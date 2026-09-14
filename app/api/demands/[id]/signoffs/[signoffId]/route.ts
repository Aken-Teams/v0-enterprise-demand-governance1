import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { prisma } from "@/lib/prisma"
import { verifyAuth, verifyRole, AuthError } from "@/lib/auth"
import { canAdminWrite } from "@/lib/demand-access"
import { DemandStatus } from "@/lib/generated/prisma/client"
import { notifyUsers, getAdminUserIds, getDemandStakeholderIds, getOrgSubsidiaryUserIds } from "@/lib/notify"
import { logAudit } from "@/lib/audit"
import { SP_PROGRESS_RATE, STATUS_MAP, PIPELINE_STEPS, spRateOf, settlementTierLabel } from "@/lib/constants/demand"
import { DEV_LINK_KIND } from "@/lib/dev-link"
import { parseClosingSpPayload } from "@/lib/closing-sp"

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/markdown",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/octet-stream", // fallback for .md etc. on Windows
])

// Extensions allowed when MIME is application/octet-stream
const ALLOWED_EXTENSIONS = new Set([
  "md", "txt", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "jpg", "jpeg", "png", "gif", "webp",
])

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// PATCH: Respond to sign-off (approve / reject), with optional file attachments
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; signoffId: string }> }
) {
  try {
    const auth = verifyAuth(request)
    const { id, signoffId } = await params

    // Parse FormData (supports both files + text fields)
    const formData = await request.formData()
    const action = formData.get("action") as string | null
    const comment = formData.get("comment") as string | null
    const files = formData.getAll("files") as File[]

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "無效的操作" }, { status: 400 })
    }

    if (action === "reject" && !comment?.trim()) {
      return NextResponse.json({ error: "退回時必須填寫原因" }, { status: 400 })
    }

    // Validate files
    const validFiles = files.filter((f) => f.size > 0)
    for (const file of validFiles) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `檔案「${file.name}」超過 10MB 限制` },
          { status: 400 }
        )
      }
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: `檔案「${file.name}」格式不支援 (${file.type})` },
          { status: 400 }
        )
      }
      // For octet-stream (e.g. .md on Windows), verify by file extension
      if (file.type === "application/octet-stream") {
        const ext = file.name.split(".").pop()?.toLowerCase() || ""
        if (!ALLOWED_EXTENSIONS.has(ext)) {
          return NextResponse.json(
            { error: `檔案「${file.name}」格式不支援 (.${ext})` },
            { status: 400 }
          )
        }
      }
    }

    const signoff = await prisma.phaseSignoff.findUnique({
      where: { id: signoffId },
      include: {
        demand: { select: { id: true, demandNumber: true, title: true, submitterId: true, organizationId: true, managerId: true, developerId: true } },
      },
    })

    if (!signoff || signoff.demandId !== id) {
      return NextResponse.json({ error: "簽核記錄不存在" }, { status: 404 })
    }

    if (signoff.status !== "PENDING") {
      return NextResponse.json({ error: "此簽核已處理" }, { status: 400 })
    }

    // 交付連結確認純粹是「簽收」：確認前看不到連結，無從判斷內容好壞，
    // 因此不提供退回——否則開發端與需求方都不知道退回後該做什麼。
    // 對交付內容有意見，請於確認並檢視後循設計變更或驗收程序反映。
    if (signoff.kind === DEV_LINK_KIND && action === "reject") {
      return NextResponse.json(
        { error: "APP 交付連結確認為簽收作業，不提供退回。如對交付內容有意見，請確認後循設計變更或驗收程序反映。" },
        { status: 400 }
      )
    }

    // 階段簽核前置條件：若有尚未通過的設計變更，須先完成設計變更審核
    if ((signoff.kind ?? "PHASE") === "PHASE") {
      const blockingDC = await prisma.designChange.findFirst({
        where: { demandId: id, status: { in: ["PENDING", "REJECTED"] } },
        select: { seq: true, status: true },
      })
      if (blockingDC) {
        return NextResponse.json(
          { error: `請先完成設計變更審核（DC-${String(blockingDC.seq).padStart(2, "0")} ${blockingDC.status === "PENDING" ? "待確認" : "已駁回"}），通過後才能進行階段簽核` },
          { status: 409 }
        )
      }
    }

    // Admin write permission check (view-only admins cannot respond to signoffs)
    if (auth.role === "admin") {
      const canWrite = await canAdminWrite(auth.userId, auth.adminScopeType, {
        id: signoff.demand.id, organizationId: signoff.demand.organizationId,
      })
      if (!canWrite) {
        return NextResponse.json({ error: "此管理員無修改權限" }, { status: 403 })
      }
    }

    // Auth check: admin bypasses; others must be the designated target user
    if (auth.role !== "admin") {
      // Block org-level accounts (read-only, cannot sign)
      const currentUser = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { isOrgAccount: true, isBoardMember: true, restrictBoardToOrg: true, organizationId: true },
      })
      if (currentUser?.isOrgAccount) {
        return NextResponse.json({ error: "組織帳號為唯讀，無法進行簽核操作" }, { status: 403 })
      }

      // Board member org scope check: restricted board members can only sign their own org's demands
      if (currentUser?.isBoardMember && currentUser.restrictBoardToOrg) {
        const demand = await prisma.demand.findUnique({ where: { id }, select: { organizationId: true } })
        if (demand?.organizationId !== currentUser.organizationId) {
          return NextResponse.json({ error: "您僅能審核自己組織的專案" }, { status: 403 })
        }
      }

      if (signoff.targetUserId) {
        // New multi-signer: only the designated target can respond
        if (auth.userId !== signoff.targetUserId) {
          return NextResponse.json({ error: "此簽核指定由其他人員處理" }, { status: 403 })
        }
        // BOARD_OVERRIDE can only be handled by board members or admin/delivery
        if (signoff.targetRole === "BOARD_OVERRIDE" && auth.role === "subsidiary") {
          if (!currentUser?.isBoardMember) {
            return NextResponse.json({ error: "代簽僅限 Scrum Master 操作" }, { status: 403 })
          }
        }
      } else {
        // Legacy signoff (no targetUserId): fall back to role-based check
        const phase = signoff.phase as string

        if (phase === "SP_REVIEW") {
          if (!currentUser?.isBoardMember) {
            return NextResponse.json({ error: "您無權進行此簽核操作（需為 Scrum Master）" }, { status: 403 })
          }
        } else {
          const access = await prisma.demandAccess.findUnique({
            where: { demandId_userId: { demandId: id, userId: auth.userId } },
            select: { signoffRole: true },
          })
          const userRole = access?.signoffRole
          if (userRole !== "REQUESTER" && userRole !== "MANAGER") {
            return NextResponse.json({ error: "您無權進行此簽核操作（需為需求窗口或需求主管）" }, { status: 403 })
          }
        }
      }
    }

    const updated = await prisma.phaseSignoff.update({
      where: { id: signoffId },
      data: {
        status: action === "approve" ? "APPROVED" : "REJECTED",
        comment: comment?.trim() || null,
        respondedAt: new Date(),
        respondedById: auth.userId,
      },
      include: {
        requestedBy: { select: { id: true, name: true } },
        respondedBy: { select: { id: true, name: true } },
      },
    })

    // When a signer rejects, auto-skip other PENDING signoffs in the same round
    // (same phase + kind + requestedAt within 5 seconds = same round)
    if (action === "reject") {
      const roundTime = signoff.requestedAt.getTime()
      await prisma.phaseSignoff.updateMany({
        where: {
          demandId: id,
          phase: signoff.phase as DemandStatus,
          kind: signoff.kind,
          status: "PENDING",
          id: { not: signoffId },
          requestedAt: {
            gte: new Date(roundTime - 5000),
            lte: new Date(roundTime + 5000),
          },
        },
        data: {
          status: "SKIPPED",
          comment: "同輪次已有審核人退回，自動略過",
          respondedAt: new Date(),
        },
      })
    }

    // When a BOARD_OVERRIDE signoff is approved, auto-skip all other PENDING in same round
    if (action === "approve" && signoff.targetRole === "BOARD_OVERRIDE") {
      const roundTime = signoff.requestedAt.getTime()
      await prisma.phaseSignoff.updateMany({
        where: {
          demandId: id,
          phase: signoff.phase as DemandStatus,
          kind: signoff.kind,
          status: "PENDING",
          id: { not: signoffId },
          requestedAt: {
            gte: new Date(roundTime - 5000),
            lte: new Date(roundTime + 5000),
          },
        },
        data: {
          status: "SKIPPED",
          comment: "Scrum Master 代簽，自動略過",
          respondedAt: new Date(),
          respondedById: auth.userId,
        },
      })
    }

    // When an approved BOARD_OVERRIDE carries a settlement target, transition the demand
    // directly to that status (一步結案 / 指定結算狀態) so it doesn't hang in an intermediate phase.
    if (action === "approve" && signoff.targetRole === "BOARD_OVERRIDE" && signoff.overrideTargetStatus) {
      const settlementTier = signoff.overrideTargetStatus as DemandStatus
      const dem = await prisma.demand.findUnique({
        where: { id },
        select: { status: true, heldFromStatus: true, confirmedSp: true, estimatedSp: true, organizationId: true, vendor: true, demandNumber: true, title: true, devLinkConfirmedAt: true },
      })
      if (dem && dem.status !== "CLOSED") {
        const now = new Date()
        // 暫緩／駁回時，結算基準為暫緩前的階段（heldFromStatus），而非 ON_HOLD 本身
        const fromStatus = ((dem.status === "ON_HOLD" || dem.status === "REJECTED")
          ? (dem.heldFromStatus || dem.status)
          : dem.status) as DemandStatus
        const effectiveSp = dem.confirmedSp ?? dem.estimatedSp
        const settlementRate = SP_PROGRESS_RATE[settlementTier] ?? 0
        const settledSp = Math.round(effectiveSp * settlementRate)
        const oldRate = spRateOf(fromStatus, !!dem.devLinkConfirmedAt)
        const oldUsed = Math.round(effectiveSp * oldRate)
        const delta = settledSp - oldUsed
        const year = now.getFullYear()
        const tierLabel = settlementTierLabel(settlementTier)

        await prisma.$transaction(async (tx) => {
          await tx.demand.update({
            where: { id },
            data: {
              status: "CLOSED",
              completedDate: now,
              confirmedSp: settledSp,
              isTerminated: true, // 代簽直接結案 → 客戶認知為「已終止」
            },
          })
          await tx.demandStatusHistory.create({
            data: {
              demandId: id,
              fromStatus,
              toStatus: "CLOSED",
              comment: JSON.stringify({
                type: "SP_ADJUSTMENT",
                oldSp: effectiveSp,
                newSp: settledSp,
                reason: `Scrum Master 代簽結算（依${tierLabel}比例 ${Math.round(settlementRate * 100)}%）`,
              }),
              changedBy: auth.userId,
            },
          })
          // Close current phase plan
          const fromIdx = PIPELINE_STEPS.indexOf(fromStatus as typeof PIPELINE_STEPS[number])
          if (fromIdx >= 0) {
            await tx.demandPhasePlan.upsert({
              where: { demandId_phase: { demandId: id, phase: fromStatus } },
              create: { demandId: id, phase: fromStatus, actualEnd: now },
              update: { actualEnd: now },
            })
          }
          // Skip all remaining PENDING signoffs for this demand
          await tx.phaseSignoff.updateMany({
            where: { demandId: id, status: "PENDING" },
            data: {
              status: "SKIPPED",
              comment: "Scrum Master 代簽結案，自動略過",
              respondedAt: now,
              respondedById: auth.userId,
            },
          })
          // SP wallet delta
          if (delta !== 0) {
            await tx.spWallet.upsert({
              where: { organizationId_year_vendor: { organizationId: dem.organizationId, year, vendor: dem.vendor } },
              create: { organizationId: dem.organizationId, year, vendor: dem.vendor, totalQuota: 0, usedSp: Math.max(0, delta), committedSp: 0 },
              update: { usedSp: { increment: delta } },
            })
          }
        })

        // Notify stakeholders
        const fromLabel = STATUS_MAP[fromStatus]?.label ?? fromStatus
        Promise.all([getDemandStakeholderIds(id), getOrgSubsidiaryUserIds(dem.organizationId)]).then(([sIds, oIds]) => {
          const recipients = [...new Set([...sIds, ...oIds])].filter(uid => uid !== auth.userId)
          notifyUsers(recipients, {
            type: "DEMAND_STATUS",
            title: "需求結案",
            message: `需求 ${dem.demandNumber}「${dem.title}」經 Scrum Master 代簽結算，已從「${fromLabel}」直接結案（依${tierLabel}比例結算 ${settledSp} SP）。`,
            linkUrl: `/demands/${id}`,
          })
        })
        logAudit({
          userId: auth.userId,
          action: "STATUS_CHANGE",
          entity: "DEMAND",
          entityId: id,
          demandId: id,
          details: { fromStatus, toStatus: "CLOSED", settlementTier, settlementRate, effectiveSp, settledSp, via: "BOARD_OVERRIDE_SETTLEMENT" },
          request,
        })
      }
    }

    // When a non-override signoff is approved, check if all non-override signoffs
    // in the round are now approved — if so, auto-skip pending BOARD_OVERRIDE signoffs
    if (action === "approve" && signoff.targetRole !== "BOARD_OVERRIDE") {
      const roundTime = signoff.requestedAt.getTime()
      const sameRoundNonOverride = await prisma.phaseSignoff.findMany({
        where: {
          demandId: id,
          phase: signoff.phase as DemandStatus,
          kind: signoff.kind,
          targetRole: { not: "BOARD_OVERRIDE" },
          requestedAt: {
            gte: new Date(roundTime - 5000),
            lte: new Date(roundTime + 5000),
          },
        },
      })
      if (sameRoundNonOverride.every(s => s.status === "APPROVED")) {
        await prisma.phaseSignoff.updateMany({
          where: {
            demandId: id,
            phase: signoff.phase as DemandStatus,
            kind: signoff.kind,
            targetRole: "BOARD_OVERRIDE",
            status: "PENDING",
          },
          data: {
            status: "SKIPPED",
            comment: "所有審核人已確認，代簽自動略過",
            respondedAt: new Date(),
          },
        })
      }
    }

    // ── 結案 SP 調整 (kind = CLOSING_SP) ──
    // Scrum Master 全數同意後才實際套用 SP 並結案；任一人退回則需求維持原狀態，
    // 由管理者修正後重新發起（見 app/api/demands/[id]/closing-sp/route.ts）。
    if (signoff.kind === "CLOSING_SP") {
      if (action === "approve") {
        const roundTime = signoff.requestedAt.getTime()
        const round = await prisma.phaseSignoff.findMany({
          where: {
            demandId: id,
            kind: "CLOSING_SP",
            requestedAt: { gte: new Date(roundTime - 5000), lte: new Date(roundTime + 5000) },
          },
          select: { status: true },
        })
        const payload = parseClosingSpPayload(signoff.payload)

        if (payload && round.every((s) => s.status === "APPROVED")) {
          const dem = await prisma.demand.findUnique({
            where: { id },
            select: {
              status: true, confirmedSp: true, estimatedSp: true, organizationId: true,
              vendor: true, demandNumber: true, title: true, devLinkConfirmedAt: true,
            },
          })

          if (dem && dem.status !== "CLOSED") {
            const now = new Date()
            const fromStatus = dem.status
            const oldSp = dem.confirmedSp ?? dem.estimatedSp
            const newSp = payload.newSp
            const year = now.getFullYear()

            // 結案為 100% 消耗；差額 = 新結算值 - 目前階段已認列值
            const oldUsed = Math.round(oldSp * spRateOf(fromStatus, !!dem.devLinkConfirmedAt))
            const newUsed = Math.round(newSp * (SP_PROGRESS_RATE.CLOSED ?? 1))
            const delta = newUsed - oldUsed

            await prisma.$transaction(async (tx) => {
              await tx.demand.update({
                where: { id },
                data: {
                  status: "CLOSED",
                  confirmedSp: newSp,
                  ...(payload.completedDate ? { completedDate: new Date(payload.completedDate) } : {}),
                },
              })

              const existingPlans = await tx.demandPhasePlan.findMany({
                where: { demandId: id },
                select: { phase: true, plannedSp: true, originalPlannedSp: true },
              })
              const existingMap = Object.fromEntries(existingPlans.map((p) => [p.phase, p]))

              await tx.demandStatusHistory.create({
                data: {
                  demandId: id,
                  fromStatus,
                  toStatus: "CLOSED",
                  comment: JSON.stringify({
                    type: "SP_ADJUSTMENT",
                    oldSp,
                    newSp,
                    reason: payload.reason,
                    designChangeIds: payload.designChangeIds,
                    boardApproved: true,
                    originalPhaseAllocations: Object.fromEntries(
                      existingPlans.filter((p) => p.plannedSp != null).map((p) => [p.phase, p.plannedSp])
                    ),
                    phaseAllocations: payload.phaseAllocations,
                  }),
                  changedBy: auth.userId,
                },
              })

              // 各階段 SP 重新分配（保留調整前的原始分配供對照）
              if (payload.phaseAllocations) {
                for (const step of PIPELINE_STEPS) {
                  if (step === "CLOSED") continue
                  const plannedSp = payload.phaseAllocations[step] ?? 0
                  const existing = existingMap[step]
                  const originalSp = existing?.originalPlannedSp ?? existing?.plannedSp ?? null
                  await tx.demandPhasePlan.upsert({
                    where: { demandId_phase: { demandId: id, phase: step as DemandStatus } },
                    create: { demandId: id, phase: step as DemandStatus, plannedSp, originalPlannedSp: originalSp },
                    update: {
                      plannedSp,
                      ...(existing?.originalPlannedSp == null ? { originalPlannedSp: existing?.plannedSp ?? null } : {}),
                    },
                  })
                }
              }

              // 收尾目前階段、開啟結案階段的實際時間
              if (PIPELINE_STEPS.indexOf(fromStatus as typeof PIPELINE_STEPS[number]) >= 0) {
                await tx.demandPhasePlan.upsert({
                  where: { demandId_phase: { demandId: id, phase: fromStatus } },
                  create: { demandId: id, phase: fromStatus, actualEnd: now },
                  update: { actualEnd: now },
                })
              }
              await tx.demandPhasePlan.upsert({
                where: { demandId_phase: { demandId: id, phase: "CLOSED" } },
                create: { demandId: id, phase: "CLOSED", actualStart: now },
                update: { actualStart: now },
              })

              if (delta !== 0) {
                await tx.spWallet.upsert({
                  where: { organizationId_year_vendor: { organizationId: dem.organizationId, year, vendor: dem.vendor } },
                  create: {
                    organizationId: dem.organizationId, year, vendor: dem.vendor,
                    totalQuota: 0, usedSp: Math.max(0, delta), committedSp: 0,
                  },
                  update: { usedSp: { increment: delta } },
                })
              }

              // 需求已結案，殘留的階段待簽核不再有意義，一併標記略過避免永遠掛著
              await tx.phaseSignoff.updateMany({
                where: { demandId: id, status: "PENDING", id: { not: signoffId } },
                data: {
                  status: "SKIPPED",
                  comment: "需求已結案（結案 SP 調整經 Scrum Master 核准），自動略過",
                  respondedAt: now,
                  respondedById: auth.userId,
                },
              })
            })

            const fromLabel = STATUS_MAP[fromStatus]?.label ?? fromStatus
            Promise.all([getDemandStakeholderIds(id), getOrgSubsidiaryUserIds(dem.organizationId)]).then(([sIds, oIds]) => {
              const recipients = [...new Set([...sIds, ...oIds])].filter((uid) => uid !== auth.userId)
              notifyUsers(recipients, {
                type: "DEMAND_STATUS",
                title: "需求結案",
                message: `需求 ${dem.demandNumber}「${dem.title}」的結案 SP 調整（${oldSp} → ${newSp}）已經 Scrum Master 同意，已從「${fromLabel}」結案。`,
                linkUrl: `/demands/${id}`,
              })
            })
            logAudit({
              userId: auth.userId,
              action: "STATUS_CHANGE",
              entity: "DEMAND",
              entityId: id,
              demandId: id,
              details: {
                fromStatus, toStatus: "CLOSED", oldSp, newSp,
                designChangeIds: payload.designChangeIds, via: "CLOSING_SP_BOARD_APPROVAL",
              },
              request,
            })
          }
        }
      } else {
        // 退回：需求不結案，通知發起者修正後重送
        const requesterId = signoff.requestedById
        if (requesterId !== auth.userId) {
          notifyUsers([requesterId], {
            type: "SIGNOFF",
            title: "結案 SP 調整已退回",
            message: `需求 ${signoff.demand.demandNumber}「${signoff.demand.title}」的結案 SP 調整遭 Scrum Master 退回${comment ? `：${comment.trim()}` : ""}，需求維持原狀態。`,
            linkUrl: `/demands/${id}`,
          })
        }
      }
    }

    // ── 開發中 APP 交付連結確認 (kind = DEV_LINK) ──
    // 需求方全數確認後，連結對其開放，同時提前認列 25%（開發中 50% → 75%）。
    // 之後推進到驗收中時比例同為 75%、增量為 0，故不會重複計費。
    if (signoff.kind === DEV_LINK_KIND && action === "approve") {
      const roundTime = signoff.requestedAt.getTime()
      const round = await prisma.phaseSignoff.findMany({
        where: {
          demandId: id,
          kind: DEV_LINK_KIND,
          requestedAt: { gte: new Date(roundTime - 5000), lte: new Date(roundTime + 5000) },
        },
        select: { status: true },
      })

      if (round.every((sg) => sg.status === "APPROVED")) {
        const dem = await prisma.demand.findUnique({
          where: { id },
          select: {
            status: true, confirmedSp: true, estimatedSp: true, organizationId: true,
            vendor: true, demandNumber: true, title: true, devLinkConfirmedAt: true,
          },
        })

        // 已確認過就不再計費；已離開開發中者比例本就 ≥ 75%，補記時間即可
        if (dem && !dem.devLinkConfirmedAt) {
          const now = new Date()
          const effectiveSp = dem.confirmedSp ?? dem.estimatedSp
          const oldUsed = Math.round(effectiveSp * spRateOf(dem.status, false))
          const newUsed = Math.round(effectiveSp * spRateOf(dem.status, true))
          const delta = newUsed - oldUsed
          const year = now.getFullYear()

          await prisma.$transaction(async (tx) => {
            await tx.demand.update({
              where: { id },
              data: { devLinkConfirmedAt: now, devLinkConfirmedById: auth.userId },
            })
            if (delta !== 0) {
              await tx.spWallet.upsert({
                where: { organizationId_year_vendor: { organizationId: dem.organizationId, year, vendor: dem.vendor } },
                create: {
                  organizationId: dem.organizationId, year, vendor: dem.vendor,
                  totalQuota: 0, usedSp: Math.max(0, delta), committedSp: 0,
                },
                update: { usedSp: { increment: delta } },
              })
            }
          })

          Promise.all([getDemandStakeholderIds(id), getOrgSubsidiaryUserIds(dem.organizationId)]).then(([sIds, oIds]) => {
            const recipients = [...new Set([...sIds, ...oIds])].filter((uid) => uid !== auth.userId)
            notifyUsers(recipients, {
              type: "DEMAND_STATUS",
              title: "首次 APP 交付已確認",
              message: `需求 ${dem.demandNumber}「${dem.title}」的首次 APP 交付已由需求方確認收到，SP 認列調整為 75%。後續更新連結不需再確認。`,
              linkUrl: `/demands/${id}`,
            })
          })
          logAudit({
            userId: auth.userId,
            action: "UPDATE",
            entity: "DEMAND",
            entityId: id,
            demandId: id,
            details: { devLinkConfirmed: true, effectiveSp, deltaSp: delta, via: "DEV_LINK_CONFIRMATION" },
            request,
          })
        } else if (dem) {
          await prisma.demand.update({
            where: { id },
            data: { devLinkConfirmedAt: dem.devLinkConfirmedAt ?? new Date(), devLinkConfirmedById: auth.userId },
          })
        }
      }
    }

    // Save attached files (if any)
    if (validFiles.length > 0) {
      const uploadDir = path.join(process.cwd(), "uploads", "demands", id)
      await mkdir(uploadDir, { recursive: true })

      for (const file of validFiles) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const safeFileName = `${Date.now()}-${file.name.replace(
          /[^a-zA-Z0-9._\-\u4e00-\u9fff]/g,
          "_"
        )}`
        const filePath = path.join(uploadDir, safeFileName)
        await writeFile(filePath, buffer)

        await prisma.demandDocument.create({
          data: {
            demandId: id,
            type: "ATTACHMENT",
            phase: signoff.phase as DemandStatus,
            fileName: file.name,
            fileUrl: `/api/uploads/demands/${id}/${safeFileName}`,
            fileSize: file.size,
            uploadedBy: auth.userId,
            signoffId: updated.id,
          },
        })
      }
    }

    // Fire-and-forget: notify admin + manager + developer about signoff result + audit
    const actionLabel = action === "approve" ? "已確認" : "已退回"
    getAdminUserIds().then((adminIds) => {
      const targetIds = [
        ...adminIds,
        signoff.demand.managerId,
        signoff.demand.developerId,
      ].filter((uid): uid is string => uid !== null && uid !== auth.userId)
      const recipients = [...new Set(targetIds)]
      notifyUsers(recipients, {
        type: "SIGNOFF",
        title: `簽核${actionLabel}`,
        message: `需求 ${signoff.demand.demandNumber}「${signoff.demand.title}」的簽核已${actionLabel}。`,
        linkUrl: `/demands/${id}`,
      })
    })
    logAudit({
      userId: auth.userId,
      action: action === "approve" ? "SIGNOFF_APPROVE" : "SIGNOFF_REJECT",
      entity: "SIGNOFF",
      entityId: signoffId,
      demandId: id,
      details: { phase: signoff.phase, action },
      request,
    })

    return NextResponse.json({ signoff: updated })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Update signoff error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// PUT: Update requestComment (admin/delivery) or comment (subsidiary)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; signoffId: string }> }
) {
  try {
    const auth = verifyAuth(request)
    const { id, signoffId } = await params
    const body = await request.json()

    const signoff = await prisma.phaseSignoff.findUnique({
      where: { id: signoffId },
      select: { id: true, demandId: true, requestedById: true, demand: { select: { submitterId: true, organizationId: true } } },
    })

    if (!signoff || signoff.demandId !== id) {
      return NextResponse.json({ error: "簽核記錄不存在" }, { status: 404 })
    }

    // Determine which field is being updated based on role
    if ("requestComment" in body) {
      // Only admin/delivery can edit requestComment (提出說明)
      if (auth.role !== "admin" && auth.role !== "delivery") {
        return NextResponse.json({ error: "權限不足" }, { status: 403 })
      }
      // Admin write permission check
      if (auth.role === "admin") {
        const canWrite = await canAdminWrite(auth.userId, auth.adminScopeType, {
          id, organizationId: signoff.demand.organizationId,
        })
        if (!canWrite) {
          return NextResponse.json({ error: "此管理員無修改權限" }, { status: 403 })
        }
      }
      const updated = await prisma.phaseSignoff.update({
        where: { id: signoffId },
        data: { requestComment: body.requestComment?.trim() || null },
      })
      return NextResponse.json({ success: true, requestComment: updated.requestComment })
    }

    if ("comment" in body) {
      // Only subsidiary can edit comment (審核回應)
      if (auth.role !== "subsidiary") {
        return NextResponse.json({ error: "權限不足" }, { status: 403 })
      }
      // Verify subsidiary belongs to same org
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { organizationId: true },
      })
      if (auth.userId !== signoff.demand.submitterId && user?.organizationId !== signoff.demand.organizationId) {
        return NextResponse.json({ error: "您無權修改此審核回應" }, { status: 403 })
      }
      const updated = await prisma.phaseSignoff.update({
        where: { id: signoffId },
        data: { comment: body.comment?.trim() || null },
      })
      return NextResponse.json({ success: true, comment: updated.comment })
    }

    return NextResponse.json({ error: "缺少更新欄位" }, { status: 400 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Update signoff field error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

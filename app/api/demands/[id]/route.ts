import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth, verifyRole, verifyAdminFull, AuthError } from "@/lib/auth"
import { canAccessDemand, canAdminWrite } from "@/lib/demand-access"
import { DemandStatus } from "@/lib/generated/prisma/client"
import { PIPELINE_STEPS, SIGNOFF_REQUIRED_PHASES, STATUS_MAP, SP_PROGRESS_RATE } from "@/lib/constants/demand"
import { updateDemandSchema } from "@/lib/validations/demand"
import { notifyUsers, getDemandStakeholderIds, getOrgSubsidiaryUserIds } from "@/lib/notify"
import { logAudit } from "@/lib/audit"

const VALID_STATUSES = new Set<string>(Object.values(DemandStatus))

// GET: Get demand detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyAuth(request)
    const { id } = await params

    const demand = await prisma.demand.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true } },
        submitter: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
        developer: { select: { id: true, name: true } },
        contactPerson_: { select: { id: true, name: true } },
        demandManager: { select: { id: true, name: true } },
        accessGrants: {
          select: { userId: true, signoffRole: true, user: { select: { id: true, name: true } } },
        },
        documents: {
          orderBy: { createdAt: "desc" },
        },
        comments: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        statusHistory: {
          orderBy: { createdAt: "desc" },
        },
        phasePlans: {
          include: {
            engineer: { select: { id: true, name: true } },
            pm: { select: { id: true, name: true } },
          },
        },
        subTasks: {
          include: {
            assignee: { select: { id: true, name: true } },
          },
          orderBy: { order: "asc" },
        },
        phaseSignoffs: {
          include: {
            requestedBy: { select: { id: true, name: true } },
            respondedBy: { select: { id: true, name: true } },
            targetUser: { select: { id: true, name: true, email: true } },
            documents: { select: { id: true, fileName: true, fileUrl: true, fileSize: true } },
          },
          orderBy: { requestedAt: "desc" },
        },
      },
    })

    if (!demand) {
      return NextResponse.json({ error: "需求不存在" }, { status: 404 })
    }

    // Access control: check if user can view this demand
    const hasAccess = await canAccessDemand(auth, {
      id: demand.id,
      organizationId: demand.organizationId,
      developerId: demand.developerId,
    })
    if (!hasAccess) {
      return NextResponse.json({ error: "無權限查看此需求" }, { status: 403 })
    }

    // Include current user's signoff role for this demand (for UI gating)
    let mySignoffRole: string | null = null
    if (auth.role !== "admin") {
      // Check demand-specific DemandAccess first
      const access = await prisma.demandAccess.findUnique({
        where: { demandId_userId: { demandId: id, userId: auth.userId } },
        select: { signoffRole: true },
      })
      mySignoffRole = access?.signoffRole ?? null

      // Board members always get BOARD role for SP_REVIEW phases
      if (!mySignoffRole) {
        const currentUser = await prisma.user.findUnique({
          where: { id: auth.userId },
          select: { isBoardMember: true },
        })
        if (currentUser?.isBoardMember) {
          mySignoffRole = "BOARD"
        }
      }
    }

    // Self-healing: if demand is in a signoff-required phase, ensure all required
    // targets have PENDING signoffs. Handles demands advanced before auto-create was
    // deployed, and board members added after the demand entered SP_REVIEW.
    const signoffPhases = SIGNOFF_REQUIRED_PHASES as readonly string[]
    if (signoffPhases.includes(demand.status)) {
      const phase = demand.status as DemandStatus
      // Only consider PHASE signoffs for self-healing (exclude DESIGN_CHANGE)
      const currentPhaseSignoffs = demand.phaseSignoffs.filter(
        (s) => s.phase === demand.status && (s.kind ?? "PHASE") === "PHASE"
      )

      // Determine if the phase is actively waiting (has PENDING or has no signoffs at all)
      const hasPending = currentPhaseSignoffs.some((s) => s.status === "PENDING")
      const noSignoffs = currentPhaseSignoffs.length === 0

      if (hasPending || noSignoffs) {
        // Determine required targets for this phase
        type Target = { userId: string; role: string }
        const requiredTargets: Target[] = []
        if (phase === "PRD_REVIEW" || phase === "ACCEPTANCE") {
          if (demand.contactPersonId) requiredTargets.push({ userId: demand.contactPersonId, role: "REQUESTER" })
          if (demand.demandManagerId) requiredTargets.push({ userId: demand.demandManagerId, role: "MANAGER" })
        } else if (phase === "SP_REVIEW") {
          // Board members: filter by restrictBoardToOrg
          const boardMembers = await prisma.user.findMany({
            where: { isBoardMember: true, isActive: true, boardExemptFromSignoff: false },
            select: { id: true, restrictBoardToOrg: true, organizationId: true },
          })
          for (const u of boardMembers) {
            if (u.restrictBoardToOrg && u.organizationId !== demand.organizationId) continue
            requiredTargets.push({ userId: u.id, role: "BOARD" })
          }
        }

        // Find latest round timestamp
        const latestTime = currentPhaseSignoffs.length > 0
          ? Math.max(...currentPhaseSignoffs.map((s) => new Date(s.requestedAt).getTime()))
          : 0

        // Create missing signoffs
        const roundTime = latestTime > 0 ? new Date(latestTime) : new Date()
        const requestedById = demand.managerId || demand.creatorId || auth.userId
        let needRefetch = false

        for (const t of requiredTargets) {
          const exists = currentPhaseSignoffs.some((s) => s.targetUserId === t.userId)
          if (!exists) {
            await prisma.phaseSignoff.create({
              data: {
                demandId: id,
                phase,
                status: "PENDING",
                requestedById,
                targetUserId: t.userId,
                targetRole: t.role,
                requestedAt: roundTime,
              },
            })
            needRefetch = true
          }
        }

        // Re-fetch phaseSignoffs if we created any
        if (needRefetch) {
          const refreshed = await prisma.phaseSignoff.findMany({
            where: { demandId: id },
            include: {
              requestedBy: { select: { id: true, name: true } },
              respondedBy: { select: { id: true, name: true } },
              targetUser: { select: { id: true, name: true, email: true } },
              documents: { select: { id: true, fileName: true, fileUrl: true, fileSize: true } },
            },
            orderBy: { requestedAt: "desc" },
          })
          ;(demand as Record<string, unknown>).phaseSignoffs = refreshed

          // Re-check mySignoffRole: board members get BOARD role for SP_REVIEW
          if (!mySignoffRole && auth.role !== "admin") {
            const currentUser = await prisma.user.findUnique({
              where: { id: auth.userId },
              select: { isBoardMember: true },
            })
            if (currentUser?.isBoardMember) {
              mySignoffRole = "BOARD"
            }
          }
        }
      }
    }

    // Restructure: rename contactPerson_ → contactPerson, extract accessUsers
    const { contactPerson_: contactPersonUser, accessGrants, ...demandRest } = demand as typeof demand & { contactPerson_: { id: string; name: string } | null }
    const accessUsers = (accessGrants ?? []).map((g: { userId: string; signoffRole: string; user: { id: string; name: string } }) => ({
      id: g.user.id,
      name: g.user.name,
      signoffRole: g.signoffRole,
    }))

    // For limited admins, check write permission for this demand
    let adminCanWrite = true
    if (auth.role === "admin" && auth.adminScopeType && auth.adminScopeType !== "all") {
      adminCanWrite = await canAdminWrite(auth.userId, auth.adminScopeType, {
        id: demand.id,
        organizationId: demand.organizationId,
      })
    }

    return NextResponse.json({
      demand: { ...demandRest, contactPerson: contactPersonUser },
      mySignoffRole,
      accessUsers,
      adminCanWrite,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Get demand detail error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// PATCH: Update demand status or assignments
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const { id } = await params
    const body = await request.json()

    const demand = await prisma.demand.findUnique({ where: { id } })
    if (!demand) {
      return NextResponse.json({ error: "需求不存在" }, { status: 404 })
    }

    // Admin write permission check (non-"all" admins need "edit" permission)
    if (auth.role === "admin") {
      const canWrite = await canAdminWrite(auth.userId, auth.adminScopeType, {
        id: demand.id,
        organizationId: demand.organizationId,
      })
      if (!canWrite) {
        return NextResponse.json({ error: "此管理員無修改權限" }, { status: 403 })
      }
    }

    // Handle assignment update (managerId / developerId) — admin only
    if (body.managerId !== undefined || body.developerId !== undefined) {
      if (auth.role !== "admin") {
        return NextResponse.json({ error: "僅管理者可指派人員" }, { status: 403 })
      }
      const data: Record<string, string | null> = {}
      if (body.managerId !== undefined) data.managerId = body.managerId || null
      if (body.developerId !== undefined) data.developerId = body.developerId || null

      const updated = await prisma.demand.update({
        where: { id },
        data,
        include: {
          manager: { select: { id: true, name: true } },
          developer: { select: { id: true, name: true } },
        },
      })

      // Notify newly assigned users
      const assignedIds: string[] = []
      if (body.managerId && body.managerId !== demand.managerId) assignedIds.push(body.managerId)
      if (body.developerId && body.developerId !== demand.developerId) assignedIds.push(body.developerId)
      const notifyIds = [...new Set(assignedIds)].filter(uid => uid !== auth.userId)
      if (notifyIds.length > 0) {
        notifyUsers(notifyIds, {
          type: "ASSIGNMENT",
          title: "您已被指派需求",
          message: `您已被指派至需求 ${demand.demandNumber}「${demand.title}」。`,
          linkUrl: `/demands/${id}`,
        })
      }
      logAudit({
        userId: auth.userId,
        action: "ASSIGN",
        entity: "DEMAND",
        entityId: id,
        demandId: id,
        details: { managerId: body.managerId, developerId: body.developerId },
        request,
      })

      return NextResponse.json({
        demand: {
          id: updated.id,
          managerId: updated.managerId,
          developerId: updated.developerId,
          manager: updated.manager,
          developer: updated.developer,
        },
      })
    }

    // Handle contactPersonId / demandManagerId update — admin only
    if (body.contactPersonId !== undefined || body.demandManagerId !== undefined) {
      if (auth.role !== "admin") {
        return NextResponse.json({ error: "僅管理者可編輯" }, { status: 403 })
      }

      // Read current values before update so we can re-target pending signoffs
      const current = await prisma.demand.findUnique({
        where: { id },
        select: { contactPersonId: true, demandManagerId: true },
      })

      const data: Record<string, string | null> = {}
      if (body.contactPersonId !== undefined) data.contactPersonId = body.contactPersonId || null
      if (body.demandManagerId !== undefined) data.demandManagerId = body.demandManagerId || null
      await prisma.demand.update({ where: { id }, data })

      // Re-target pending signoffs when contact person or manager changes
      if (current) {
        if (body.contactPersonId !== undefined && body.contactPersonId !== current.contactPersonId) {
          await prisma.phaseSignoff.updateMany({
            where: {
              demandId: id,
              status: "PENDING",
              targetRole: "REQUESTER",
              targetUserId: current.contactPersonId,
            },
            data: { targetUserId: body.contactPersonId || null },
          })
        }
        if (body.demandManagerId !== undefined && body.demandManagerId !== current.demandManagerId) {
          await prisma.phaseSignoff.updateMany({
            where: {
              demandId: id,
              status: "PENDING",
              targetRole: "MANAGER",
              targetUserId: current.demandManagerId,
            },
            data: { targetUserId: body.demandManagerId || null },
          })
        }
      }

      return NextResponse.json({ success: true })
    }

    // Handle field editing (title, description, etc.) — admin only
    if (body.title !== undefined) {
      if (auth.role !== "admin") {
        return NextResponse.json({ error: "僅管理者可編輯需求" }, { status: 403 })
      }
      const parseResult = updateDemandSchema.safeParse(body)
      if (!parseResult.success) {
        return NextResponse.json(
          { error: "驗證失敗", details: parseResult.error.flatten().fieldErrors },
          { status: 400 }
        )
      }
      const data = parseResult.data
      const updateData: Record<string, unknown> = {
        title: data.title,
        description: data.description,
        painPoint: data.painPoint || null,
        expectedBenefit: data.expectedBenefit || null,
        estimatedSp: data.estimatedSp,
        desiredDate: data.desiredDate,
        adminNotes: data.adminNotes || null,
      }
      if (data.organizationId) updateData.organizationId = data.organizationId
      if (data.submitterId) updateData.submitterId = data.submitterId
      if (data.vendor) updateData.vendor = data.vendor
      const updated = await prisma.demand.update({
        where: { id },
        data: updateData,
      })
      logAudit({
        userId: auth.userId,
        action: "UPDATE",
        entity: "DEMAND",
        entityId: id,
        demandId: id,
        details: { fields: Object.keys(updateData) },
        request,
      })
      return NextResponse.json({ demand: { id: updated.id } })
    }

    // Handle completedDate-only update (admin only)
    if (!body.status && body.completedDate !== undefined) {
      if (auth.role !== "admin") {
        return NextResponse.json({ error: "僅管理者可修改結案日期" }, { status: 403 })
      }
      const updated = await prisma.demand.update({
        where: { id },
        data: { completedDate: body.completedDate ? new Date(body.completedDate) : null },
      })
      return NextResponse.json({ demand: { id: updated.id } })
    }

    // Handle ON_HOLD: save holdReason and record previous status
    if (body.status === "ON_HOLD") {
      if (demand.status === "ON_HOLD") {
        return NextResponse.json({ error: "此需求已是暫緩狀態" }, { status: 400 })
      }
      if (demand.status === "CLOSED" || demand.status === "REJECTED") {
        return NextResponse.json({ error: "已結案或已駁回的需求無法暫緩" }, { status: 400 })
      }
      const holdReason = body.holdReason || null

      const updated = await prisma.$transaction(async (tx) => {
        const d = await tx.demand.update({
          where: { id },
          data: {
            status: "ON_HOLD",
            holdReason,
            heldFromStatus: demand.status,
          },
        })
        await tx.demandStatusHistory.create({
          data: {
            demandId: id,
            fromStatus: demand.status,
            toStatus: "ON_HOLD",
            comment: holdReason || "設為暫緩",
            changedBy: auth.userId,
          },
        })
        return d
      })

      // Notification
      const fromLabel = STATUS_MAP[demand.status]?.label ?? demand.status
      const stakeholderIds = getDemandStakeholderIds(id)
      const orgUserIds = getOrgSubsidiaryUserIds(demand.organizationId)
      Promise.all([stakeholderIds, orgUserIds]).then(([sIds, oIds]) => {
        const recipients = [...new Set([...sIds, ...oIds])].filter(uid => uid !== auth.userId)
        notifyUsers(recipients, {
          type: "DEMAND_STATUS",
          title: "需求已暫緩",
          message: `需求 ${demand.demandNumber}「${demand.title}」已從「${fromLabel}」設為暫緩。${holdReason ? `原因：${holdReason}` : ""}`,
          linkUrl: `/demands/${id}`,
        })
      })
      logAudit({
        userId: auth.userId,
        action: "STATUS_CHANGE",
        entity: "DEMAND",
        entityId: id,
        demandId: id,
        details: { fromStatus: demand.status, toStatus: "ON_HOLD", holdReason },
        request,
      })

      return NextResponse.json({ demand: { id: updated.id, status: updated.status } })
    }

    // Handle resume from ON_HOLD: restore to previous status
    if (demand.status === "ON_HOLD" && (body.resume === true || (body.status && body.status !== "ON_HOLD"))) {
      // Look up the status before ON_HOLD from history
      const prevHistory = await prisma.demandStatusHistory.findFirst({
        where: { demandId: id, toStatus: "ON_HOLD" },
        orderBy: { createdAt: "desc" },
        select: { fromStatus: true },
      })
      let targetStatus = prevHistory?.fromStatus || "SUBMITTED"
      // Allow explicit override if a valid status is provided
      if (body.status && VALID_STATUSES.has(body.status) && body.status !== "ON_HOLD") {
        targetStatus = body.status as string
      }

      const updated = await prisma.$transaction(async (tx) => {
        const d = await tx.demand.update({
          where: { id },
          data: {
            status: targetStatus as DemandStatus,
            holdReason: null,
            heldFromStatus: null,
          },
        })
        await tx.demandStatusHistory.create({
          data: {
            demandId: id,
            fromStatus: "ON_HOLD",
            toStatus: targetStatus as DemandStatus,
            comment: "恢復進行",
            changedBy: auth.userId,
          },
        })
        return d
      })

      const toLabel = STATUS_MAP[targetStatus]?.label ?? targetStatus
      const stakeholderIds = getDemandStakeholderIds(id)
      const orgUserIds = getOrgSubsidiaryUserIds(demand.organizationId)
      Promise.all([stakeholderIds, orgUserIds]).then(([sIds, oIds]) => {
        const recipients = [...new Set([...sIds, ...oIds])].filter(uid => uid !== auth.userId)
        notifyUsers(recipients, {
          type: "DEMAND_STATUS",
          title: "需求恢復進行",
          message: `需求 ${demand.demandNumber}「${demand.title}」已從暫緩恢復為「${toLabel}」。`,
          linkUrl: `/demands/${id}`,
        })
      })
      logAudit({
        userId: auth.userId,
        action: "STATUS_CHANGE",
        entity: "DEMAND",
        entityId: id,
        demandId: id,
        details: { fromStatus: "ON_HOLD", toStatus: targetStatus },
        request,
      })

      return NextResponse.json({ demand: { id: updated.id, status: updated.status } })
    }

    // Handle status update
    const { status } = body
    if (!status || !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: "無效的狀態" }, { status: 400 })
    }

    if (demand.status === status) {
      return NextResponse.json({ error: "狀態未變更" }, { status: 400 })
    }

    // Sign-off blocking: only block FORWARD movement from a sign-off phase
    const signoffPhases = SIGNOFF_REQUIRED_PHASES as readonly string[]
    const currentIdx = PIPELINE_STEPS.indexOf(demand.status as typeof PIPELINE_STEPS[number])
    const targetIdx = PIPELINE_STEPS.indexOf(status as typeof PIPELINE_STEPS[number])
    const isForward = currentIdx >= 0 && targetIdx >= 0 && targetIdx > currentIdx

    if (isForward && signoffPhases.includes(demand.status)) {
      // Check if all required signers have signoff records; auto-create missing ones
      const phase = demand.status as DemandStatus
      type RequiredTarget = { userId: string; role: string }
      const requiredTargets: RequiredTarget[] = []

      if (phase === "PRD_REVIEW" || phase === "ACCEPTANCE") {
        if (demand.contactPersonId) requiredTargets.push({ userId: demand.contactPersonId, role: "REQUESTER" })
        if (demand.demandManagerId) requiredTargets.push({ userId: demand.demandManagerId, role: "MANAGER" })
      } else if (phase === "SP_REVIEW") {
        // Board members: filter by restrictBoardToOrg
        const boardMembers = await prisma.user.findMany({
          where: { isBoardMember: true, isActive: true, boardExemptFromSignoff: false },
          select: { id: true, restrictBoardToOrg: true, organizationId: true },
        })
        for (const u of boardMembers) {
          if (u.restrictBoardToOrg && u.organizationId !== demand.organizationId) continue
          requiredTargets.push({ userId: u.id, role: "BOARD" })
        }
      }

      // Find existing signoffs for current phase (latest round only)
      const allPhaseSignoffs = await prisma.phaseSignoff.findMany({
        where: { demandId: id, phase },
      })
      const latestTime = allPhaseSignoffs.length > 0
        ? Math.max(...allPhaseSignoffs.map(s => new Date(s.requestedAt).getTime()))
        : 0
      const latestRound = allPhaseSignoffs.filter(s => new Date(s.requestedAt).getTime() === latestTime)

      // Auto-create missing signoffs for required targets that don't have a record
      for (const t of requiredTargets) {
        const exists = latestRound.some(s => s.targetUserId === t.userId)
        if (!exists) {
          await prisma.phaseSignoff.create({
            data: {
              demandId: id,
              phase,
              status: "PENDING",
              requestedById: auth.userId,
              targetUserId: t.userId,
              targetRole: t.role,
              requestedAt: latestTime > 0 ? new Date(latestTime) : new Date(),
            },
          })
        }
      }

      // Re-fetch pending signoffs after potential auto-creates
      // Exclude orphan signoffs (no targetUserId) — they are stale/invalid
      const pendingSignoffs = await prisma.phaseSignoff.findMany({
        where: {
          demandId: id,
          phase,
          status: "PENDING",
          targetUserId: { not: null },
        },
        orderBy: { requestedAt: "desc" },
      })

      if (pendingSignoffs.length > 0) {
        if (!body.forceAdvance) {
          return NextResponse.json(
            { error: "此階段需要所有簽核人員確認後才能推進", signoffRequired: true, pendingCount: pendingSignoffs.length },
            { status: 409 }
          )
        }
        // Force advance: mark all pending sign-offs as SKIPPED inside transaction below
      }
    }

    // For CLOSED: only set completedDate if explicitly provided (default stays null)
    const closedDate = status === "CLOSED" && body.completedDate
      ? new Date(body.completedDate)
      : null

    // Parse SP adjustment (only when closing)
    const spAdjustment = (status === "CLOSED" && body.spAdjustment && typeof body.spAdjustment === "object")
      ? {
          newSp: Number(body.spAdjustment.newSp),
          reason: (body.spAdjustment.reason as string | null) || null,
          phaseAllocations: (body.spAdjustment.phaseAllocations as Record<string, number> | null) || null,
        }
      : null

    const updated = await prisma.$transaction(async (tx) => {
      const d = await tx.demand.update({
        where: { id },
        data: {
          status: status as DemandStatus,
          ...(status === "CLOSED" && closedDate ? { completedDate: closedDate } : {}),
          // Clear completedDate if moving back from CLOSED
          ...(demand.status === "CLOSED" && status !== "CLOSED" ? { completedDate: null } : {}),
          // Update confirmedSp if SP adjustment provided
          ...(spAdjustment && spAdjustment.newSp > 0 ? { confirmedSp: spAdjustment.newSp } : {}),
        },
      })

      // Build status history comment
      const historyComment = spAdjustment
        ? JSON.stringify({
            type: "SP_ADJUSTMENT",
            oldSp: demand.confirmedSp ?? demand.estimatedSp,
            newSp: spAdjustment.newSp,
            reason: spAdjustment.reason,
            phaseAllocations: spAdjustment.phaseAllocations,
          })
        : "狀態變更"

      await tx.demandStatusHistory.create({
        data: {
          demandId: id,
          fromStatus: demand.status,
          toStatus: status,
          comment: historyComment,
          changedBy: auth.userId,
        },
      })

      // Update phase plan SP allocations
      if (spAdjustment?.phaseAllocations) {
        // User provided explicit phase allocations — update all phases
        for (const step of PIPELINE_STEPS) {
          if (step === "CLOSED") continue
          const plannedSp = spAdjustment.phaseAllocations[step] ?? 0
          await tx.demandPhasePlan.upsert({
            where: { demandId_phase: { demandId: id, phase: step as DemandStatus } },
            create: { demandId: id, phase: step as DemandStatus, plannedSp },
            update: { plannedSp },
          })
        }
      }

      // Auto-set actual dates on phase plans
      const now = new Date()
      const fromIdx = PIPELINE_STEPS.indexOf(demand.status as typeof PIPELINE_STEPS[number])
      const toIdx = PIPELINE_STEPS.indexOf(status as typeof PIPELINE_STEPS[number])

      if (fromIdx >= 0) {
        await tx.demandPhasePlan.upsert({
          where: { demandId_phase: { demandId: id, phase: demand.status } },
          create: { demandId: id, phase: demand.status, actualEnd: now },
          update: { actualEnd: now },
        })
      }
      if (toIdx >= 0) {
        await tx.demandPhasePlan.upsert({
          where: { demandId_phase: { demandId: id, phase: status as DemandStatus } },
          create: { demandId: id, phase: status as DemandStatus, actualStart: now },
          update: { actualStart: now },
        })
      }

      // SP wallet: progressive consumption based on phase
      // oldSp = previous effective SP; newSp = adjusted (only differs when closing with SP adjustment)
      const oldSp = demand.confirmedSp ?? demand.estimatedSp
      const newSp = spAdjustment && spAdjustment.newSp > 0 ? spAdjustment.newSp : oldSp
      const year = now.getFullYear()

      // Calculate delta between old and new progressive consumption
      const oldRate = SP_PROGRESS_RATE[demand.status] ?? 0
      const newRate = SP_PROGRESS_RATE[status as string] ?? 0
      const oldUsed = Math.round(oldSp * oldRate)
      const newUsed = Math.round(newSp * newRate)
      const delta = newUsed - oldUsed

      if (delta !== 0) {
        await tx.spWallet.upsert({
          where: { organizationId_year_vendor: { organizationId: demand.organizationId, year, vendor: demand.vendor } },
          create: { organizationId: demand.organizationId, year, vendor: demand.vendor, totalQuota: 0, usedSp: Math.max(0, delta), committedSp: 0 },
          update: { usedSp: { increment: delta } },
        })
      }

      // Force-advance: mark pending sign-off as SKIPPED
      if (isForward && body.forceAdvance && signoffPhases.includes(demand.status)) {
        await tx.phaseSignoff.updateMany({
          where: {
            demandId: id,
            phase: demand.status as DemandStatus,
            status: "PENDING",
          },
          data: {
            status: "SKIPPED",
            respondedAt: now,
            respondedById: auth.userId,
            comment: body.forceComment || "管理者略過簽核",
          },
        })
      }

      // Auto-create sign-off(s) for the target phase if required (forward only)
      if (isForward && signoffPhases.includes(status)) {
        type SignoffTarget = { userId: string; role: string }
        const targets: SignoffTarget[] = []

        if (status === "PRD_REVIEW" || status === "ACCEPTANCE") {
          if (demand.contactPersonId) targets.push({ userId: demand.contactPersonId, role: "REQUESTER" })
          if (demand.demandManagerId) targets.push({ userId: demand.demandManagerId, role: "MANAGER" })
        } else if (status === "SP_REVIEW") {
          // Board members: filter by restrictBoardToOrg
          const boardMembers = await tx.user.findMany({
            where: { isBoardMember: true, isActive: true, boardExemptFromSignoff: false },
            select: { id: true, restrictBoardToOrg: true, organizationId: true },
          })
          for (const u of boardMembers) {
            if (u.restrictBoardToOrg && u.organizationId !== demand.organizationId) continue
            targets.push({ userId: u.id, role: "BOARD" })
          }
        }

        // Fallback: create one generic signoff if no specific targets
        if (targets.length === 0) targets.push({ userId: "", role: "" })

        // Use the same requestedAt for all signoffs so they form a single round
        const advanceRoundTime = now
        for (const t of targets) {
          await tx.phaseSignoff.create({
            data: {
              demandId: id,
              phase: status as DemandStatus,
              status: "PENDING",
              requestedById: auth.userId,
              targetUserId: t.userId || null,
              targetRole: t.role || null,
              requestedAt: advanceRoundTime,
            },
          })
        }
      }

      return d
    })

    // Fire-and-forget: status change notification + audit
    const fromLabel = STATUS_MAP[demand.status]?.label ?? demand.status
    const toLabel = STATUS_MAP[status]?.label ?? status
    const stakeholderIds = getDemandStakeholderIds(id)
    const orgUserIds = getOrgSubsidiaryUserIds(demand.organizationId)
    Promise.all([stakeholderIds, orgUserIds]).then(([sIds, oIds]) => {
      const recipients = [...new Set([...sIds, ...oIds])].filter(uid => uid !== auth.userId)
      notifyUsers(recipients, {
        type: "DEMAND_STATUS",
        title: "需求狀態變更",
        message: `需求 ${demand.demandNumber}「${demand.title}」狀態已從「${fromLabel}」變更為「${toLabel}」。`,
        linkUrl: `/demands/${id}`,
      })
    })
    logAudit({
      userId: auth.userId,
      action: "STATUS_CHANGE",
      entity: "DEMAND",
      entityId: id,
      demandId: id,
      details: { fromStatus: demand.status, toStatus: status },
      request,
    })

    return NextResponse.json({ demand: { id: updated.id, status: updated.status } })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Update demand error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// DELETE: Delete a demand
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyRole(request, ["admin"])
    verifyAdminFull(auth)
    const { id } = await params

    const demand = await prisma.demand.findUnique({ where: { id } })
    if (!demand) {
      return NextResponse.json({ error: "需求不存在" }, { status: 404 })
    }

    await prisma.demand.delete({ where: { id } })

    logAudit({
      userId: auth.userId,
      action: "DELETE",
      entity: "DEMAND",
      entityId: id,
      demandId: id,
      details: { demandNumber: demand.demandNumber, title: demand.title },
      request,
    })

    return NextResponse.json({ message: "需求已刪除" })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Delete demand error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import { DemandStatus } from "@/lib/generated/prisma/client"
import { notifyUsers } from "@/lib/notify"
import { logAudit } from "@/lib/audit"
import { DESIGN_CHANGE_ALLOWED_PHASES, PIPELINE_STEPS, STATUS_MAP } from "@/lib/constants/demand"

// 終止開發結案除「需求確認」（尚未投入）與「已結案」（已結算完畢）外皆可提出。
// 結算落點另由 PIPELINE_STEPS 索引把關，不得低於目前階段，故最低仍為開發中 50%。
const PHASE_OVERRIDE_ALLOWED: string[] = ["PRD_REVIEW", "SP_REVIEW", "DEVELOPING", "ACCEPTANCE"]

/** 代簽結算可選的目標狀態（有消耗比例、可直接落點的狀態） */
const SETTLEMENT_STATUSES: string[] = ["DEVELOPING", "ACCEPTANCE", "CLOSED"]

// POST: 管理者發起專案 Master 代簽 — creates PENDING BOARD_OVERRIDE signoffs for board members
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const { id } = await params
    const body = await request.json()
    const comment = (body.comment as string || "").trim()
    const kind = (body.kind as string) || "PHASE"
    const targetStatus = (body.targetStatus as string | null) || null

    if (!comment) {
      return NextResponse.json({ error: "請填寫代簽原因" }, { status: 400 })
    }
    if (!["PHASE", "DESIGN_CHANGE"].includes(kind)) {
      return NextResponse.json({ error: "無效的簽核類型" }, { status: 400 })
    }
    if (targetStatus !== null) {
      if (kind !== "PHASE") {
        return NextResponse.json({ error: "僅階段代簽可指定結算狀態" }, { status: 400 })
      }
      if (!SETTLEMENT_STATUSES.includes(targetStatus)) {
        return NextResponse.json({ error: "無效的結算狀態" }, { status: 400 })
      }
    }

    // Fetch demand
    const demand = await prisma.demand.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        heldFromStatus: true,
        organizationId: true,
        demandNumber: true,
        title: true,
      },
    })

    if (!demand) {
      return NextResponse.json({ error: "需求不存在" }, { status: 404 })
    }

    // 暫緩／已駁回不得代簽：暫緩是「SP 押在原地、將來可能重啟」，
    // 與「結算在某個落點、案子結束」的終止意義相反；要終止須先解除暫緩。
    if (demand.status === "ON_HOLD" || demand.status === "REJECTED") {
      return NextResponse.json(
        {
          error: demand.status === "ON_HOLD"
            ? "需求目前為暫緩，無法發起代簽。如需終止開發結案，請先解除暫緩，讓需求回到實際階段後再發起。"
            : "需求目前為已駁回，無法發起代簽。",
        },
        { status: 400 }
      )
    }

    // 代簽一律以需求「目前」的階段為準（暫緩／已駁回已於上方擋下）
    const effectivePhase = demand.status

    // Validate phase
    if (kind === "PHASE" && !PHASE_OVERRIDE_ALLOWED.includes(effectivePhase)) {
      return NextResponse.json(
        { error: `目前階段（${STATUS_MAP[demand.status]?.label ?? demand.status}）不支援代簽` },
        { status: 400 }
      )
    }
    if (kind === "DESIGN_CHANGE" && !DESIGN_CHANGE_ALLOWED_PHASES.includes(demand.status as typeof DESIGN_CHANGE_ALLOWED_PHASES[number])) {
      return NextResponse.json(
        { error: `目前階段（${demand.status}）不支援設計變更代簽` },
        { status: 400 }
      )
    }

    // Settlement target: 不可低於目前（有效）階段的結算比例；允許結算在當前階段（終止）或往後
    if (targetStatus !== null) {
      const curIdx = PIPELINE_STEPS.indexOf(effectivePhase as typeof PIPELINE_STEPS[number])
      const tgtIdx = PIPELINE_STEPS.indexOf(targetStatus as typeof PIPELINE_STEPS[number])
      if (curIdx < 0 || tgtIdx < 0 || tgtIdx < curIdx) {
        return NextResponse.json({ error: "結算狀態不可低於目前階段" }, { status: 400 })
      }
    }

    // Find pending signoffs for this phase+kind (exclude existing overrides)
    const pendingSignoffs = await prisma.phaseSignoff.findMany({
      where: {
        demandId: id,
        phase: effectivePhase as DemandStatus,
        kind,
        status: "PENDING",
        targetRole: { not: "BOARD_OVERRIDE" },
      },
    })

    // 一般階段代簽需有待確認簽核；但「終止結算」（帶結算狀態）即使無待簽核也可發起（如開發中）
    if (pendingSignoffs.length === 0 && !targetStatus) {
      return NextResponse.json({ error: "沒有待確認的簽核可以代簽" }, { status: 409 })
    }

    // Check for existing PENDING BOARD_OVERRIDE signoff
    const existingOverride = await prisma.phaseSignoff.findFirst({
      where: {
        demandId: id,
        phase: effectivePhase as DemandStatus,
        kind,
        targetRole: "BOARD_OVERRIDE",
        status: "PENDING",
      },
    })
    if (existingOverride) {
      return NextResponse.json({ error: "已有待處理的代簽請求" }, { status: 409 })
    }

    // Find eligible board members
    const boardMembers = await prisma.user.findMany({
      where: { isBoardMember: true, isActive: true, boardExemptFromSignoff: false },
      select: { id: true, name: true, restrictBoardToOrg: true, organizationId: true },
    })

    // 董事：一間公司一位（優先序，與 lib/board.ts 一致）
    const orgSpecific = boardMembers.filter((u) => u.restrictBoardToOrg && u.organizationId === demand.organizationId)
    const defaults = boardMembers.filter((u) => !u.restrictBoardToOrg)
    const eligibleMembers = orgSpecific.length > 0 ? orgSpecific : defaults.length > 0 ? defaults : boardMembers

    if (eligibleMembers.length === 0) {
      return NextResponse.json({ error: "找不到可代簽的專案 Master" }, { status: 404 })
    }

    // Use the round timestamp from existing signoffs（終止結算可能無待簽核 → 用現在時間）
    const roundTime = pendingSignoffs[0]?.requestedAt ?? new Date()

    // Delegating to 代簽 supersedes the original signers (需求者/主管) — once a
    // 代簽 is initiated, only the 代簽人 should be asked. Skip their pending
    // signoffs so they're removed from the loop (not left hanging as 待確認).
    const created = await prisma.$transaction(async (tx) => {
      await tx.phaseSignoff.updateMany({
        where: {
          demandId: id,
          phase: effectivePhase as DemandStatus,
          kind,
          status: "PENDING",
          targetRole: { not: "BOARD_OVERRIDE" },
        },
        data: {
          status: "SKIPPED",
          comment: "已改由專案 Master 代簽",
          respondedAt: new Date(),
          respondedById: auth.userId,
        },
      })

      // Create PENDING BOARD_OVERRIDE signoff for each eligible board member
      const rows = []
      for (const member of eligibleMembers) {
        rows.push(
          await tx.phaseSignoff.create({
            data: {
              demandId: id,
              phase: effectivePhase as DemandStatus,
              kind,
              status: "PENDING",
              targetUserId: member.id,
              targetRole: "BOARD_OVERRIDE",
              overrideTargetStatus: targetStatus as DemandStatus | null,
              requestComment: comment,
              requestedById: auth.userId,
              requestedAt: roundTime,
            },
          })
        )
      }
      return rows
    })

    // Notify board members
    const memberIds = eligibleMembers.map((m) => m.id)
    notifyUsers(memberIds, {
      type: "SIGNOFF",
      title: "專案 Master 代簽請求",
      message: `需求 ${demand.demandNumber}「${demand.title}」的${kind === "DESIGN_CHANGE" ? "設計變更" : "階段"}簽核需要您代為確認。`,
      linkUrl: `/governance/demands/${id}`,
    })

    logAudit({
      userId: auth.userId,
      action: "SIGNOFF_BOARD_OVERRIDE_REQUEST",
      entity: "SIGNOFF",
      entityId: created[0].id,
      demandId: id,
      details: { phase: effectivePhase, kind, comment, targetStatus, targetMembers: eligibleMembers.map(m => m.name) },
      request,
    })

    return NextResponse.json({
      signoffs: created,
      targetMembers: eligibleMembers.map(m => ({ id: m.id, name: m.name })),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Board override request error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

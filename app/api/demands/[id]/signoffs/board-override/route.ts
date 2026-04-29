import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import { DemandStatus } from "@/lib/generated/prisma/client"
import { notifyUsers } from "@/lib/notify"
import { logAudit } from "@/lib/audit"
import { DESIGN_CHANGE_ALLOWED_PHASES } from "@/lib/constants/demand"

const PHASE_OVERRIDE_ALLOWED: string[] = ["PRD_REVIEW", "ACCEPTANCE"]

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

    if (!comment) {
      return NextResponse.json({ error: "請填寫代簽原因" }, { status: 400 })
    }
    if (!["PHASE", "DESIGN_CHANGE"].includes(kind)) {
      return NextResponse.json({ error: "無效的簽核類型" }, { status: 400 })
    }

    // Fetch demand
    const demand = await prisma.demand.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        organizationId: true,
        demandNumber: true,
        title: true,
      },
    })

    if (!demand) {
      return NextResponse.json({ error: "需求不存在" }, { status: 404 })
    }

    // Validate phase
    if (kind === "PHASE" && !PHASE_OVERRIDE_ALLOWED.includes(demand.status)) {
      return NextResponse.json(
        { error: `目前階段（${demand.status}）不支援代簽` },
        { status: 400 }
      )
    }
    if (kind === "DESIGN_CHANGE" && !DESIGN_CHANGE_ALLOWED_PHASES.includes(demand.status as typeof DESIGN_CHANGE_ALLOWED_PHASES[number])) {
      return NextResponse.json(
        { error: `目前階段（${demand.status}）不支援設計變更代簽` },
        { status: 400 }
      )
    }

    // Find pending signoffs for this phase+kind (exclude existing overrides)
    const pendingSignoffs = await prisma.phaseSignoff.findMany({
      where: {
        demandId: id,
        phase: demand.status as DemandStatus,
        kind,
        status: "PENDING",
        targetRole: { not: "BOARD_OVERRIDE" },
      },
    })

    if (pendingSignoffs.length === 0) {
      return NextResponse.json({ error: "沒有待確認的簽核可以代簽" }, { status: 409 })
    }

    // Check for existing PENDING BOARD_OVERRIDE signoff
    const existingOverride = await prisma.phaseSignoff.findFirst({
      where: {
        demandId: id,
        phase: demand.status as DemandStatus,
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

    const eligibleMembers = boardMembers.filter((u) => {
      if (u.restrictBoardToOrg && u.organizationId !== demand.organizationId) return false
      return true
    })

    if (eligibleMembers.length === 0) {
      return NextResponse.json({ error: "找不到可代簽的專案 Master" }, { status: 404 })
    }

    // Use the round timestamp from existing signoffs
    const roundTime = pendingSignoffs[0].requestedAt

    // Create PENDING BOARD_OVERRIDE signoff for each eligible board member
    const created = await prisma.$transaction(
      eligibleMembers.map((member) =>
        prisma.phaseSignoff.create({
          data: {
            demandId: id,
            phase: demand.status as DemandStatus,
            kind,
            status: "PENDING",
            targetUserId: member.id,
            targetRole: "BOARD_OVERRIDE",
            requestComment: comment,
            requestedById: auth.userId,
            requestedAt: roundTime,
          },
        })
      )
    )

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
      details: { phase: demand.status, kind, comment, targetMembers: eligibleMembers.map(m => m.name) },
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

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth, AuthError } from "@/lib/auth"
import { DemandStatus } from "@/lib/generated/prisma/client"
import { notifyUsers } from "@/lib/notify"
import { logAudit } from "@/lib/audit"

/**
 * POST /api/demands/:id/signoffs/:signoffId/cancel
 *
 * Withdraw (cancel) a pending DESIGN_CHANGE signoff.
 * - Only the original requester (requestedById) can cancel.
 * - Only works when signoff.status === "PENDING" and kind === "DESIGN_CHANGE".
 * - Cascades to other PENDING DC signoffs in the same round (5 sec window).
 * - Notifies the originally-designated target users.
 *
 * Body (JSON): { reason: string }  (min 5 chars after trim)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; signoffId: string }> }
) {
  try {
    const auth = verifyAuth(request)
    const { id, signoffId } = await params

    const body = await request.json().catch(() => ({}))
    const reason = typeof body.reason === "string" ? body.reason.trim() : ""

    if (reason.length < 5) {
      return NextResponse.json({ error: "撤回原因至少 5 字" }, { status: 400 })
    }

    const signoff = await prisma.phaseSignoff.findUnique({
      where: { id: signoffId },
      include: {
        demand: {
          select: { id: true, demandNumber: true, title: true },
        },
        requestedBy: { select: { id: true, name: true } },
      },
    })

    if (!signoff || signoff.demandId !== id) {
      return NextResponse.json({ error: "簽核記錄不存在" }, { status: 404 })
    }

    if (signoff.kind !== "DESIGN_CHANGE") {
      return NextResponse.json(
        { error: "僅設計變更可由發起者撤回" },
        { status: 400 },
      )
    }

    if (signoff.status !== "PENDING") {
      return NextResponse.json({ error: "此簽核已處理" }, { status: 400 })
    }

    if (signoff.requestedById !== auth.userId) {
      return NextResponse.json(
        { error: "只有發起者能撤回此設計變更" },
        { status: 403 },
      )
    }

    // Main signoff: mark CANCELLED with reason
    await prisma.phaseSignoff.update({
      where: { id: signoffId },
      data: {
        status: "CANCELLED",
        comment: `[撤回] ${reason}`,
        respondedAt: new Date(),
        respondedById: auth.userId,
      },
    })

    // Cascade: same round (5s window), same phase, same kind, other PENDING
    const roundTime = signoff.requestedAt.getTime()
    const siblings = await prisma.phaseSignoff.findMany({
      where: {
        demandId: id,
        phase: signoff.phase as DemandStatus,
        kind: "DESIGN_CHANGE",
        status: "PENDING",
        id: { not: signoffId },
        requestedAt: {
          gte: new Date(roundTime - 5000),
          lte: new Date(roundTime + 5000),
        },
      },
      select: { id: true, targetUserId: true },
    })

    if (siblings.length > 0) {
      await prisma.phaseSignoff.updateMany({
        where: { id: { in: siblings.map((s) => s.id) } },
        data: {
          status: "CANCELLED",
          comment: "同輪次已由發起者撤回",
          respondedAt: new Date(),
          respondedById: auth.userId,
        },
      })
    }

    // Collect notification recipients: all originally-designated target users
    const recipientIds = [
      signoff.targetUserId,
      ...siblings.map((s) => s.targetUserId),
    ].filter((uid): uid is string => uid !== null && uid !== auth.userId)

    if (recipientIds.length > 0) {
      notifyUsers([...new Set(recipientIds)], {
        type: "SIGNOFF",
        title: "設計變更已撤回",
        message: `需求 ${signoff.demand.demandNumber}「${signoff.demand.title}」的設計變更已由 ${signoff.requestedBy.name} 撤回：${reason}`,
        linkUrl: `/demands/${id}`,
      })
    }

    logAudit({
      userId: auth.userId,
      action: "SIGNOFF_CANCEL",
      entity: "SIGNOFF",
      entityId: signoffId,
      demandId: id,
      details: { kind: "DESIGN_CHANGE", phase: signoff.phase, reason, cascaded: siblings.length },
      request,
    })

    return NextResponse.json({ success: true, cancelledCount: 1 + siblings.length })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Cancel signoff error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

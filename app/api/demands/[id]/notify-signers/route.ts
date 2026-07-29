import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import { sendMailAndLog } from "@/lib/mail"
import { logAudit } from "@/lib/audit"
import { notifyUsers } from "@/lib/notify"

/**
 * POST /api/demands/[id]/notify-signers
 * 發送簽核通知信給 PENDING 簽核人
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const { id } = await params

    const body = await request.json()
    const { to, cc, subject, body: emailBody } = body as {
      to: string[]
      cc?: string[]
      subject: string
      body: string
    }

    if (!to?.length) {
      return NextResponse.json({ error: "缺少收件者" }, { status: 400 })
    }
    if (!subject?.trim()) {
      return NextResponse.json({ error: "缺少主旨" }, { status: 400 })
    }
    if (!emailBody?.trim()) {
      return NextResponse.json({ error: "缺少信件內容" }, { status: 400 })
    }

    // Verify demand exists and has PENDING signoffs
    const demand = await prisma.demand.findUnique({
      where: { id },
      select: {
        id: true,
        demandNumber: true,
        title: true,
        status: true,
        phaseSignoffs: {
          where: { status: "PENDING" },
          select: { targetUserId: true, targetRole: true, overrideTargetStatus: true },
        },
      },
    })

    if (!demand) {
      return NextResponse.json({ error: "需求不存在" }, { status: 404 })
    }

    if (demand.phaseSignoffs.length === 0) {
      return NextResponse.json({ error: "此需求目前沒有待簽核項目" }, { status: 400 })
    }

    // Send email
    await sendMailAndLog({
      type: "SIGNOFF_NOTIFY",
      to,
      cc: cc?.filter(Boolean),
      subject: subject.trim(),
      body: emailBody,
      bodyType: "html",
      demandId: id,
      sentById: auth.userId,
    })

    // Also send in-app notifications
    const targetUserIds = demand.phaseSignoffs
      .map((s) => s.targetUserId)
      .filter((uid): uid is string => !!uid)

    if (targetUserIds.length > 0) {
      const uniqueIds = [...new Set(targetUserIds)]
      const isTermination = demand.phaseSignoffs.some(
        (s) => s.targetRole === "BOARD_OVERRIDE" && !!s.overrideTargetStatus,
      )
      notifyUsers(uniqueIds, {
        type: "SIGNOFF",
        title: isTermination ? "專案終止確認" : "簽核通知",
        message: isTermination
          ? `需求 ${demand.demandNumber} - ${demand.title} 申請終止結算，需要您確認`
          : `需求 ${demand.demandNumber} - ${demand.title} 需要您進行簽核確認`,
        linkUrl: `/governance/demands/${id}`,
      }).catch(console.error)
    }

    // Audit log
    logAudit({
      userId: auth.userId,
      action: "NOTIFY_SIGNERS",
      entity: "DEMAND",
      entityId: id,
      demandId: id,
      details: { to, cc, subject },
      request,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("POST /api/demands/[id]/notify-signers error:", error)
    const message = error instanceof Error ? error.message : "伺服器錯誤"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

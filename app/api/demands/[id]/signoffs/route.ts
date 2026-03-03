import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import { DemandStatus } from "@/lib/generated/prisma/client"
import { SIGNOFF_REQUIRED_PHASES, STATUS_MAP } from "@/lib/constants/demand"
import { notifyUsers, getOrgSubsidiaryUserIds } from "@/lib/notify"
import { logAudit } from "@/lib/audit"

// POST: Re-request sign-off (after rejection)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const { id } = await params
    const { phase, requestComment } = await request.json()

    const demand = await prisma.demand.findUnique({
      where: { id },
      select: { id: true, demandNumber: true, title: true, status: true, organizationId: true },
    })
    if (!demand) {
      return NextResponse.json({ error: "需求不存在" }, { status: 404 })
    }

    const signoffPhases = SIGNOFF_REQUIRED_PHASES as readonly string[]
    if (!phase || !signoffPhases.includes(phase)) {
      return NextResponse.json({ error: "無效的簽核階段" }, { status: 400 })
    }

    if (demand.status !== phase) {
      return NextResponse.json({ error: "只能對目前階段發起簽核" }, { status: 400 })
    }

    // Check no existing PENDING sign-off for this demand+phase
    const existing = await prisma.phaseSignoff.findFirst({
      where: { demandId: id, phase: phase as DemandStatus, status: "PENDING" },
    })
    if (existing) {
      return NextResponse.json({ error: "此階段已有待確認的簽核" }, { status: 409 })
    }

    const signoff = await prisma.phaseSignoff.create({
      data: {
        demandId: id,
        phase: phase as DemandStatus,
        status: "PENDING",
        requestedById: auth.userId,
        requestComment: requestComment?.trim() || null,
      },
      include: {
        requestedBy: { select: { id: true, name: true } },
      },
    })

    // Fire-and-forget: notify org subsidiary users + audit
    const phaseLabel = STATUS_MAP[phase]?.label ?? phase
    getOrgSubsidiaryUserIds(demand.organizationId).then((orgIds) => {
      const recipients = orgIds.filter(uid => uid !== auth.userId)
      notifyUsers(recipients, {
        type: "SIGNOFF",
        title: "簽核請求",
        message: `需求 ${demand.demandNumber}「${demand.title}」在「${phaseLabel}」階段需要您的簽核確認。`,
        linkUrl: `/demands/${id}`,
      })
    })
    logAudit({
      userId: auth.userId,
      action: "SIGNOFF_REQUEST",
      entity: "SIGNOFF",
      entityId: signoff.id,
      demandId: id,
      details: { phase },
      request,
    })

    return NextResponse.json({ signoff })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Create signoff error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

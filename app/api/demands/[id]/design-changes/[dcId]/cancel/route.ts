import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import { canAdminWrite } from "@/lib/demand-access"
import { notifyUsers } from "@/lib/notify"
import { logAudit } from "@/lib/audit"

// POST: 撤銷設計變更（設為已取消，不再擋階段簽核）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dcId: string }> }
) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const { id, dcId } = await params

    const dc = await prisma.designChange.findUnique({
      where: { id: dcId },
      include: {
        demand: { select: { id: true, demandNumber: true, title: true, organizationId: true } },
        revisions: { orderBy: { version: "desc" }, take: 1, select: { id: true } },
      },
    })
    if (!dc || dc.demandId !== id) return NextResponse.json({ error: "設計變更不存在" }, { status: 404 })

    if (auth.role === "admin") {
      const canWrite = await canAdminWrite(auth.userId, auth.adminScopeType, { id: dc.demand.id, organizationId: dc.demand.organizationId })
      if (!canWrite) return NextResponse.json({ error: "此管理員無修改權限" }, { status: 403 })
    }
    if (dc.status === "APPROVED") return NextResponse.json({ error: "已通過的設計變更無法撤銷" }, { status: 400 })
    if (dc.status === "CANCELLED") return NextResponse.json({ error: "此設計變更已撤銷" }, { status: 400 })

    await prisma.$transaction(async (tx) => {
      await tx.designChange.update({ where: { id: dcId }, data: { status: "CANCELLED" } })
      const latestId = dc.revisions[0]?.id
      if (latestId) {
        await tx.designChangeRevision.update({ where: { id: latestId }, data: { status: "CANCELLED", decidedAt: new Date() } })
      }
    })

    logAudit({
      userId: auth.userId, action: "STATUS_CHANGE", entity: "SIGNOFF", entityId: dcId, demandId: id,
      details: { kind: "DESIGN_CHANGE_CANCEL", seq: dc.seq, title: dc.title },
      request,
    })
    // 通知利害關係人（簡訊息；撤銷後不再需要審核）
    notifyUsers([dc.createdById], {
      type: "DEMAND_STATUS",
      title: "設計變更已撤銷",
      message: `需求 ${dc.demand.demandNumber}「${dc.demand.title}」的設計變更「${dc.title}」已撤銷。`,
      linkUrl: `/demands/${id}`,
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    console.error("Cancel design change error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

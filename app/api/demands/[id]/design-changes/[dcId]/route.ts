import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import { canAdminWrite } from "@/lib/demand-access"
import { logAudit } from "@/lib/audit"

// DELETE: 永久刪除整筆設計變更（含所有版本、審核、檔案紀錄）
// 供管理者移除填寫錯誤或誤建立的設計變更。
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dcId: string }> }
) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const { id, dcId } = await params

    const dc = await prisma.designChange.findUnique({
      where: { id: dcId },
      select: { id: true, demandId: true, seq: true, title: true, status: true, demand: { select: { organizationId: true } } },
    })
    if (!dc || dc.demandId !== id) return NextResponse.json({ error: "設計變更不存在" }, { status: 404 })

    if (auth.role === "admin") {
      const canWrite = await canAdminWrite(auth.userId, auth.adminScopeType, { id, organizationId: dc.demand.organizationId })
      if (!canWrite) return NextResponse.json({ error: "此管理員無修改權限" }, { status: 403 })
    }

    // 級聯刪除：revisions → items/feedback/reviews/documents（schema onDelete: Cascade）；
    // 需求文件的關聯 (DemandDocument.designChangeId) 會被設為 null。
    await prisma.designChange.delete({ where: { id: dcId } })

    logAudit({
      userId: auth.userId, action: "DELETE", entity: "SIGNOFF", entityId: dcId, demandId: id,
      details: { kind: "DESIGN_CHANGE_DELETE", seq: dc.seq, title: dc.title, prevStatus: dc.status },
      request,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    console.error("Delete design change error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { unlink } from "fs/promises"
import path from "path"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

// PATCH: 調整此版本的畫面順序（傳入畫面 id 陣列） — 管理者／交付團隊
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; protoId: string }> },
) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const { id, protoId } = await params
    const body = await request.json()
    const order = body.order as string[] | undefined
    if (!Array.isArray(order) || order.length === 0) {
      return NextResponse.json({ error: "缺少排序資料" }, { status: 400 })
    }

    const proto = await prisma.prototype.findFirst({
      where: { id: protoId, demandId: id },
      select: { id: true, screens: { select: { id: true } } },
    })
    if (!proto) {
      return NextResponse.json({ error: "原型不存在" }, { status: 404 })
    }
    const valid = new Set(proto.screens.map((s) => s.id))

    await prisma.$transaction(
      order.filter((sid) => valid.has(sid)).map((sid, idx) =>
        prisma.prototypeScreen.update({ where: { id: sid }, data: { order: idx } }),
      ),
    )

    logAudit({
      userId: auth.userId, action: "UPDATE", entity: "DEMAND", entityId: protoId, demandId: id,
      details: { kind: "PROTOTYPE_REORDER" }, request,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Reorder prototype error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// DELETE: 刪除一個原型版本（含其畫面檔案） — 管理者／交付團隊
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; protoId: string }> },
) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const { id, protoId } = await params

    const proto = await prisma.prototype.findFirst({
      where: { id: protoId, demandId: id },
      include: { screens: true },
    })
    if (!proto) {
      return NextResponse.json({ error: "原型不存在" }, { status: 404 })
    }

    // 刪除實體檔案
    for (const s of proto.screens) {
      for (const f of [s.htmlFile, s.screenshotFile]) {
        if (!f) continue
        try {
          await unlink(path.join(process.cwd(), "uploads", "demands", id, path.basename(f)))
        } catch { /* 檔案可能已不存在 */ }
      }
    }

    await prisma.prototype.delete({ where: { id: protoId } })

    logAudit({
      userId: auth.userId,
      action: "DELETE",
      entity: "DEMAND",
      entityId: protoId,
      demandId: id,
      details: { kind: "PROTOTYPE", version: proto.version },
      request,
    })

    return NextResponse.json({ message: "原型已刪除" })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Delete prototype error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

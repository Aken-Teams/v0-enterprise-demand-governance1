import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"
import { prisma } from "@/lib/prisma"
import { AuthError } from "@/lib/auth"
import { authorizePrototypeView } from "@/lib/prototype-access"

// GET: 回傳單一原型畫面的 HTML 原始內容（前端以 iframe srcdoc 沙箱呈現）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; protoId: string; screenId: string }> },
) {
  try {
    const { id, protoId, screenId } = await params
    await authorizePrototypeView(request, id)

    const screen = await prisma.prototypeScreen.findFirst({
      where: { id: screenId, prototype: { id: protoId, demandId: id } },
      select: { htmlFile: true },
    })
    if (!screen) {
      return NextResponse.json({ error: "畫面不存在" }, { status: 404 })
    }

    const filePath = path.join(process.cwd(), "uploads", "demands", id, path.basename(screen.htmlFile))
    let html: string
    try {
      html = await readFile(filePath, "utf-8")
    } catch {
      return NextResponse.json({ error: "檔案不存在" }, { status: 404 })
    }

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Render prototype screen error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

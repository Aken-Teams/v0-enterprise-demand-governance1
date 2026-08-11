import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"
import JSZip from "jszip"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

function safeFolder(name: string): string {
  return (name.replace(/[\/\\:*?"<>|]+/g, "_").trim() || "screen").slice(0, 80)
}

// GET: 打包下載此原型版本的所有檔案（HTML + 截圖）為 ZIP — 僅管理者／交付團隊
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; protoId: string }> },
) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const { id, protoId } = await params

    const proto = await prisma.prototype.findFirst({
      where: { id: protoId, demandId: id },
      include: { screens: { orderBy: { order: "asc" } } },
    })
    if (!proto) {
      return NextResponse.json({ error: "原型不存在" }, { status: 404 })
    }

    const dir = path.join(process.cwd(), "uploads", "demands", id)
    const zip = new JSZip()

    for (let i = 0; i < proto.screens.length; i++) {
      const s = proto.screens[i]
      const folder = `${String(i + 1).padStart(2, "0")}_${safeFolder(s.name)}`
      // 網頁版 HTML
      try {
        zip.file(`${folder}/code.html`, await readFile(path.join(dir, path.basename(s.htmlFile))))
      } catch { /* 檔案缺失 → 略過 */ }
      // 手機版 HTML
      if (s.htmlFileMobile) {
        try {
          zip.file(`${folder}_mobile/code.html`, await readFile(path.join(dir, path.basename(s.htmlFileMobile))))
        } catch { /* 略過 */ }
      }
      // 截圖
      if (s.screenshotFile) {
        try {
          const ext = path.extname(s.screenshotFile) || ".png"
          zip.file(`${folder}/screen${ext}`, await readFile(path.join(dir, path.basename(s.screenshotFile))))
        } catch { /* 略過 */ }
      }
    }

    const content = await zip.generateAsync({ type: "uint8array" })

    logAudit({
      userId: auth.userId,
      action: "DOWNLOAD",
      entity: "DEMAND",
      entityId: protoId,
      demandId: id,
      details: { kind: "PROTOTYPE_ZIP", version: proto.version, screens: proto.screens.length },
      request,
    })

    const fileName = `prototype-v${proto.version}.zip`
    return new NextResponse(content as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Download prototype zip error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

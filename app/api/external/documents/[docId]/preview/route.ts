import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { prisma } from "@/lib/prisma"
import { verifyApiKey, AuthError } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

// 可預覽的 MIME 類型
const PREVIEW_MIME: Record<string, string> = {
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
}

// GET: 用文件 ID 預覽檔案（inline 顯示，不強制下載）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const apiKey = await verifyApiKey(request)
    const { docId } = await params

    const doc = await prisma.demandDocument.findUnique({
      where: { id: docId },
      select: {
        id: true,
        demandId: true,
        fileName: true,
        fileUrl: true,
        demand: { select: { demandNumber: true } },
      },
    })

    if (!doc) {
      return NextResponse.json({ error: "文件不存在" }, { status: 404 })
    }

    // External URL: redirect to the URL
    if (!doc.fileUrl || doc.fileUrl.startsWith("http")) {
      if (doc.fileUrl) {
        return NextResponse.redirect(doc.fileUrl)
      }
      return NextResponse.json({ error: "無檔案連結" }, { status: 400 })
    }

    const ext = path.extname(doc.fileName).toLowerCase()
    const contentType = PREVIEW_MIME[ext]

    if (!contentType) {
      return NextResponse.json(
        { error: "此檔案類型不支援預覽，請改用 download 端點", fileName: doc.fileName },
        { status: 400 }
      )
    }

    const filePath = path.join(
      process.cwd(),
      "uploads",
      "demands",
      doc.demandId,
      path.basename(doc.fileUrl)
    )

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "檔案不存在" }, { status: 404 })
    }

    const buffer = await readFile(filePath)

    logAudit({
      userId: apiKey.createdById,
      action: "API_PREVIEW",
      entity: "DOCUMENT",
      entityId: doc.id,
      demandId: doc.demandId,
      details: {
        apiKeyId: apiKey.apiKeyId,
        apiKeyName: apiKey.name,
        fileName: doc.fileName,
      },
      request,
    })

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.fileName)}"`,
        "Cache-Control": "private, max-age=300",
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("External document preview error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

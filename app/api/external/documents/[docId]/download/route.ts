import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { prisma } from "@/lib/prisma"
import { verifyApiKey, AuthError } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
}

// GET: 用文件 ID 下載檔案（原始檔案，不加浮水印）
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

    // External URL: cannot download, return the URL
    if (!doc.fileUrl || doc.fileUrl.startsWith("http")) {
      return NextResponse.json(
        { error: "此為外部連結文件，無法下載", url: doc.fileUrl },
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
    const ext = path.extname(doc.fileName).toLowerCase()
    const contentType = MIME_MAP[ext] || "application/octet-stream"

    logAudit({
      userId: apiKey.createdById,
      action: "API_DOWNLOAD",
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
        "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.fileName)}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("External document download error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

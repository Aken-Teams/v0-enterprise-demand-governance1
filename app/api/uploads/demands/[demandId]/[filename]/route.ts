import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ demandId: string; filename: string }> }
) {
  const { demandId, filename } = await params

  if (demandId.includes("..") || filename.includes("..")) {
    return NextResponse.json({ error: "無效的路徑" }, { status: 400 })
  }

  const filePath = path.join(
    process.cwd(),
    "uploads",
    "demands",
    demandId,
    filename
  )

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "檔案不存在" }, { status: 404 })
  }

  const buffer = await readFile(filePath)
  const ext = path.extname(filename).toLowerCase()
  const contentType = MIME_MAP[ext] || "application/octet-stream"

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}

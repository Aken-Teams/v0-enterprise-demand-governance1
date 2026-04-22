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
    const decodedName = decodeURIComponent(filename).replace(/^\d+-/, "")
    const html = `<!DOCTYPE html>
<html lang="zh-TW"><head><meta charset="utf-8"><title>檔案不存在</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f9fafb;color:#374151}
.box{text-align:center;padding:2rem}.icon{font-size:3rem;margin-bottom:1rem}.title{font-size:1.25rem;font-weight:600;margin-bottom:.5rem}
.desc{font-size:.875rem;color:#6b7280}.filename{background:#f3f4f6;border:1px solid #e5e7eb;border-radius:.25rem;padding:.25rem .5rem;font-size:.75rem;color:#6b7280;margin-bottom:1rem;display:inline-block;word-break:break-all}</style></head>
<body><div class="box"><div class="icon">📄</div><div class="title">檔案不存在</div>
<div class="filename">${decodedName}</div>
<div class="desc">此檔案可能尚未同步至本機環境，或已被移除。</div></div></body></html>`
    return new NextResponse(html, {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
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

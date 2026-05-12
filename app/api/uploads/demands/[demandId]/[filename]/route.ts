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
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;background:transparent;color:#71717a}
.box{text-align:center}.title{font-size:.875rem;font-weight:500;margin-bottom:.375rem;color:#a1a1aa}
.desc{font-size:.75rem;color:#a1a1aa}.filename{font-size:.75rem;color:#a1a1aa;margin-bottom:.25rem;word-break:break-all}
svg{margin:0 auto .75rem;display:block}</style></head>
<body><div class="box"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d4d4d8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
<div class="title">檔案不存在</div>
<div class="filename">${decodedName}</div>
<div class="desc">檔案可能尚未同步或已被移除</div></div></body></html>`
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

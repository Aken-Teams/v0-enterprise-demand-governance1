import { NextRequest, NextResponse } from "next/server"
import { existsSync } from "fs"
import { readFile, mkdir, copyFile, rm, stat } from "fs/promises"
import path from "path"
import os from "os"
import { execFile } from "child_process"
import { promisify } from "util"

const execFileAsync = promisify(execFile)
const CONVERTIBLE = new Set([".ppt", ".pptx", ".doc", ".docx"])

function findSoffice(): string {
  if (process.platform === "win32") {
    const candidates = [
      path.join("C:", "Program Files", "LibreOffice", "program", "soffice.exe"),
      path.join("C:", "Program Files (x86)", "LibreOffice", "program", "soffice.exe"),
    ]
    for (const c of candidates) {
      if (existsSync(c)) return c
    }
  }
  return process.platform === "win32" ? "soffice" : "libreoffice"
}

async function ensurePreview(demandId: string, filename: string): Promise<string> {
  if (demandId.includes("..") || filename.includes("..")) throw new Error("INVALID")

  const ext = path.extname(filename).toLowerCase()
  if (!CONVERTIBLE.has(ext)) throw new Error("UNSUPPORTED")

  const uploadsDir = path.join(process.cwd(), "uploads", "demands", demandId)
  const filePath = path.join(uploadsDir, filename)
  if (!existsSync(filePath)) throw new Error("NOT_FOUND")

  const baseName = path.basename(filename, ext)
  const previewPath = path.join(uploadsDir, `${baseName}.preview.pdf`)

  // Check freshness: reconvert if source is newer than cached preview
  if (existsSync(previewPath)) {
    const [srcStat, prevStat] = await Promise.all([stat(filePath), stat(previewPath)])
    if (prevStat.mtimeMs >= srcStat.mtimeMs) return previewPath
  }

  // Convert with LibreOffice headless
  const tmpDir = path.join(os.tmpdir(), `lo-preview-${Date.now()}`)
  await mkdir(tmpDir, { recursive: true })
  try {
    const soffice = findSoffice()
    await execFileAsync(soffice, [
      "--headless",
      "--convert-to", "pdf",
      "--outdir", tmpDir,
      filePath,
    ], { timeout: 60000 })

    const convertedPath = path.join(tmpDir, `${baseName}.pdf`)
    if (!existsSync(convertedPath)) throw new Error("CONVERSION_FAILED")
    await copyFile(convertedPath, previewPath)
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }

  return previewPath
}

export async function HEAD(
  _request: NextRequest,
  { params }: { params: Promise<{ demandId: string; filename: string }> }
) {
  const { demandId, filename } = await params
  try {
    await ensurePreview(demandId, filename)
    return new NextResponse(null, { status: 200 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ""
    const status = msg === "NOT_FOUND" ? 404 : msg === "UNSUPPORTED" || msg === "INVALID" ? 400 : 500
    return new NextResponse(null, { status })
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ demandId: string; filename: string }> }
) {
  const { demandId, filename } = await params
  try {
    const previewPath = await ensurePreview(demandId, filename)
    const buffer = await readFile(previewPath)
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(path.basename(previewPath))}"`,
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ""
    if (msg === "NOT_FOUND") return NextResponse.json({ error: "檔案不存在" }, { status: 404 })
    if (msg === "UNSUPPORTED" || msg === "INVALID") return NextResponse.json({ error: "此格式不支援轉換" }, { status: 400 })
    return NextResponse.json(
      { error: "轉換失敗，請確認伺服器已安裝 LibreOffice", detail: msg },
      { status: 500 }
    )
  }
}

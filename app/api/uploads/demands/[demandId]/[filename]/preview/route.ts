import { NextRequest, NextResponse } from "next/server"
import { existsSync } from "fs"
import { readFile, mkdir, copyFile, rm, stat, writeFile } from "fs/promises"
import path from "path"
import os from "os"
import { execFile, exec } from "child_process"
import { promisify } from "util"

const execFileAsync = promisify(execFile)
const execAsync = promisify(exec)
const CONVERTIBLE = new Set([".ppt", ".pptx", ".doc", ".docx"])

function findSoffice(): string | null {
  if (process.platform === "win32") {
    const candidates = [
      path.join("C:", "Program Files", "LibreOffice", "program", "soffice.exe"),
      path.join("C:", "Program Files (x86)", "LibreOffice", "program", "soffice.exe"),
    ]
    for (const c of candidates) {
      if (existsSync(c)) return c
    }
    return null
  }
  return "libreoffice"
}

async function convertWithLibreOffice(filePath: string, outputDir: string, baseName: string): Promise<string> {
  const soffice = findSoffice()
  if (!soffice) throw new Error("NO_LIBREOFFICE")

  const tmpDir = path.join(os.tmpdir(), `lo-preview-${Date.now()}`)
  await mkdir(tmpDir, { recursive: true })
  try {
    await execFileAsync(soffice, [
      "--headless",
      "--convert-to", "pdf",
      "--outdir", tmpDir,
      filePath,
    ], { timeout: 60000 })

    const convertedPath = path.join(tmpDir, `${baseName}.pdf`)
    if (!existsSync(convertedPath)) throw new Error("CONVERSION_FAILED")
    const previewPath = path.join(outputDir, `${baseName}.preview.pdf`)
    await copyFile(convertedPath, previewPath)
    return previewPath
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}

async function convertWithPowerShell(filePath: string, outputDir: string, baseName: string, ext: string): Promise<string> {
  if (process.platform !== "win32") throw new Error("NOT_WINDOWS")

  const previewPath = path.join(outputDir, `${baseName}.preview.pdf`)
  const absInput = path.resolve(filePath).replace(/\//g, "\\")
  const absOutput = path.resolve(previewPath).replace(/\//g, "\\")

  const isPpt = [".ppt", ".pptx"].includes(ext)
  const isDoc = [".doc", ".docx"].includes(ext)

  let script: string
  if (isPpt) {
    script = `
$ErrorActionPreference = 'Stop'
$ppt = $null
$presentation = $null
try {
  $ppt = New-Object -ComObject PowerPoint.Application
  $presentation = $ppt.Presentations.Open('${absInput}', [Microsoft.Office.Core.MsoTriState]::msoTrue, [Microsoft.Office.Core.MsoTriState]::msoFalse, [Microsoft.Office.Core.MsoTriState]::msoFalse)
  $presentation.SaveAs('${absOutput}', 32)
} finally {
  if ($presentation) { $presentation.Close() }
  if ($ppt) { $ppt.Quit() }
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
  [System.GC]::Collect()
}
`
  } else if (isDoc) {
    script = `
$ErrorActionPreference = 'Stop'
$word = $null
$doc = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $doc = $word.Documents.Open('${absInput}', $false, $true)
  $doc.SaveAs([ref]'${absOutput}', [ref]17)
} finally {
  if ($doc) { $doc.Close([ref]$false) }
  if ($word) { $word.Quit() }
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
  [System.GC]::Collect()
}
`
  } else {
    throw new Error("UNSUPPORTED")
  }

  // Write script to temp file to avoid encoding issues
  const scriptPath = path.join(os.tmpdir(), `convert-${Date.now()}.ps1`)
  await writeFile(scriptPath, script, "utf-8")
  try {
    await execAsync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
      { timeout: 120000 }
    )
  } finally {
    await rm(scriptPath, { force: true }).catch(() => {})
  }

  if (!existsSync(previewPath)) throw new Error("CONVERSION_FAILED")
  return previewPath
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

  // Try LibreOffice first, then PowerShell COM automation
  try {
    return await convertWithLibreOffice(filePath, uploadsDir, baseName)
  } catch {
    // LibreOffice not available, try PowerShell
  }

  try {
    return await convertWithPowerShell(filePath, uploadsDir, baseName, ext)
  } catch {
    // PowerShell conversion also failed
  }

  throw new Error("CONVERSION_FAILED")
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
      { error: "轉換失敗，請確認伺服器已安裝 LibreOffice 或 Microsoft Office", detail: msg },
      { status: 500 }
    )
  }
}

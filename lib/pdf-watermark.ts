import { PDFDocument, rgb, StandardFonts, degrees, PDFFont, PDFPage } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import { readFile, writeFile, unlink, mkdtemp, rmdir } from "fs/promises"
import { exec } from "child_process"
import { promisify } from "util"
import path from "path"
import os from "os"
import { marked, type Token, type Tokens } from "marked"

const execAsync = promisify(exec)

// System CJK font paths (tried in order)
const CJK_FONT_PATHS = [
  "C:\\Windows\\Fonts\\kaiu.ttf",       // 楷體 (Traditional Chinese TTF)
  "C:\\Windows\\Fonts\\msjh.ttc",       // Microsoft JhengHei
  "C:\\Windows\\Fonts\\mingliu.ttc",    // MingLiU
  "/System/Library/Fonts/PingFang.ttc", // macOS
  "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
  "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
]

async function loadCJKFont(pdfDoc: PDFDocument): Promise<PDFFont | null> {
  pdfDoc.registerFontkit(fontkit)
  for (const fontPath of CJK_FONT_PATHS) {
    try {
      const fontBytes = await readFile(fontPath)
      return await pdfDoc.embedFont(fontBytes, { subset: false })
    } catch {
      continue
    }
  }
  return null
}

function drawWatermarkOnPage(
  page: PDFPage,
  text: string,
  font: PDFFont,
  fontSize: number = 16,
) {
  const { width, height } = page.getSize()
  // Draw diagonal watermark in a grid
  const spacingX = 280
  const spacingY = 140
  for (let y = -100; y < height + 200; y += spacingY) {
    for (let x = -200; x < width + 200; x += spacingX) {
      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0.6, 0.6, 0.6),
        opacity: 0.18,
        rotate: degrees(35),
      })
    }
  }
}

/** Add watermark to an existing PDF */
export async function watermarkPdf(
  pdfBytes: Buffer | Uint8Array,
  watermarkText: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const cjkFont = await loadCJKFont(pdfDoc)
  const font = cjkFont || (await pdfDoc.embedFont(StandardFonts.Helvetica))

  for (const page of pdfDoc.getPages()) {
    drawWatermarkOnPage(page, watermarkText, font)
  }
  return pdfDoc.save()
}

/** Create a PDF from plain text content with watermark */
export async function textToPdf(
  text: string,
  watermarkText: string,
  title?: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const cjkFont = await loadCJKFont(pdfDoc)
  const contentFont = cjkFont || (await pdfDoc.embedFont(StandardFonts.Courier))
  const watermarkFont = cjkFont || (await pdfDoc.embedFont(StandardFonts.Helvetica))

  const fontSize = 10
  const margin = 50
  const lineHeight = fontSize * 1.6
  const pageWidth = 595 // A4
  const pageHeight = 842

  // Split into lines and do basic word wrap
  const rawLines = text.split("\n")
  const maxCharsPerLine = Math.floor((pageWidth - margin * 2) / (fontSize * 0.55))

  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  // Optional title
  if (title) {
    const titleFont = cjkFont || (await pdfDoc.embedFont(StandardFonts.HelveticaBold))
    page.drawText(title, { x: margin, y, size: 14, font: titleFont, color: rgb(0, 0, 0) })
    y -= 30
  }

  for (const rawLine of rawLines) {
    // Simple wrap
    const wrappedLines = rawLine.length > maxCharsPerLine
      ? rawLine.match(new RegExp(`.{1,${maxCharsPerLine}}`, "g")) || [""]
      : [rawLine || " "] // empty lines need a space to advance

    for (const line of wrappedLines) {
      if (y < margin) {
        page = pdfDoc.addPage([pageWidth, pageHeight])
        y = pageHeight - margin
      }
      try {
        page.drawText(line, {
          x: margin,
          y,
          size: fontSize,
          font: contentFont,
          color: rgb(0.1, 0.1, 0.1),
        })
      } catch {
        // If font can't render certain chars, skip the line
        page.drawText("[無法顯示]", {
          x: margin,
          y,
          size: fontSize,
          font: watermarkFont,
          color: rgb(0.5, 0.5, 0.5),
        })
      }
      y -= lineHeight
    }
  }

  // Add watermark to all pages
  for (const p of pdfDoc.getPages()) {
    drawWatermarkOnPage(p, watermarkText, watermarkFont)
  }

  return pdfDoc.save()
}

// ── Markdown helpers ──

/** Strip inline markdown tokens to plain text */
function tokensToPlainText(tokens: Token[]): string {
  let text = ""
  for (const t of tokens) {
    if (t.type === "text") {
      // Use .text (parsed) not .raw (may include surrounding syntax)
      text += (t as Tokens.Text).text
    } else if (t.type === "codespan") {
      text += (t as Tokens.Codespan).text
    } else if (t.type === "strong" || t.type === "em" || t.type === "del") {
      text += "tokens" in t ? tokensToPlainText(t.tokens as Token[]) : (t as { text: string }).text ?? ""
    } else if (t.type === "link") {
      text += "tokens" in t ? tokensToPlainText(t.tokens as Token[]) : (t as Tokens.Link).text ?? ""
    } else if (t.type === "br") {
      text += "\n"
    } else if (t.type === "escape") {
      text += (t as Tokens.Escape).text
    } else if ("tokens" in t && Array.isArray(t.tokens)) {
      text += tokensToPlainText(t.tokens as Token[])
    } else if ("text" in t) {
      text += (t as { text: string }).text
    }
  }
  return text
}

/** Fallback: strip any remaining inline markdown syntax from text */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")       // **bold**
    .replace(/\*(.+?)\*/g, "$1")            // *italic*
    .replace(/__(.+?)__/g, "$1")            // __bold__
    .replace(/_(.+?)_/g, "$1")              // _italic_
    .replace(/~~(.+?)~~/g, "$1")            // ~~strikethrough~~
    .replace(/`([^`]+)`/g, "$1")            // `code`
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [link](url)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1") // ![image](url)
}

/** Check if inline tokens contain bold text */
function hasBold(tokens: Token[]): boolean {
  for (const t of tokens) {
    if (t.type === "strong") return true
    if ("tokens" in t && Array.isArray(t.tokens)) {
      if (hasBold(t.tokens as Token[])) return true
    }
  }
  return false
}

/** Measure actual text width using the font, fallback for CJK */
function measureTextWidth(text: string, font: PDFFont, fontSize: number): number {
  try {
    return font.widthOfTextAtSize(text, fontSize)
  } catch {
    // Font can't encode some chars – estimate: CJK ≈ fontSize, Latin ≈ 0.5*fontSize
    let w = 0
    for (const ch of text) {
      w += ch.charCodeAt(0) > 0x2e80 ? fontSize : fontSize * 0.55
    }
    return w
  }
}

/** Word-wrap text based on actual font width measurement */
function wrapTextByWidth(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string[] {
  if (!text || text.trim() === "") return [""]
  const chars = [...text] // handle multi-byte chars
  const lines: string[] = []
  let currentLine = ""
  let currentWidth = 0

  for (const char of chars) {
    let charWidth: number
    try {
      charWidth = font.widthOfTextAtSize(char, fontSize)
    } catch {
      charWidth = char.charCodeAt(0) > 0x2e80 ? fontSize : fontSize * 0.55
    }

    if (currentWidth + charWidth > maxWidth && currentLine.length > 0) {
      lines.push(currentLine)
      currentLine = char
      currentWidth = charWidth
    } else {
      currentLine += char
      currentWidth += charWidth
    }
  }

  if (currentLine) lines.push(currentLine)
  return lines.length > 0 ? lines : [""]
}

interface MdFonts {
  regular: PDFFont
  bold: PDFFont
  mono: PDFFont
  watermark: PDFFont
}

/** Diagram languages we can try to render via mermaid.ink */
const MERMAID_LANGS = new Set(["mermaid"])
/** Other diagram languages we can't render */
const OTHER_DIAGRAM_LANGS = new Set(["plantuml", "dot", "graphviz"])

/** Render mermaid code to PNG image bytes, trying multiple services */
async function renderMermaidToPng(code: string): Promise<Uint8Array | null> {
  // Strategy 1: kroki.io POST (most reliable, supports CJK)
  try {
    const res = await fetch("https://kroki.io/mermaid/png", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: code,
      signal: AbortSignal.timeout(20000),
    })
    if (res.ok) {
      const buf = await res.arrayBuffer()
      if (buf.byteLength > 100) return new Uint8Array(buf)
    }
    console.warn("kroki.io mermaid render failed:", res.status, await res.text().catch(() => ""))
  } catch (e) {
    console.warn("kroki.io mermaid render error:", e)
  }

  // Strategy 2: mermaid.ink with base64 encoding
  try {
    const encoded = Buffer.from(code).toString("base64")
    const url = `https://mermaid.ink/img/base64:${encoded}`
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (res.ok) {
      const buf = await res.arrayBuffer()
      if (buf.byteLength > 100) return new Uint8Array(buf)
    }
    console.warn("mermaid.ink render failed:", res.status)
  } catch (e) {
    console.warn("mermaid.ink render error:", e)
  }

  return null
}

/** Create a PDF from Markdown content with watermark */
export async function markdownToPdf(
  mdText: string,
  watermarkText: string,
  title?: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const cjkFont = await loadCJKFont(pdfDoc)

  const fonts: MdFonts = {
    regular: cjkFont || (await pdfDoc.embedFont(StandardFonts.Helvetica)),
    bold: cjkFont || (await pdfDoc.embedFont(StandardFonts.HelveticaBold)),
    mono: cjkFont || (await pdfDoc.embedFont(StandardFonts.Courier)),
    watermark: cjkFont || (await pdfDoc.embedFont(StandardFonts.Helvetica)),
  }

  const pageWidth = 595
  const pageHeight = 842
  const margin = 50
  const contentWidth = pageWidth - margin * 2

  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  function ensureSpace(needed: number) {
    if (y - needed < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
  }

  function drawTextSafe(
    text: string,
    x: number,
    yPos: number,
    font: PDFFont,
    size: number,
    color = rgb(0.1, 0.1, 0.1),
  ) {
    try {
      page.drawText(text, { x, y: yPos, size, font, color })
    } catch {
      try {
        page.drawText("[無法顯示]", { x, y: yPos, size, font: fonts.watermark, color: rgb(0.5, 0.5, 0.5) })
      } catch {
        // skip
      }
    }
  }

  /** Extract text from tokens, strip inline markdown as fallback */
  function extractText(tokens: Token[]): string {
    return stripInlineMarkdown(tokensToPlainText(tokens))
  }

  function wrapAndDraw(
    text: string,
    font: PDFFont,
    fontSize: number,
    lineHeight: number,
    indentX: number = margin,
    color = rgb(0.1, 0.1, 0.1),
  ) {
    const maxWidth = contentWidth - (indentX - margin)
    const lines = text.split("\n")

    for (const rawLine of lines) {
      if (rawLine.trim() === "") {
        y -= lineHeight * 0.5
        continue
      }
      const wrapped = wrapTextByWidth(rawLine, font, fontSize, maxWidth)

      for (const line of wrapped) {
        ensureSpace(lineHeight)
        drawTextSafe(line, indentX, y, font, fontSize, color)
        y -= lineHeight
      }
    }
  }

  // Optional title at top
  if (title) {
    ensureSpace(30)
    const titleWrapped = wrapTextByWidth(title, fonts.bold, 14, contentWidth)
    for (const line of titleWrapped) {
      ensureSpace(24)
      drawTextSafe(line, margin, y, fonts.bold, 14, rgb(0, 0, 0))
      y -= 24
    }
    y -= 6
  }

  // Parse markdown
  const tokens = marked.lexer(mdText)

  for (const token of tokens) {
    switch (token.type) {
      case "heading": {
        const t = token as Tokens.Heading
        const sizeMap: Record<number, number> = { 1: 22, 2: 18, 3: 15, 4: 13, 5: 12, 6: 11 }
        const fontSize = sizeMap[t.depth] || 12
        const lineHeight = fontSize * 1.8
        const text = extractText(t.tokens)

        y -= fontSize * 0.6 // space before heading
        const headingWrapped = wrapTextByWidth(text, fonts.bold, fontSize, contentWidth)
        for (const line of headingWrapped) {
          ensureSpace(lineHeight)
          drawTextSafe(line, margin, y, fonts.bold, fontSize, rgb(0.05, 0.05, 0.05))
          y -= lineHeight
        }
        // Underline for h1 and h2
        if (t.depth <= 2) {
          page.drawLine({
            start: { x: margin, y: y + fontSize * 0.3 },
            end: { x: pageWidth - margin, y: y + fontSize * 0.3 },
            thickness: t.depth === 1 ? 1.5 : 0.75,
            color: rgb(0.7, 0.7, 0.7),
          })
          y -= 6
        }
        break
      }

      case "paragraph": {
        const t = token as Tokens.Paragraph
        const text = extractText(t.tokens)
        const isBold = hasBold(t.tokens)
        const font = isBold ? fonts.bold : fonts.regular
        wrapAndDraw(text, font, 10, 16)
        y -= 6 // paragraph spacing
        break
      }

      case "list": {
        const t = token as Tokens.List
        for (let i = 0; i < t.items.length; i++) {
          const item = t.items[i]
          const bullet = t.ordered ? `${(t.start || 1) + i}. ` : "•  "
          const text = extractText(item.tokens)

          ensureSpace(16)
          drawTextSafe(bullet, margin + 8, y, fonts.regular, 10)
          wrapAndDraw(text, fonts.regular, 10, 16, margin + 24)
          y -= 2
        }
        y -= 6
        break
      }

      case "code": {
        const t = token as Tokens.Code
        const langLower = t.lang?.toLowerCase() || ""

        // Mermaid diagram: render to image via mermaid.ink
        if (MERMAID_LANGS.has(langLower)) {
          const pngBytes = await renderMermaidToPng(t.text)
          if (pngBytes) {
            try {
              const img = await pdfDoc.embedPng(pngBytes)
              const { width: imgW, height: imgH } = img.scale(1)
              const scale = Math.min(contentWidth / imgW, (pageHeight - margin * 2 - 20) / imgH, 1)
              const drawW = imgW * scale
              const drawH = imgH * scale

              y -= 8
              ensureSpace(drawH + 16)
              page.drawImage(img, {
                x: margin + (contentWidth - drawW) / 2, // center
                y: y - drawH,
                width: drawW,
                height: drawH,
              })
              y -= drawH + 12
              break
            } catch {
              // embed failed, fall through to placeholder
            }
          }
          // Fallback placeholder if rendering failed
          y -= 8
          ensureSpace(50)
          page.drawRectangle({
            x: margin,
            y: y - 30,
            width: contentWidth,
            height: 40,
            color: rgb(0.95, 0.95, 0.97),
            borderColor: rgb(0.8, 0.8, 0.85),
            borderWidth: 1,
          })
          drawTextSafe(
            `[ ${t.lang} 圖表 — 渲染失敗，請至線上版本檢視 ]`,
            margin + 12, y - 18, fonts.regular, 10, rgb(0.4, 0.4, 0.5),
          )
          y -= 46
          break
        }

        // Other unsupported diagram languages
        if (OTHER_DIAGRAM_LANGS.has(langLower)) {
          y -= 8
          ensureSpace(50)
          page.drawRectangle({
            x: margin,
            y: y - 30,
            width: contentWidth,
            height: 40,
            color: rgb(0.95, 0.95, 0.97),
            borderColor: rgb(0.8, 0.8, 0.85),
            borderWidth: 1,
          })
          drawTextSafe(
            `[ ${t.lang} 圖表 — 無法在 PDF 中呈現，請至線上版本檢視 ]`,
            margin + 12, y - 18, fonts.regular, 10, rgb(0.4, 0.4, 0.5),
          )
          y -= 46
          break
        }

        // Regular code block: gray background, monospace
        const codeLines = t.text.split("\n")
        const lineHeight = 14
        const codeMaxWidth = contentWidth - 16

        y -= 4

        // Language label
        if (t.lang) {
          ensureSpace(18)
          page.drawRectangle({
            x: margin - 4,
            y: y - 4,
            width: contentWidth + 8,
            height: 16,
            color: rgb(0.92, 0.92, 0.92),
          })
          drawTextSafe(t.lang, margin + 4, y, fonts.mono, 8, rgb(0.4, 0.4, 0.4))
          y -= 18
        }

        for (const codeLine of codeLines) {
          const wrapped = wrapTextByWidth(codeLine || " ", fonts.mono, 9, codeMaxWidth)
          for (const wl of wrapped) {
            ensureSpace(lineHeight)
            // Background per line
            page.drawRectangle({
              x: margin - 4,
              y: y - 4,
              width: contentWidth + 8,
              height: lineHeight,
              color: rgb(0.95, 0.95, 0.95),
            })
            drawTextSafe(wl, margin + 8, y, fonts.mono, 9, rgb(0.2, 0.2, 0.2))
            y -= lineHeight
          }
        }
        y -= 8
        break
      }

      case "blockquote": {
        const t = token as Tokens.Blockquote
        const text = extractText(t.tokens)
        const bqLines = text.split("\n").filter(l => l.trim())

        y -= 4
        for (const line of bqLines) {
          const maxW = contentWidth - 16
          const wrapped = wrapTextByWidth(line, fonts.regular, 10, maxW)
          for (const wl of wrapped) {
            ensureSpace(16)
            // Vertical bar
            page.drawRectangle({
              x: margin + 4,
              y: y - 3,
              width: 3,
              height: 14,
              color: rgb(0.75, 0.75, 0.75),
            })
            drawTextSafe(wl, margin + 16, y, fonts.regular, 10, rgb(0.35, 0.35, 0.35))
            y -= 16
          }
        }
        y -= 8
        break
      }

      case "hr": {
        y -= 8
        ensureSpace(20)
        page.drawLine({
          start: { x: margin, y },
          end: { x: pageWidth - margin, y },
          thickness: 1,
          color: rgb(0.7, 0.7, 0.7),
        })
        y -= 12
        break
      }

      case "table": {
        const t = token as Tokens.Table
        const cellPadding = 6
        const fontSize = 9
        const colCount = t.header.length

        // Measure column widths based on content
        const colTexts: string[][] = []
        for (let c = 0; c < colCount; c++) {
          const texts = [extractText(t.header[c].tokens)]
          for (const row of t.rows) {
            texts.push(extractText(row[c].tokens))
          }
          colTexts.push(texts)
        }

        // Compute natural widths (capped)
        const maxColWidth = contentWidth * 0.6
        const naturalWidths = colTexts.map((texts) => {
          const maxW = Math.max(...texts.map((txt) => measureTextWidth(txt, fonts.regular, fontSize)))
          return Math.min(maxW + cellPadding * 2, maxColWidth)
        })
        const totalNatural = naturalWidths.reduce((a, b) => a + b, 0)
        const colWidths = totalNatural > contentWidth
          ? naturalWidths.map((w) => (w / totalNatural) * contentWidth)
          : naturalWidths

        y -= 4

        // Helper to draw a table row with cell wrapping
        const drawRow = (cells: string[], font: PDFFont, bgColor?: ReturnType<typeof rgb>) => {
          // Compute wrapped lines per cell to determine row height
          const cellWrapped = cells.map((text, c) =>
            wrapTextByWidth(text, font, fontSize, colWidths[c] - cellPadding * 2)
          )
          const maxLines = Math.max(...cellWrapped.map((w) => w.length))
          const rowHeight = maxLines * (fontSize + 4) + cellPadding * 2

          ensureSpace(rowHeight)

          // Background
          if (bgColor) {
            page.drawRectangle({
              x: margin,
              y: y - rowHeight + fontSize + cellPadding,
              width: colWidths.reduce((a, b) => a + b, 0),
              height: rowHeight,
              color: bgColor,
            })
          }

          // Draw row border line
          const rowBottom = y - rowHeight + fontSize + cellPadding
          page.drawLine({
            start: { x: margin, y: rowBottom },
            end: { x: margin + colWidths.reduce((a, b) => a + b, 0), y: rowBottom },
            thickness: 0.5,
            color: rgb(0.82, 0.82, 0.82),
          })

          let cellX = margin
          for (let c = 0; c < colCount; c++) {
            let cellY = y
            for (const wl of cellWrapped[c]) {
              drawTextSafe(wl, cellX + cellPadding, cellY, font, fontSize)
              cellY -= fontSize + 4
            }
            cellX += colWidths[c]
          }

          y -= rowHeight
        }

        // Header
        const headerTexts = t.header.map((h) => extractText(h.tokens))
        drawRow(headerTexts, fonts.bold, rgb(0.92, 0.92, 0.92))

        // Data rows
        for (const row of t.rows) {
          const rowTexts = row.map((cell) => extractText(cell.tokens))
          drawRow(rowTexts, fonts.regular)
        }
        y -= 6
        break
      }

      case "space": {
        y -= 8
        break
      }

      default: {
        // Fallback: render raw text with inline syntax stripped
        if ("text" in token && typeof token.text === "string") {
          wrapAndDraw(stripInlineMarkdown(token.text), fonts.regular, 10, 16)
          y -= 4
        }
        break
      }
    }
  }

  // Watermark all pages
  for (const p of pdfDoc.getPages()) {
    drawWatermarkOnPage(p, watermarkText, fonts.watermark)
  }

  return pdfDoc.save()
}

/** Create a PDF from an image with watermark */
export async function imageToPdf(
  imageBytes: Buffer | Uint8Array,
  mimeType: string,
  watermarkText: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const cjkFont = await loadCJKFont(pdfDoc)
  const watermarkFont = cjkFont || (await pdfDoc.embedFont(StandardFonts.Helvetica))

  let image
  if (mimeType === "image/png") {
    image = await pdfDoc.embedPng(imageBytes)
  } else {
    image = await pdfDoc.embedJpg(imageBytes)
  }

  const { width, height } = image.scale(1)
  // Fit to A4-ish while preserving aspect ratio
  const maxW = 545 // A4 width minus margins
  const maxH = 742 // A4 height minus margins
  const scale = Math.min(maxW / width, maxH / height, 1)
  const drawW = width * scale
  const drawH = height * scale

  const pageW = drawW + 50
  const pageH = drawH + 100

  const page = pdfDoc.addPage([Math.max(pageW, 300), Math.max(pageH, 300)])
  page.drawImage(image, {
    x: 25,
    y: pageH - drawH - 25,
    width: drawW,
    height: drawH,
  })

  drawWatermarkOnPage(page, watermarkText, watermarkFont)
  return pdfDoc.save()
}

// LibreOffice paths to try (in order, use forward slashes for Windows compatibility)
const SOFFICE_PATHS = [
  "C:/Program Files/LibreOffice/program/soffice.exe",
  "C:/Program Files (x86)/LibreOffice/program/soffice.exe",
  "/usr/bin/soffice",
  "/usr/bin/libreoffice",
  "/Applications/LibreOffice.app/Contents/MacOS/soffice",
]

/**
 * Convert Office files (docx, xlsx, pptx, etc.) to PDF via LibreOffice headless,
 * then apply watermark.
 * Returns null if LibreOffice is not available.
 */
export async function officeToPdf(
  fileBytes: Buffer | Uint8Array,
  fileName: string,
  watermarkText: string,
): Promise<Uint8Array | null> {
  const ext = fileName.split(".").pop()?.toLowerCase() || ""
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "pdf-convert-"))
  const inputPath = path.join(tmpDir, `input.${ext}`)
  const outputPath = path.join(tmpDir, "input.pdf")

  try {
    await writeFile(inputPath, fileBytes)

    let converted = false
    for (const soffice of SOFFICE_PATHS) {
      try {
        const cmd = `"${soffice}" --headless --norestore --convert-to pdf --outdir "${tmpDir}" "${inputPath}"`
        await execAsync(cmd, { timeout: 60000 })
        converted = true
        break
      } catch {
        continue
      }
    }

    if (!converted) {
      console.warn("LibreOffice not found, cannot convert Office file to PDF")
      return null
    }

    const pdfBytes = await readFile(outputPath)
    return watermarkPdf(pdfBytes, watermarkText)
  } catch (e) {
    console.error("Office to PDF conversion error:", e)
    return null
  } finally {
    // Cleanup temp files
    await unlink(inputPath).catch(() => {})
    await unlink(outputPath).catch(() => {})
    await rmdir(tmpDir).catch(() => {})
  }
}

/** Create a simple cover-page PDF for unsupported file types */
export async function coverPagePdf(
  fileName: string,
  watermarkText: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const cjkFont = await loadCJKFont(pdfDoc)
  const font = cjkFont || (await pdfDoc.embedFont(StandardFonts.Helvetica))

  const page = pdfDoc.addPage([595, 842])
  const lines = [
    `Document: ${fileName}`,
    "",
    `Downloaded by: ${watermarkText}`,
    "",
    "This file format cannot be converted to PDF.",
    "The original file has been preserved in its native format.",
  ]

  let y = 600
  for (const line of lines) {
    try {
      page.drawText(line, { x: 50, y, size: 12, font, color: rgb(0.2, 0.2, 0.2) })
    } catch {
      // skip
    }
    y -= 24
  }

  drawWatermarkOnPage(page, watermarkText, font)
  return pdfDoc.save()
}

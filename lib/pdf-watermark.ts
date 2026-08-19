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
//
// 只放單一字型檔（.ttf / .otf）。.ttc 是「字型集合」，pdf-lib + fontkit 對它的支援不完整：
// embedFont() 會成功，但實際 drawText 時才炸 "this.font.layout is not a function"，
// 讓整個下載請求 500 —— 使用者只看到轉圈圈然後沒有檔案。所以下面刻意把 .ttc 排到最後，
// 且載入後會實際試排一次版才採用。
const CJK_FONT_PATHS = [
  // 一律用正斜線：Node 在 Windows 也吃得下，而且不會踩到 "\W" 這種反斜線跳脫陷阱
  "C:/Windows/Fonts/kaiu.ttf",       // 楷體 (Traditional Chinese TTF)
  "C:/Windows/Fonts/msjhl.ttf",      // Microsoft JhengHei Light（單檔版）
  "C:/Windows/Fonts/simsun.ttf",     // 新宋體
  "/usr/share/fonts/truetype/noto/NotoSansTC-Regular.otf",
  "/usr/share/fonts/opentype/noto/NotoSansTC-Regular.otf",
  "/usr/share/fonts/truetype/arphic/uming.ttc",
  "/System/Library/Fonts/PingFang.ttc",
  "C:/Windows/Fonts/msjh.ttc",
  "C:/Windows/Fonts/mingliu.ttc",
]

/** 抽樣字元：涵蓋中文、英數與時間戳會用到的符號 */
const FONT_PROBE_TEXT = "測試 Test 2026/01/01 10:00 |"

/**
 * 載入可用的中文字型。
 *
 * 兩個重點：
 * 1. subset: true —— 只嵌入實際用到的字。整包楷體約 4.9MB，不做 subset 等於每份下載的
 *    PDF 都白白多背幾 MB（實測 855KB 的來源檔會變成 3.6MB；subset 後只剩 737KB）。
 * 2. 嵌完要真的試排一次版。有些字型（特別是 .ttc）embedFont 會過、drawText 才炸，
 *    先驗證過才能安全地 fallback 到下一個候選字型，而不是讓整個請求掛掉。
 */
async function loadCJKFont(pdfDoc: PDFDocument): Promise<PDFFont | null> {
  pdfDoc.registerFontkit(fontkit)
  for (const fontPath of CJK_FONT_PATHS) {
    let font: PDFFont
    try {
      const fontBytes = await readFile(fontPath)
      font = await pdfDoc.embedFont(fontBytes, { subset: true })
    } catch {
      continue // 檔案不存在或格式不支援
    }
    try {
      font.widthOfTextAtSize(FONT_PROBE_TEXT, 12) // 會走到 fontkit 的 layout()
      return font
    } catch (e) {
      console.warn(`字型 ${fontPath} 無法排版，改用下一個候選：`, (e as Error)?.message)
      continue
    }
  }
  console.warn("找不到可用的中文字型，浮水印將退回 ASCII")
  return null
}

/** 中文字型不可用時，退回只留 ASCII 的浮水印文字，讓下載還是能完成 */
function toAsciiWatermark(text: string): string {
  const ascii = text.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim()
  return ascii.length >= 8
    ? ascii
    : `RESTRICTED ${new Date().toISOString().slice(0, 19).replace("T", " ")}`
}

function drawWatermarkOnPage(
  page: PDFPage,
  text: string,
  font: PDFFont,
  fontSize: number = 16,
  fallbackFont?: PDFFont,
) {
  const { width, height } = page.getSize()
  // 先試一次：字型畫不出這段文字就整頁改用 ASCII 版，不要每格都丟例外
  let drawText = text
  let drawFont = font
  try {
    font.widthOfTextAtSize(text, fontSize)
  } catch {
    if (!fallbackFont) return // 沒有備援字型就跳過浮水印，也不要讓整份檔案失敗
    drawText = toAsciiWatermark(text)
    drawFont = fallbackFont
  }

  // Draw diagonal watermark in a grid
  const spacingX = 280
  const spacingY = 140
  for (let y = -100; y < height + 200; y += spacingY) {
    for (let x = -200; x < width + 200; x += spacingX) {
      try {
        page.drawText(drawText, {
          x,
          y,
          size: fontSize,
          font: drawFont,
          color: rgb(0.6, 0.6, 0.6),
          opacity: 0.18,
          rotate: degrees(35),
        })
      } catch {
        return // 這頁畫不了就放棄這頁，不要拖垮整個下載
      }
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
  const latinFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const font = cjkFont || latinFont
  const text = cjkFont ? watermarkText : toAsciiWatermark(watermarkText)

  for (const page of pdfDoc.getPages()) {
    drawWatermarkOnPage(page, text, font, 16, latinFont)
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
  const latinFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const watermarkFont = cjkFont || latinFont

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
    drawWatermarkOnPage(p, watermarkText, watermarkFont, 16, latinFont)
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

  const latinFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fonts: MdFonts = {
    regular: cjkFont || latinFont,
    bold: cjkFont || (await pdfDoc.embedFont(StandardFonts.HelveticaBold)),
    mono: cjkFont || (await pdfDoc.embedFont(StandardFonts.Courier)),
    watermark: cjkFont || latinFont,
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
    drawWatermarkOnPage(p, watermarkText, fonts.watermark, 16, latinFont)
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
  const latinFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const watermarkFont = cjkFont || latinFont

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

  drawWatermarkOnPage(page, watermarkText, watermarkFont, 16, latinFont)
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

    // For Excel files: set page setup to landscape + fit all columns on one page
    if (ext === "xlsx") {
      try {
        const ExcelJS = await import("exceljs")
        const workbook = new ExcelJS.Workbook()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await workbook.xlsx.load(fileBytes as any)
        workbook.eachSheet((ws: any) => {
          ws.pageSetup = {
            ...ws.pageSetup,
            orientation: "landscape" as const,
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            paperSize: 9, // A4
          }
        })
        const modifiedBuffer = await workbook.xlsx.writeBuffer()
        await writeFile(inputPath, Buffer.from(modifiedBuffer))
      } catch (e) {
        console.warn("Failed to modify Excel page setup, using original:", e)
      }
    }

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
  const latinFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const font = cjkFont || latinFont

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

  drawWatermarkOnPage(page, watermarkText, font, 16, latinFont)
  return pdfDoc.save()
}

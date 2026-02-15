"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

/* ─── Types ─── */
interface ExcelSheet { name: string; html: string }
interface ExcelPreviewProps {
  fileUrl: string
  className?: string
}

/* ─── Color helpers ─── */
const THEME_COLORS = [
  "FFFFFF", "000000", "E7E6E6", "44546A",
  "4472C4", "ED7D31", "A5A5A5", "FFC000",
  "5B9BD5", "70AD47",
]

const INDEXED_COLORS: Record<number, string> = {
  0: "000000", 1: "FFFFFF", 2: "FF0000", 3: "00FF00",
  4: "0000FF", 5: "FFFF00", 6: "FF00FF", 7: "00FFFF",
  8: "000000", 9: "FFFFFF", 10: "FF0000", 11: "00FF00",
  12: "0000FF", 13: "FFFF00", 14: "FF00FF", 15: "00FFFF",
  16: "800000", 17: "008000", 18: "000080", 19: "808000",
  20: "800080", 21: "008080", 22: "C0C0C0", 23: "808080",
  24: "9999FF", 25: "993366", 26: "FFFFCC", 27: "CCFFFF",
  28: "660066", 29: "FF8080", 30: "0066CC", 31: "CCCCFF",
  32: "000080", 33: "FF00FF", 34: "FFFF00", 35: "00FFFF",
  36: "800080", 37: "800000", 38: "008080", 39: "0000FF",
  40: "00CCFF", 41: "CCFFFF", 42: "CCFFCC", 43: "FFFF99",
  44: "99CCFF", 45: "FF99CC", 46: "CC99FF", 47: "FFCC99",
  48: "3366FF", 49: "33CCCC", 50: "99CC00", 51: "FFCC00",
  52: "FF9900", 53: "FF6600", 54: "666699", 55: "969696",
  56: "003366", 57: "339966", 58: "003300", 59: "333300",
  60: "993300", 61: "993366", 62: "333399", 63: "333333",
  64: "000000",
}

function applyTint(hex: string, tint: number): string {
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  const apply = (c: number) => {
    if (tint < 0) return Math.round(c * (1 + tint))
    return Math.round(c + (255 - c) * tint)
  }
  const clamp = (v: number) => Math.max(0, Math.min(255, v))
  const toHex = (v: number) => clamp(apply(v)).toString(16).padStart(2, "0")
  return toHex(r) + toHex(g) + toHex(b)
}

function resolveColor(
  color: { argb?: string; theme?: number; indexed?: number; tint?: number } | undefined | null,
): string | null {
  if (!color) return null
  if (color.argb) {
    const hex = color.argb.length === 8 ? color.argb.substring(2) : color.argb
    if (hex === "000000" && !color.tint) return null // skip default black
    return `#${color.tint ? applyTint(hex, color.tint) : hex}`
  }
  if (color.theme !== undefined && color.theme < THEME_COLORS.length) {
    const base = THEME_COLORS[color.theme]
    const hex = color.tint ? applyTint(base, color.tint) : base
    return `#${hex}`
  }
  if (color.indexed !== undefined && INDEXED_COLORS[color.indexed]) {
    return `#${INDEXED_COLORS[color.indexed]}`
  }
  return null
}

/* ─── HTML generation ─── */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function decodeCellRef(ref: string): { r: number; c: number } {
  const m = ref.match(/^\$?([A-Z]+)\$?(\d+)$/)
  if (!m) return { r: 0, c: 0 }
  let col = 0
  for (const ch of m[1]) col = col * 26 + ch.charCodeAt(0) - 64
  return { r: parseInt(m[2]), c: col }
}

function worksheetToHtml(ws: any): string {
  const rowCount = ws.rowCount
  const colCount = ws.columnCount
  if (!rowCount || !colCount) return ""

  // Merge map
  const mergeMap = new Map<string, { rowSpan: number; colSpan: number }>()
  const skipCells = new Set<string>()
  const merges: string[] = ws.model?.merges || []
  for (const range of merges) {
    const [startRef, endRef] = range.split(":")
    if (!startRef || !endRef) continue
    const s = decodeCellRef(startRef)
    const e = decodeCellRef(endRef)
    mergeMap.set(`${s.r}-${s.c}`, { rowSpan: e.r - s.r + 1, colSpan: e.c - s.c + 1 })
    for (let r = s.r; r <= e.r; r++)
      for (let c = s.c; c <= e.c; c++)
        if (r !== s.r || c !== s.c) skipCells.add(`${r}-${c}`)
  }

  let html = "<table>"

  // Column widths
  let hasColWidths = false
  for (let c = 1; c <= colCount; c++) {
    const col = ws.getColumn(c)
    if (col.width) { hasColWidths = true; break }
  }
  if (hasColWidths) {
    html += "<colgroup>"
    for (let c = 1; c <= colCount; c++) {
      const col = ws.getColumn(c)
      const w = col.width ? Math.round(col.width * 7.5) : 64
      html += `<col style="width:${w}px">`
    }
    html += "</colgroup>"
  }

  ws.eachRow({ includeEmpty: true }, (row: any, rowNumber: number) => {
    html += "<tr>"
    for (let c = 1; c <= colCount; c++) {
      if (skipCells.has(`${rowNumber}-${c}`)) continue

      const cell = row.getCell(c)
      const styles: string[] = []
      let attrs = ""

      // Merge
      const mi = mergeMap.get(`${rowNumber}-${c}`)
      if (mi) {
        if (mi.colSpan > 1) attrs += ` colspan="${mi.colSpan}"`
        if (mi.rowSpan > 1) attrs += ` rowspan="${mi.rowSpan}"`
      }

      // Background
      const fill = cell.fill
      if (fill?.type === "pattern" && fill.pattern !== "none") {
        const bg = resolveColor(fill.fgColor)
        if (bg && bg.toUpperCase() !== "#FFFFFF") styles.push(`background-color:${bg}`)
      }

      // Font
      const font = cell.font
      if (font) {
        if (font.bold) styles.push("font-weight:bold")
        if (font.italic) styles.push("font-style:italic")
        if (font.underline) styles.push("text-decoration:underline")
        if (font.strike) styles.push("text-decoration:line-through")
        if (font.color) {
          const tc = resolveColor(font.color)
          if (tc && tc.toUpperCase() !== "#000000") styles.push(`color:${tc}`)
        }
        if (font.size && font.size !== 11) styles.push(`font-size:${font.size}pt`)
      }

      // Alignment
      const al = cell.alignment
      if (al) {
        if (al.horizontal && al.horizontal !== "general")
          styles.push(`text-align:${al.horizontal}`)
        if (al.vertical)
          styles.push(`vertical-align:${al.vertical === "middle" ? "middle" : al.vertical}`)
        if (al.wrapText) styles.push("white-space:normal;word-wrap:break-word")
      }

      // Border (only if explicitly set)
      const border = cell.border
      if (border) {
        const mapStyle = (s: string) => {
          if (s === "thin") return "1px solid"
          if (s === "medium") return "2px solid"
          if (s === "thick") return "3px solid"
          if (s === "dotted") return "1px dotted"
          if (s === "dashed") return "1px dashed"
          if (s === "double") return "3px double"
          return "1px solid"
        }
        for (const side of ["top", "right", "bottom", "left"] as const) {
          const b = border[side]
          if (b?.style) {
            const bc = resolveColor(b.color) || "#D1D5DB"
            styles.push(`border-${side}:${mapStyle(b.style)} ${bc}`)
          }
        }
      }

      // Value
      const styleAttr = styles.length ? ` style="${styles.join(";")}"` : ""
      let displayHtml = ""
      const val = cell.value
      if (val && typeof val === "object" && "richText" in val) {
        displayHtml = (val as any).richText
          .map((rt: any) => {
            let t = escapeHtml(String(rt.text ?? ""))
            if (rt.font?.bold) t = `<b>${t}</b>`
            if (rt.font?.italic) t = `<i>${t}</i>`
            if (rt.font?.underline) t = `<u>${t}</u>`
            if (rt.font?.color) {
              const c = resolveColor(rt.font.color)
              if (c) t = `<span style="color:${c}">${t}</span>`
            }
            return t
          })
          .join("")
      } else if (val && typeof val === "object" && "result" in val) {
        displayHtml = escapeHtml(String((val as any).result ?? ""))
      } else if (val && typeof val === "object" && "text" in val) {
        displayHtml = escapeHtml(String((val as any).text ?? ""))
      } else if (val instanceof Date) {
        displayHtml = escapeHtml(val.toLocaleDateString())
      } else {
        // Prefer formatted value (.text on model) if available
        const txt = cell.text ?? String(val ?? "")
        displayHtml = escapeHtml(txt)
      }

      html += `<td${attrs}${styleAttr}>${displayHtml}</td>`
    }
    html += "</tr>"
  })

  html += "</table>"
  return html
}

/* ─── XLSX fallback (for .xls files) ─── */
async function parseWithXlsx(buf: ArrayBuffer): Promise<ExcelSheet[]> {
  const XLSX = (await import("xlsx")).default || (await import("xlsx"))
  const wb = XLSX.read(buf, { type: "array" })
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]
    const html = XLSX.utils.sheet_to_html(ws, { id: `sheet-${name}` })
    return { name, html }
  })
}

/* ─── Component ─── */
export function ExcelPreview({ fileUrl, className }: ExcelPreviewProps) {
  const [sheets, setSheets] = useState<ExcelSheet[]>([])
  const [activeSheet, setActiveSheet] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    setSheets([])
    setActiveSheet(0)

    ;(async () => {
      try {
        const res = await fetch(fileUrl)
        const buf = await res.arrayBuffer()
        if (cancelled) return

        const ext = fileUrl.split(".").pop()?.toLowerCase() || ""
        let parsed: ExcelSheet[] = []

        if (ext === "xls") {
          // Old format – use XLSX (SheetJS) fallback
          parsed = await parseWithXlsx(buf)
        } else {
          // .xlsx – use ExcelJS for full style support
          try {
            const ExcelJS = await import("exceljs")
            const workbook = new ExcelJS.Workbook()
            await workbook.xlsx.load(buf)
            if (cancelled) return
            workbook.eachSheet((ws) => {
              parsed.push({ name: ws.name, html: worksheetToHtml(ws) })
            })
          } catch {
            // ExcelJS failed – fall back to XLSX
            parsed = await parseWithXlsx(buf)
          }
        }

        if (!cancelled) setSheets(parsed)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [fileUrl])

  if (loading) {
    return <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
  }

  if (error || sheets.length === 0) return null

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <div className="flex border-b border-border bg-muted/30 overflow-x-auto shrink-0">
          {sheets.map((sheet, i) => (
            <button
              key={i}
              onClick={() => setActiveSheet(i)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors",
                i === activeSheet
                  ? "border-primary text-primary bg-background"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}

      {/* Sheet content */}
      <div
        className="w-full max-h-[520px] overflow-auto p-4 text-sm [&_table]:border-collapse [&_table]:min-w-max [&_td]:border [&_td]:border-border [&_td]:px-2.5 [&_td]:py-1.5 [&_td]:text-xs [&_td]:whitespace-nowrap [&_th]:border [&_th]:border-border [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-xs [&_th]:bg-muted/50 [&_th]:font-medium [&_th]:whitespace-nowrap"
        dangerouslySetInnerHTML={{ __html: sheets[activeSheet]?.html || "" }}
      />
    </div>
  )
}

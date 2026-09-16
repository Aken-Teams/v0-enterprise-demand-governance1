/**
 * Markdown 前處理。
 *
 * 系統內的流程文件多半來自 HackMD，會夾帶 HackMD 專屬的擴充語法：
 *   - 容器：`:::spoiler` / `:::info` / `:::warning` …
 *   - 高亮：`==重點==`
 * 這些都不是標準 Markdown，react-markdown 會原樣印出，
 * 因此先轉成 HTML 再交給渲染器（各處皆已啟用 rehype-raw）。
 */

/** HackMD 提示框類型 → 呈現樣式 */
const ALERT_STYLES: Record<string, { border: string; bg: string }> = {
  info: { border: "#3b82f6", bg: "rgba(59,130,246,0.06)" },
  primary: { border: "#6366f1", bg: "rgba(99,102,241,0.06)" },
  success: { border: "#10b981", bg: "rgba(16,185,129,0.06)" },
  warning: { border: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
  danger: { border: "#ef4444", bg: "rgba(239,68,68,0.06)" },
}

const MARK_STYLE = "background-color:#fef08a;padding:0 0.15em;border-radius:0.15em;"

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/**
 * 容器標題會被放進 <summary> 等原生 HTML 標籤內，Markdown 不會再解析它，
 * 因此手動處理最常見的行內語法（粗體／斜體／行內程式碼／高亮），
 * 否則標題會顯示成 `**修改歷程資訊**` 這種帶星號的原文。
 */
function inlineMarkdownToHtml(raw: string): string {
  return escapeHtml(raw)
    .replace(/==(.+?)==/g, `<mark style="${MARK_STYLE}">$1</mark>`)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
}

/**
 * 將一行中的 `==高亮==` 轉為 <mark>，但略過行內程式碼（反引號包住的片段），
 * 避免把程式碼裡的等號誤判成語法。
 */
function markHighlightsInLine(line: string): string {
  if (!line.includes("==")) return line
  // 以反引號切段：偶數索引在程式碼外、奇數索引在程式碼內
  return line
    .split(/(`[^`]*`)/g)
    .map((seg, i) => (i % 2 === 1 ? seg : seg.replace(/==([^=\n]+)==/g, `<mark style="${MARK_STYLE}">$1</mark>`)))
    .join("")
}

/**
 * 將 HackMD 擴充語法展開成 HTML。
 *
 *   :::spoiler 標題        → <details><summary>標題</summary>…</details>
 *   :::info / warning …    → 帶左側色條的區塊
 *   ==重點==               → <mark> 螢光標記
 *
 * 未知的容器類型一律以中性區塊呈現，至少不會把 `:::xxx` 這行字直接印在畫面上。
 */
export function preprocessMarkdown(md: string): string {
  if (!md) return md
  // 一律先正規化換行。CRLF 的檔案若保留 CR，後續逐行解析（目錄、差異標註）會整個失效：
  // JS 正則的 `.` 不匹配 CR，`^#{1,6}\s+(.*)$` 於是對不上任何一行標題。
  md = md.replace(/\r\n?/g, "\n")
  if (!md.includes(":::") && !md.includes("==")) return md

  const lines = md.split("\n")
  const out: string[] = []
  // 以堆疊追蹤巢狀容器，收到 ::: 就關掉最近開啟的那一層
  const stack: string[] = []
  // 圍欄式程式碼區塊內不做任何轉換
  let inFence = false

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      out.push(line)
      continue
    }
    if (inFence) {
      out.push(line)
      continue
    }

    const open = line.match(/^\s*:::\s*([A-Za-z][\w-]*)\s*(.*)$/)
    const close = /^\s*:::\s*$/.test(line)

    if (open) {
      const kind = open[1].toLowerCase()
      const title = open[2].trim()
      if (kind === "spoiler") {
        out.push(
          `<details style="margin:0.75rem 0;border:1px solid #e5e7eb;border-radius:0.5rem;padding:0.5rem 0.75rem;">` +
            `<summary style="cursor:pointer;font-weight:600;">${inlineMarkdownToHtml(title || "展開內容")}</summary>` +
            `<div style="margin-top:0.5rem;">`
        )
        stack.push("</div></details>")
      } else {
        const st = ALERT_STYLES[kind] ?? { border: "#9ca3af", bg: "rgba(156,163,175,0.08)" }
        out.push(
          `<div style="margin:0.75rem 0;border-left:3px solid ${st.border};background:${st.bg};` +
            `border-radius:0.375rem;padding:0.5rem 0.75rem;">`
        )
        if (title) out.push(`<p style="font-weight:600;margin:0 0 0.25rem;">${inlineMarkdownToHtml(title)}</p>`)
        stack.push("</div>")
      }
      // 容器內容需與 HTML 標籤間隔空行，Markdown 才會繼續解析
      out.push("")
      continue
    }

    if (close && stack.length > 0) {
      out.push("")
      out.push(stack.pop() as string)
      // 關閉標籤後同樣要留空行，否則後續的 ---、> 、**粗體** 會被當成 HTML 區塊的延續而不解析
      out.push("")
      continue
    }

    out.push(markHighlightsInLine(line))
  }

  // 內容未正確收尾時補上結尾標籤，避免版面被未閉合的區塊吃掉
  while (stack.length > 0) {
    out.push("")
    out.push(stack.pop() as string)
    out.push("")
  }

  return out.join("\n")
}

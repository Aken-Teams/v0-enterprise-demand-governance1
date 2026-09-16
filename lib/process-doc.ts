/**
 * 開發流程文件的閱讀輔助：目錄（TOC）與「本版變更」標註。
 *
 * 兩者都以 **前處理後** 的 Markdown 行號為基準——ReactMarkdown 拿到的是
 * preprocessMarkdown() 的輸出，其 AST 的 position.start.line 也是對應那份文字；
 * 若改用原始 Markdown 的行號，容器展開（:::info 等）造成的行數位移會讓標註跑掉。
 */

import { diffLines } from "@/lib/diff"
import { preprocessMarkdown } from "@/lib/markdown"

export interface TocItem {
  /** 錨點 id，與渲染時標題掛上的 id 一致（以行號產生，必定唯一） */
  id: string
  text: string
  /** 標題層級 1–6 */
  level: number
  /** 此標題所屬章節是否含有本版變更 */
  changed?: boolean
  /** 前處理後的起始行號 */
  line: number
  /** 該章節涵蓋到的最後一行（下一個同級或更高級標題之前） */
  endLine: number
}

/** 標題錨點 id：用行號而非標題文字，避免同名小標（「目的」「簽核」）互撞 */
export function headingId(line: number | null | undefined): string | undefined {
  return typeof line === "number" ? `sec-${line}` : undefined
}

/** 去掉標題文字裡的行內標記，讓目錄乾淨好讀 */
function plainHeadingText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, "")
    .replace(/==(.+?)==/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.+?)\]\([^)]*\)/g, "$1")
    .trim()
}

/**
 * 由前處理後的 Markdown 取出目錄。
 *
 * 圍欄式程式碼區塊內的 `#` 不算標題（Mermaid、範例程式常出現）。
 */
export function buildToc(processedMd: string, maxLevel = 3): TocItem[] {
  if (!processedMd) return []
  // 保險：呼叫端多半已由 preprocessMarkdown 正規化，但直接傳原始檔進來也要能解析
  const lines = processedMd.replace(/\r\n?/g, "\n").split("\n")
  const items: TocItem[] = []
  let inFence = false

  lines.forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      return
    }
    if (inFence) return
    const m = line.match(/^(#{1,6})\s+(.*)$/)
    if (!m) return
    const level = m[1].length
    if (level > maxLevel) return
    const text = plainHeadingText(m[2])
    if (!text) return
    // 行號自 1 起算，與 AST 的 position.start.line 對齊
    items.push({ id: `sec-${i + 1}`, text, level, line: i + 1, endLine: lines.length })
  })

  // 章節結束行 = 下一個層級相同或更高的標題前一行
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[j].level <= items[i].level) {
        items[i].endLine = items[j].line - 1
        break
      }
    }
  }
  return items
}

/**
 * 算出「這一版新增或修改」的行號集合（以新版前處理後的行號表示）。
 *
 * 修改在行級比對下呈現為「刪一行 + 加一行」，因此涵蓋在 add 內；
 * 純刪除沒有對應的新版行號，無法標註在畫面上——那類變更請看版本差異。
 */
export function changedLineSet(prevContent: string, currentContent: string): Set<number> {
  const set = new Set<number>()
  if (!prevContent || !currentContent) return set
  const lines = diffLines(preprocessMarkdown(prevContent), preprocessMarkdown(currentContent))
  for (const l of lines) {
    if (l.op === "add" && l.newNo != null) set.add(l.newNo)
  }
  return set
}

/** 區間內是否有任一行被標記為變更（供區塊元素判斷要不要上底色） */
export function rangeHasChange(
  changed: Set<number>,
  start: number | null | undefined,
  end: number | null | undefined
): boolean {
  if (changed.size === 0 || typeof start !== "number") return false
  const last = typeof end === "number" ? end : start
  for (let i = start; i <= last; i++) {
    if (changed.has(i)) return true
  }
  return false
}

/** 標記目錄中哪些章節含有本版變更 */
export function markChangedSections(toc: TocItem[], changed: Set<number>): TocItem[] {
  if (changed.size === 0) return toc
  return toc.map((item) => ({
    ...item,
    changed: rangeHasChange(changed, item.line, item.endLine),
  }))
}

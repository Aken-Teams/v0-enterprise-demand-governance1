/**
 * 行級文字差異比對（供開發流程文件的版本對照使用）。
 *
 * 採 LCS（最長共同子序列）計算，先裁掉頭尾相同的部分再進 DP，
 * 讓「只改中間幾行」這種常見情況不必付出整份文件的計算成本。
 */

export type DiffOp = "same" | "add" | "del"

export interface DiffLine {
  op: DiffOp
  text: string
  /** 舊版行號（新增行為 null） */
  oldNo: number | null
  /** 新版行號（刪除行為 null） */
  newNo: number | null
}

/** 一段變更區塊（含前後脈絡），近似 GitHub 的 hunk */
export interface DiffHunk {
  oldStart: number
  newStart: number
  lines: DiffLine[]
}

export interface DiffStats {
  added: number
  removed: number
  /** 兩版之間是否完全相同 */
  identical: boolean
}

/** 超過此行數就不做完整 LCS，改以粗略比對避免記憶體爆掉 */
const MAX_LCS_CELLS = 4_000_000

function splitLines(text: string): string[] {
  // 統一換行符，避免 CRLF/LF 差異被誤判成整份文件都改了
  return text.replace(/\r\n?/g, "\n").split("\n")
}

/**
 * 比對兩份文字，回傳逐行的差異結果。
 */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = splitLines(oldText)
  const b = splitLines(newText)

  // 頭尾相同的部分直接保留，縮小 DP 範圍
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head++

  let tail = 0
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  ) {
    tail++
  }

  const aMid = a.slice(head, a.length - tail)
  const bMid = b.slice(head, b.length - tail)

  const result: DiffLine[] = []
  for (let i = 0; i < head; i++) {
    result.push({ op: "same", text: a[i], oldNo: i + 1, newNo: i + 1 })
  }

  result.push(...diffCore(aMid, bMid, head))

  for (let i = 0; i < tail; i++) {
    const oldNo = a.length - tail + i + 1
    const newNo = b.length - tail + i + 1
    result.push({ op: "same", text: a[oldNo - 1], oldNo, newNo })
  }

  return result
}

/** 對已裁掉頭尾的區段做 LCS；offset 為該區段在原文中的起始行位移 */
function diffCore(a: string[], b: string[], offset: number): DiffLine[] {
  if (a.length === 0 && b.length === 0) return []
  if (a.length === 0) {
    return b.map((text, i) => ({ op: "add" as const, text, oldNo: null, newNo: offset + i + 1 }))
  }
  if (b.length === 0) {
    return a.map((text, i) => ({ op: "del" as const, text, oldNo: offset + i + 1, newNo: null }))
  }

  // 文件過大時退化為「整段刪除 + 整段新增」，仍可看出改動範圍
  if (a.length * b.length > MAX_LCS_CELLS) {
    return [
      ...a.map((text, i) => ({ op: "del" as const, text, oldNo: offset + i + 1, newNo: null })),
      ...b.map((text, i) => ({ op: "add" as const, text, oldNo: null, newNo: offset + i + 1 })),
    ]
  }

  const m = a.length
  const n = b.length
  const width = n + 1
  const dp = new Int32Array((m + 1) * width)

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i * width + j] =
        a[i] === b[j]
          ? dp[(i + 1) * width + (j + 1)] + 1
          : Math.max(dp[(i + 1) * width + j], dp[i * width + (j + 1)])
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ op: "same", text: a[i], oldNo: offset + i + 1, newNo: offset + j + 1 })
      i++
      j++
    } else if (dp[(i + 1) * width + j] >= dp[i * width + (j + 1)]) {
      out.push({ op: "del", text: a[i], oldNo: offset + i + 1, newNo: null })
      i++
    } else {
      out.push({ op: "add", text: b[j], oldNo: null, newNo: offset + j + 1 })
      j++
    }
  }
  while (i < m) {
    out.push({ op: "del", text: a[i], oldNo: offset + i + 1, newNo: null })
    i++
  }
  while (j < n) {
    out.push({ op: "add", text: b[j], oldNo: null, newNo: offset + j + 1 })
    j++
  }
  return out
}

/** 統計新增/刪除行數 */
export function diffStats(lines: DiffLine[]): DiffStats {
  let added = 0
  let removed = 0
  for (const l of lines) {
    if (l.op === "add") added++
    else if (l.op === "del") removed++
  }
  return { added, removed, identical: added === 0 && removed === 0 }
}

/**
 * 把逐行結果收斂成變更區塊，未變動的長段落會被摺疊，
 * 只保留變更前後各 `context` 行作為脈絡。
 */
export function toHunks(lines: DiffLine[], context = 3): DiffHunk[] {
  const changed = lines.map((l) => l.op !== "same")
  if (!changed.some(Boolean)) return []

  // 標記需要保留的行（變更行 + 其前後脈絡）
  const keep = new Array<boolean>(lines.length).fill(false)
  for (let i = 0; i < lines.length; i++) {
    if (!changed[i]) continue
    for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) {
      keep[k] = true
    }
  }

  const hunks: DiffHunk[] = []
  let cur: DiffLine[] = []
  for (let i = 0; i < lines.length; i++) {
    if (keep[i]) {
      cur.push(lines[i])
    } else if (cur.length > 0) {
      hunks.push(makeHunk(cur))
      cur = []
    }
  }
  if (cur.length > 0) hunks.push(makeHunk(cur))
  return hunks
}

function makeHunk(lines: DiffLine[]): DiffHunk {
  const firstOld = lines.find((l) => l.oldNo != null)?.oldNo ?? 0
  const firstNew = lines.find((l) => l.newNo != null)?.newNo ?? 0
  return { oldStart: firstOld, newStart: firstNew, lines }
}

/** 一個有變動的章節 */
export interface ChangedSection {
  /** 完整路徑，例如「Phase 6 — 結案 › SP 結算規則」 */
  path: string
  /** 最上層章節，供分組收斂用 */
  top: string
  /** 末層小節 */
  leaf: string
  /** 該區段的第一個變更行，供捲動定位 */
  firstChanged: DiffLine
}

/**
 * 抓出有變動的 Markdown 章節，讓使用者一眼看出「改了哪些區塊」。
 *
 * 以標題層級維護路徑：像「目的」「簽核」「階段產出」這類小標會在多個章節重複出現，
 * 只回傳最近的標題會失去脈絡，因此一併附上上層章節。
 */
export function changedSections(lines: DiffLine[]): ChangedSection[] {
  const sections: ChangedSection[] = []
  const seen = new Set<string>()
  const stack: { level: number; text: string }[] = []

  const record = (line: DiffLine) => {
    if (stack.length === 0) return
    // 最多顯示兩層，過長的路徑反而難讀
    const parts = stack.slice(-2).map((h) => h.text)
    const path = parts.join(" › ")
    if (!path || seen.has(path)) return
    seen.add(path)
    sections.push({
      path,
      top: stack[0].text,
      leaf: parts[parts.length - 1],
      firstChanged: line,
    })
  }

  for (const l of lines) {
    const m = l.text.match(/^(#{1,6})\s+(.*)$/)
    if (m) {
      const level = m[1].length
      const text = m[2].trim()
      while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop()
      if (text) stack.push({ level, text })
      if (l.op !== "same") record(l)
      continue
    }
    if (l.op !== "same") record(l)
  }
  return sections
}

"use client"

import {
  Children, Fragment, isValidElement,
  useCallback, useEffect, useMemo, useRef, useState,
  type ReactElement, type ReactNode,
} from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Bold, List, ListChecks, Heading2, Link2, Pencil, Eye, Loader2, Check, AtSign, LayoutTemplate, CalendarClock,
} from "lucide-react"

/** 換行字元；模板組字串時用，避免各處跳脫寫法不一致 */
const NL = String.fromCharCode(10)

/**
 * 待辦的「壓時間」語法：行內寫 !2026-09-20。
 *
 * 用驚嘆號而不是 @：@ 已經給人名了，同一個符號兼兩種語意，
 * 打起來和讀起來都會混淆。這個 token 由工具列的日期鍵插入，不必手打。
 */
export const DUE_RE = /!(\d{4}-\d{2}-\d{2})/

/** n 天後的 YYYY-MM-DD（今天／明天／下週的快捷用） */
export function isoIn(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, "0")
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())
}

/** 距今天幾天（負數代表已過期）；只比日期不比時分 */
export function dueDays(iso: string): number {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const [y, m, d] = iso.split("-").map(Number)
  return Math.round((new Date(y, m - 1, d).getTime() - today) / 86400000)
}

/** 日期標籤文字：逾期／今天／明天，其餘顯示 9/20 */
export function dueLabel(iso: string): string {
  const diff = dueDays(iso)
  const [, m, d] = iso.split("-").map(Number)
  const md = m + "/" + d
  if (diff < 0) return md + " 逾期"
  if (diff === 0) return md + " 今天"
  if (diff === 1) return md + " 明天"
  return md
}

export interface TodoPerson {
  /** 角色，例如 PM、開發者、需求窗口、Scrum Master */
  role: string
  name: string
}

/**
 * 角色配色。
 *
 * 標註的重點是「這件事關係到哪一種人」，光看名字認不出角色——
 * 尤其 Scrum Master 與需求方人員各廠都不同人。顏色讓一整頁筆記可以掃過去分辨。
 */
const ROLE_TONE: Record<string, string> = {
  "PM": "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "開發者": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "需求窗口": "bg-amber-50 text-amber-800 ring-amber-200",
  "需求主管": "bg-rose-50 text-rose-700 ring-rose-200",
  "Scrum Master": "bg-violet-50 text-violet-700 ring-violet-200",
  "IT": "bg-cyan-50 text-cyan-700 ring-cyan-200",
  "任務負責人": "bg-slate-100 text-slate-700 ring-slate-200",
}
const roleTone = (role: string) => ROLE_TONE[role] ?? "bg-muted text-muted-foreground ring-border"

interface TodoEditorProps {
  value: string
  onSave: (content: string) => Promise<void>
  /**
   * 這個專案的相關人，供 @ 標註與模板帶入。
   * 純粹是寫給自己看的標記——不會通知對方，也不會建立任何指派關係。
   */
  people?: TodoPerson[]
  /** 唯讀模式（例如管理者檢視他人筆記時不想誤改，目前保留給未來使用） */
  readOnly?: boolean
  placeholder?: string
}

/**
 * 專案待辦編輯器。
 *
 * 用「工具列 + 即時預覽」而不是所見即所得：多數人不會寫 Markdown，工具列讓他們
 * 不必背語法；懂的人仍可直接打。同時避免引入 WYSIWYG 套件——那會讓系統出現
 * 兩套互不相通的內容格式（其餘文件都是 Markdown）。
 *
 * 儲存採停止輸入後自動存檔，不做「儲存」按鈕：這是隨手記的筆記，
 * 多一個按鈕就多一個忘記按的機會。也刻意不顯示完成率——這是給自己看的備忘，
 * 不是進度考核。
 */
export function TodoEditor({ value, onSave, people = [], readOnly, placeholder }: TodoEditorProps) {
  const [text, setText] = useState(value)
  const [mode, setMode] = useState<"edit" | "preview">("preview")
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const dirty = useRef(false)
  /** 工具列下拉：快速模板、日期 */
  const [menu, setMenu] = useState<"template" | "due" | null>(null)
  /** 打 @ 時跟著游標出現的人名選單 */
  const [at, setAt] = useState<{ start: number; query: string; top: number; left: number } | null>(null)
  const [atIdx, setAtIdx] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  // 點到別處就收起下拉，不然它會一直擋住下面的文字
  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(null)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [menu])

  // 外部資料更新時同步；但自己還沒存完就不要蓋掉正在打的字
  useEffect(() => {
    if (dirty.current) return
    setText(value)
  }, [value])

  // 停止輸入 1.2 秒後自動存檔
  useEffect(() => {
    if (!dirty.current || readOnly) return
    const t = setTimeout(async () => {
      setSaving(true)
      try {
        await onSave(text)
        dirty.current = false
        setSavedAt(Date.now())
      } finally {
        setSaving(false)
      }
    }, 1200)
    return () => clearTimeout(t)
  }, [text, onSave, readOnly])

  const update = (next: string) => { dirty.current = true; setText(next) }

  /** 符合目前 @ 後面關鍵字的人 */
  const atMatches = useMemo(() => {
    if (!at) return []
    const q = at.query.toLowerCase()
    return people.filter((x) => !q || x.name.toLowerCase().includes(q) || x.role.toLowerCase().includes(q))
  }, [at, people])

  /**
   * 每次輸入都檢查游標前是不是「@ + 還沒打完的名字」，是就把選單叫出來。
   * 限制在 12 個字元內且不含空白，避免打信箱或程式碼時被誤觸。
   */
  const syncAt = useCallback((value: string, caret: number) => {
    const ta = taRef.current
    if (!ta || people.length === 0) return setAt(null)
    const m = value.slice(0, caret).match(/@([^\s@]{0,12})$/)
    if (!m) return setAt(null)
    const pos = caretPoint(ta)
    setAtIdx(0)
    setAt({ start: caret - m[0].length, query: m[1], top: pos.top, left: pos.left })
  }, [people])

  /** 選定人名：把已打的 @關鍵字整段換成 @姓名 */
  const pickPerson = useCallback((name: string) => {
    const ta = taRef.current
    if (!ta || !at) return
    const next = text.slice(0, at.start) + "@" + name + " " + text.slice(ta.selectionStart)
    update(next)
    setAt(null)
    const pos = at.start + name.length + 2
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(pos, pos) })
  }, [at, text])

  /** 在游標處插入語法；有選取文字就包住它 */
  const wrap = useCallback((before: string, after = "", placeholderText = "") => {
    const ta = taRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e } = ta
    const selected = text.slice(s, e) || placeholderText
    const next = text.slice(0, s) + before + selected + after + text.slice(e)
    update(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(s + before.length, s + before.length + selected.length)
    })
  }, [text])

  /** 於游標處插入一段文字 */
  const insert = useCallback((snippet: string) => {
    const ta = taRef.current
    if (!ta) return
    const st = ta.selectionStart
    const en = ta.selectionEnd
    const next = text.slice(0, st) + snippet + text.slice(en)
    update(next)
    requestAnimationFrame(() => {
      ta.focus()
      const pos = st + snippet.length
      ta.setSelectionRange(pos, pos)
    })
  }, [text])

  /** 對游標所在的每一行加上前綴（清單、打勾、標題） */
  const prefixLines = useCallback((prefix: string) => {
    const ta = taRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e } = ta
    const start = text.lastIndexOf(NL, s - 1) + 1
    const end = text.indexOf(NL, e) === -1 ? text.length : text.indexOf(NL, e)
    const block = text.slice(start, end)
    const lines = block.split(NL).map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : prefix + l))
    const next = text.slice(0, start) + lines.join(NL) + text.slice(end)
    update(next)
    requestAnimationFrame(() => ta.focus())
  }, [text])

  /**
   * 預覽模式下點擊核取方塊即切換勾選狀態。
   *
   * 以 Markdown 的「原始行號」定位，而不是第幾個 checkbox：後者只要預覽與原文的
   * 順序有一點出入就會勾錯行（也曾造成勾了取消不掉）。行號由 remark 的節點位置提供，
   * 與 text 逐行對得起來。
   */
  const toggleLine = useCallback((line?: number) => {
    if (readOnly || !line) return
    const lines = text.split(NL)
    const i = line - 1
    const target = lines[i]
    if (target == null) return
    const m = target.match(/^(\s*[-*]\s+)\[([ xX])\]/)
    if (!m) return
    const checked = m[2].toLowerCase() === "x"
    lines[i] = target.replace(/\[([ xX])\]/, checked ? "[ ]" : "[x]")
    update(lines.join(NL))
  }, [text, readOnly])

  /** 把日期壓在游標所在那一行的行尾（同一行已經有日期就換掉） */
  const appendDue = useCallback((iso: string) => {
    const ta = taRef.current
    if (!ta) return
    const caret = ta.selectionStart
    const start = text.lastIndexOf(NL, caret - 1) + 1
    const endIdx = text.indexOf(NL, caret)
    const end = endIdx === -1 ? text.length : endIdx
    const line = text.slice(start, end)
    const token = "!" + iso
    const replaced = DUE_RE.test(line)
      ? line.replace(DUE_RE, token)
      : line.replace(/\s*$/, "") + " " + token
    update(text.slice(0, start) + replaced + text.slice(end))
    const pos = start + replaced.length
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(pos, pos) })
  }, [text])

  /**
   * 快速模板：把常見的「誰要做什麼」一次鋪好，人名直接帶入這個專案的實際人員，
   * 不必每次重打。查無該角色就留空白，不塞「未指派」占位字。
   */
  const templates = useMemo(() => {
    const mention = (role: string) => {
      const n = people.find((x) => x.role === role)?.name
      return n ? "@" + n + " " : ""
    }
    return [
      {
        label: "各角色待辦",
        text: [
          "- [ ] " + mention("PM"),
          "- [ ] " + mention("開發者"),
          "- [ ] " + mention("需求窗口"),
          "",
        ].join(NL),
      },
      {
        label: "追進度",
        text: [
          "- [ ] 跟 " + mention("需求窗口") + "確認回饋",
          "- [ ] 跟 " + mention("PM") + "對齊時程",
          "",
        ].join(NL),
      },
      {
        label: "本週重點",
        text: ["## 本週重點", "- [ ] ", "- [ ] ", ""].join(NL),
      },
    ]
  }, [people])

  /**
   * 把純文字裡的 @人名 與 !日期 換成標籤元素。
   *
   * 走 React 元素而不是塞 HTML 字串：筆記內容是使用者自己打的，
   * 用 rehype-raw 解析原始 HTML 不只有風險，也會弄丟節點位置（打勾就定位不到行）。
   */
  const decorate = useCallback((node: ReactNode): ReactNode => {
    if (Array.isArray(node)) {
      return node.map((child, i) => <Fragment key={i}>{decorate(child)}</Fragment>)
    }
    if (typeof node !== "string") return node

    const names = people.map((x) => x.name).filter(Boolean).sort((a, b) => b.length - a.length)
    const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    const source = (escaped.length > 0 ? "@(" + escaped.join("|") + ")|" : "") + "!(\\d{4}-\\d{2}-\\d{2})"
    const re = new RegExp(source, "g")

    const out: ReactNode[] = []
    let last = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(node)) !== null) {
      if (m.index > last) out.push(node.slice(last, m.index))
      const [full, who, iso] = m
      if (who) {
        const role = people.find((x) => x.name === who)?.role ?? ""
        out.push(
          <span
            key={m.index}
            className={cn(
              "mx-0.5 inline-flex items-baseline gap-1 rounded px-1.5 py-0.5 align-baseline text-[11px] font-medium ring-1 ring-inset",
              roleTone(role)
            )}
          >
            {role && <span className="opacity-70">{role}</span>}
            {who}
          </span>
        )
      } else if (iso) {
        const diff = dueDays(iso)
        out.push(
          <span
            key={m.index}
            className={cn(
              "mx-0.5 inline-block rounded px-1.5 py-0.5 align-baseline text-[11px] ring-1 ring-inset",
              diff < 0
                ? "bg-red-50 text-red-600 ring-red-200"
                : diff <= 3
                  ? "bg-amber-50 text-amber-700 ring-amber-200"
                  : "bg-muted text-muted-foreground ring-border"
            )}
          >
            {dueLabel(iso)}
          </span>
        )
      }
      last = m.index + full.length
    }
    if (last < node.length) out.push(node.slice(last))
    return out.length > 0 ? out : node
  }, [people])

  return (
    <div className="relative rounded-lg border">
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 px-2 py-1.5">
        {mode === "edit" && !readOnly && (
          <>
            <ToolbarBtn icon={Bold} label="粗體" onClick={() => wrap("**", "**", "重點")} />
            <ToolbarBtn icon={List} label="清單" onClick={() => prefixLines("- ")} />
            <ToolbarBtn icon={ListChecks} label="待辦（可打勾）" onClick={() => prefixLines("- [ ] ")} />
            <ToolbarBtn icon={Heading2} label="小標題" onClick={() => prefixLines("## ")} />
            <ToolbarBtn icon={Link2} label="連結" onClick={() => wrap("[", "](https://)", "連結文字")} />

            <div className="relative" ref={menuRef}>
              <span className="flex items-center gap-1">
                {people.length > 0 && (
                  <ToolbarBtn
                    icon={AtSign}
                    label="標註人員（或直接打 @）"
                    onClick={() => {
                      insert("@")
                      const ta = taRef.current
                      if (ta) requestAnimationFrame(() => syncAt(ta.value, ta.selectionStart))
                    }}
                  />
                )}
                <ToolbarBtn
                  icon={CalendarClock}
                  label="壓日期"
                  active={menu === "due"}
                  onClick={() => setMenu((m) => (m === "due" ? null : "due"))}
                />
                <ToolbarBtn
                  icon={LayoutTemplate}
                  label="快速模板"
                  active={menu === "template"}
                  onClick={() => setMenu((m) => (m === "template" ? null : "template"))}
                />
              </span>

              {menu === "due" && (
                <div className="absolute left-0 top-7 z-20 w-52 rounded-md border bg-popover p-2 shadow-md">
                  <p className="pb-1.5 text-[10px] text-muted-foreground">壓在游標所在的那一行</p>
                  <input
                    type="date"
                    className="w-full rounded border bg-background px-2 py-1 text-xs"
                    onChange={(e) => {
                      if (!e.target.value) return
                      appendDue(e.target.value)
                      setMenu(null)
                    }}
                  />
                  <div className="mt-1.5 flex gap-1">
                    {[0, 1, 7].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => { appendDue(isoIn(d)); setMenu(null) }}
                        className="flex-1 rounded border px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        {d === 0 ? "今天" : d === 1 ? "明天" : "下週"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {menu === "template" && (
                <div className="absolute left-0 top-7 z-20 w-44 rounded-md border bg-popover p-1 shadow-md">
                  <p className="px-2 py-1 text-[10px] text-muted-foreground">插入常用格式</p>
                  {templates.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => { insert(t.text); setMenu(null) }}
                      className="w-full rounded px-2 py-1 text-left text-xs hover:bg-muted"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <span className="ml-auto flex items-center gap-2">
          {saving ? (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />儲存中
            </span>
          ) : savedAt ? (
            <span className="flex items-center gap-1 text-[11px] text-emerald-600">
              <Check className="h-3 w-3" />已儲存
            </span>
          ) : null}
          {!readOnly && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => setMode((m) => (m === "edit" ? "preview" : "edit"))}
            >
              {mode === "edit"
                ? <><Eye className="mr-1 h-3 w-3" />預覽</>
                : <><Pencil className="mr-1 h-3 w-3" />編輯</>}
            </Button>
          )}
        </span>
      </div>

      {mode === "edit" && !readOnly ? (
        <>
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => { update(e.target.value); syncAt(e.target.value, e.target.selectionStart) }}
            onClick={() => setAt(null)}
            onBlur={() => setTimeout(() => setAt(null), 120)}
            onKeyDown={(e) => {
              if (!at || atMatches.length === 0) return
              if (e.key === "ArrowDown") { e.preventDefault(); setAtIdx((i) => (i + 1) % atMatches.length) }
              else if (e.key === "ArrowUp") { e.preventDefault(); setAtIdx((i) => (i - 1 + atMatches.length) % atMatches.length) }
              else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pickPerson(atMatches[atIdx].name) }
              else if (e.key === "Escape") { e.preventDefault(); setAt(null) }
            }}
            placeholder={placeholder ?? "寫下這個專案要做的事…\n\n- [ ] 例如：等強茂 IT 開 API 權限（打 @ 可標註人員）\n- [ ] 例如：PPT 版面待優化"}
            className="min-h-[180px] w-full resize-y bg-transparent p-3 font-mono text-xs leading-relaxed outline-none"
          />

          {at && atMatches.length > 0 && (
            <div
              className="absolute z-30 max-h-56 w-56 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg"
              style={{ top: at.top, left: at.left }}
            >
              <p className="px-2 py-1 text-[10px] text-muted-foreground">只是標記給自己看，不會通知對方</p>
              {atMatches.map((per, i) => (
                <button
                  key={per.role + per.name}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); pickPerson(per.name) }}
                  onMouseEnter={() => setAtIdx(i)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs",
                    i === atIdx && "bg-muted"
                  )}
                >
                  <span className={cn("shrink-0 rounded px-1 text-[10px] ring-1 ring-inset", roleTone(per.role))}>
                    {per.role}
                  </span>
                  <span className="truncate">{per.name}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div
          className={cn(
            "prose prose-sm prose-neutral max-w-none p-3",
            // 區塊之間留出間距，讓預覽的段落分隔看起來跟編輯時打的空行一致
            "prose-p:my-0 prose-ul:my-0 prose-headings:my-0 prose-li:my-0.5 [&>*+*]:mt-3"
          )}
          onDoubleClick={() => !readOnly && setMode("edit")}
          title={readOnly ? undefined : "點兩下開始編輯"}
        >
          {text.trim() ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p>{decorate(children)}</p>,
                /**
                 * 待辦項目的核取方塊在這裡整個換掉。
                 *
                 * remark-gfm 產生的 input 節點是合成的、沒有原始位置（行號只有 li 有），
                 * 而且它在 children 裡是「元件」而不是 <input> 元素，用 type 判斷抓不到——
                 * 所以直接認 props.type === "checkbox"，用自己的 input 取代並綁上行號。
                 */
                li: ({ node, children, className }) => {
                  const line = node?.position?.start?.line
                  const kids = Children.toArray(children)
                  const box = kids.find(
                    (c): c is ReactElement<{ type?: string; checked?: boolean }> =>
                      isValidElement(c) && (c.props as { type?: string }).type === "checkbox"
                  )

                  // 一般清單項目：照原樣渲染
                  if (!box) return <li className={className}>{decorate(children)}</li>

                  // 待辦項目：整列可點，勾掉的用刪除線淡出
                  const checked = !!box.props.checked
                  const rest = kids.filter((c) => c !== box)
                  return (
                    <li className="list-none">
                      <div
                        onClick={() => toggleLine(line)}
                        className={cn(
                          "group -mx-1.5 flex items-start gap-2 rounded-md px-1.5 py-1 transition-colors",
                          !readOnly && "cursor-pointer hover:bg-muted/50"
                        )}
                      >
                        <span
                          role="checkbox"
                          aria-checked={checked}
                          className={cn(
                            "mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                            checked
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-muted-foreground/40 bg-background group-hover:border-primary"
                          )}
                        >
                          {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        <span
                          className={cn(
                            "min-w-0 flex-1 leading-snug",
                            checked && "text-muted-foreground line-through decoration-muted-foreground/40"
                          )}
                        >
                          {decorate(rest)}
                        </span>
                      </div>
                    </li>
                  )
                },
                // 待辦清單不要項目符號——方框本身就是符號，再加一個圓點只是雜訊
                ul: ({ children, className }) => (
                  <ul className={cn(className, className?.includes("contains-task-list") && "list-none pl-0")}>
                    {children}
                  </ul>
                ),
                h2: ({ children }) => <h2 className="text-sm font-semibold">{decorate(children)}</h2>,
                h3: ({ children }) => <h3 className="text-xs font-semibold">{decorate(children)}</h3>,
              }}
            >
              {text}
            </ReactMarkdown>
          ) : (
            <p className="text-xs text-muted-foreground">
              尚未建立待辦{readOnly ? "" : "——點「編輯」開始寫"}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * 量出游標在 textarea 內的座標。
 *
 * 作法是複製 textarea 的字體與寬度到一個隱藏 div，把游標前的文字放進去、
 * 在尾端插一個標記元素來量它的位置。看起來土，但這是唯一能同時處理
 * 換行、折行與任意字體的方法（textarea 本身沒有提供游標座標 API）。
 */
function caretPoint(ta: HTMLTextAreaElement) {
  const cs = getComputedStyle(ta)
  const div = document.createElement("div")
  const copy = [
    "font-family", "font-size", "font-weight", "line-height", "letter-spacing",
    "padding-top", "padding-right", "padding-bottom", "padding-left",
    "border-width", "box-sizing", "width",
  ]
  for (const k of copy) div.style.setProperty(k, cs.getPropertyValue(k))
  div.style.position = "absolute"
  div.style.visibility = "hidden"
  div.style.whiteSpace = "pre-wrap"
  div.style.wordWrap = "break-word"
  div.style.top = "0"
  div.style.left = "-9999px"
  document.body.appendChild(div)
  div.textContent = ta.value.slice(0, ta.selectionStart)
  const marker = document.createElement("span")
  marker.textContent = "."
  div.appendChild(marker)
  const point = { top: marker.offsetTop - ta.scrollTop, left: marker.offsetLeft }
  document.body.removeChild(div)
  const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5
  return { top: ta.offsetTop + point.top + lh, left: ta.offsetLeft + point.left }
}

function ToolbarBtn({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active && "bg-muted text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

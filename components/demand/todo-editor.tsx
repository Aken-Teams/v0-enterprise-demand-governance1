"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Bold, List, ListChecks, Heading2, Link2, Pencil, Eye, Loader2, Check, AtSign, LayoutTemplate,
} from "lucide-react"

/** 換行字元；模板組字串時用，避免各處跳脫寫法不一致 */
const NL = String.fromCharCode(10)

export interface TodoPerson {
  /** 角色，例如 PM、開發者、需求窗口 */
  role: string
  name: string
}

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
 * 多一個按鈕就多一個忘記按的機會。
 */
export function TodoEditor({ value, onSave, people = [], readOnly, placeholder }: TodoEditorProps) {
  const [text, setText] = useState(value)
  const [mode, setMode] = useState<"edit" | "preview">("preview")
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const dirty = useRef(false)
  /** 工具列的兩個下拉：@ 標註、快速模板（同時只開一個） */
  const [menu, setMenu] = useState<"mention" | "template" | null>(null)
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

  useEffect(() => { setText(value); dirty.current = false }, [value])

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
    const start = text.lastIndexOf("\n", s - 1) + 1
    const end = text.indexOf("\n", e) === -1 ? text.length : text.indexOf("\n", e)
    const block = text.slice(start, end)
    const lines = block.split("\n").map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : prefix + l))
    const next = text.slice(0, start) + lines.join("\n") + text.slice(end)
    update(next)
    requestAnimationFrame(() => ta.focus())
  }, [text])

  /** 預覽模式下點擊核取方塊即切換勾選狀態，不必進編輯 */
  const toggleCheckbox = useCallback((index: number) => {
    if (readOnly) return
    let seen = -1
    const next = text
      .split("\n")
      .map((line) => {
        const m = line.match(/^(\s*[-*]\s+)\[([ xX])\]/)
        if (!m) return line
        seen += 1
        if (seen !== index) return line
        const checked = m[2].toLowerCase() === "x"
        return line.replace(/\[([ xX])\]/, checked ? "[ ]" : "[x]")
      })
      .join("\n")
    update(next)
  }, [text, readOnly])

  /**
   * 快速模板：把常見的「誰要做什麼」一次鋪好，人名直接帶入這個專案的實際人員，
   * 不必每次重打。查無該角色就留空白，不塞「未指派」占位字。
   */
  const templates = useMemo(() => {
    const at = (role: string) => {
      const n = people.find((x) => x.role === role)?.name
      return n ? "@" + n + " " : ""
    }
    return [
      {
        label: "各角色待辦",
        text: ["- [ ] " + at("PM"), "- [ ] " + at("開發者"), "- [ ] " + at("需求窗口"), ""].join(NL),
      },
      {
        label: "追進度",
        text: ["- [ ] 跟 " + at("需求窗口") + "確認回饋", "- [ ] 跟 " + at("PM") + "對齊時程", ""].join(NL),
      },
      {
        label: "本週重點",
        text: ["## 本週重點", "- [ ] ", "- [ ] ", ""].join(NL),
      },
    ]
  }, [people])

  const stats = useMemo(() => {
    const boxes = text.match(/^\s*[-*]\s+\[([ xX])\]/gm) ?? []
    const done = boxes.filter((b) => /\[[xX]\]/.test(b)).length
    return { done, total: boxes.length }
  }, [text])

  /**
   * 預覽時把 @人名 轉成淡底標籤。
   * 只比對這個專案實際的人名，而不是任意 @字串——否則信箱、程式碼都會被誤判。
   */
  const rendered = useMemo(() => {
    const names = people.map((x) => x.name).filter(Boolean).sort((a, b) => b.length - a.length)
    if (names.length === 0) return text
    const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    return text.replace(
      new RegExp("@(" + escaped.join("|") + ")", "g"),
      '<span class="rounded bg-primary/10 px-1 py-0.5 font-medium text-primary">@$1</span>'
    )
  }, [text, people])

  let checkboxIndex = -1

  return (
    <div className="rounded-lg border">
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
                    label="標註人員"
                    active={menu === "mention"}
                    onClick={() => setMenu((m) => (m === "mention" ? null : "mention"))}
                  />
                )}
                <ToolbarBtn
                  icon={LayoutTemplate}
                  label="快速模板"
                  active={menu === "template"}
                  onClick={() => setMenu((m) => (m === "template" ? null : "template"))}
                />
              </span>

              {menu === "mention" && (
                <div className="absolute left-0 top-7 z-20 w-52 rounded-md border bg-popover p-1 shadow-md">
                  <p className="px-2 py-1 text-[10px] text-muted-foreground">只是標記給自己看，不會通知對方</p>
                  {people.map((per) => (
                    <button
                      key={per.role + per.name}
                      type="button"
                      onClick={() => { insert("@" + per.name + " "); setMenu(null) }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-muted"
                    >
                      <span className="shrink-0 rounded bg-muted px-1 text-[10px] text-muted-foreground">{per.role}</span>
                      <span className="truncate">{per.name}</span>
                    </button>
                  ))}
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

            <span className="mx-1 h-4 w-px bg-border" />
          </>
        )}

        {stats.total > 0 && (
          <span className="text-[11px] text-muted-foreground">
            完成 {stats.done}/{stats.total}
          </span>
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
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => update(e.target.value)}
          placeholder={placeholder ?? "寫下這個專案要做的事…\n\n- [ ] 例如：等強茂 IT 開 API 權限\n- [ ] 例如：PPT 版面待優化"}
          className="min-h-[180px] w-full resize-y bg-transparent p-3 font-mono text-xs leading-relaxed outline-none"
        />
      ) : (
        <div
          className="prose prose-sm prose-neutral max-w-none p-3 prose-p:my-1 prose-ul:my-1 prose-li:my-0.5"
          onDoubleClick={() => !readOnly && setMode("edit")}
          title={readOnly ? undefined : "點兩下開始編輯"}
        >
          {text.trim() ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                input({ checked, type }) {
                  if (type !== "checkbox") return null
                  checkboxIndex += 1
                  const idx = checkboxIndex
                  return (
                    <input
                      type="checkbox"
                      checked={!!checked}
                      disabled={readOnly}
                      onChange={() => toggleCheckbox(idx)}
                      className={cn("mr-1.5 align-middle", !readOnly && "cursor-pointer")}
                    />
                  )
                },
              }}
            >
              {rendered}
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

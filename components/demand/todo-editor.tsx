"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Bold, List, ListChecks, Heading2, Link2, Pencil, Eye, Loader2, Check,
} from "lucide-react"

interface TodoEditorProps {
  value: string
  onSave: (content: string) => Promise<void>
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
export function TodoEditor({ value, onSave, readOnly, placeholder }: TodoEditorProps) {
  const [text, setText] = useState(value)
  const [mode, setMode] = useState<"edit" | "preview">("preview")
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const dirty = useRef(false)

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

  const stats = useMemo(() => {
    const boxes = text.match(/^\s*[-*]\s+\[([ xX])\]/gm) ?? []
    const done = boxes.filter((b) => /\[[xX]\]/.test(b)).length
    return { done, total: boxes.length }
  }, [text])

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

function ToolbarBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

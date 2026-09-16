"use client"

import React, { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import rehypeRaw from "rehype-raw"
import { Highlighter } from "lucide-react"
import { MermaidBlock } from "@/components/mermaid-block"
import { preprocessMarkdown } from "@/lib/markdown"
import { changedLineSet, headingId, rangeHasChange } from "@/lib/process-doc"
import { cn } from "@/lib/utils"

interface MarkdownDocViewProps {
  /** 本版內容（已是純文字的 Markdown） */
  content: string
  /** 前一版的檔案位址；有的話才會出現「標註本版變更」開關 */
  prevFileUrl?: string | null
  /** 版本號，僅供提示文字顯示 */
  version?: number
  prevVersion?: number
  /** 點擊圖片時的處理（交給頁面既有的放大層） */
  onZoomImage?: (src: string) => void
  /**
   * 「標註本版變更」按鈕的掛載位置。
   * 頁面把預覽標題列的某個節點傳進來，按鈕就會渲染到那裡（例如放大鈕左側）；
   * 沒給的話按鈕會浮在內文右上角。
   */
  toolbarTarget?: HTMLElement | null
  className?: string
}

/**
 * Markdown 文件檢視器（內嵌預覽用）。
 *
 * 與全螢幕預覽共用同一套差異比對邏輯：和前一版逐行比對，新增或修改的段落打黃底。
 * 抽成共用元件的原因——需求詳情、需求方詳情、分享頁三處都要用，先前 MermaidBlock
 * 各自複製三份，結果共用元件加了功能三個畫面都吃不到，同樣的坑不要再踩一次。
 *
 * 純刪除的段落無法在內文標示（本版根本沒有那些行），這點於提示帶中說明。
 */
export function MarkdownDocView({
  content,
  prevFileUrl,
  version,
  prevVersion,
  onZoomImage,
  toolbarTarget,
  className,
}: MarkdownDocViewProps) {
  const [prevContent, setPrevContent] = useState("")
  const [showChanges, setShowChanges] = useState(false)

  useEffect(() => {
    setShowChanges(false)
    if (!prevFileUrl) { setPrevContent(""); return }
    let alive = true
    fetch(prevFileUrl)
      .then((res) => (res.ok ? res.text() : ""))
      .then((t) => { if (alive) setPrevContent(t || "") })
      .catch(() => { if (alive) setPrevContent("") })
    return () => { alive = false }
  }, [prevFileUrl])

  const processed = useMemo(() => preprocessMarkdown(content), [content])
  const changed = useMemo(
    () => (prevContent ? changedLineSet(prevContent, content) : new Set<number>()),
    [prevContent, content]
  )

  const components = useMemo(() => {
    const hl = (node: unknown) => {
      if (!showChanges) return false
      const pos = (node as { position?: { start?: { line?: number }; end?: { line?: number } } })?.position
      return rangeHasChange(changed, pos?.start?.line, pos?.end?.line)
    }
    const HL = "bg-yellow-100/80 rounded-[3px] ring-1 ring-yellow-300/70 px-1"
    const heading = (level: number) =>
      function H({ node, children }: { node?: unknown; children?: React.ReactNode }) {
        const Tag = `h${level}` as "h1"
        const line = (node as { position?: { start?: { line?: number } } })?.position?.start?.line
        return <Tag id={headingId(line)} className={cn(hl(node) && HL)}>{children}</Tag>
      }

    return {
      h1: heading(1), h2: heading(2), h3: heading(3),
      h4: heading(4), h5: heading(5), h6: heading(6),
      p({ node, children }: { node?: unknown; children?: React.ReactNode }) {
        return <p className={cn(hl(node) && HL)}>{children}</p>
      },
      li({ node, children }: { node?: unknown; children?: React.ReactNode }) {
        return <li className={cn(hl(node) && HL)}>{children}</li>
      },
      tr({ node, children }: { node?: unknown; children?: React.ReactNode }) {
        return <tr className={cn(hl(node) && "bg-yellow-100/80")}>{children}</tr>
      },
      blockquote({ node, children }: { node?: unknown; children?: React.ReactNode }) {
        return <blockquote className={cn(hl(node) && HL)}>{children}</blockquote>
      },
      img({ src, alt }: { src?: unknown; alt?: string }) {
        const url = typeof src === "string" ? src : ""
        return (
          <img
            src={url}
            alt={alt ?? ""}
            className={cn(
              "mx-auto max-h-[55vh] w-auto rounded-lg border",
              onZoomImage && "cursor-zoom-in",
            )}
            onClick={() => url && onZoomImage?.(url)}
            title={onZoomImage ? "點擊放大" : undefined}
          />
        )
      },
      pre({ children }: { children?: React.ReactNode }) {
        if (React.isValidElement(children)) {
          const cp = children.props as { className?: string }
          if (/language-mermaid/.test(cp.className || "")) return <>{children}</>
        }
        return <pre>{children}</pre>
      },
      code({ className: cls, children, ...props }: { className?: string; children?: React.ReactNode }) {
        const match = /language-(\w+)/.exec(cls || "")
        if (match?.[1] === "mermaid") return <MermaidBlock code={String(children).trim()} />
        return <code className={cls} {...props}>{children}</code>
      },
    }
  }, [changed, showChanges, onZoomImage])

  return (
    <div className={cn("relative", className)}>
      {!!prevContent && (() => {
        const btn = (
          <button
            type="button"
            onClick={() => setShowChanges((v) => !v)}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors",
              showChanges
                ? "border-yellow-400 bg-yellow-400 text-yellow-950"
                : "bg-background text-muted-foreground hover:bg-muted",
              // 未指定掛載位置時退回浮在內文右上角
              !toolbarTarget && "sticky top-0 z-10 float-right ml-2",
            )}
            title={`標出與 v${prevVersion ?? "前一版"} 相比新增或修改的內容`}
          >
            <Highlighter className="h-3 w-3" />
            {showChanges ? "隱藏變更" : "標註本版變更"}
          </button>
        )
        return toolbarTarget ? createPortal(btn, toolbarTarget) : btn
      })()}

      {showChanges && (
        <div className="not-prose mb-3 flex items-start gap-1.5 rounded-lg border border-yellow-300 bg-yellow-50 px-2.5 py-1.5 text-[11px] text-yellow-900">
          <Highlighter className="mt-px h-3 w-3 shrink-0" />
          <p>
            黃底為本版{version != null ? `（v${version}）` : ""}相對於 v{prevVersion ?? "前一版"} 新增或修改的內容；
            純刪除的段落無法在內文標示。
          </p>
        </div>
      )}

      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeRaw]}
        remarkRehypeOptions={{ allowDangerousHtml: true }}
        components={components}
      >
        {processed}
      </ReactMarkdown>
    </div>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { use } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import rehypeRaw from "rehype-raw"
import { mermaidMarkdownComponents } from "@/components/mermaid-block"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { preprocessMarkdown } from "@/lib/markdown"
import { buildToc, changedLineSet, headingId, markChangedSections, rangeHasChange, type TocItem } from "@/lib/process-doc"
import { cn } from "@/lib/utils"
import { Loader2, ShieldAlert, FileText, Info, Highlighter, List, X, PanelLeftClose, PanelLeftOpen } from "lucide-react"

interface SharedDoc {
  versionLabel: string
  title: string
  content: string
  changeNote: string | null
  createdAt: string
}

/** hast 節點只用得到位置，其餘欄位不關心 */
type NodeWithPosition = { position?: { start?: { line?: number }; end?: { line?: number } } }

/**
 * 開發流程文件的公開分享頁。
 *
 * 供沒有平台帳號者檢視，故不套用 AppLayout、不需登入；
 * 僅呈現最新版內容，無下載入口，並疊上浮水印。
 *
 * 兩個閱讀輔助：
 *  - 左側目錄，點擊捲動至該章節（含本版變更的章節會標記）。
 *  - 右上角「標註本版變更」開關，把這一版新增／修改的段落打上黃底，
 *    讓收到連結的人不必自己比對就知道哪裡不一樣。
 */
export default function ProcessSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [doc, setDoc] = useState<SharedDoc | null>(null)
  const [prevContent, setPrevContent] = useState<string | null>(null)
  const [prevLabel, setPrevLabel] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [showChanges, setShowChanges] = useState(false)
  const [tocOpen, setTocOpen] = useState(false)
  const [tocCollapsed, setTocCollapsed] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const tocListRef = useRef<HTMLElement>(null)

  // 記住收合狀態，換頁或重整後維持使用者的選擇
  useEffect(() => {
    if (localStorage.getItem("process-toc-collapsed") === "1") setTocCollapsed(true)
  }, [])
  const toggleCollapsed = useCallback(() => {
    setTocCollapsed((v) => {
      localStorage.setItem("process-toc-collapsed", v ? "0" : "1")
      return !v
    })
  }, [])

  // 匿名檢視無法標註姓名，改以中性文字標示機密性
  const watermarkBg = useMemo(() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150"><text transform="rotate(-30 150 75)" x="150" y="85" font-size="14" fill="rgba(0,0,0,0.07)" text-anchor="middle" font-family="sans-serif">機密文件　請勿外傳</text></svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/process-docs/share/${token}`)
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setDoc(data.doc)
        setPrevContent(data.prev?.content ?? null)
        setPrevLabel(data.prev?.versionLabel ?? null)
        setExpiresAt(data.expiresAt ?? null)
      } else {
        setError(data.error || "無法載入文件")
      }
    } catch {
      setError("網路錯誤，請稍後再試")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  // 前處理只做一次：目錄、變更標註與渲染都吃同一份文字，行號才對得起來
  const processed = useMemo(() => (doc ? preprocessMarkdown(doc.content) : ""), [doc])
  const changed = useMemo(
    () => (doc && prevContent ? changedLineSet(prevContent, doc.content) : new Set<number>()),
    [doc, prevContent]
  )
  const toc = useMemo(() => markChangedSections(buildToc(processed), changed), [processed, changed])
  const hasChanges = changed.size > 0

  // 捲動時標出目前所在章節
  useEffect(() => {
    if (!contentRef.current || toc.length === 0) return
    const headings = toc
      .map((t) => document.getElementById(t.id))
      .filter((el): el is HTMLElement => !!el)
    if (headings.length === 0) return

    const onScroll = () => {
      // 以視窗上緣往下 120px 當判定線，避免標題剛滑出畫面就換下一節
      const line = 120
      let current: string | null = headings[0].id
      for (const h of headings) {
        if (h.getBoundingClientRect().top <= line) current = h.id
        else break
      }
      setActiveId(current)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [toc])

  // 目錄很長，目前章節要自動捲進可視範圍，否則使用者會找不到自己在哪
  useEffect(() => {
    if (!activeId || !tocListRef.current) return
    const el = tocListRef.current.querySelector<HTMLElement>(`[data-toc-id="${activeId}"]`)
    if (!el) return
    const box = tocListRef.current.getBoundingClientRect()
    const item = el.getBoundingClientRect()
    if (item.top < box.top + 8 || item.bottom > box.bottom - 8) {
      el.scrollIntoView({ block: "nearest" })
    }
  }, [activeId])

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY - 80
    window.scrollTo({ top, behavior: "smooth" })
    setActiveId(id)
    setTocOpen(false)
  }, [])

  /** 區塊元素：掛上錨點 id，並在開關開啟時替變更段落上黃底 */
  const markdownComponents = useMemo(() => {
    const hl = (node: unknown) => {
      if (!showChanges) return false
      const pos = (node as NodeWithPosition)?.position
      return rangeHasChange(changed, pos?.start?.line, pos?.end?.line)
    }
    const HIGHLIGHT = "bg-yellow-100/80 rounded-[3px] ring-1 ring-yellow-300/70"

    const heading = (level: number) =>
      function Heading({ node, children, ...props }: { node?: unknown; children?: React.ReactNode }) {
        const Tag = `h${level}` as "h1"
        const line = (node as NodeWithPosition)?.position?.start?.line
        return (
          <Tag
            id={headingId(line)}
            className={cn("scroll-mt-24", hl(node) && `${HIGHLIGHT} px-1`)}
            {...props}
          >
            {children}
          </Tag>
        )
      }

    return {
      ...mermaidMarkdownComponents,
      h1: heading(1),
      h2: heading(2),
      h3: heading(3),
      h4: heading(4),
      h5: heading(5),
      h6: heading(6),
      p({ node, children, ...props }: { node?: unknown; children?: React.ReactNode }) {
        return <p className={cn(hl(node) && `${HIGHLIGHT} px-1`)} {...props}>{children}</p>
      },
      li({ node, children, ...props }: { node?: unknown; children?: React.ReactNode }) {
        return <li className={cn(hl(node) && `${HIGHLIGHT} px-1`)} {...props}>{children}</li>
      },
      tr({ node, children, ...props }: { node?: unknown; children?: React.ReactNode }) {
        return <tr className={cn(hl(node) && "bg-yellow-100/80")} {...props}>{children}</tr>
      },
      blockquote({ node, children, ...props }: { node?: unknown; children?: React.ReactNode }) {
        return <blockquote className={cn(hl(node) && `${HIGHLIGHT} px-1`)} {...props}>{children}</blockquote>
      },
    }
  }, [changed, showChanges])

  const renderToc = (className?: string, withRef = false) => (
    <nav ref={withRef ? tocListRef : undefined} className={cn("text-sm", className)}>
      <ul className="space-y-0.5">
        {toc.map((item: TocItem) => (
          <li key={item.id}>
            <button
              type="button"
              data-toc-id={item.id}
              onClick={() => scrollTo(item.id)}
              className={cn(
                "flex w-full items-start gap-1.5 rounded px-2 py-1 text-left text-[13px] leading-snug transition-colors hover:bg-muted",
                item.level === 1 ? "font-medium text-foreground" : "text-muted-foreground",
                item.level === 2 && "pl-4",
                item.level >= 3 && "pl-7 text-[12px]",
                activeId === item.id && "bg-indigo-50 text-indigo-700 hover:bg-indigo-50"
              )}
            >
              <span className="min-w-0 flex-1 break-words">{item.text}</span>
              {item.changed && (
                <span
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-400"
                  title="此章節有本版變更"
                />
              )}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )

  return (
    <div className="min-h-screen bg-muted/30">
      {/* 頁首 */}
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <FileText className="h-5 w-5 text-indigo-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm sm:text-base truncate">開發流程</p>
            <p className="hidden text-[11px] text-muted-foreground sm:block sm:text-xs">
              強茂股份有限公司 × 強合智慧　開案與開發流程規範
            </p>
          </div>

          {/* 目錄（小螢幕） */}
          {toc.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0 lg:hidden"
              onClick={() => setTocOpen((v) => !v)}
            >
              {tocOpen ? <X className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
              <span className="ml-1 text-xs">目錄</span>
            </Button>
          )}

          {/* 變更標註開關 */}
          {hasChanges && (
            <Button
              variant={showChanges ? "default" : "outline"}
              size="sm"
              className={cn("h-8 shrink-0", showChanges && "bg-yellow-500 text-yellow-950 hover:bg-yellow-500/90")}
              onClick={() => setShowChanges((v) => !v)}
              title={prevLabel ? `標出與 ${prevLabel} 相比新增或修改的內容` : "標出本版新增或修改的內容"}
            >
              <Highlighter className="h-3.5 w-3.5" />
              <span className="ml-1 text-xs">{showChanges ? "隱藏變更標註" : "標註本版變更"}</span>
            </Button>
          )}

          {doc && (
            <Badge variant="outline" className="hidden shrink-0 font-mono text-xs sm:inline-flex">
              {doc.versionLabel}
            </Badge>
          )}
        </div>

        {/* 小螢幕的目錄面板 */}
        {tocOpen && toc.length > 0 && (
          <div className="max-h-[60vh] overflow-y-auto border-t bg-background px-4 py-3 lg:hidden">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <List className="h-3.5 w-3.5" />目錄
            </p>
            {renderToc()}
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {loading ? (
          <Card><CardContent className="py-20 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />載入中…
          </CardContent></Card>
        ) : error ? (
          <Card><CardContent className="py-20 text-center">
            <ShieldAlert className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">請向文件提供者索取新的分享連結</p>
          </CardContent></Card>
        ) : doc ? (
          <div className="flex gap-6">
            {/* 左側目錄（大螢幕常駐、可收合，捲動時固定跟隨） */}
            {toc.length > 0 && (
              <aside
                className={cn(
                  "sticky top-[4.25rem] hidden h-[calc(100vh-5.5rem)] shrink-0 self-start transition-[width] duration-200 lg:block",
                  tocCollapsed ? "w-10" : "w-64"
                )}
              >
                {tocCollapsed ? (
                  <button
                    type="button"
                    onClick={toggleCollapsed}
                    title="展開目錄"
                    className="flex h-full w-10 flex-col items-center gap-2 rounded-lg border bg-background py-3 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <PanelLeftOpen className="h-4 w-4 shrink-0" />
                    <span className="text-[11px] [writing-mode:vertical-rl]">目錄</span>
                  </button>
                ) : (
                  <div className="flex h-full flex-col rounded-lg border bg-background">
                    <div className="flex items-center gap-1.5 border-b px-3 py-2">
                      <List className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1 text-xs font-semibold text-muted-foreground">目錄</span>
                      <button
                        type="button"
                        onClick={toggleCollapsed}
                        title="收合目錄"
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <PanelLeftClose className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {renderToc("flex-1 overflow-y-auto p-2", true)}
                  </div>
                )}
              </aside>
            )}

            <div className="min-w-0 flex-1 space-y-4">
              {doc.changeNote && (
                <Card className="border-indigo-200 bg-indigo-50/40">
                  <CardContent className="p-3 sm:p-4">
                    <p className="text-xs font-semibold text-indigo-800 mb-1 flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5" />{doc.versionLabel} 修改摘要
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-line">{doc.changeNote}</p>
                    {hasChanges && (
                      <p className="mt-2 text-[11px] text-indigo-700/80 sm:text-xs">
                        想知道實際改了哪裡？點右上角
                        <span className="mx-1 inline-flex items-center gap-1 rounded border border-yellow-300 bg-yellow-100/80 px-1.5 py-px font-medium text-yellow-900">
                          <Highlighter className="h-3 w-3" />標註本版變更
                        </span>
                        ，{prevLabel ? `與 ${prevLabel} 相比` : "本版"}新增或修改的段落會以黃底標出。
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {showChanges && (
                <div className="flex items-start gap-1.5 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-[11px] text-yellow-900 sm:text-xs">
                  <Highlighter className="mt-px h-3.5 w-3.5 shrink-0" />
                  <p>
                    黃底處為 <span className="font-medium">{doc.versionLabel}</span>
                    {prevLabel ? ` 相對於 ${prevLabel}` : ""} 新增或修改的內容；
                    純刪除的段落無法在內文標示，請以修改摘要為準。
                  </p>
                </div>
              )}

              <Card className="relative overflow-hidden">
                <div
                  className="absolute inset-0 pointer-events-none z-10"
                  style={{ backgroundImage: watermarkBg, backgroundRepeat: "repeat" }}
                />
                <CardContent
                  className="p-4 sm:p-6 select-none"
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <div
                    ref={contentRef}
                    className="prose prose-sm sm:prose-base prose-neutral max-w-none
                      prose-table:border-collapse prose-th:border prose-th:border-border prose-th:px-2 prose-th:py-1
                      prose-th:bg-muted/50 prose-td:border prose-td:border-border prose-td:px-2 prose-td:py-1
                      prose-img:rounded-lg"
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkBreaks]}
                      rehypePlugins={[rehypeRaw]}
                      remarkRehypeOptions={{ allowDangerousHtml: true }}
                      components={markdownComponents}
                    >
                      {processed}
                    </ReactMarkdown>
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground/70">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-px" />
                <p>
                  本文件為機密規範，僅供線上檢視、不提供下載，請勿轉傳。
                  {expiresAt && `　此分享連結於 ${new Date(expiresAt).toLocaleDateString("zh-TW")} 到期。`}
                  　內容以平台最新版本為準。
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}

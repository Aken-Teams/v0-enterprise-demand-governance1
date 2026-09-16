"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, FileText, Loader2, Download, ExternalLink, FileAudio, ZoomIn, Highlighter, List, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { DOCUMENT_TYPE_LABELS } from "@/lib/constants/demand"
import { preprocessMarkdown } from "@/lib/markdown"
import { buildToc, changedLineSet, headingId, rangeHasChange } from "@/lib/process-doc"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import rehypeRaw from "rehype-raw"
import mermaid from "mermaid"
import { ExcelPreview } from "@/components/excel-preview"

// ── Gherkin formatting (shared logic) ──────────────────────────
function formatGherkinInMarkdown(input: string): string {
  // HackMD 容器語法（:::spoiler / :::info…）標準 Markdown 不認得，
  // 須在下方的提前返回之前先展開，否則含程式碼區塊的文件會整段跳過處理。
  const md = preprocessMarkdown(input)
  if (/```gherkin/.test(md)) return md
  if (/```/.test(md)) return md

  let src = md
  const kwPattern = '(?:Feature\\s*[\\d.]*\\s*[:：]|Scenario(?:\\s+Outline)?\\s*[\\d.]*\\s*[:：]|Background\\s*[:：]|Examples\\s*[:：]|Given\\b|When\\b|Then\\b|And\\b|But\\b)'
  const kwCountRe = new RegExp(kwPattern, 'g')
  const splitBeforeKwRe = new RegExp(`(\\S)\\s+(?=${kwPattern})`, 'g')

  const expanded = src.split('\n').flatMap((raw) => {
    let line = raw.trim()
    if (/^`[^`]+`$/.test(line)) line = line.slice(1, -1).trim()
    const kwHits = line.match(kwCountRe)
    if (kwHits && kwHits.length >= 3) return line.replace(splitBeforeKwRe, '$1\n').split('\n')
    return [line]
  }).join('\n')

  const lines = expanded.split('\n')
  const featureRe = /^Feature\s*([\d.]*)\s*[:：]\s*(.+)/
  const scenarioRe = /^(Scenario(?:\s+Outline)?)\s*([\d.]*)\s*[:：]\s*(.+)/
  const bgRe = /^Background\s*[:：](.*)/
  const exRe = /^Examples\s*[:：](.*)/
  const stepKw = /^(Given|When|Then|And|But)\b/

  const hasGherkin = lines.some((l) => {
    const t = l.trim()
    return featureRe.test(t) || scenarioRe.test(t) || stepKw.test(t)
  })
  if (!hasGherkin) return src

  const result: string[] = []
  let stepLines: string[] = []
  const flushSteps = () => {
    if (stepLines.length) {
      result.push('', '```gherkin')
      stepLines.forEach(l => result.push(l))
      result.push('```', '')
      stepLines = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    const fm = trimmed.match(featureRe)
    if (fm) { flushSteps(); result.push(`## Feature${fm[1] ? ` ${fm[1]}` : ''}：${fm[2]}`, ''); continue }
    const sm = trimmed.match(scenarioRe)
    if (sm) { flushSteps(); result.push(`### ${sm[1]}${sm[2] ? ` ${sm[2]}` : ''}：${sm[3]}`, ''); continue }
    const bm = trimmed.match(bgRe)
    if (bm) { flushSteps(); result.push(`### Background${bm[1]?.trim() ? '：' + bm[1].trim() : ''}`, ''); continue }
    const em2 = trimmed.match(exRe)
    if (em2) { flushSteps(); result.push(`### Examples${em2[1]?.trim() ? '：' + em2[1].trim() : ''}`, ''); continue }
    if (stepKw.test(trimmed)) { stepLines.push(trimmed); continue }
    if (stepLines.length > 0 && trimmed) { stepLines.push(trimmed); continue }
    if (!trimmed) { flushSteps(); result.push(''); continue }
    result.push(line)
  }
  flushSteps()
  return result.join('\n')
}

function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading")
  useEffect(() => {
    if (!ref.current) return
    setStatus("loading")
    const id = `mermaid-fs-${Math.random().toString(36).slice(2, 9)}`
    mermaid.render(id, code).then(({ svg }) => {
      if (ref.current) {
        ref.current.innerHTML = svg
        ref.current.querySelectorAll("svg").forEach((s) => { s.style.background = "transparent"; s.style.maxWidth = "100%" })
      }
      setStatus("ok")
    }).catch(() => {
      if (!ref.current) return
      const pre = document.createElement("pre")
      pre.className = "mermaid"
      pre.textContent = code
      ref.current.innerHTML = ""
      ref.current.appendChild(pre)
      mermaid.run({ nodes: [pre], suppressErrors: true }).then(() => {
        if (ref.current) {
          ref.current.querySelectorAll("svg").forEach((s) => { s.style.background = "transparent"; s.style.maxWidth = "100%" })
          setStatus(ref.current.querySelector("svg") ? "ok" : "error")
        }
      }).catch(() => setStatus("error"))
    })
    return () => { if (ref.current) ref.current.innerHTML = "" }
  }, [code])

  if (status === "error") {
    return (
      <div className="w-full rounded-lg border border-amber-200 bg-amber-50/50 p-4 not-prose">
        <p className="text-xs font-medium text-amber-700 mb-2">此圖表格式無法解析</p>
        <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-white/60 rounded p-3">{code}</pre>
      </div>
    )
  }
  return <div ref={ref} data-mermaid-container className="flex justify-center not-prose [&_svg]:!bg-transparent" />
}

// ── Types ──────────────────────────────────────────────────────
interface DocumentInfo {
  id: string
  type: string
  phase: string | null
  fileName: string
  fileUrl: string | null
  fileSize: number | null
  uploadedBy: string
  createdAt: string
  version?: number
}

interface FullScreenDocumentPreviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  doc: DocumentInfo | null
  /**
   * 同一份文件的前一個版本；有的話 .md 預覽會多出「標註本版變更」開關。
   * PDF／Word 無法做行級比對，傳了也不會用到。
   */
  prevDoc?: { fileName: string; fileUrl: string | null; version?: number } | null
  watermarkBg?: string
  userName?: string
}

export function FullScreenDocumentPreview({ open, onOpenChange, doc, prevDoc, watermarkBg: watermarkBgProp, userName }: FullScreenDocumentPreviewProps) {
  const [textContent, setTextContent] = useState("")
  const [textLoading, setTextLoading] = useState(false)
  const [excelReady, setExcelReady] = useState(false)
  const [officePreviewUrl, setOfficePreviewUrl] = useState<string | null>(null)
  const [officeLoading, setOfficeLoading] = useState(false)
  const [zoomedImg, setZoomedImg] = useState<string | null>(null)
  /** 前一版內容（僅 .md 會抓），供「標註本版變更」比對 */
  const [prevContent, setPrevContent] = useState("")
  const [showChanges, setShowChanges] = useState(false)
  const [tocOpen, setTocOpen] = useState(true)
  const [activeHeading, setActiveHeading] = useState<string | null>(null)
  const mdScrollRef = useRef<HTMLDivElement>(null)

  const watermarkBg = useMemo(() => {
    if (watermarkBgProp) return watermarkBgProp
    const name = userName || "使用者"
    const text = `${name}\u3000機密文件`
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150"><text transform="rotate(-30 150 75)" x="150" y="85" font-size="14" fill="rgba(0,0,0,0.07)" text-anchor="middle" font-family="sans-serif">${text}</text></svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  }, [watermarkBgProp, userName])

  // Load text content
  useEffect(() => {
    if (!open || !doc?.fileUrl) { setTextContent(""); return }
    const ext = doc.fileName.split(".").pop()?.toLowerCase() || ""
    if (!["txt", "md"].includes(ext)) return
    setTextLoading(true)
    fetch(doc.fileUrl)
      .then((res) => {
        if (!res.ok) { setTextContent(""); setTextLoading(false); return }
        return res.text()
      })
      .then((t) => { if (t !== undefined) setTextContent(t) })
      .catch(() => setTextContent(""))
      .finally(() => setTextLoading(false))
  }, [open, doc])

  // 前一版內容：只有 .md 需要（其他格式無法行級比對）
  useEffect(() => {
    setShowChanges(false)
    const ext = doc?.fileName.split(".").pop()?.toLowerCase() || ""
    if (!open || ext !== "md" || !prevDoc?.fileUrl) { setPrevContent(""); return }
    fetch(prevDoc.fileUrl)
      .then((res) => (res.ok ? res.text() : ""))
      .then((t) => setPrevContent(t || ""))
      .catch(() => setPrevContent(""))
  }, [open, doc, prevDoc])

  // Excel readiness
  useEffect(() => {
    if (!open || !doc?.fileUrl) { setExcelReady(false); return }
    const ext = doc.fileName.split(".").pop()?.toLowerCase() || ""
    setExcelReady(["xls", "xlsx"].includes(ext))
  }, [open, doc])

  // Office preview
  useEffect(() => {
    if (!open || !doc?.fileUrl) { setOfficePreviewUrl(null); return }
    const ext = doc.fileName.split(".").pop()?.toLowerCase() || ""
    if (!["ppt", "pptx", "doc", "docx"].includes(ext)) { setOfficePreviewUrl(null); return }
    setOfficeLoading(true)
    setOfficePreviewUrl(null)
    const previewUrl = `${doc.fileUrl}/preview`
    fetch(previewUrl, { method: "HEAD" })
      .then((res) => { if (res.ok) setOfficePreviewUrl(previewUrl) })
      .catch(() => {})
      .finally(() => setOfficeLoading(false))
  }, [open, doc])

  if (!doc) return null

  const ext = doc.fileName.split(".").pop()?.toLowerCase() || ""
  const url = doc.fileUrl
  const isExternalLink = (doc.type === "APP_RESULT" || doc.type === "GITHUB_REPO") && url?.startsWith("http")
  const typeLabel = DOCUMENT_TYPE_LABELS[doc.type as keyof typeof DOCUMENT_TYPE_LABELS] || doc.type

  const renderContent = () => {
    if (isExternalLink && doc.type === "GITHUB_REPO") {
      return (
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <ExternalLink className="h-8 w-8 text-muted-foreground/60" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">GitHub 連結</p>
            <a href={url!} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all">{url}</a>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href={url!} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5 mr-1.5" />前往 GitHub</a>
          </Button>
        </div>
      )
    }

    if (isExternalLink) {
      return (
        <div className="w-full h-full flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
            <p className="text-xs text-muted-foreground truncate flex-1">{url}</p>
            <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" asChild>
              <a href={url!} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3 mr-1" />新分頁</a>
            </Button>
          </div>
          <iframe src={url!} className="flex-1 w-full border-0" title="APP 預覽" />
        </div>
      )
    }

    if (!url) return <p className="text-sm text-muted-foreground">此文件無預覽連結</p>

    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
      return (
        <div className="relative group cursor-zoom-in" onClick={() => setZoomedImg(url)}>
          <img src={url} alt={doc.fileName} className="max-w-full max-h-[80vh] object-contain rounded" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors rounded">
            <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow-lg" />
          </div>
        </div>
      )
    }

    if (ext === "pdf") {
      return <iframe src={`${url}#toolbar=0&navpanes=0`} className="w-full h-full rounded border-0" title={doc.fileName} />
    }

    if (["mp4", "webm"].includes(ext)) {
      return <video src={url} controls className="max-w-full max-h-[80vh] rounded" />
    }

    if (["mp3", "wav", "ogg"].includes(ext)) {
      return (
        <div className="text-center space-y-4">
          <FileAudio className="h-16 w-16 mx-auto text-sky-400" />
          <p className="text-sm font-medium">{doc.fileName}</p>
          <audio src={url} controls className="mx-auto" />
        </div>
      )
    }

    if (["txt", "md"].includes(ext)) {
      if (textLoading) return <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      if (!textContent) {
        return (
          <div className="text-center space-y-2">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">檔案不存在</p>
            <p className="text-xs text-muted-foreground/60">檔案可能尚未同步或已被移除</p>
          </div>
        )
      }
      if (ext === "md") {
        const processed = preprocessMarkdown(formatGherkinInMarkdown(textContent))
        const changed = prevContent
          ? changedLineSet(formatGherkinInMarkdown(prevContent), formatGherkinInMarkdown(textContent))
          : new Set<number>()
        const toc = buildToc(processed)
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
            return <Tag id={headingId(line)} className={cn("scroll-mt-6", hl(node) && HL)}>{children}</Tag>
          }

        return (
          <div className="flex h-full w-full overflow-hidden">
            {/* 目錄：AI 產的 PRD 動輒數十頁，沒有目錄很難找到要看的段落 */}
            {toc.length > 1 && tocOpen && (
              <aside className="hidden w-60 shrink-0 overflow-y-auto border-r bg-muted/20 p-2 lg:block">
                <p className="mb-1.5 flex items-center gap-1.5 px-2 text-xs font-semibold text-muted-foreground">
                  <List className="h-3.5 w-3.5" />目錄
                </p>
                <ul className="space-y-0.5">
                  {toc.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          const el = mdScrollRef.current?.querySelector(`#${item.id}`)
                          el?.scrollIntoView({ behavior: "smooth", block: "start" })
                          setActiveHeading(item.id)
                        }}
                        className={cn(
                          "flex w-full items-start gap-1.5 rounded px-2 py-1 text-left text-[13px] leading-snug transition-colors hover:bg-muted",
                          item.level === 1 ? "font-medium text-foreground" : "text-muted-foreground",
                          item.level === 2 && "pl-4",
                          item.level >= 3 && "pl-7 text-[12px]",
                          activeHeading === item.id && "bg-indigo-50 text-indigo-700",
                        )}
                      >
                        <span className="min-w-0 flex-1 break-words">{item.text}</span>
                        {showChanges && rangeHasChange(changed, item.line, item.endLine) && (
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-400" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>
            )}

            <div
              ref={mdScrollRef}
              className="prose prose-sm prose-neutral dark:prose-invert h-full max-w-none flex-1 overflow-auto p-8 prose-table:border-collapse prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-1.5 prose-th:bg-muted/50 prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-1.5"
            >
              {showChanges && (
                <div className="not-prose mb-4 flex items-start gap-1.5 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-900">
                  <Highlighter className="mt-px h-3.5 w-3.5 shrink-0" />
                  <p>
                    黃底為本版（v{doc.version ?? "—"}）相對於 v{prevDoc?.version ?? "前一版"} 新增或修改的內容；
                    純刪除的段落無法在內文標示。
                  </p>
                </div>
              )}
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                rehypePlugins={[rehypeRaw]}
                remarkRehypeOptions={{ allowDangerousHtml: true }}
                components={{
                  h1: heading(1), h2: heading(2), h3: heading(3),
                  h4: heading(4), h5: heading(5), h6: heading(6),
                  p({ node, children }) { return <p className={cn(hl(node) && HL)}>{children}</p> },
                  li({ node, children }) { return <li className={cn(hl(node) && HL)}>{children}</li> },
                  tr({ node, children }) { return <tr className={cn(hl(node) && "bg-yellow-100/80")}>{children}</tr> },
                  blockquote({ node, children }) { return <blockquote className={cn(hl(node) && HL)}>{children}</blockquote> },
                  pre({ children }) {
                    if (children && typeof children === "object" && "props" in (children as any)) {
                      const cp = (children as any).props as { className?: string }
                      if (/language-mermaid/.test(cp.className || "")) return <>{children}</>
                    }
                    return <pre>{children}</pre>
                  },
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "")
                    if (match?.[1] === "mermaid") return <MermaidBlock code={String(children).trim()} />
                    return <code className={className} {...props}>{children}</code>
                  },
                }}
              >
                {processed}
              </ReactMarkdown>
            </div>
          </div>
        )
      }
      return (
        <pre className="text-sm whitespace-pre-wrap break-words w-full h-full overflow-auto p-6 bg-muted/30 rounded-lg font-mono leading-relaxed">
          {textContent}
        </pre>
      )
    }

    if (["xls", "xlsx"].includes(ext) && excelReady) {
      return (
        <div className="w-full h-full relative">
          <ExcelPreview fileUrl={doc.fileUrl} fileName={doc.fileName} />
        </div>
      )
    }

    if (["ppt", "pptx", "doc", "docx"].includes(ext)) {
      if (officeLoading) {
        return (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-xs text-muted-foreground">正在轉換預覽…</p>
          </div>
        )
      }
      if (officePreviewUrl) {
        return <iframe src={`${officePreviewUrl}#toolbar=0&navpanes=0`} className="w-full h-full rounded border-0" title={doc.fileName} />
      }
      return (
        <div className="text-center space-y-3">
          <FileText className="h-16 w-16 mx-auto text-muted-foreground/40" />
          <p className="text-sm font-medium">{doc.fileName}</p>
          <p className="text-xs text-muted-foreground">無法轉換預覽</p>
        </div>
      )
    }

    return (
      <div className="text-center space-y-3">
        <FileText className="h-16 w-16 mx-auto text-muted-foreground/40" />
        <p className="text-sm font-medium">{doc.fileName}</p>
        <Button variant="outline" size="sm" asChild>
          <a href={url} download><Download className="h-3.5 w-3.5 mr-1.5" />下載檔案</a>
        </Button>
      </div>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] h-[90vh] !max-w-[95vw] p-0 flex flex-col gap-0 [&>button]:hidden">
          <VisuallyHidden><DialogTitle>{doc.fileName}</DialogTitle></VisuallyHidden>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">{doc.fileName}</span>
              <Badge variant="secondary" className="text-[10px] h-5 shrink-0">{typeLabel}</Badge>
              {doc.version != null && (
                <Badge variant="outline" className="h-5 shrink-0 font-mono text-[10px]">v{doc.version}</Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {/* 只有 .md 才有目錄與差異標註——PDF／Word 做不到行級比對 */}
              {ext === "md" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden h-8 w-8 lg:inline-flex"
                  title={tocOpen ? "收合目錄" : "展開目錄"}
                  onClick={() => setTocOpen((v) => !v)}
                >
                  {tocOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                </Button>
              )}
              {ext === "md" && !!prevContent && (
                <Button
                  variant={showChanges ? "default" : "outline"}
                  size="sm"
                  className={cn("h-8", showChanges && "bg-yellow-500 text-yellow-950 hover:bg-yellow-500/90")}
                  onClick={() => setShowChanges((v) => !v)}
                  title={`標出與 v${prevDoc?.version ?? "前一版"} 相比新增或修改的內容`}
                >
                  <Highlighter className="h-3.5 w-3.5" />
                  <span className="ml-1 text-xs">{showChanges ? "隱藏變更" : "標註本版變更"}</span>
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 relative overflow-hidden">
            <div className="h-full flex items-center justify-center overflow-auto">
              {renderContent()}
            </div>
            {/* Watermark */}
            <div
              className="absolute inset-0 pointer-events-none z-10"
              style={{ backgroundImage: watermarkBg, backgroundRepeat: "repeat" }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Zoomed image overlay */}
      {zoomedImg && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 cursor-zoom-out" onClick={() => setZoomedImg(null)}>
          <img src={zoomedImg} className="max-w-[95vw] max-h-[95vh] object-contain" alt="Zoomed" />
        </div>
      )}
    </>
  )
}

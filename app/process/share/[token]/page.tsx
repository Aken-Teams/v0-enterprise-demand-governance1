"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { use } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import rehypeRaw from "rehype-raw"
import { mermaidMarkdownComponents } from "@/components/mermaid-block"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { preprocessMarkdown } from "@/lib/markdown"
import { Loader2, ShieldAlert, FileText, Info } from "lucide-react"

interface SharedDoc {
  versionLabel: string
  title: string
  content: string
  changeNote: string | null
  createdAt: string
}

/**
 * 開發流程文件的公開分享頁。
 *
 * 供沒有平台帳號者檢視，故不套用 AppLayout、不需登入；
 * 僅呈現最新版內容，無下載入口，並疊上浮水印。
 */
export default function ProcessSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [doc, setDoc] = useState<SharedDoc | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="min-h-screen bg-muted/30">
      {/* 頁首 */}
      <header className="border-b bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap">
          <FileText className="h-5 w-5 text-indigo-600 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-sm sm:text-base truncate">開發流程</p>
            <p className="text-[11px] sm:text-xs text-muted-foreground">
              強茂股份有限公司 × 強合智慧　開案與開發流程規範
            </p>
          </div>
          {doc && (
            <Badge variant="outline" className="ml-auto font-mono text-xs shrink-0">{doc.versionLabel}</Badge>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">
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
          <>
            {doc.changeNote && (
              <Card className="border-indigo-200 bg-indigo-50/40">
                <CardContent className="p-3 sm:p-4">
                  <p className="text-xs font-semibold text-indigo-800 mb-1 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5" />{doc.versionLabel} 修改摘要
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-line">{doc.changeNote}</p>
                </CardContent>
              </Card>
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
                <div className="prose prose-sm sm:prose-base prose-neutral max-w-none
                  prose-table:border-collapse prose-th:border prose-th:border-border prose-th:px-2 prose-th:py-1
                  prose-th:bg-muted/50 prose-td:border prose-td:border-border prose-td:px-2 prose-td:py-1
                  prose-img:rounded-lg">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    rehypePlugins={[rehypeRaw]}
                    remarkRehypeOptions={{ allowDangerousHtml: true }}
                    components={mermaidMarkdownComponents}
                  >
                    {preprocessMarkdown(doc.content)}
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
          </>
        ) : null}
      </main>
    </div>
  )
}

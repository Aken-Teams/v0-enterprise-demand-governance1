"use client"

import React, { use, useState, useEffect, useCallback, useMemo, useRef } from "react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  User,
  FileText,
  CheckCircle,
  Paperclip,
  Loader2,
  AlertTriangle,
  CalendarDays,
  Circle,
  BarChart3,
  Hash,
  Layers,
  Eye,
  Download,
  ExternalLink,
  ZoomIn,
  X,
  FileAudio,
  ShieldAlert,
  ClipboardCheck,
} from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { STATUS_MAP, PIPELINE_STEPS, SIGNOFF_REQUIRED_PHASES } from "@/lib/constants/demand"
import { PhaseDocuments } from "@/components/demand/phase-documents"
import { PhaseSignoffBanner } from "@/components/demand/phase-signoff-banner"
import { SignoffHistory } from "@/components/demand/signoff-history"
import { ProjectGantt } from "@/components/demand/project-gantt"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { ExcelPreview } from "@/components/excel-preview"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import mermaid from "mermaid"

mermaid.initialize({
  startOnLoad: false,
  suppressErrorRendering: true,
  securityLevel: "loose",
  theme: "neutral",
  themeVariables: { background: "transparent", primaryColor: "#dbeafe", primaryTextColor: "#1e3a5f", lineColor: "#94a3b8" },
})

/** Pre-process raw Gherkin / BDD text into well-structured Markdown.
 *  Feature / Scenario lines → headings; Given/When/Then blocks → fenced code blocks. */
function formatGherkinInMarkdown(md: string): string {
  // If the content already has proper ```gherkin fenced code blocks,
  // return as-is and let ReactMarkdown render them natively.
  if (/```gherkin/.test(md)) return md
  // Non-gherkin code blocks (e.g. mermaid) → leave as-is
  if (/```/.test(md)) return md

  let src = md

  // ── Step 2: Restore line breaks in concatenated Gherkin ──
  // Content may have been stored with newlines stripped into one line,
  // possibly wrapped in single backticks. Detect and expand.
  const kwPattern = '(?:Feature\\s*[\\d.]*\\s*[:：]|Scenario(?:\\s+Outline)?\\s*[\\d.]*\\s*[:：]|Background\\s*[:：]|Examples\\s*[:：]|Given\\b|When\\b|Then\\b|And\\b|But\\b)'
  const kwCountRe = new RegExp(kwPattern, 'g')
  const splitBeforeKwRe = new RegExp(`(\\S)\\s+(?=${kwPattern})`, 'g')

  const expanded = src.split('\n').flatMap((raw) => {
    let line = raw.trim()
    // Strip wrapping single backticks (inline code that wraps Gherkin)
    if (/^`[^`]+`$/.test(line)) {
      line = line.slice(1, -1).trim()
    }
    // If ≥3 Gherkin keywords on one line → likely concatenated, split them
    const kwHits = line.match(kwCountRe)
    if (kwHits && kwHits.length >= 3) {
      return line.replace(splitBeforeKwRe, '$1\n').split('\n')
    }
    return [line]
  }).join('\n')

  // ── Step 3: Convert Gherkin keywords into structured Markdown ──
  const lines = expanded.split('\n')
  const featureRe = /^Feature\s*([\d.]*)\s*[:：]\s*(.+)/
  const scenarioRe = /^(Scenario(?:\s+Outline)?)\s*([\d.]*)\s*[:：]\s*(.+)/
  const bgRe = /^Background\s*[:：](.*)/
  const exRe = /^Examples\s*[:：](.*)/
  const stepKw = /^(Given|When|Then|And|But)\b/

  // Detect whether the content contains Gherkin structure
  const hasGherkin = lines.some((l) => {
    const t = l.trim()
    return featureRe.test(t) || scenarioRe.test(t) || stepKw.test(t)
  })
  if (!hasGherkin) return src

  const result: string[] = []
  let stepLines: string[] = []
  const flushSteps = () => {
    if (stepLines.length) {
      result.push('')
      result.push('```gherkin')
      stepLines.forEach(l => result.push(l))
      result.push('```')
      result.push('')
      stepLines = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()

    // Feature heading
    const fm = trimmed.match(featureRe)
    if (fm) {
      flushSteps()
      const num = fm[1] ? ` ${fm[1]}` : ''
      result.push(`## Feature${num}：${fm[2]}`)
      result.push('')
      continue
    }

    // Scenario heading
    const sm = trimmed.match(scenarioRe)
    if (sm) {
      flushSteps()
      const num = sm[2] ? ` ${sm[2]}` : ''
      result.push(`### ${sm[1]}${num}：${sm[3]}`)
      result.push('')
      continue
    }

    // Background heading
    const bm = trimmed.match(bgRe)
    if (bm) {
      flushSteps()
      result.push(`### Background${bm[1]?.trim() ? '：' + bm[1].trim() : ''}`)
      result.push('')
      continue
    }

    // Examples heading
    const em2 = trimmed.match(exRe)
    if (em2) {
      flushSteps()
      result.push(`### Examples${em2[1]?.trim() ? '：' + em2[1].trim() : ''}`)
      result.push('')
      continue
    }

    // Step keywords → collect for HTML <pre> block
    if (stepKw.test(trimmed)) {
      stepLines.push(trimmed)
      continue
    }

    // Non-empty line while collecting steps (data tables, doc-strings, etc.)
    if (stepLines.length > 0 && trimmed) {
      stepLines.push(trimmed)
      continue
    }

    // Empty line → flush step block
    if (!trimmed) {
      flushSteps()
      result.push('')
      continue
    }

    // Any other text outside step block
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
    const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`

    mermaid.render(id, code).then(({ svg }) => {
      if (ref.current) {
        ref.current.innerHTML = svg
        ref.current.querySelectorAll("svg").forEach((s) => {
          s.style.background = "transparent"
          s.style.maxWidth = "100%"
        })
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
          ref.current.querySelectorAll("svg").forEach((s) => {
            s.style.background = "transparent"
            s.style.maxWidth = "100%"
          })
          if (ref.current.querySelector("svg")) {
            setStatus("ok")
          } else {
            setStatus("error")
          }
        }
      }).catch(() => {
        setStatus("error")
      })
    })

    return () => {
      if (ref.current) ref.current.innerHTML = ""
    }
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

// ── Pie chart colors (one per pipeline phase) ──
const PIE_COLORS: Record<string, string> = {
  SUBMITTED: "#3b82f6",
  PRD_REVIEW: "#f59e0b",
  SP_REVIEW: "#ef4444",
  DEVELOPING: "#8b5cf6",
  ACCEPTANCE: "#06b6d4",
  CLOSED: "#10b981",
}

// Internal-only document types hidden from subsidiary users
const CONFIDENTIAL_DOC_TYPES = new Set<string>(["GITHUB_REPO"])

interface DemandDetail {
  id: string
  demandNumber: string
  title: string
  description: string
  painPoint: string | null
  expectedBenefit: string | null
  status: string
  priority: string
  estimatedSp: number
  confirmedSp: number | null
  desiredDate: string | null
  expectedDate: string | null
  completedDate: string | null
  rejectReason: string | null
  adminNotes: string | null
  createdAt: string
  updatedAt: string
  organization: { id: string; name: string }
  submitter: { id: string; name: string; email: string }
  creator: { id: string; name: string }
  manager: { id: string; name: string } | null
  developer: { id: string; name: string } | null
  documents: {
    id: string
    type: string
    phase: string | null
    fileName: string
    fileUrl: string | null
    fileSize: number | null
    uploadedBy: string
    createdAt: string
  }[]
  comments: {
    id: string
    content: string
    user: { id: string; name: string }
    createdAt: string
  }[]
  statusHistory: {
    id: string
    fromStatus: string
    toStatus: string
    comment: string | null
    createdAt: string
  }[]
  phasePlans: {
    phase: string
    plannedSp: number | null
    plannedStart: string | null
    plannedEnd: string | null
    actualStart: string | null
    actualEnd: string | null
    engineer: { id: string; name: string } | null
    pm: { id: string; name: string } | null
  }[]
  subTasks: {
    id: string
    name: string
    plannedStart: string | null
    plannedEnd: string | null
    actualStart: string | null
    actualEnd: string | null
    status: string
    assignee: { id: string; name: string } | null
    order: number
  }[]
  phaseSignoffs: {
    id: string
    phase: string
    status: string
    comment: string | null
    requestedAt: string
    respondedAt: string | null
    requestedBy: { id: string; name: string }
    respondedBy: { id: string; name: string } | null
    documents?: { id: string; fileName: string; fileUrl: string | null; fileSize: number | null }[]
  }[]
}

function fmtDate(dateStr: string | null) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
}

function fmtDateFull(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

export default function DemandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { token, user } = useAuth()
  const [demand, setDemand] = useState<DemandDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Document preview states
  const [selectedDoc, setSelectedDoc] = useState<DemandDetail["documents"][0] | null>(null)
  const [textContent, setTextContent] = useState("")
  const [textLoading, setTextLoading] = useState(false)
  const [excelReady, setExcelReady] = useState(false)
  const [officePreviewUrl, setOfficePreviewUrl] = useState<string | null>(null)
  const [officeLoading, setOfficeLoading] = useState(false)
  const [zoomedImg, setZoomedImg] = useState<string | null>(null)

  const fetchDemand = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`/api/demands/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "載入失敗")
        return
      }
      const data = await res.json()
      setDemand(data.demand)
    } catch {
      setError("網路錯誤，無法載入需求資料")
    } finally {
      setLoading(false)
    }
  }, [token, id])

  useEffect(() => {
    fetchDemand()
  }, [fetchDemand])

  // Check if selected document is confidential
  const isConfidential = selectedDoc ? CONFIDENTIAL_DOC_TYPES.has(selectedDoc.type) : false

  // Fetch text content for txt/md files
  useEffect(() => {
    if (!selectedDoc?.fileUrl || isConfidential) return
    const ext = selectedDoc.fileName.split(".").pop()?.toLowerCase() || ""
    if (!["txt", "md"].includes(ext)) return
    setTextLoading(true)
    fetch(selectedDoc.fileUrl)
      .then((r) => r.text())
      .then(setTextContent)
      .catch(() => setTextContent(""))
      .finally(() => setTextLoading(false))
  }, [selectedDoc, isConfidential])

  // Track when Excel file is selected for preview
  useEffect(() => {
    if (!selectedDoc?.fileUrl || isConfidential) { setExcelReady(false); return }
    const ext = selectedDoc.fileName.split(".").pop()?.toLowerCase() || ""
    setExcelReady(["xls", "xlsx"].includes(ext))
  }, [selectedDoc, isConfidential])

  // Trigger LibreOffice conversion for Office files
  useEffect(() => {
    if (!selectedDoc?.fileUrl || isConfidential) { setOfficePreviewUrl(null); return }
    const ext = selectedDoc.fileName.split(".").pop()?.toLowerCase() || ""
    if (!["ppt", "pptx", "doc", "docx"].includes(ext)) { setOfficePreviewUrl(null); return }
    setOfficeLoading(true)
    setOfficePreviewUrl(null)
    const previewUrl = `${selectedDoc.fileUrl}/preview`
    fetch(previewUrl, { method: "HEAD" })
      .then((res) => {
        if (res.ok) setOfficePreviewUrl(previewUrl)
      })
      .catch(() => {})
      .finally(() => setOfficeLoading(false))
  }, [selectedDoc, isConfidential])

  // Watermark SVG background
  const watermarkBg = useMemo(() => {
    const name = user?.name || "使用者"
    const text = `${name}\u3000機密文件`
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150"><text transform="rotate(-30 150 75)" x="150" y="85" font-size="14" fill="rgba(0,0,0,0.07)" text-anchor="middle" font-family="sans-serif">${text}</text></svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  }, [user?.name])

  if (loading) {
    return (
      <AppLayout userRole="subsidiary">
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  if (error || !demand) {
    return (
      <AppLayout userRole="subsidiary">
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-muted-foreground mb-4">{error || "找不到此需求"}</p>
          <Button asChild>
            <Link href="/subsidiary/demands">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回需求列表
            </Link>
          </Button>
        </div>
      </AppLayout>
    )
  }

  const statusInfo = STATUS_MAP[demand.status] || { label: demand.status, color: "bg-gray-100 text-gray-700" }
  const sp = demand.confirmedSp ?? demand.estimatedSp
  const isRejected = demand.status === "REJECTED"
  const isClosed = demand.status === "CLOSED"
  const currentStepIdx = PIPELINE_STEPS.indexOf(demand.status as typeof PIPELINE_STEPS[number])
  const phasePlanMap = Object.fromEntries(demand.phasePlans.map((p) => [p.phase, p]))

  // Pending sign-off for current phase
  const pendingSignoff = demand.phaseSignoffs?.find(
    (s) => s.status === "PENDING"
  ) || null

  // Project start date
  const projectStartDate = demand.phasePlans.reduce<string | null>((earliest, p) => {
    const d = p.plannedStart || p.actualStart
    if (!d) return earliest
    if (!earliest) return d
    return new Date(d) < new Date(earliest) ? d : earliest
  }, null)

  // Pie chart data
  const spPieData = demand.phasePlans
    .filter((p) => p.plannedSp && p.plannedSp > 0)
    .map((p) => ({
      name: STATUS_MAP[p.phase]?.label || p.phase,
      value: p.plannedSp!,
      phase: p.phase,
    }))

  return (
    <AppLayout userRole="subsidiary">
      <div className="space-y-5">
        {/* ── Header ── */}
        <div>
          <Button variant="ghost" size="sm" asChild className="h-8 px-2 mb-3 -ml-2">
            <Link href="/subsidiary/demands">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              返回需求列表
            </Link>
          </Button>

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-mono text-muted-foreground mb-1">{demand.demandNumber}</p>
              <h1 className="text-xl font-bold tracking-tight leading-snug">{demand.title}</h1>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Badge className={cn("text-xs whitespace-nowrap", statusInfo.color)}>
                {statusInfo.label}
              </Badge>
              <div className="text-right">
                <span className="text-2xl font-bold text-primary">{sp}</span>
                <span className="text-xs text-muted-foreground ml-1">SP</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Alert banners ── */}
        {isRejected && demand.rejectReason && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-800 text-sm mb-0.5">需求已駁回</p>
              <p className="text-sm text-red-700 whitespace-pre-line">{demand.rejectReason}</p>
            </div>
          </div>
        )}

        {isClosed && (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
            <p className="text-sm text-emerald-700">
              此需求已於 <span className="font-medium">{fmtDateFull(demand.completedDate || demand.updatedAt)}</span> 結案完成
            </p>
          </div>
        )}

        {/* ── Sign-off Banner ── */}
        {pendingSignoff && (
          <PhaseSignoffBanner
            signoff={pendingSignoff}
            demandId={demand.id}
            token={token}
            onComplete={fetchDemand}
          />
        )}

        {/* ── Tabs ── */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full justify-start bg-muted/50 h-10">
            <TabsTrigger value="overview" className="gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              概覽
            </TabsTrigger>
            <TabsTrigger value="gantt" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              甘特圖
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5">
              <Paperclip className="h-3.5 w-3.5" />
              文件
              {demand.documents.filter((d) => d.type !== "GITHUB_REPO").length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-0.5">
                  {demand.documents.filter((d) => d.type !== "GITHUB_REPO").length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ══════ Tab: 概覽 ══════ */}
          <TabsContent value="overview" className="mt-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Left */}
              <div className="lg:col-span-2 space-y-5">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">需求內容</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0">
                    <div>
                      <p className="text-xs font-semibold text-blue-600 mb-1.5">需求說明</p>
                      <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none prose-table:border-collapse prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-1.5 prose-th:bg-muted/50 prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-1.5">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkBreaks]}
                          components={{
                            pre({ children }) {
                              // Only unwrap <pre> for mermaid blocks
                              if (React.isValidElement(children)) {
                                const cp = children.props as { className?: string }
                                if (/language-mermaid/.test(cp.className || "")) {
                                  return <>{children}</>
                                }
                              }
                              return <pre>{children}</pre>
                            },
                            code({ className, children, ...props }) {
                              const match = /language-(\w+)/.exec(className || "")
                              if (match?.[1] === "mermaid") {
                                return <MermaidBlock code={String(children).trim()} />
                              }
                              return <code className={className} {...props}>{children}</code>
                            },
                          }}
                        >
                          {formatGherkinInMarkdown(demand.description)}
                        </ReactMarkdown>
                      </div>
                    </div>

                    {demand.painPoint && (
                      <>
                        <Separator className="my-4" />
                        <div>
                          <p className="text-xs font-semibold text-amber-600 mb-1.5">痛點說明</p>
                          <p className="text-sm leading-relaxed whitespace-pre-line">{demand.painPoint}</p>
                        </div>
                      </>
                    )}

                    {demand.expectedBenefit && (
                      <>
                        <Separator className="my-4" />
                        <div>
                          <p className="text-xs font-semibold text-emerald-600 mb-1.5">預期效益</p>
                          <p className="text-sm leading-relaxed whitespace-pre-line">{demand.expectedBenefit}</p>
                        </div>
                      </>
                    )}

                    {demand.adminNotes && (
                      <>
                        <Separator className="my-4" />
                        <div>
                          <p className="text-xs font-semibold text-violet-600 mb-1.5">管理者備註</p>
                          <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{demand.adminNotes}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Comments */}
                {demand.comments.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        留言
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{demand.comments.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {demand.comments.map((c) => (
                        <div key={c.id} className="rounded-lg bg-muted/50 p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{c.user.name}</span>
                            <span className="text-[11px] text-muted-foreground">{fmtDate(c.createdAt)}</span>
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-pre-line">{c.content}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right */}
              <div className="space-y-5">
                {/* Basic info + Team */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">基本資訊</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Hash className="h-3.5 w-3.5" />
                        編號
                      </span>
                      <span className="font-mono font-medium">{demand.demandNumber}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        提交者
                      </span>
                      <span className="font-medium">{demand.submitter.name}</span>
                    </div>
                    <Separator />
                    {projectStartDate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" />
                          專案開始日期
                        </span>
                        <span className="font-medium">{fmtDate(projectStartDate)}</span>
                      </div>
                    )}
                    {demand.desiredDate && (
                      <>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            希望完成日期
                          </span>
                          <span className="font-medium">{fmtDate(demand.desiredDate)}</span>
                        </div>
                      </>
                    )}
                    {demand.expectedDate && (
                      <>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">預計完成</span>
                          <span className="font-medium">{fmtDate(demand.expectedDate)}</span>
                        </div>
                      </>
                    )}
                    {demand.completedDate && (
                      <>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">實際完成</span>
                          <span className="font-medium text-emerald-600">{fmtDate(demand.completedDate)}</span>
                        </div>
                      </>
                    )}

                    {/* Team section */}
                    <Separator />
                    <p className="text-xs font-medium text-muted-foreground pt-1">負責人</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-[11px] font-medium text-primary">
                            {demand.manager ? demand.manager.name[0] : "?"}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate leading-tight">
                            {demand.manager?.name || "未指派"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">PM</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                          <span className="text-[11px] font-medium text-violet-600">
                            {demand.developer ? demand.developer.name[0] : "?"}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate leading-tight">
                            {demand.developer?.name || "未指派"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">開發</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* SP Pie Chart */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      SP 分配
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {spPieData.length > 0 ? (
                      <div>
                        <div className="h-[160px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={spPieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={65}
                                paddingAngle={3}
                                dataKey="value"
                                stroke="none"
                              >
                                {spPieData.map((entry) => (
                                  <Cell key={entry.phase} fill={PIE_COLORS[entry.phase] || "#94a3b8"} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value: number) => [`${value} SP`, ""]}
                                contentStyle={{
                                  fontSize: "12px",
                                  borderRadius: "8px",
                                  border: "1px solid var(--border)",
                                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                                }}
                              />
                              <text x="50%" y="48%" textAnchor="middle" dominantBaseline="central" className="fill-foreground text-lg font-bold">
                                {sp}
                              </text>
                              <text x="50%" y="62%" textAnchor="middle" dominantBaseline="central" className="fill-muted-foreground text-[10px]">
                                SP
                              </text>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-1.5 mt-2">
                          {spPieData.map((entry) => (
                            <div key={entry.phase} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[entry.phase] || "#94a3b8" }} />
                                <span className="text-muted-foreground">{entry.name}</span>
                              </div>
                              <span className="font-medium">{entry.value} SP</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-3xl font-bold text-primary">{sp}</p>
                        <p className="text-xs text-muted-foreground mt-1">總 Story Points</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Phase progress */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      階段進度
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {PIPELINE_STEPS.map((phase, idx) => {
                        const plan = phasePlanMap[phase]
                        const phaseInfo = STATUS_MAP[phase]
                        const isPast = currentStepIdx >= 0 && idx < currentStepIdx
                        const isCurrent = idx === currentStepIdx && !isRejected
                        const isFuture = currentStepIdx >= 0 ? idx > currentStepIdx : true

                        const dateRange =
                          plan?.plannedStart && plan?.plannedEnd
                            ? `${fmtDate(plan.plannedStart)} — ${fmtDate(plan.plannedEnd)}`
                            : plan?.actualStart
                              ? `${fmtDate(plan.actualStart)} 起`
                              : null

                        return (
                          <div
                            key={phase}
                            className={cn(
                              "flex items-center gap-3 px-5 py-2.5",
                              isCurrent && "bg-primary/[0.04]",
                            )}
                          >
                            {isPast ? (
                              <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                            ) : isCurrent ? (
                              <div className="h-4 w-4 shrink-0 relative flex items-center justify-center">
                                <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                                <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-pulse" />
                              </div>
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                            )}

                            <span className={cn(
                              "text-sm flex-1 min-w-0",
                              isCurrent && "font-semibold text-foreground",
                              isPast && "text-muted-foreground",
                              isFuture && "text-muted-foreground/50",
                            )}>
                              {phaseInfo?.label}
                            </span>

                            {dateRange && (
                              <span className={cn(
                                "text-[11px] shrink-0 hidden xl:inline",
                                isCurrent ? "text-muted-foreground" : "text-muted-foreground/60",
                              )}>
                                {dateRange}
                              </span>
                            )}

                            <Badge variant="secondary" className={cn(
                              "text-[10px] h-5 px-1.5 rounded shrink-0",
                              isFuture && "opacity-50",
                            )}>
                              {plan?.plannedSp ?? 0}
                            </Badge>
                          </div>
                        )
                      })}

                      {isRejected && (
                        <div className="flex items-center gap-3 px-5 py-2.5 bg-red-50/50">
                          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                          <span className="text-sm font-medium text-red-700">已駁回</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Sign-off History */}
                {demand.phaseSignoffs && demand.phaseSignoffs.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <ClipboardCheck className="h-4 w-4" />
                        簽核紀錄
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <SignoffHistory signoffs={demand.phaseSignoffs} />
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ══════ Tab: 甘特圖 ══════ */}
          <TabsContent value="gantt" className="mt-5">
            <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  專案時程
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-hidden">
                <div className="overflow-x-auto">
                  <ProjectGantt
                    phasePlans={demand.phasePlans}
                    currentStatus={demand.status}
                    subTasks={demand.subTasks}
                    demandId={demand.id}
                    canEdit={false}
                    token={token}
                    onRefresh={fetchDemand}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════ Tab: 文件 ══════ */}
          <TabsContent value="documents" className="mt-5">
            <div className="grid gap-6 lg:grid-cols-5">
              {/* Preview pane */}
              <div className="lg:col-span-3">
                <Card className="h-full">
                  <CardContent className="p-0 h-full">
                    {selectedDoc ? (
                      <div className="relative min-h-[520px] h-full">
                        <div className="h-full min-h-[520px] flex items-center justify-center p-4 overflow-hidden">
                          {(() => {
                            // Block confidential documents
                            if (isConfidential) {
                              return (
                                <div className="text-center space-y-3">
                                  <ShieldAlert className="h-16 w-16 mx-auto text-amber-400" />
                                  <p className="text-sm font-medium">{selectedDoc.fileName}</p>
                                  <p className="text-xs text-muted-foreground">此為機密文件，僅限內部團隊檢視</p>
                                </div>
                              )
                            }

                            const ext = selectedDoc.fileName.split(".").pop()?.toLowerCase() || ""
                            const url = selectedDoc.fileUrl
                            const isExternalLink = (selectedDoc.type === "APP_RESULT" || selectedDoc.type === "GITHUB_REPO") && url?.startsWith("http")

                            if (isExternalLink && selectedDoc.type === "GITHUB_REPO") {
                              return (
                                <div className="flex flex-col items-center justify-center gap-4 text-center">
                                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                                    <ExternalLink className="h-8 w-8 text-muted-foreground/60" />
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-sm font-medium">GitHub 連結</p>
                                    <a
                                      href={url!}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-blue-600 hover:underline break-all"
                                    >
                                      {url}
                                    </a>
                                  </div>
                                  <Button variant="outline" size="sm" asChild>
                                    <a href={url!} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />前往 GitHub
                                    </a>
                                  </Button>
                                </div>
                              )
                            }

                            if (isExternalLink) {
                              return (
                                <div className="w-full h-full min-h-[520px] flex flex-col">
                                  <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                                    <p className="text-xs text-muted-foreground truncate flex-1">{url}</p>
                                    <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" asChild>
                                      <a href={url!} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-3 w-3 mr-1" />新分頁
                                      </a>
                                    </Button>
                                  </div>
                                  <iframe src={url!} className="flex-1 w-full border-0" title="APP 預覽" />
                                </div>
                              )
                            }

                            if (!url) {
                              return <p className="text-sm text-muted-foreground">此文件無預覽連結</p>
                            }

                            if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
                              return (
                                <div className="relative group cursor-zoom-in" onClick={() => setZoomedImg(url)}>
                                  <img src={url} alt={selectedDoc.fileName} className="max-w-full max-h-[480px] object-contain rounded" />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors rounded">
                                    <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow-lg" />
                                  </div>
                                </div>
                              )
                            }

                            if (ext === "pdf") {
                              return <iframe src={`${url}#toolbar=0&navpanes=0`} className="w-full h-full min-h-[520px] rounded border-0" title={selectedDoc.fileName} />
                            }

                            if (["mp4", "webm"].includes(ext)) {
                              return <video src={url} controls className="max-w-full max-h-[480px] rounded" />
                            }

                            if (["mp3", "wav", "ogg"].includes(ext)) {
                              return (
                                <div className="text-center space-y-4">
                                  <FileAudio className="h-16 w-16 mx-auto text-sky-400" />
                                  <p className="text-sm font-medium">{selectedDoc.fileName}</p>
                                  <audio src={url} controls className="mx-auto" />
                                </div>
                              )
                            }

                            if (["txt", "md"].includes(ext)) {
                              if (textLoading) {
                                return <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                              }
                              if (ext === "md") {
                                return (
                                  <div className="w-full max-h-[520px] overflow-auto p-6 prose prose-sm prose-neutral dark:prose-invert max-w-none prose-table:border-collapse prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-1.5 prose-th:bg-muted/50 prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-1.5">
                                    <ReactMarkdown
                                      remarkPlugins={[remarkGfm, remarkBreaks]}
                                      components={{
                                        pre({ children }) {
                                          // Only unwrap <pre> for mermaid blocks
                                          if (React.isValidElement(children)) {
                                            const cp = children.props as { className?: string }
                                            if (/language-mermaid/.test(cp.className || "")) {
                                              return <>{children}</>
                                            }
                                          }
                                          return <pre>{children}</pre>
                                        },
                                        code({ className, children, ...props }) {
                                          const match = /language-(\w+)/.exec(className || "")
                                          if (match?.[1] === "mermaid") {
                                            return <MermaidBlock code={String(children).trim()} />
                                          }
                                          return <code className={className} {...props}>{children}</code>
                                        },
                                      }}
                                    >
                                      {formatGherkinInMarkdown(textContent)}
                                    </ReactMarkdown>
                                  </div>
                                )
                              }
                              return (
                                <pre className="text-sm whitespace-pre-wrap break-words w-full max-h-[520px] overflow-auto p-4 bg-muted/30 rounded-lg font-mono leading-relaxed">
                                  {textContent}
                                </pre>
                              )
                            }

                            if (["xls", "xlsx"].includes(ext) && excelReady) {
                              return (
                                <div className="absolute inset-0">
                                  <ExcelPreview
                                    fileUrl={selectedDoc.fileUrl}
                                    fileName={selectedDoc.fileName}
                                  />
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
                                return <iframe src={`${officePreviewUrl}#toolbar=0&navpanes=0`} className="w-full h-full min-h-[520px] rounded border-0" title={selectedDoc.fileName} />
                              }
                              return (
                                <div className="text-center space-y-3">
                                  <FileText className="h-16 w-16 mx-auto text-muted-foreground/40" />
                                  <p className="text-sm font-medium">{selectedDoc.fileName}</p>
                                  <p className="text-xs text-muted-foreground">無法轉換預覽，請確認伺服器已安裝 LibreOffice</p>
                                </div>
                              )
                            }

                            return (
                              <div className="text-center space-y-3">
                                <FileText className="h-16 w-16 mx-auto text-muted-foreground/40" />
                                <p className="text-sm font-medium">{selectedDoc.fileName}</p>
                              </div>
                            )
                          })()}
                        </div>
                        {/* Watermark overlay */}
                        <div
                          className="absolute inset-0 pointer-events-none z-10"
                          style={{ backgroundImage: watermarkBg, backgroundRepeat: "repeat" }}
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center min-h-[520px] text-muted-foreground">
                        <Eye className="h-12 w-12 mb-3 opacity-20" />
                        <p className="text-sm">請選擇文件以預覽</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Document list */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">階段文件</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PhaseDocuments
                      documents={demand.documents}
                      currentPhase={demand.status}
                      demandId={demand.id}
                      canUpload={false}
                      canDownload={false}
                      token={token}
                      onRefresh={fetchDemand}
                      onDocumentSelect={setSelectedDoc}
                      selectedDocId={selectedDoc?.id}
                      userRole="subsidiary"
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Image zoom overlay */}
      {zoomedImg && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center cursor-zoom-out"
          onClick={() => setZoomedImg(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20 h-10 w-10"
            onClick={() => setZoomedImg(null)}
          >
            <X className="h-6 w-6" />
          </Button>
          <img
            src={zoomedImg}
            alt="放大預覽"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </AppLayout>
  )
}

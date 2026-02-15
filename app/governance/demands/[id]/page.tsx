"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft, Building2, User, Calendar, FileText,
  Loader2, Pencil, Trash2, Check, ChevronDown,
  BarChart3, GanttChart, FolderOpen,
  AlertCircle, CircleDot, Info, UserPlus,
} from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { STATUS_MAP, PIPELINE_STEPS, PHASE_DOCUMENT_MAP, PHASE_DESCRIPTIONS, PHASE_ACTIONS, DOCUMENT_TYPE_LABELS } from "@/lib/constants/demand"
import { Upload, Download, Eye, ExternalLink, FileAudio, X, ZoomIn } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { SpAllocationChart } from "@/components/demand/sp-allocation-chart"
import { ProjectGantt } from "@/components/demand/project-gantt"
import { PhaseDocuments } from "@/components/demand/phase-documents"
import { StepNavigation } from "@/components/demand/step-navigation"
import { PhasePlanInlineEditor } from "@/components/demand/phase-plan-inline-editor"
import { SubTaskEditor } from "@/components/demand/sub-task-editor"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import mermaid from "mermaid"
import { ExcelPreview } from "@/components/excel-preview"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

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
    isInternal: boolean
    createdAt: string
    user: { id: string; name: string }
  }[]
  statusHistory: {
    id: string
    fromStatus: string | null
    toStatus: string
    comment: string | null
    changedBy: string
    createdAt: string
  }[]
  phasePlans: {
    id: string
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
}

const ROLE_META: Record<string, { label: string; color: string }> = {
  delivery: { label: "交付團隊", color: "text-emerald-600" },
  admin: { label: "管理員", color: "text-amber-600" },
  subsidiary: { label: "需求單位", color: "text-blue-600" },
}
const ROLE_ORDER = ["delivery", "admin", "subsidiary"]

function groupUsersByRole(users: { id: string; name: string; role?: string }[]) {
  const groups: Record<string, { id: string; name: string }[]> = {}
  for (const u of users) {
    const role = u.role || "subsidiary"
    if (!groups[role]) groups[role] = []
    groups[role].push(u)
  }
  return ROLE_ORDER
    .filter((r) => groups[r]?.length)
    .map((r) => ({ role: r, label: ROLE_META[r]?.label || r, color: ROLE_META[r]?.color || "", users: groups[r] }))
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit",
  })
}

// Mermaid code block renderer
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
      // Fallback: use mermaid.run() which renders in the visible DOM
      // (needed for block-beta which requires getBBox on visible elements)
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
          // Check if rendering actually produced an SVG
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

export default function DemandDetailPage() {
  const { token, user } = useAuth()
  const params = useParams()
  const router = useRouter()
  const demandId = params.id as string

  const [demand, setDemand] = useState<DemandDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [staffUsers, setStaffUsers] = useState<{ id: string; name: string; role?: string }[]>([])
  const [activeTab, setActiveTab] = useState("overview")
  const [docPhaseKey, setDocPhaseKey] = useState(0)
  const [spPlanOpen, setSpPlanOpen] = useState<boolean | null>(null)
  const [subTasksOpen, setSubTasksOpen] = useState<boolean | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<DemandDetail["documents"][0] | null>(null)
  const [textContent, setTextContent] = useState("")
  const [textLoading, setTextLoading] = useState(false)
  const [excelReady, setExcelReady] = useState(false)
  const [officePreviewUrl, setOfficePreviewUrl] = useState<string | null>(null)
  const [officeLoading, setOfficeLoading] = useState(false)
  const [zoomedImg, setZoomedImg] = useState<string | null>(null)

  const canManage = user?.role === "admin" || user?.role === "delivery"

  // Periodically clean up stray mermaid error SVGs from the DOM
  useEffect(() => {
    const timer = setInterval(() => {
      document.querySelectorAll("svg[aria-roledescription='error']").forEach((el) => el.remove())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto-collapse SP plan if already has content
  useEffect(() => {
    if (spPlanOpen !== null || !demand) return
    const hasContent = demand.phasePlans.some(
      (p) => p.plannedSp || p.plannedStart || p.plannedEnd || p.engineer
    )
    setSpPlanOpen(!hasContent)
  }, [demand, spPlanOpen])

  // Auto-collapse sub-tasks if already have dates filled
  useEffect(() => {
    if (subTasksOpen !== null || !demand) return
    const hasContent = demand.subTasks.length > 0 && demand.subTasks.some(
      (t) => t.plannedStart || t.plannedEnd
    )
    setSubTasksOpen(!hasContent)
  }, [demand, subTasksOpen])

  const fetchDemand = useCallback(async () => {
    if (!token || !demandId) return
    try {
      const res = await fetch(`/api/demands/${demandId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) setDemand(data.demand)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [token, demandId])

  useEffect(() => {
    fetchDemand()
  }, [fetchDemand])

  // Fetch staff users for PM/Engineer assignment
  useEffect(() => {
    if (!token || !canManage) return
    fetch("/api/demands?_usersOnly=1", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.filters?.developers) setStaffUsers(data.filters.developers)
      })
      .catch(() => {})
  }, [token, canManage])

  // Fetch text content for preview
  useEffect(() => {
    if (!selectedDoc?.fileUrl) { setTextContent(""); return }
    const ext = selectedDoc.fileName.split(".").pop()?.toLowerCase() || ""
    if (!["txt", "md"].includes(ext)) return
    setTextLoading(true)
    fetch(selectedDoc.fileUrl)
      .then((res) => res.text())
      .then((t) => setTextContent(t))
      .catch(() => setTextContent("無法載入文件內容"))
      .finally(() => setTextLoading(false))
  }, [selectedDoc])

  // Track when Excel file is selected for preview
  useEffect(() => {
    if (!selectedDoc?.fileUrl) { setExcelReady(false); return }
    const ext = selectedDoc.fileName.split(".").pop()?.toLowerCase() || ""
    setExcelReady(["xls", "xlsx"].includes(ext))
  }, [selectedDoc])

  // Trigger LibreOffice server-side conversion for Office files
  useEffect(() => {
    if (!selectedDoc?.fileUrl) { setOfficePreviewUrl(null); return }
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
  }, [selectedDoc])

  // Watermark SVG background
  const watermarkBg = useMemo(() => {
    const name = user?.name || "使用者"
    const text = `${name}\u3000機密文件`
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150"><text transform="rotate(-30 150 75)" x="150" y="85" font-size="14" fill="rgba(0,0,0,0.07)" text-anchor="middle" font-family="sans-serif">${text}</text></svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  }, [user?.name])

  const handleAssign = async (field: "managerId" | "developerId", userId: string) => {
    if (!token || !demand) return
    try {
      const res = await fetch(`/api/demands/${demand.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: userId || null }),
      })
      if (res.ok) fetchDemand()
    } catch { /* ignore */ }
  }

  const handleDelete = async () => {
    if (!token) return
    try {
      const res = await fetch(`/api/demands/${demandId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) router.push("/governance/inbox")
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  if (!demand) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-32">
          <p className="text-muted-foreground mb-4">需求不存在或已被刪除</p>
          <Button variant="outline" asChild>
            <Link href="/governance/inbox"><ArrowLeft className="mr-2 h-4 w-4" />返回列表</Link>
          </Button>
        </div>
      </AppLayout>
    )
  }

  const statusInfo = STATUS_MAP[demand.status] || { label: demand.status, color: "bg-gray-100 text-gray-700" }
  const currentStepIndex = PIPELINE_STEPS.indexOf(demand.status as typeof PIPELINE_STEPS[number])
  const isRejected = demand.status === "REJECTED"
  const isClosed = demand.status === "CLOSED"
  // When CLOSED, only admin retains modification rights
  const effectiveCanManage = canManage && (!isClosed || user?.role === "admin")
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <Link href="/governance/inbox"><ArrowLeft className="h-4 w-4" /></Link>
              </Button>
              <span className="text-sm font-mono text-muted-foreground">{demand.demandNumber}</span>
              <Badge variant="secondary" className={cn("text-xs px-2 py-0.5", statusInfo.color)}>
                {statusInfo.label}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground ml-11">{demand.title}</h1>
          </div>
          {user?.role === "admin" && !isClosed && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/governance/demands/${demand.id}/edit`}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  編輯
                </Link>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    刪除
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>確定要刪除此需求？</AlertDialogTitle>
                    <AlertDialogDescription>
                      將永久刪除需求「{demand.title}」（{demand.demandNumber}）及其所有相關資料，包含文件、子任務、狀態紀錄等。此操作無法復原。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      確定刪除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        {/* Status Pipeline */}
        <Card>
          <CardContent className="py-4">
            <TooltipProvider delayDuration={200}>
              <div className="flex items-center">
                {PIPELINE_STEPS.map((step, i) => {
                  const info = STATUS_MAP[step]
                  const isPast = !isRejected && currentStepIndex >= 0 && i < currentStepIndex
                  const isCurrent = !isRejected && i === currentStepIndex
                  const isFuture = isRejected || currentStepIndex < 0 || i > currentStepIndex

                  // Phase completion info
                  const phaseConfig = PHASE_DOCUMENT_MAP[step]
                  const requiredDocs = phaseConfig?.required || []
                  const missingDocs = requiredDocs.filter(
                    (type) => !demand.documents.some((d) => d.phase === step && d.type === type)
                  )
                  const hasAssignment = step === "PRD_REVIEW" || step === "SP_REVIEW" || step === "DEVELOPING" || step === "ACCEPTANCE"
                  const needsAssignment = hasAssignment && !demand.manager && !demand.developer
                  const showWarning = (isPast || isCurrent) && (missingDocs.length > 0 || (isCurrent && needsAssignment))
                  const isComplete = (isPast || isCurrent) && missingDocs.length === 0 && requiredDocs.length > 0

                  return (
                    <div key={step} className="flex items-center flex-1 last:flex-none">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col items-center gap-2 cursor-default">
                            <div className="relative">
                              <div className={cn(
                                "h-9 w-9 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors",
                                isCurrent && "border-primary bg-primary text-primary-foreground",
                                isPast && "border-primary bg-primary/10 text-primary",
                                isFuture && "border-muted-foreground/30 bg-background text-muted-foreground/50",
                              )}>
                                {isPast ? <Check className="h-4 w-4" /> : i + 1}
                              </div>
                              {showWarning && (
                                <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-500 flex items-center justify-center">
                                  <AlertCircle className="h-3 w-3 text-white" />
                                </div>
                              )}
                            </div>
                            <span className={cn(
                              "text-sm whitespace-nowrap",
                              isCurrent && "font-semibold text-foreground",
                              isPast && "text-primary",
                              isFuture && "text-muted-foreground/50",
                            )}>
                              {info.label}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs p-3">
                          <p className="font-medium text-xs mb-1">{info.label}</p>
                          <p className="text-xs text-muted-foreground mb-2">{PHASE_DESCRIPTIONS[step]}</p>
                          {requiredDocs.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium">必要文件：</p>
                              {requiredDocs.map((type) => {
                                const uploaded = demand.documents.some((d) => d.phase === step && d.type === type)
                                return (
                                  <div key={type} className="flex items-center gap-1.5 text-xs">
                                    {uploaded
                                      ? <Check className="h-3 w-3 text-emerald-500" />
                                      : <CircleDot className="h-3 w-3 text-amber-500" />
                                    }
                                    <span className={uploaded ? "text-emerald-600" : "text-amber-600"}>
                                      {DOCUMENT_TYPE_LABELS[type] || type}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </TooltipContent>
                      </Tooltip>
                      {i < PIPELINE_STEPS.length - 1 && (
                        <div className={cn(
                          "flex-1 h-px mx-2 mt-[-1.5rem]",
                          isPast ? "bg-primary" : "bg-muted-foreground/20",
                        )} />
                      )}
                    </div>
                  )
                })}
              </div>
            </TooltipProvider>

            {/* Current phase status banner */}
            {!isRejected && (() => {
              const currentPhase = demand.status
              const phaseConfig = PHASE_DOCUMENT_MAP[currentPhase]
              const requiredDocs = phaseConfig?.required || []
              const missingDocs = requiredDocs.filter(
                (type) => !demand.documents.some((d) => d.phase === currentPhase && d.type === type)
              )
              const actions = PHASE_ACTIONS[currentPhase] || []
              const needsAssignment = (currentPhase === "PRD_REVIEW" || currentPhase === "SP_REVIEW" || currentPhase === "DEVELOPING") && !demand.manager && !demand.developer

              if (missingDocs.length === 0 && !needsAssignment && actions.length === 0) return null

              return (
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <p className="text-xs font-medium text-blue-700">
                        {PHASE_DESCRIPTIONS[currentPhase]}
                      </p>
                      {(missingDocs.length > 0 || needsAssignment) && (
                        <div className="flex flex-wrap gap-2">
                          {needsAssignment && (
                            <Badge variant="outline" className="text-[11px] bg-amber-50 text-amber-700 border-amber-200 cursor-pointer hover:bg-amber-100" onClick={() => setActiveTab("overview")}>
                              <UserPlus className="h-3 w-3 mr-1" />
                              待指派 PM / 工程師
                            </Badge>
                          )}
                          {missingDocs.map((type) => (
                            <Badge key={type} variant="outline" className="text-[11px] bg-amber-50 text-amber-700 border-amber-200 cursor-pointer hover:bg-amber-100" onClick={() => setActiveTab("documents")}>
                              <AlertCircle className="h-3 w-3 mr-1" />
                              缺 {DOCUMENT_TYPE_LABELS[type] || type}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}

            {isRejected && (
              <div className="mt-3 text-center">
                <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">已駁回</Badge>
                {demand.rejectReason && (
                  <p className="text-xs text-muted-foreground mt-1">原因：{demand.rejectReason}</p>
                )}
              </div>
            )}
            {/* Step Navigation */}
            {canManage && !isRejected && (
              <StepNavigation
                currentStatus={demand.status}
                demandId={demand.id}
                documents={demand.documents}
                token={token}
                completedDate={demand.completedDate}
                onStatusChange={() => { setActiveTab("overview"); setDocPhaseKey((k) => k + 1); fetchDemand() }}
              />
            )}
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start h-10 p-1 bg-muted/60">
            <TabsTrigger value="overview" className="flex-1 gap-1.5 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <BarChart3 className="h-3.5 w-3.5" />
              概覽
            </TabsTrigger>
            <TabsTrigger value="gantt" className="flex-1 gap-1.5 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <GanttChart className="h-3.5 w-3.5" />
              甘特圖
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex-1 gap-1.5 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <FolderOpen className="h-3.5 w-3.5" />
              文件
              {demand.documents.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 min-w-4 px-1 rounded-full ml-0.5">
                  {demand.documents.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* 概覽 Tab */}
          <TabsContent value="overview" className="mt-4">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Left column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Phase-specific action cards */}
                {user?.role === "admin" && demand.status === "SP_REVIEW" && (
                  <Collapsible open={spPlanOpen ?? false} onOpenChange={setSpPlanOpen}>
                    <Card className="border-orange-200">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-orange-600" />
                            SP 與時程規劃
                          </CardTitle>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <ChevronDown className={cn("h-4 w-4 transition-transform", spPlanOpen && "rotate-180")} />
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                        <p className="text-xs text-muted-foreground">填寫各階段 SP 點數與計畫開始/結束時間</p>
                      </CardHeader>
                      <CollapsibleContent>
                        <CardContent>
                          <PhasePlanInlineEditor
                            phasePlans={demand.phasePlans}
                            totalSp={demand.estimatedSp}
                            demandId={demand.id}
                            token={token}
                            staffUsers={staffUsers}
                            onSaved={() => { setSpPlanOpen(false); fetchDemand() }}
                          />
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                )}

                {user?.role === "admin" && demand.status === "PRD_REVIEW" && (!demand.manager || !demand.developer) && (
                  <Card className="border-amber-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-amber-600" />
                        指派團隊成員
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">請在右側基本資訊區塊指派 PM 與工程師</p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <div className={cn("h-2 w-2 rounded-full", demand.manager ? "bg-emerald-500" : "bg-amber-400")} />
                          <span>PM：</span>
                          <span className={demand.manager ? "font-medium" : "text-muted-foreground"}>
                            {demand.manager?.name || "尚未指派"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <div className={cn("h-2 w-2 rounded-full", demand.developer ? "bg-emerald-500" : "bg-amber-400")} />
                          <span>工程師：</span>
                          <span className={demand.developer ? "font-medium" : "text-muted-foreground"}>
                            {demand.developer?.name || "尚未指派"}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {user?.role === "admin" && demand.status === "DEVELOPING" && (() => {
                  const devPlan = demand.phasePlans.find((p) => p.phase === "DEVELOPING")
                  return (
                    <Collapsible open={subTasksOpen ?? false} onOpenChange={setSubTasksOpen}>
                      <Card className="border-violet-200">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              <GanttChart className="h-4 w-4 text-violet-600" />
                              開發任務管理
                            </CardTitle>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <ChevronDown className={cn("h-4 w-4 transition-transform", subTasksOpen && "rotate-180")} />
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                          <p className="text-xs text-muted-foreground">設定子任務時程與負責人，日期須在開發階段範圍內</p>
                        </CardHeader>
                        <CollapsibleContent>
                          <CardContent>
                            <SubTaskEditor
                              subTasks={demand.subTasks}
                              demandId={demand.id}
                              token={token}
                              devStart={devPlan?.plannedStart ?? null}
                              devEnd={devPlan?.plannedEnd ?? null}
                              devEngineer={devPlan?.engineer ?? null}
                              onRefresh={fetchDemand}
                              onViewGantt={() => setActiveTab("gantt")}
                              onDatesSaved={() => setSubTasksOpen(false)}
                            />
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  )
                })()}


                {/* 需求說明 (always shown) */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      需求說明
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0">
                    <div className="pb-4 prose prose-sm prose-neutral dark:prose-invert max-w-none prose-table:border-collapse prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-1.5 prose-th:bg-muted/50 prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-1.5">
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
                    {demand.painPoint && (
                      <>
                        <hr className="border-border/60" />
                        <div className="py-4">
                          <p className="text-xs font-semibold text-orange-600 mb-1.5">痛點說明</p>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{demand.painPoint}</p>
                        </div>
                      </>
                    )}
                    {demand.expectedBenefit && (
                      <>
                        <hr className="border-border/60" />
                        <div className="py-4">
                          <p className="text-xs font-semibold text-emerald-600 mb-1.5">預期效益</p>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{demand.expectedBenefit}</p>
                        </div>
                      </>
                    )}
                    {demand.adminNotes && (
                      <>
                        <hr className="border-border/60" />
                        <div className="pt-4">
                          <p className="text-xs font-semibold text-muted-foreground mb-1.5">管理者備註</p>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{demand.adminNotes}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right column */}
              <div className="space-y-6">
                {/* 基本資訊 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">基本資訊</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground w-16 shrink-0">子公司</span>
                      <span className="font-medium">{demand.organization.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground w-16 shrink-0">PM</span>
                      {user?.role === "admin" && !isClosed && staffUsers.length > 0 ? (
                        <Select
                          value={demand.manager?.id || "none"}
                          onValueChange={(v) => handleAssign("managerId", v === "none" ? "" : v)}
                        >
                          <SelectTrigger className="h-7 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">尚未指派</SelectItem>
                            {groupUsersByRole(staffUsers).map((g) => (
                              <SelectGroup key={g.role}>
                                <SelectLabel className={cn("text-xs font-semibold", g.color)}>{g.label}</SelectLabel>
                                {g.users.map((u) => (
                                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={cn("font-medium", !demand.manager && "text-muted-foreground")}>
                          {demand.manager?.name || "尚未指派"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground w-16 shrink-0">工程師</span>
                      {user?.role === "admin" && !isClosed && staffUsers.length > 0 ? (
                        <Select
                          value={demand.developer?.id || "none"}
                          onValueChange={(v) => handleAssign("developerId", v === "none" ? "" : v)}
                        >
                          <SelectTrigger className="h-7 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">尚未指派</SelectItem>
                            {groupUsersByRole(staffUsers).map((g) => (
                              <SelectGroup key={g.role}>
                                <SelectLabel className={cn("text-xs font-semibold", g.color)}>{g.label}</SelectLabel>
                                {g.users.map((u) => (
                                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={cn("font-medium", !demand.developer && "text-muted-foreground")}>
                          {demand.developer?.name || "尚未指派"}
                        </span>
                      )}
                    </div>
                    <hr className="border-border/60" />
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground w-16 shrink-0">估計 SP</span>
                      <span className="font-medium">{demand.estimatedSp} SP</span>
                    </div>
                    {demand.confirmedSp !== null && (
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground w-16 shrink-0">確認 SP</span>
                        <span className="font-medium">{demand.confirmedSp} SP</span>
                      </div>
                    )}
                    <hr className="border-border/60" />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-1.5 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground shrink-0">開案時間</span>
                        <span className="font-medium">{formatDate(demand.phasePlans.find(p => p.phase === "SUBMITTED")?.plannedStart ?? demand.createdAt)}</span>
                      </div>
                      {demand.desiredDate && (
                        <div className="flex items-center gap-1.5 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground shrink-0">希望完成</span>
                          <span className="font-medium">{formatDate(demand.desiredDate)}</span>
                        </div>
                      )}
                    </div>
                    {demand.status === "CLOSED" && user?.role === "admin" && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground shrink-0">實際結案日期</span>
                        </div>
                        <input
                          type="date"
                          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                          value={demand.completedDate ? new Date(demand.completedDate).toISOString().slice(0, 10) : ""}
                          onChange={async (e) => {
                            const val = e.target.value
                            if (!token) return
                            const res = await fetch(`/api/demands/${demand.id}`, {
                              method: "PATCH",
                              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                              body: JSON.stringify({ completedDate: val || null }),
                            })
                            if (res.ok) {
                              setDemand((prev) => prev ? { ...prev, completedDate: val || null } : prev)
                            }
                          }}
                        />
                        <p className="text-[11px] text-muted-foreground">此日期用於交付率計算</p>
                      </div>
                    )}
                    {demand.status === "CLOSED" && user?.role !== "admin" && demand.completedDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground shrink-0">實際結案</span>
                        <span className="font-medium">{formatDate(demand.completedDate)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* SP 分配 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">SP 分配</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SpAllocationChart
                      phasePlans={demand.phasePlans}
                      totalSp={demand.estimatedSp}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* 甘特圖 Tab */}
          <TabsContent value="gantt" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <GanttChart className="h-4 w-4" />
                  甘特圖
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProjectGantt
                  phasePlans={demand.phasePlans}
                  currentStatus={demand.status}
                  subTasks={demand.subTasks}
                  demandId={demand.id}
                  canEdit={canManage && !isClosed}
                  token={token}
                  onRefresh={fetchDemand}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* 文件 Tab */}
          <TabsContent value="documents" className="mt-4">
            <div className="grid gap-6 lg:grid-cols-5">
              {/* Preview pane */}
              <div className="lg:col-span-3">
                <Card className="h-full">
                  <CardContent className="p-0 h-full">
                    {selectedDoc ? (
                      <div className="relative min-h-[520px] h-full">
                        <div className="h-full min-h-[520px] flex items-center justify-center p-4 overflow-hidden">
                          {(() => {
                            const ext = selectedDoc.fileName.split(".").pop()?.toLowerCase() || ""
                            const url = selectedDoc.fileUrl
                            const isExternal = selectedDoc.type === "APP_RESULT" && url?.startsWith("http")

                            if (isExternal) {
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
                                  <Button variant="outline" size="sm" asChild>
                                    <a href={url} download><Download className="h-3.5 w-3.5 mr-1.5" />下載檔案</a>
                                  </Button>
                                </div>
                              )
                            }

                            return (
                              <div className="text-center space-y-3">
                                <FileText className="h-16 w-16 mx-auto text-muted-foreground/40" />
                                <p className="text-sm font-medium">{selectedDoc.fileName}</p>
                                <Button variant="outline" size="sm" asChild>
                                  <a href={url} download>
                                    <Download className="h-3.5 w-3.5 mr-1.5" />下載檔案
                                  </a>
                                </Button>
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
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">階段文件</CardTitle>
                      {effectiveCanManage && (
                        <Button variant="outline" size="sm" id="doc-upload-trigger">
                          <Upload className="h-4 w-4 mr-1.5" />
                          上傳文件
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <PhaseDocuments
                      key={`${demand.status}-${docPhaseKey}`}
                      documents={demand.documents}
                      currentPhase={demand.status}
                      demandId={demand.id}
                      canUpload={effectiveCanManage}
                      token={token}
                      onRefresh={fetchDemand}
                      uploadTriggerSelector="#doc-upload-trigger"
                      onDocumentSelect={setSelectedDoc}
                      selectedDocId={selectedDoc?.id}
                      userId={user?.id}
                      userRole={user?.role}
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
          {/* Watermark on zoomed image */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundImage: watermarkBg, backgroundRepeat: "repeat" }}
          />
        </div>
      )}
    </AppLayout>
  )
}

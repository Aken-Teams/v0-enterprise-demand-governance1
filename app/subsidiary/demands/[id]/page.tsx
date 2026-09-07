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
  Package,
  Maximize2,
  Link2,
  Check,
  Share2,
  Trash2,
  Copy,
  XCircle,
  FileEdit,
} from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { cn, copyText } from "@/lib/utils"
import { toast } from "sonner"
import { STATUS_MAP, PIPELINE_STEPS, SIGNOFF_REQUIRED_PHASES, demandStatusKey } from "@/lib/constants/demand"
import { PhaseDocuments } from "@/components/demand/phase-documents"
import { PrototypePanel, PrototypeInlinePreview, PrototypePreviewModal, type Prototype } from "@/components/demand/prototype-panel"
import { PhaseSignoffBanner } from "@/components/demand/phase-signoff-banner"
import { DesignChangeTab } from "@/components/demand/design-change-tab"
import { SignoffHistory } from "@/components/demand/signoff-history"
import { ProjectGantt } from "@/components/demand/project-gantt"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { FullScreenDocumentPreview } from "@/components/demand/full-screen-document-preview"
import { ExcelPreview } from "@/components/excel-preview"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import rehypeRaw from "rehype-raw"
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
  holdReason: string | null
  adminNotes: string | null
  contactPersonId: string | null
  contactPerson: { id: string; name: string } | null
  demandManagerId: string | null
  demandManager: { id: string; name: string } | null
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
    kind?: string
    status: string
    targetUserId: string | null
    targetUser: { id: string; name: string } | null
    targetRole: string | null
    comment: string | null
    requestComment: string | null
    requestedAt: string
    respondedAt: string | null
    requestedBy: { id: string; name: string }
    respondedBy: { id: string; name: string } | null
    documents?: { id: string; fileName: string; fileUrl: string | null; fileSize: number | null }[]
  }[]
}

type ShareLink = {
  id: string
  token: string
  expiresAt: string
  createdAt: string
  createdBy: { name: string }
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
  const [mySignoffRole, setMySignoffRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Document preview states
  const [selectedDoc, setSelectedDoc] = useState<DemandDetail["documents"][0] | null>(null)
  const [docActivePhase, setDocActivePhase] = useState<string | null>(null)
  const [protoPreview, setProtoPreview] = useState<{ proto: Prototype; screenId: string } | null>(null)
  const [protoMax, setProtoMax] = useState(false)
  const [textContent, setTextContent] = useState("")
  const [textLoading, setTextLoading] = useState(false)
  const [excelReady, setExcelReady] = useState(false)
  const [officePreviewUrl, setOfficePreviewUrl] = useState<string | null>(null)
  const [officeLoading, setOfficeLoading] = useState(false)
  const [zoomedImg, setZoomedImg] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("overview")
  const [fullScreenDoc, setFullScreenDoc] = useState<DemandDetail["documents"][0] | null>(null)
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([])
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState<string | null>(null)
  const [docLinkCopied, setDocLinkCopied] = useState(false)
  const [docLinkBusy, setDocLinkBusy] = useState(false)
  // Tracks if user just approved a DESIGN_CHANGE in this session — used to
  // suppress the PHASE banner so they don't see a second "approve" prompt
  // immediately after. Resets naturally on any new page load.
  const [justApprovedDc, setJustApprovedDc] = useState(false)

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
      setMySignoffRole(data.mySignoffRole ?? null)
    } catch {
      setError("網路錯誤，無法載入需求資料")
    } finally {
      setLoading(false)
    }
  }, [token, id])

  useEffect(() => {
    fetchDemand()
  }, [fetchDemand])

  // Fetch share links for document sharing
  const fetchShareLinks = useCallback(async () => {
    if (!token || !id) return [] as ShareLink[]
    setShareLoading(true)
    try {
      const res = await fetch(`/api/demands/${id}/share`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        const list: ShareLink[] = data.shares ?? []
        setShareLinks(list)
        return list
      }
    } catch { /* ignore */ }
    finally { setShareLoading(false) }
    return [] as ShareLink[]
  }, [token, id])

  useEffect(() => {
    fetchShareLinks()
  }, [fetchShareLinks])

  const createShareLink = async () => {
    if (!token) return
    setShareLoading(true)
    try {
      const res = await fetch(`/api/demands/${id}/share`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) fetchShareLinks()
    } catch { /* ignore */ }
    finally { setShareLoading(false) }
  }

  const deleteShareLink = async (shareId: string) => {
    if (!token) return
    try {
      await fetch(`/api/demands/${id}/share`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ shareId }),
      })
      fetchShareLinks()
    } catch { /* ignore */ }
  }

  /**
   * 複製「單一文件」的分享連結。客戶自己就能分享：
   * 沒有有效連結時直接建一條再複製，不要只彈對話框讓人再點一次。
   */
  const copyDocShareLink = async (docId: string) => {
    if (!token || docLinkBusy) return
    setDocLinkBusy(true)
    try {
      const isActive = (s: ShareLink) => new Date(s.expiresAt) > new Date()
      let active = shareLinks.find(isActive) ?? (await fetchShareLinks()).find(isActive)

      if (!active) {
        const res = await fetch(`/api/demands/${id}/share`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          toast.error(err.error || "無法建立分享連結")
          return
        }
        active = await res.json()
        fetchShareLinks()
      }

      const url = `${window.location.origin}/share/${active!.token}?doc=${docId}`
      if (await copyText(url)) {
        setDocLinkCopied(true)
        setTimeout(() => setDocLinkCopied(false), 2000)
        toast.success("已複製文件分享連結")
      } else {
        toast.message("請手動複製連結", { description: url, duration: 15000 })
      }
    } catch {
      toast.error("複製分享連結失敗")
    } finally {
      setDocLinkBusy(false)
    }
  }

  const copyShareUrl = (shareToken: string) => {
    const url = `${window.location.origin}/share/${shareToken}`
    navigator.clipboard.writeText(url)
    setShareCopied(shareToken)
    setTimeout(() => setShareCopied(null), 2000)
  }

  // Check if selected document is confidential
  const isConfidential = selectedDoc ? CONFIDENTIAL_DOC_TYPES.has(selectedDoc.type) : false
  const selectedDocExt = selectedDoc?.fileName.split(".").pop()?.toLowerCase() || ""
  const isPreviewEmpty = !!selectedDoc && ["txt", "md"].includes(selectedDocExt) && !textLoading && !textContent

  // Fetch text content for txt/md files
  useEffect(() => {
    setTextContent("")
    if (!selectedDoc?.fileUrl || isConfidential) return
    const ext = selectedDoc.fileName.split(".").pop()?.toLowerCase() || ""
    if (!["txt", "md"].includes(ext)) return
    setTextLoading(true)
    fetch(selectedDoc.fileUrl)
      .then((r) => {
        if (!r.ok) { setTextContent(""); setTextLoading(false); return }
        return r.text()
      })
      .then((t) => { if (t !== undefined) setTextContent(t) })
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

  const statusInfo = STATUS_MAP[demandStatusKey(demand.status, (demand as unknown as { isTerminated?: boolean }).isTerminated, (demand as unknown as { hasPendingClosingSp?: boolean }).hasPendingClosingSp)] || { label: demand.status, color: "bg-gray-100 text-gray-700" }
  const sp = demand.confirmedSp ?? demand.estimatedSp
  const isRejected = demand.status === "REJECTED"
  const isCancelled = demand.status === "CANCELLED"
  const isClosed = demand.status === "CLOSED"
  const currentStepIdx = PIPELINE_STEPS.indexOf(demand.status as typeof PIPELINE_STEPS[number])
  const phasePlanMap = Object.fromEntries(demand.phasePlans.map((p) => [p.phase, p]))

  // Pending sign-off(s) for current phase — find the one targeting current user
  // Org accounts are read-only and can never sign
  const isOrgAccount = user?.isOrgAccount
  const isBoardMember = user?.isBoardMember
  const myPendingSignoffs = !isOrgAccount
    ? (demand.phaseSignoffs?.filter((s) => {
        if (s.status !== "PENDING" || s.targetUserId !== user?.id) return false
        if (s.targetRole === "BOARD_OVERRIDE") return !!isBoardMember
        if (!isBoardMember) {
          const hasOverride = demand.phaseSignoffs?.some(
            (o) =>
              o.status === "PENDING" &&
              o.targetRole === "BOARD_OVERRIDE" &&
              o.phase === s.phase &&
              (o.kind ?? "PHASE") === (s.kind ?? "PHASE"),
          )
          if (hasOverride) return false
        }
        return true
      }) || [])
    : []
  // Prefer DESIGN_CHANGE signoff over PHASE when both exist for the same user.
  // After the user approves a DC in this session (justApprovedDc), suppress
  // the PHASE banner so they aren't prompted for a second approval right
  // after — the PHASE banner will reappear naturally on next page load.
  const pendingDcSignoff = myPendingSignoffs.find((s) => (s.kind ?? "PHASE") === "DESIGN_CHANGE")
  const pendingPhaseSignoff = myPendingSignoffs.find((s) => (s.kind ?? "PHASE") === "PHASE")
  const pendingSignoff =
    pendingDcSignoff ||
    (justApprovedDc ? null : pendingPhaseSignoff) ||
    null
  const pendingSignoffKind: "PHASE" | "DESIGN_CHANGE" =
    (pendingSignoff?.kind ?? "PHASE") === "DESIGN_CHANGE" ? "DESIGN_CHANGE" : "PHASE"
  // Any pending DC for the current phase (used for "- 設計變更" labeling)
  const dcHasPending = (demand.phaseSignoffs || []).some(
    (s) => s.status === "PENDING" && s.phase === demand.status && (s.kind ?? "PHASE") === "DESIGN_CHANGE",
  )

  // Project start date
  const projectStartDate = demand.phasePlans.reduce<string | null>((earliest, p) => {
    const d = p.plannedStart || p.actualStart
    if (!d) return earliest
    if (!earliest) return d
    return new Date(d) < new Date(earliest) ? d : earliest
  }, null)

  // Pie chart data
  const isOverride = demand.confirmedSp != null && demand.confirmedSp !== demand.estimatedSp
    && demand.phaseSignoffs?.some((s: any) => s.targetRole === "BOARD_OVERRIDE" && s.status === "APPROVED")
  const isAdjustment = demand.confirmedSp != null && demand.confirmedSp !== demand.estimatedSp && !isOverride
  const isTerminated = demand.status === "CLOSED" && (demand as unknown as { isTerminated?: boolean }).isTerminated
  // 終止當下所在的階段（代簽結案前的 fromStatus）→ 用於階段進度只標到實際到達的階段
  const terminatedFromStatus = isTerminated
    ? (demand.statusHistory?.find((h: any) => h.toStatus === "CLOSED" && h.comment?.includes("SP_ADJUSTMENT"))?.fromStatus ?? null)
    : null
  const terminatedAtIdx = terminatedFromStatus ? PIPELINE_STEPS.indexOf(terminatedFromStatus as typeof PIPELINE_STEPS[number]) : -1
  const ratio = isOverride && demand.estimatedSp && demand.confirmedSp != null ? demand.confirmedSp / demand.estimatedSp : 1

  const hasOriginalData = isAdjustment && demand.phasePlans.some((p: any) => p.originalPlannedSp != null)

  const settlementReason = (() => {
    if (!isOverride && !isAdjustment) return null
    const h = demand.statusHistory?.find(
      (h: any) => h.toStatus === "CLOSED" && h.comment?.includes("SP_ADJUSTMENT")
    )
    if (!h?.comment) return null
    try { return JSON.parse(h.comment).reason || null } catch { return null }
  })()

  const spPieData = demand.phasePlans
    .map((p: any) => {
      const currentSp = p.plannedSp || 0
      const displaySp = isOverride ? Math.round(currentSp * ratio * 10) / 10 : currentSp
      const originalSp = isOverride ? currentSp
        : (isAdjustment && p.originalPlannedSp != null) ? p.originalPlannedSp
        : currentSp
      return { name: STATUS_MAP[p.phase]?.label || p.phase, value: displaySp, originalSp, phase: p.phase }
    })
    .filter((p) => p.value > 0 || p.originalSp > 0)

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

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <p className="text-xs font-mono text-muted-foreground">{demand.demandNumber}</p>
                <Badge className={cn("text-[10px] sm:text-xs whitespace-nowrap shrink-0", statusInfo.color)}>
                  {statusInfo.label}
                  {dcHasPending && <span className="ml-1">- 設計變更</span>}
                </Badge>
                <Dialog open={shareDialogOpen} onOpenChange={(open) => { setShareDialogOpen(open); if (open) fetchShareLinks() }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] sm:text-xs gap-1">
                      <Share2 className="h-3 w-3" />
                      分享
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md p-4 sm:p-6">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <Link2 className="h-4 w-4 sm:h-5 sm:w-5" />
                        分享連結管理
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                      {shareLoading && shareLinks.length === 0 ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : (() => {
                        const hasActive = shareLinks.some((s) => new Date(s.expiresAt) > new Date())
                        return (
                        <>
                          {shareLinks.length > 0 ? (
                            <div className="space-y-2">
                              {shareLinks.map((s) => {
                                const expired = new Date(s.expiresAt) <= new Date()
                                return (
                                <div key={s.id} className={cn("rounded-lg border p-3 space-y-2", expired && "opacity-60 bg-muted/30")}>
                                  <div className="flex items-center gap-2">
                                    <p className={cn("text-sm font-mono break-all flex-1", expired ? "text-muted-foreground line-through" : "text-foreground")}>
                                      {typeof window !== "undefined" ? `${window.location.origin}/share/${s.token}` : `/share/${s.token}`}
                                    </p>
                                    {expired && (
                                      <Badge variant="outline" className="text-[10px] text-red-500 border-red-200 shrink-0">已失效</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs text-muted-foreground">
                                      {expired ? "已於" : "有效至"} {new Date(s.expiresAt).toLocaleDateString("zh-TW")} {expired ? "過期" : ""} · {s.createdBy.name} 建立
                                    </p>
                                    <div className="flex items-center gap-1">
                                      {!expired && (
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyShareUrl(s.token)}>
                                          {shareCopied === s.token ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                        </Button>
                                      )}
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteShareLink(s.id)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                                )
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-2">目前沒有分享連結</p>
                          )}
                          <Button onClick={createShareLink} disabled={shareLoading || hasActive} className="w-full">
                            {shareLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Share2 className="h-4 w-4 mr-2" />}
                            產生新的分享連結（7 天有效）
                          </Button>
                          <p className="text-[11px] text-muted-foreground text-center">
                            {hasActive ? "已有有效連結，到期後才可產生新連結" : "唯讀分享，登入後可簽核"}
                          </p>
                        </>
                        )
                      })()}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight leading-snug break-words">{demand.title}</h1>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                {demand.confirmedSp != null && demand.confirmedSp !== demand.estimatedSp ? (
                  <>
                    <span className="text-sm text-muted-foreground line-through mr-1">{demand.estimatedSp}</span>
                    <span className="text-xl sm:text-2xl font-bold text-primary">{sp}</span>
                    <span className="text-xs text-muted-foreground ml-1">SP</span>
                  </>
                ) : (
                  <>
                    <span className="text-xl sm:text-2xl font-bold text-primary">{sp}</span>
                    <span className="text-xs text-muted-foreground ml-1">SP</span>
                  </>
                )}
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

        {/* ── Sign-off Banner (show if a pending signoff targets the current user) ── */}
        {pendingSignoff && (
          <PhaseSignoffBanner
            signoff={pendingSignoff}
            kind={pendingSignoffKind}
            demandId={demand.id}
            token={token}
            blocked={pendingSignoffKind !== "DESIGN_CHANGE" && ((demand as unknown as { designChanges?: { status: string }[] }).designChanges ?? []).some((dc) => dc.status === "PENDING" || dc.status === "REJECTED")}
            blockedMessage={((demand as unknown as { designChanges?: { status: string }[] }).designChanges ?? []).some((dc) => dc.status === "PENDING") ? "有待確認的設計變更，需通過後才能進行此階段確認。" : "設計變更已駁回，等待開發端修訂後重新送出，目前無法進行此階段確認。"}
            onGoToDesignChange={((demand as unknown as { designChanges?: { status: string }[] }).designChanges ?? []).some((dc) => dc.status === "PENDING") ? () => setActiveTab("design-changes") : undefined}
            onComplete={() => {
              if (pendingSignoffKind === "DESIGN_CHANGE") setJustApprovedDc(true)
              fetchDemand()
            }}
          />
        )}

        {/* ── 設計變更待審引導（例如董事會審 SP，或需求方逐條確認） ── */}
        {(() => {
          const r = (demand as unknown as { myDesignChangeReview?: { seq: number; title: string; role: string; stage?: string; affectsSp: boolean } | null }).myDesignChangeReview
          if (!r) return null
          const roleLabel = r.role === "BOARD" ? "董事會" : r.role === "MANAGER" ? "需求主管" : "需求窗口"
          // 兩階段流程：寫明目前是第幾關，避免誤以為重複簽核
          const isContent = r.stage === "CONTENT"
          return (
            <div className="rounded-lg border-2 border-indigo-300 bg-indigo-50/80 p-3 sm:p-4">
              <div className="flex items-start gap-2.5 sm:gap-3">
                <FileEdit className="h-5 w-5 shrink-0 text-indigo-600 mt-px sm:mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[15px] sm:text-sm text-indigo-900">
                    {isContent ? "設計變更已開立，請逐項確認內容" : "您有一筆設計變更待您確認"}
                  </p>
                  <p className="text-xs text-indigo-700/80 mt-1">
                    DC-{String(r.seq).padStart(2, "0")}「{r.title}」
                    {isContent
                      ? "已通過第一關的設計變更確認，現在進入第二關：請以「" + roleLabel + "」身分逐項確認變更內容。"
                      : "，需您以「" + roleLabel + "」身分裁決是否同意開立此變更。"}
                  </p>
                </div>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 h-9" onClick={() => setActiveTab("design-changes")}>
                  <FileEdit className="h-3.5 w-3.5 mr-1" />前往審核
                </Button>
              </div>
            </div>
          )
        })()}

        {/* ── Approved info banner: user already signed, waiting for admin ── */}
        {!pendingSignoff && !isClosed && !isRejected && (() => {
          const approvedByMe = demand.phaseSignoffs?.find(
            (s) => s.status === "APPROVED" && s.targetUserId === user?.id && s.phase === demand.status
              && ((s as unknown as { kind?: string }).kind ?? "PHASE") === "PHASE"
          )
          if (!approvedByMe) return null
          return (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 sm:p-4 flex items-center gap-2 sm:gap-2.5">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500 shrink-0" />
              <p className="text-xs sm:text-sm text-emerald-700"><span className="font-medium">您已確認通過</span><span className="hidden sm:inline"> —</span><span className="sm:hidden">，</span>管理者已收到，正在審閱內容後將推進至下一階段。</p>
            </div>
          )
        })()}

        {/* ── Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto scrollbar-hide">
          <TabsList className="inline-flex w-max sm:w-full justify-start bg-muted/50 h-10 p-1">
            <TabsTrigger value="overview" className="gap-1 sm:gap-1.5 px-2.5 sm:px-4 text-xs sm:text-sm">
              <Layers className="h-3.5 w-3.5 hidden sm:block" />
              概覽
            </TabsTrigger>
            <TabsTrigger value="gantt" className="gap-1 sm:gap-1.5 px-2.5 sm:px-4 text-xs sm:text-sm">
              <BarChart3 className="h-3.5 w-3.5 hidden sm:block" />
              甘特圖
            </TabsTrigger>
            <TabsTrigger value="deliverables" className="gap-1 sm:gap-1.5 px-2.5 sm:px-4 text-xs sm:text-sm">
              <Package className="h-3.5 w-3.5 hidden sm:block" />
              交付成果
              {(() => {
                const devLinks = demand.documents.filter(d => d.type === "APP_RESULT" && d.phase === "DEVELOPING")
                const prdLinks = demand.documents.filter(d => d.type === "APP_RESULT" && d.phase === "PRD_REVIEW")
                const count = devLinks.length > 0 ? devLinks.length : prdLinks.length
                return count > 0 ? (
                  <Badge variant="secondary" className="text-[10px] h-4 min-w-4 px-1 rounded-full ml-0.5">
                    {count}
                  </Badge>
                ) : null
              })()}
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1 sm:gap-1.5 px-2.5 sm:px-4 text-xs sm:text-sm">
              <Paperclip className="h-3.5 w-3.5 hidden sm:block" />
              文件
              {(() => {
                const visible = demand.documents.filter((d) => d.type !== "GITHUB_REPO")
                const n = new Set(visible.map((d) => (d as unknown as { docGroup?: string | null }).docGroup || d.id)).size
                return n > 0 ? (
                  <Badge variant="secondary" className="text-[10px] h-4 min-w-4 px-1 rounded-full ml-0.5">
                    {n}
                  </Badge>
                ) : null
              })()}
            </TabsTrigger>
            <TabsTrigger value="signoffs" className="gap-1 sm:gap-1.5 px-2.5 sm:px-4 text-xs sm:text-sm">
              <ClipboardCheck className="h-3.5 w-3.5 hidden sm:block" />
              簽核紀錄
              {(() => {
                const c = demand.phaseSignoffs?.filter((s: { targetUserId: string | null; status: string }) => s.targetUserId || s.status !== "PENDING").length ?? 0
                return c > 0 ? (
                  <Badge variant="secondary" className="text-[10px] h-4 min-w-4 px-1 rounded-full ml-0.5">{c}</Badge>
                ) : null
              })()}
            </TabsTrigger>
            <TabsTrigger value="design-changes" className="gap-1 sm:gap-1.5 px-2.5 sm:px-4 text-xs sm:text-sm">
              <FileEdit className="h-3.5 w-3.5 hidden sm:block" />
              設計變更
              {(() => {
                const dcs = (demand as unknown as { designChanges?: { status: string }[] }).designChanges ?? []
                if (!dcs.length) return null
                const pending = dcs.some((d) => d.status === "PENDING")
                return (
                  <>
                    <Badge variant="secondary" className="text-[10px] h-4 min-w-4 px-1 rounded-full ml-0.5">{dcs.length}</Badge>
                    {pending && <span className="h-1.5 w-1.5 rounded-full bg-red-500" title="有待確認的設計變更" />}
                  </>
                )
              })()}
            </TabsTrigger>
          </TabsList>
          </div>

          {/* ══════ Tab: 概覽 ══════ */}
          <TabsContent value="overview" className="mt-5">
            <div className="grid gap-5 lg:grid-cols-3">
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
                          rehypePlugins={[rehypeRaw]}
                          remarkRehypeOptions={{ allowDangerousHtml: true }}
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
                    {isCancelled && (
                      <>
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                          <div className="flex items-center gap-1.5 text-slate-600 mb-0.5">
                            <XCircle className="h-3.5 w-3.5 shrink-0" />
                            <span className="text-xs font-medium">已取消原因</span>
                          </div>
                          <p className="text-xs leading-snug text-slate-600 whitespace-pre-line">
                            {demand.holdReason || "此需求已由管理者取消，後續如有需要可重新啟動。"}
                          </p>
                        </div>
                        <Separator />
                      </>
                    )}
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
                    {(demand.contactPerson || demand.demandManager) && (
                      <div className="grid grid-cols-2 gap-3">
                        {demand.contactPerson && (
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                              <span className="text-[11px] font-medium text-amber-600">
                                {demand.contactPerson.name[0]}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium leading-tight truncate">
                                {demand.contactPerson.name}
                              </p>
                              <p className="text-[11px] text-muted-foreground">需求窗口</p>
                            </div>
                          </div>
                        )}
                        {demand.demandManager && (
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                              <span className="text-[11px] font-medium text-teal-600">
                                {demand.demandManager.name[0]}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium leading-tight truncate">
                                {demand.demandManager.name}
                              </p>
                              <p className="text-[11px] text-muted-foreground">需求主管</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
                    {isTerminated ? (
                      /* 已終止：只呈現結算金額，不把 SP 攤到各階段（避免誤會後段階段有完成） */
                      <div className="space-y-3">
                        <div className="flex items-center justify-center gap-4 py-2">
                          <div className="text-center">
                            <p className="text-[11px] text-muted-foreground">原規劃</p>
                            <p className="text-lg font-bold text-muted-foreground/50 line-through">{demand.estimatedSp}</p>
                          </div>
                          <div className="text-muted-foreground text-lg">→</div>
                          <div className="text-center">
                            <p className="text-[11px] text-muted-foreground">終止結算</p>
                            <p className="text-3xl font-bold text-primary leading-none">{demand.confirmedSp ?? sp}<span className="text-sm font-normal text-muted-foreground ml-1">SP</span></p>
                          </div>
                        </div>
                        <div className="rounded-lg border border-orange-200 bg-orange-50/50 px-4 py-2.5 text-sm">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-muted-foreground line-through">{demand.estimatedSp} SP</span>
                            <span className="text-muted-foreground">×</span>
                            <span className="font-semibold text-orange-600">{Math.round(((demand.confirmedSp ?? sp) / demand.estimatedSp) * 100)}%</span>
                            <span className="text-muted-foreground">=</span>
                            <span className="font-semibold text-primary">{demand.confirmedSp ?? sp} SP</span>
                          </div>
                          {settlementReason && <p className="text-xs text-muted-foreground mt-1.5 text-center">{settlementReason}</p>}
                        </div>
                        <p className="text-[11px] text-muted-foreground/70 text-center leading-relaxed">
                          此為專案<span className="font-medium">終止時的結算金額</span>，非各階段實際完成的 SP 分配。
                        </p>
                      </div>
                    ) : spPieData.length > 0 ? (
                      <div>
                        <div className="h-[160px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={spPieData.filter(e => e.value > 0)}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={65}
                                paddingAngle={3}
                                dataKey="value"
                                stroke="none"
                              >
                                {spPieData.filter(e => e.value > 0).map((entry) => (
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
                              <text x="50%" y="48%" textAnchor="middle" dominantBaseline="central" className="fill-foreground text-lg font-bold">{sp}</text>
                              <text x="50%" y="62%" textAnchor="middle" dominantBaseline="central" className="fill-muted-foreground text-[10px]">SP</text>
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
                              <span className="font-medium">
                                {(isOverride || hasOriginalData) && entry.originalSp !== entry.value && entry.originalSp > 0
                                  ? <>{entry.originalSp} → {entry.value} SP</>
                                  : <>{entry.value} SP</>}
                              </span>
                            </div>
                          ))}
                        </div>
                        {isOverride && (
                          <div className="rounded-lg border border-orange-200 bg-orange-50/50 px-4 py-2.5 mt-3 text-sm">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-muted-foreground line-through">{demand.estimatedSp} SP</span>
                              <span className="text-muted-foreground">×</span>
                              <span className="font-semibold text-orange-600">{Math.round((demand.confirmedSp! / demand.estimatedSp) * 100)}%</span>
                              <span className="text-muted-foreground">=</span>
                              <span className="font-semibold text-primary">{demand.confirmedSp} SP</span>
                            </div>
                            {settlementReason && (
                              <p className="text-xs text-muted-foreground mt-1.5 text-center">{settlementReason}</p>
                            )}
                          </div>
                        )}
                        {isAdjustment && (
                          <div className="rounded-lg border border-blue-200 bg-blue-50/50 px-4 py-2.5 mt-3 text-sm">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-blue-600 font-medium">SP 調整</span>
                              <span className="text-muted-foreground">{demand.estimatedSp}</span>
                              <span className="text-muted-foreground">→</span>
                              <span className="font-semibold text-primary">{demand.confirmedSp} SP</span>
                            </div>
                            {settlementReason && (
                              <p className="text-xs text-muted-foreground mt-1.5 text-center">{settlementReason}</p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : demand.confirmedSp != null && demand.confirmedSp !== demand.estimatedSp ? (
                      <div className="text-center py-4 space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">原始 SP</p>
                          <p className="text-2xl font-bold text-muted-foreground/60 line-through">{demand.estimatedSp}</p>
                        </div>
                        <div className="text-muted-foreground">↓</div>
                        <div>
                          <p className="text-xs text-muted-foreground">結算 SP</p>
                          <p className="text-3xl font-bold text-primary">{demand.confirmedSp}</p>
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
                        const isClosedRow = phase === "CLOSED"
                        const isTermRow = isTerminated && isClosedRow
                        // 終止時：進度只標到實際到達的階段（reachedIdx），之後階段視為未進行
                        const reachedIdx = isTerminated && terminatedAtIdx >= 0 ? terminatedAtIdx : currentStepIdx
                        const isPast = isTerminated ? (idx <= reachedIdx && !isClosedRow) : (currentStepIdx >= 0 && idx < currentStepIdx)
                        const isCurrent = isTerminated ? false : (idx === currentStepIdx && !isRejected)
                        const isFuture = isTerminated ? (idx > reachedIdx && !isClosedRow) : (currentStepIdx >= 0 ? idx > currentStepIdx : true)

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
                            {isTermRow ? (
                              <XCircle className="h-4 w-4 text-zinc-400 shrink-0" />
                            ) : isPast ? (
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
                              isTermRow && "font-medium text-zinc-600",
                              isCurrent && "font-semibold text-foreground",
                              isPast && "text-muted-foreground",
                              isFuture && "text-muted-foreground/50",
                            )}>
                              {isTermRow ? "已終止" : phaseInfo?.label}
                              {isTerminated && terminatedFromStatus === phase && <span className="text-[11px] text-zinc-400 ml-1.5">· 終止於此</span>}
                              {isCurrent && dcHasPending && " - 設計變更"}
                            </span>

                            {dateRange && (!isTerminated || isPast) && (
                              <span className={cn(
                                "text-[11px] shrink-0 hidden xl:inline",
                                isCurrent ? "text-muted-foreground" : "text-muted-foreground/60",
                              )}>
                                {dateRange}
                              </span>
                            )}

                            {!isTerminated && (() => {
                              const currentSp = plan?.plannedSp ?? 0
                              const adjustedSp = isOverride ? Math.round(currentSp * ratio * 10) / 10 : currentSp
                              const origSp = isOverride ? currentSp
                                : (hasOriginalData && (plan as any)?.originalPlannedSp != null) ? (plan as any).originalPlannedSp
                                : null
                              const showArrow = origSp != null && origSp !== adjustedSp && origSp > 0
                              return (
                                <Badge variant="secondary" className={cn("text-[10px] h-5 px-1.5 rounded shrink-0", isFuture && "opacity-50")}>
                                  {showArrow ? <>{origSp} → {adjustedSp}</> : adjustedSp}
                                </Badge>
                              )
                            })()}
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

          {/* ══════ Tab: 交付成果 ══════ */}
          <TabsContent value="deliverables" className="mt-5">
            {(() => {
              const devLinks = demand.documents.filter(d => d.type === "APP_RESULT" && d.phase === "DEVELOPING")
              const prdLinks = demand.documents.filter(d => d.type === "APP_RESULT" && d.phase === "PRD_REVIEW")
              const deliverables = devLinks.length > 0 ? devLinks : prdLinks

              if (deliverables.length === 0) {
                return (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center min-h-[200px] text-muted-foreground">
                      <Package className="h-12 w-12 mb-3 opacity-20" />
                      <p className="text-sm">尚無交付成果</p>
                      <p className="text-xs mt-1">在「開發中」或「MVP 架構確認」階段上傳 APP 成果連結後會自動顯示</p>
                    </CardContent>
                  </Card>
                )
              }

              return (
                <Card>
                  <CardContent className="p-0">
                    <div className="relative min-h-[520px]">
                      <div className="w-full min-h-[520px] flex flex-col">
                        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                          <p className="text-xs text-muted-foreground truncate flex-1">{deliverables[0].fileUrl}</p>
                          <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" asChild>
                            <a href={deliverables[0].fileUrl!} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3 mr-1" />新分頁
                            </a>
                          </Button>
                        </div>
                        <iframe src={deliverables[0].fileUrl!} className="flex-1 w-full min-h-[490px] border-0" title="APP 預覽" />
                      </div>
                      <div className="absolute inset-0 pointer-events-none z-10" style={{ backgroundImage: watermarkBg, backgroundRepeat: "repeat" }} />
                    </div>
                  </CardContent>
                </Card>
              )
            })()}
          </TabsContent>

          {/* ══════ Tab: 文件 ══════ */}
          <TabsContent value="documents" className="mt-5">
            <div className="grid gap-6 lg:grid-cols-5">
              {/* Preview pane */}
              <div className={cn(protoPreview ? "lg:col-span-5" : "lg:col-span-3")}>
                <Card className="h-full">
                  <CardContent className="p-0 h-full">
                    {protoPreview ? (
                      <PrototypeInlinePreview
                        demandId={demand.id}
                        proto={protoPreview.proto}
                        screenId={protoPreview.screenId}
                        token={token}
                        watermarkBg={watermarkBg}
                        onScreenChange={(sid) => setProtoPreview((p) => (p ? { ...p, screenId: sid } : p))}
                        onMaximize={() => setProtoMax(true)}
                        onClose={() => setProtoPreview(null)}
                      />
                    ) : selectedDoc ? (
                      <div className={cn("relative h-full flex flex-col", isPreviewEmpty ? "min-h-[120px]" : "min-h-[300px] sm:min-h-[520px]")}>
                        {/* Preview toolbar */}
                        <div className="flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2 border-b bg-muted/20 shrink-0">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 lg:hidden" onClick={() => setSelectedDoc(null)}>
                              <ArrowLeft className="h-3.5 w-3.5" />
                            </Button>
                            <span className="text-[10px] sm:text-xs text-muted-foreground truncate">{selectedDoc.fileName}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <TooltipProvider>
                              <UiTooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    disabled={docLinkBusy}
                                    onClick={() => copyDocShareLink(selectedDoc.id)}
                                  >
                                    {docLinkBusy
                                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      : docLinkCopied
                                        ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                                        : <Link2 className="h-3.5 w-3.5" />}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {docLinkCopied ? "已複製" : "複製文件分享連結"}
                                </TooltipContent>
                              </UiTooltip>
                              <UiTooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFullScreenDoc(selectedDoc)}>
                                    <Maximize2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>全螢幕預覽</TooltipContent>
                              </UiTooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                        <div className="flex-1 min-h-0 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
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
                                return (
                                  <div className="w-full self-start max-h-[calc(100vh-13rem)] overflow-auto p-6 prose prose-sm prose-neutral dark:prose-invert max-w-none prose-table:border-collapse prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-1.5 prose-th:bg-muted/50 prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-1.5">
                                    <ReactMarkdown
                                      remarkPlugins={[remarkGfm, remarkBreaks]}
                                      rehypePlugins={[rehypeRaw]}
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
                                <pre className="text-sm whitespace-pre-wrap break-words w-full self-start max-h-[calc(100vh-13rem)] overflow-auto p-4 bg-muted/30 rounded-lg font-mono leading-relaxed">
                                  {textContent}
                                </pre>
                              )
                            }

                            if (["xls", "xlsx"].includes(ext) && excelReady) {
                              return (
                                <div className="w-full min-h-[300px] sm:min-h-[520px] relative">
                                  <div className="absolute inset-0">
                                    <ExcelPreview
                                      fileUrl={selectedDoc.fileUrl}
                                      fileName={selectedDoc.fileName}
                                    />
                                  </div>
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
                                  <p className="text-xs text-muted-foreground">無法轉換預覽，請確認伺服器已安裝 LibreOffice 或 Microsoft Office</p>
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
                        {/* Watermark overlay – hidden when file content is empty */}
                        {!isPreviewEmpty && (
                          <div
                            className="absolute inset-0 pointer-events-none z-10"
                            style={{ backgroundImage: watermarkBg, backgroundRepeat: "repeat" }}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center min-h-[200px] sm:min-h-[400px] text-muted-foreground">
                        <Eye className="h-10 w-10 sm:h-12 sm:w-12 mb-3 opacity-20" />
                        <p className="text-xs sm:text-sm">請選擇文件以預覽</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Document list */}
              <div className={cn("lg:col-span-2", protoPreview && "hidden")}>
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
                      onDocumentSelect={(d) => { setProtoPreview(null); setSelectedDoc(d) }}
                      onActivePhaseChange={setDocActivePhase}
                      selectedDocId={selectedDoc?.id}
                      userRole="subsidiary"
                    />
                  </CardContent>
                </Card>

                {/* 原型 Prototype — 只有點進「MVP 架構確認」階段時才出現（唯讀） */}
                {docActivePhase === "PRD_REVIEW" && (
                  <div className="mt-4">
                    <PrototypePanel
                      demandId={demand.id}
                      token={token}
                      canManage={false}
                      watermarkBg={watermarkBg}
                      onPreview={(proto, screenId) => { setSelectedDoc(null); setProtoPreview({ proto, screenId }) }}
                    />
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ══════ Tab: 簽核紀錄 ══════ */}
          <TabsContent value="signoffs" className="mt-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  簽核紀錄
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SignoffHistory
                  signoffs={demand.phaseSignoffs || []}
                  demandId={demand.id}
                  token={token}
                  userRole={user?.role}
                  currentUserId={user?.id}
                  onRefresh={fetchDemand}
                  spAdjustment={(() => {
                    if (demand.confirmedSp === null || demand.confirmedSp === demand.estimatedSp) return null
                    const closedHistory = demand.statusHistory?.find(
                      (h: { toStatus: string; comment: string | null }) => h.toStatus === "CLOSED" && h.comment?.includes("SP_ADJUSTMENT")
                    )
                    if (!closedHistory?.comment) return null
                    try {
                      const adj = JSON.parse(closedHistory.comment)
                      return { oldSp: adj.oldSp, newSp: adj.newSp, reason: adj.reason }
                    } catch { return null }
                  })()}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════ Tab: 設計變更 ══════ */}
          <TabsContent value="design-changes" className="mt-5">
            <DesignChangeTab
              demandId={demand.id}
              demandNumber={demand.demandNumber}
              phaseLabel={statusInfo.label}
              token={token}
              currentUserId={user?.id}
              canManage={false}
              currentSp={demand.confirmedSp ?? demand.estimatedSp}
              watermarkBg={watermarkBg}
              onPreviewDoc={(d) => setFullScreenDoc(d as unknown as NonNullable<typeof fullScreenDoc>)}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Full-screen document preview */}
      <FullScreenDocumentPreview
        open={!!fullScreenDoc}
        onOpenChange={(open) => { if (!open) setFullScreenDoc(null) }}
        doc={fullScreenDoc}
        watermarkBg={watermarkBg}
      />

      {/* 原型放大預覽 */}
      {protoMax && protoPreview && (
        <PrototypePreviewModal
          demandId={demand.id}
          proto={protoPreview.proto}
          screenId={protoPreview.screenId}
          token={token}
          watermarkBg={watermarkBg}
          onScreenChange={(sid) => setProtoPreview((p) => (p ? { ...p, screenId: sid } : p))}
          onClose={() => setProtoMax(false)}
        />
      )}

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

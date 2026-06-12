"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft, Building2, User, Calendar, FileText, Code2,
  Loader2, Pencil, Trash2, Check, ChevronDown,
  BarChart3, GanttChart, FolderOpen,
  AlertCircle, CircleDot, Info, UserPlus,
  Clock, SkipForward, ClipboardCheck, Share2, Copy, Link2, Package,
  FileEdit, Mail, ShieldCheck, Maximize2,
} from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { STATUS_MAP, PIPELINE_STEPS, SP_PROGRESS_RATE, PHASE_DOCUMENT_MAP, PHASE_DESCRIPTIONS, PHASE_ACTIONS, DOCUMENT_TYPE_LABELS, SIGNOFF_REQUIRED_PHASES, SIGNOFF_STATUS_MAP, DESIGN_CHANGE_ALLOWED_PHASES } from "@/lib/constants/demand"
import { Upload, Download, Eye, ExternalLink, FileAudio, X, ZoomIn } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { SpAllocationChart } from "@/components/demand/sp-allocation-chart"
import { ProjectGantt } from "@/components/demand/project-gantt"
import { PhaseDocuments } from "@/components/demand/phase-documents"
import { StepNavigation } from "@/components/demand/step-navigation"
import { SignoffHistory } from "@/components/demand/signoff-history"
import { PhaseSignoffBanner } from "@/components/demand/phase-signoff-banner"
import { DesignChangeDialog } from "@/components/demand/design-change-dialog"
import { NotifySignersDialog } from "@/components/demand/notify-signers-dialog"
import { PhasePlanInlineEditor } from "@/components/demand/phase-plan-inline-editor"
import { SubTaskEditor } from "@/components/demand/sub-task-editor"
import { FullScreenDocumentPreview } from "@/components/demand/full-screen-document-preview"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import rehypeRaw from "rehype-raw"
import mermaid from "mermaid"
import { ExcelPreview } from "@/components/excel-preview"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"

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
  vendor: string
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
  phaseSignoffs: {
    id: string
    phase: string
    status: string
    targetUserId: string | null
    targetUser: { id: string; name: string } | null
    targetRole: string | null
    overrideTargetStatus: string | null
    comment: string | null
    requestComment: string | null
    requestedAt: string
    respondedAt: string | null
    requestedBy: { id: string; name: string }
    respondedBy: { id: string; name: string } | null
    documents?: { id: string; fileName: string; fileUrl: string | null; fileSize: number | null }[]
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
  const [staffUsers, setStaffUsers] = useState<{ id: string; name: string; role?: string; organizationId?: string | null }[]>([])
  const [accessUsers, setAccessUsers] = useState<{ id: string; name: string; signoffRole: string }[]>([])
  const [vendorOptions, setVendorOptions] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState("overview")
  const [docPhaseKey, setDocPhaseKey] = useState(0)
  const [spPlanOpen, setSpPlanOpen] = useState<boolean | null>(null)
  const [spPlanDialogOpen, setSpPlanDialogOpen] = useState(false)
  const [subTasksOpen, setSubTasksOpen] = useState<boolean | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<DemandDetail["documents"][0] | null>(null)
  const [fullScreenDoc, setFullScreenDoc] = useState<DemandDetail["documents"][0] | null>(null)
  const [docLinkCopied, setDocLinkCopied] = useState(false)
  const [textContent, setTextContent] = useState("")
  const [textLoading, setTextLoading] = useState(false)
  const [excelReady, setExcelReady] = useState(false)
  const [officePreviewUrl, setOfficePreviewUrl] = useState<string | null>(null)
  const [officeLoading, setOfficeLoading] = useState(false)
  const [zoomedImg, setZoomedImg] = useState<string | null>(null)
  // Tracks if user just approved a DESIGN_CHANGE in this session — used to
  // suppress the PHASE banner so they don't see a second "approve" prompt
  // immediately after. Resets naturally on any new page load.
  const [justApprovedDc, setJustApprovedDc] = useState(false)

  // Design change dialog
  const [designChangeOpen, setDesignChangeOpen] = useState(false)
  // Notify signers dialog
  const [notifySignersOpen, setNotifySignersOpen] = useState(false)
  const [notifyShareUrl, setNotifyShareUrl] = useState<string | undefined>(undefined)
  const [notifyPreparing, setNotifyPreparing] = useState(false)

  // Board override dialog
  const [boardOverrideOpen, setBoardOverrideOpen] = useState(false)
  const [boardOverrideComment, setBoardOverrideComment] = useState("")
  const [boardOverrideSubmitting, setBoardOverrideSubmitting] = useState(false)
  const [boardOverrideKind, setBoardOverrideKind] = useState<"PHASE" | "DESIGN_CHANGE">("PHASE")
  // 代簽通過後直接結算的目標狀態（"" = 不直接結算，照正常流程）
  const [boardOverrideTargetStatus, setBoardOverrideTargetStatus] = useState<string>("")

  // Share link state
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [shareLinks, setShareLinks] = useState<{ id: string; token: string; expiresAt: string; createdAt: string; createdBy: { name: string } }[]>([])
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState<string | null>(null)
  const [adminCanWrite, setAdminCanWrite] = useState(true)

  const isFullAdmin = user?.role === "admin" && (!user?.adminScopeType || user.adminScopeType === "all")
  const isAdminWithWrite = user?.role === "admin" && (isFullAdmin || adminCanWrite)
  // canManage: full admin or delivery can manage; limited admin with edit can too
  const canManage = isAdminWithWrite || user?.role === "delivery"

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
      if (res.ok) {
        setDemand(data.demand)
        if (data.accessUsers) setAccessUsers(data.accessUsers)
        if (typeof data.adminCanWrite === "boolean") setAdminCanWrite(data.adminCanWrite)
      }
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
        if (data.filters?.assignableUsers) setStaffUsers(data.filters.assignableUsers)
      })
      .catch(() => {})
  }, [token, canManage])

  // Fetch vendor options
  useEffect(() => {
    if (!token) return
    fetch("/api/vendors", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.vendors) setVendorOptions(data.vendors.map((v: { name: string }) => v.name))
      })
      .catch(() => {})
  }, [token])

  const handleVendorChange = async (vendor: string) => {
    if (!token || !demand) return
    try {
      const res = await fetch(`/api/demands/${demand.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ vendor }),
      })
      if (res.ok) fetchDemand()
    } catch { /* ignore */ }
  }

  const selectedDocExt = selectedDoc?.fileName.split(".").pop()?.toLowerCase() || ""
  const isPreviewEmpty = !!selectedDoc && ["txt", "md"].includes(selectedDocExt) && !textLoading && !textContent

  // Fetch text content for preview
  useEffect(() => {
    setTextContent("")
    if (!selectedDoc?.fileUrl) return
    const ext = selectedDoc.fileName.split(".").pop()?.toLowerCase() || ""
    if (!["txt", "md"].includes(ext)) return
    setTextLoading(true)
    fetch(selectedDoc.fileUrl)
      .then((res) => {
        if (!res.ok) { setTextContent(""); setTextLoading(false); return }
        return res.text()
      })
      .then((t) => { if (t !== undefined) setTextContent(t) })
      .catch(() => setTextContent(""))
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

  const handleAssign = async (field: "managerId" | "developerId" | "contactPersonId" | "demandManagerId", userId: string) => {
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

  // Board override handler
  const handleBoardOverride = async () => {
    if (!token || !boardOverrideComment.trim() || !demand) return
    setBoardOverrideSubmitting(true)
    try {
      const res = await fetch(`/api/demands/${demandId}/signoffs/board-override`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          comment: boardOverrideComment.trim(),
          kind: boardOverrideKind,
          targetStatus: boardOverrideKind === "PHASE" && boardOverrideTargetStatus ? boardOverrideTargetStatus : null,
        }),
      })
      if (res.ok) {
        setBoardOverrideOpen(false)
        setBoardOverrideComment("")
        setBoardOverrideTargetStatus("")
        fetchDemand()
      }
    } catch { /* ignore */ } finally {
      setBoardOverrideSubmitting(false)
    }
  }

  // Share link functions
  const fetchShareLinks = async () => {
    if (!token) return
    setShareLoading(true)
    try {
      const res = await fetch(`/api/demands/${demandId}/share`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setShareLinks(data.shares)
      }
    } catch { /* ignore */ }
    finally { setShareLoading(false) }
  }

  const createShareLink = async () => {
    if (!token) return
    setShareLoading(true)
    try {
      const res = await fetch(`/api/demands/${demandId}/share`, {
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
      await fetch(`/api/demands/${demandId}/share`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ shareId }),
      })
      fetchShareLinks()
    } catch { /* ignore */ }
  }

  // Ensure an active share link exists, then open notify signers dialog
  const openNotifySigners = async () => {
    if (!token) return
    setNotifyPreparing(true)
    try {
      // Fetch existing share links
      const res = await fetch(`/api/demands/${demandId}/share`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error("無法取得分享連結")
      const data = await res.json()
      const shares = data.shares as typeof shareLinks
      setShareLinks(shares)

      // Find active (non-expired) share link
      let activeShare = shares.find((s: { expiresAt: string }) => new Date(s.expiresAt) > new Date())

      // If none exists, create one
      if (!activeShare) {
        const createRes = await fetch(`/api/demands/${demandId}/share`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!createRes.ok) throw new Error("無法建立分享連結")
        const created = await createRes.json()
        activeShare = created
        // Refresh share links list
        fetchShareLinks()
      }

      if (activeShare?.token) {
        setNotifyShareUrl(`${window.location.origin}/share/${activeShare.token}`)
      } else {
        setNotifyShareUrl(undefined)
      }
      setNotifySignersOpen(true)
    } catch {
      // Fallback: open dialog without share URL
      setNotifyShareUrl(undefined)
      setNotifySignersOpen(true)
    } finally {
      setNotifyPreparing(false)
    }
  }

  const copyShareUrl = (shareToken: string) => {
    const url = `${window.location.origin}/share/${shareToken}`
    navigator.clipboard.writeText(url)
    setShareCopied(shareToken)
    setTimeout(() => setShareCopied(null), 2000)
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
  const isOnHold = demand.status === "ON_HOLD"
  const isClosed = demand.status === "CLOSED"
  // When CLOSED, only admin with write retains modification rights
  const effectiveCanManage = canManage && (!isClosed || isAdminWithWrite)

  // Latest round of signoffs for current phase (ignore historical rounds)
  // Exclude orphan signoffs (no assigned user) regardless of status
  // Only include PHASE signoffs (exclude DESIGN_CHANGE)
  const allCurrentSignoffs = demand.phaseSignoffs?.filter(
    (s) => s.phase === demand.status && ["PENDING", "APPROVED", "REJECTED", "SKIPPED"].includes(s.status)
      && s.targetUserId
      && ((s as unknown as { kind?: string }).kind ?? "PHASE") === "PHASE"
  ) || []
  const latestRoundTime = allCurrentSignoffs.length > 0
    ? Math.max(...allCurrentSignoffs.map(s => new Date(s.requestedAt).getTime()))
    : 0
  const currentPhaseSignoffs = allCurrentSignoffs.filter(s => new Date(s.requestedAt).getTime() === latestRoundTime)
  const currentPhaseSignoff = currentPhaseSignoffs.length > 0
    ? currentPhaseSignoffs.find(s => s.status === "PENDING")
      || currentPhaseSignoffs.find(s => s.status === "REJECTED")
      || currentPhaseSignoffs[0]
    : null
  const curHasPending = currentPhaseSignoffs.some(s => s.status === "PENDING")
  const curHasPendingOverride = currentPhaseSignoffs.some(s => s.targetRole === "BOARD_OVERRIDE" && s.status === "PENDING")
  const curNonOverride = currentPhaseSignoffs.filter(s => s.targetRole !== "BOARD_OVERRIDE")
  const curAllApproved = currentPhaseSignoffs.length > 0 && (
    currentPhaseSignoffs.every(s => s.status === "APPROVED")
    || currentPhaseSignoffs.some(s => s.targetRole === "BOARD_OVERRIDE" && s.status === "APPROVED")
    || (curNonOverride.length > 0 && curNonOverride.every(s => s.status === "APPROVED"))
  )
  const curHasRejected = currentPhaseSignoffs.some(s => s.status === "REJECTED")

  // Design change signoffs (latest round at current phase)
  const allDesignChangeSignoffs = demand.phaseSignoffs?.filter(
    (s) => s.phase === demand.status
      && (s as unknown as { kind?: string }).kind === "DESIGN_CHANGE"
      && s.targetUserId
  ) || []
  const latestDcRoundTime = allDesignChangeSignoffs.length > 0
    ? Math.max(...allDesignChangeSignoffs.map(s => new Date(s.requestedAt).getTime()))
    : 0
  const currentDesignChangeSignoffs = allDesignChangeSignoffs.filter(
    s => new Date(s.requestedAt).getTime() === latestDcRoundTime
  )
  const dcHasPending = currentDesignChangeSignoffs.some(s => s.status === "PENDING")
  const dcNonOverride = currentDesignChangeSignoffs.filter(s => s.targetRole !== "BOARD_OVERRIDE")
  const dcAllApproved = currentDesignChangeSignoffs.length > 0
    && (currentDesignChangeSignoffs.every(s => s.status === "APPROVED")
      || currentDesignChangeSignoffs.some(s => s.targetRole === "BOARD_OVERRIDE" && s.status === "APPROVED")
      || (dcNonOverride.length > 0 && dcNonOverride.every(s => s.status === "APPROVED")))
  const dcHasRejected = currentDesignChangeSignoffs.some(s => s.status === "REJECTED")
  const designChangePendingCount = currentDesignChangeSignoffs.filter(s => s.status === "PENDING").length

  // Can propose design change: admin/delivery + current phase allowed + no pending DC
  const canProposeDesignChange =
    effectiveCanManage
    && (DESIGN_CHANGE_ALLOWED_PHASES as readonly string[]).includes(demand.status)
    && !dcHasPending
  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                <Link href="/governance/inbox"><ArrowLeft className="h-4 w-4" /></Link>
              </Button>
              <span className="text-xs sm:text-sm font-mono text-muted-foreground shrink-0">{demand.demandNumber}</span>
              <Badge variant="secondary" className={cn("text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 shrink-0", statusInfo.color)}>
                {statusInfo.label}
                {dcHasPending && <span className="ml-1">- 設計變更</span>}
              </Badge>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground ml-10 sm:ml-11 break-words">{demand.title}</h1>
          </div>
          <div className="flex items-center gap-2 ml-10 sm:ml-0 shrink-0">
            {/* Share button (admin + delivery) */}
            {canManage && (
              <Dialog open={shareDialogOpen} onOpenChange={(open) => { setShareDialogOpen(open); if (open) fetchShareLinks() }}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3">
                    <Share2 className="h-3.5 w-3.5 sm:mr-2" />
                    <span className="hidden sm:inline">分享</span>
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
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => copyShareUrl(s.token)}
                                      >
                                        {shareCopied === s.token ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive"
                                      onClick={() => deleteShareLink(s.id)}
                                    >
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
            )}
            {/* Edit / Delete (admin with write, not closed) */}
            {isAdminWithWrite && !isClosed && (
              <Button variant="outline" size="sm" className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3" asChild>
                <Link href={`/governance/demands/${demand.id}/edit`}>
                  <Pencil className="h-3.5 w-3.5 sm:mr-2" />
                  <span className="hidden sm:inline">編輯</span>
                </Link>
              </Button>
            )}
            {isFullAdmin && !isClosed && (
              <>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3">
                      <Trash2 className="h-3.5 w-3.5 sm:mr-2" />
                      <span className="hidden sm:inline">刪除</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg p-4 sm:p-6">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-base sm:text-lg">確定要刪除此需求？</AlertDialogTitle>
                      <AlertDialogDescription className="text-xs sm:text-sm">
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
              </>
            )}
          </div>
        </div>

        {/* Status Pipeline */}
        <Card>
          <CardContent className="py-3 sm:py-4 px-3 sm:px-6">
            {/* ── Mobile compact pipeline ── */}
            <div className="sm:hidden">
              {(() => {
                const currentInfo = STATUS_MAP[demand.status] || { label: demand.status }
                const total = PIPELINE_STEPS.length
                const progress = isRejected ? 0 : Math.max(0, currentStepIndex)
                return (
                  <div className="space-y-2.5">
                    {/* Progress bar with dots */}
                    <div className="flex items-center gap-1">
                      {PIPELINE_STEPS.map((step, i) => {
                        const isPast = !isRejected && currentStepIndex >= 0 && i < currentStepIndex
                        const isCurrent = !isRejected && i === currentStepIndex
                        return (
                          <React.Fragment key={step}>
                            <div className={cn(
                              "rounded-full shrink-0 transition-colors",
                              isCurrent ? "h-3 w-3 border-2 border-primary bg-primary" : isPast ? "h-2.5 w-2.5 bg-primary/60" : "h-2.5 w-2.5 bg-muted-foreground/20",
                            )} />
                            {i < PIPELINE_STEPS.length - 1 && (
                              <div className={cn("flex-1 h-px", isPast ? "bg-primary/40" : "bg-muted-foreground/15")} />
                            )}
                          </React.Fragment>
                        )
                      })}
                    </div>
                    {/* Current step info */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-medium text-muted-foreground shrink-0">
                          {progress + 1}/{total}
                        </span>
                        <span className="text-xs font-semibold text-foreground truncate">
                          {currentInfo.label}
                          {dcHasPending && " - 設計變更"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {curHasPending && !dcHasPending && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600 bg-amber-50 rounded-full px-1.5">
                            <Clock className="h-2.5 w-2.5" />待確認
                          </span>
                        )}
                        {curAllApproved && !dcHasPending && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 bg-emerald-50 rounded-full px-1.5">
                            <Check className="h-2.5 w-2.5" />已確認
                          </span>
                        )}
                        {dcHasPending && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-indigo-600 bg-indigo-50 rounded-full px-1.5">
                            <FileEdit className="h-2.5 w-2.5" />設計變更
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* ── Desktop full pipeline ── */}
            <TooltipProvider delayDuration={200}>
              <div className="hidden sm:flex items-center">
                {PIPELINE_STEPS.map((step, i) => {
                  const info = STATUS_MAP[step]
                  const isPast = !isRejected && currentStepIndex >= 0 && i < currentStepIndex
                  const isCurrent = !isRejected && i === currentStepIndex
                  const isFuture = isRejected || currentStepIndex < 0 || i > currentStepIndex

                  // Phase completion info — skip warnings for phases never entered (e.g. settlement closure)
                  const phaseVisited = demand.statusHistory?.some((h) => h.toStatus === step)
                  const phaseConfig = PHASE_DOCUMENT_MAP[step]
                  const requiredDocs = phaseConfig?.required || []
                  const missingDocs = requiredDocs.filter(
                    (type) => !demand.documents.some((d) => d.phase === step && d.type === type)
                  )
                  const hasAssignment = step === "PRD_REVIEW" || step === "SP_REVIEW" || step === "DEVELOPING" || step === "ACCEPTANCE"
                  const needsAssignment = hasAssignment && !demand.manager && !demand.developer
                  const showWarning = phaseVisited && (isPast || isCurrent) && (missingDocs.length > 0 || (isCurrent && needsAssignment))

                  // Signoff status for this phase
                  const signoffPhases = SIGNOFF_REQUIRED_PHASES as readonly string[]
                  const isSignoffPhase = signoffPhases.includes(step)
                  const allStepSignoffs = isSignoffPhase
                    ? demand.phaseSignoffs?.filter((s) => s.phase === step && ["PENDING", "APPROVED", "REJECTED", "SKIPPED"].includes(s.status)
                        && s.targetUserId) || []
                    : []
                  const latestTime = allStepSignoffs.length > 0
                    ? Math.max(...allStepSignoffs.map(s => new Date(s.requestedAt).getTime()))
                    : 0
                  const stepSignoffs = allStepSignoffs.filter(s => new Date(s.requestedAt).getTime() === latestTime)
                  const stepHasPending = stepSignoffs.some(s => s.status === "PENDING")
                  const stepNonOverride = stepSignoffs.filter(s => s.targetRole !== "BOARD_OVERRIDE")
                  const stepAllApproved = stepSignoffs.length > 0 && (stepSignoffs.every(s => s.status === "APPROVED")
                    || stepSignoffs.some(s => s.targetRole === "BOARD_OVERRIDE" && s.status === "APPROVED")
                    || (stepNonOverride.length > 0 && stepNonOverride.every(s => s.status === "APPROVED")))
                  const stepHasRejected = stepSignoffs.some(s => s.status === "REJECTED")
                  const stepAllSkipped = stepSignoffs.length > 0 && stepSignoffs.every(s => s.status === "SKIPPED")
                  const phaseSignoff = stepSignoffs.length > 0 ? stepSignoffs[0] : null

                  return (
                    <div key={step} className="flex items-center flex-1 last:flex-none">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col items-center gap-2 cursor-default shrink-0">
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
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={cn(
                                "text-sm whitespace-nowrap",
                                isCurrent && "font-semibold text-foreground",
                                isPast && "text-primary",
                                isFuture && "text-muted-foreground/50",
                              )}>
                                {info.label}
                                {isCurrent && dcHasPending && " - 設計變更"}
                              </span>
                              {isSignoffPhase && phaseSignoff && (
                                <span className={cn(
                                  "inline-flex items-center gap-0.5 text-[10px] font-medium rounded-full px-1.5 py-0",
                                  stepHasPending && "text-amber-600 bg-amber-50",
                                  stepAllApproved && "text-emerald-600 bg-emerald-50",
                                  stepHasRejected && "text-red-600 bg-red-50",
                                  stepAllSkipped && "text-gray-500 bg-gray-50",
                                )}>
                                  {stepHasPending && <><Clock className="h-2.5 w-2.5" />待確認</>}
                                  {stepAllApproved && <><Check className="h-2.5 w-2.5" />已確認</>}
                                  {stepHasRejected && <><X className="h-2.5 w-2.5" />已退回</>}
                                  {stepAllSkipped && <><SkipForward className="h-2.5 w-2.5" />略過</>}
                                </span>
                              )}
                              {isSignoffPhase && !phaseSignoff && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/40">
                                  <ClipboardCheck className="h-2.5 w-2.5" />
                                  待確認
                                </span>
                              )}
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs p-3">
                          <p className="font-medium text-xs mb-1">{info.label}</p>
                          <p className="text-xs text-muted-foreground mb-2">{PHASE_DESCRIPTIONS[step]}</p>
                          {isSignoffPhase && phaseSignoff && (
                            <div className="mb-2 flex items-center gap-1.5">
                              <span className="text-xs font-medium">簽核：</span>
                              <Badge className={cn("text-[10px]", SIGNOFF_STATUS_MAP[phaseSignoff.status]?.color)}>
                                {SIGNOFF_STATUS_MAP[phaseSignoff.status]?.label}
                              </Badge>
                            </div>
                          )}
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
                          "flex-1 h-px mx-2 mt-[-1.5rem] min-w-2",
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
              const hasSignoff = currentPhaseSignoff != null
              const hasDesignChange = currentDesignChangeSignoffs.length > 0

              if (missingDocs.length === 0 && !needsAssignment && actions.length === 0 && !hasSignoff && !hasDesignChange && !canProposeDesignChange) return null

              return (
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-2.5 sm:p-3">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <p className="text-xs font-medium text-blue-700">
                          {PHASE_DESCRIPTIONS[currentPhase]}
                        </p>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {/* Phase signoff badges — hidden while a design change is pending,
                            to avoid confusing signers with duplicate approvals */}
                        {hasSignoff && curHasPending && !dcHasPending && (
                          <Badge variant="outline" className="text-[11px] bg-amber-50 text-amber-700 border-amber-200">
                            <ClipboardCheck className="h-3 w-3 mr-1" />
                            等待簽核確認中
                          </Badge>
                        )}
                        {hasSignoff && curAllApproved && !dcHasPending && (
                          <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200">
                            <Check className="h-3 w-3 mr-1" />
                            已簽核確認
                          </Badge>
                        )}
                        {hasSignoff && curHasRejected && !curHasPending && !dcHasPending && (
                          <Badge variant="outline" className="text-[11px] bg-red-50 text-red-700 border-red-200">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            簽核已退回
                          </Badge>
                        )}
                        {dcHasPending && (
                          <Badge variant="outline" className="text-[11px] bg-indigo-50 text-indigo-700 border-indigo-200">
                            <FileEdit className="h-3 w-3 mr-1" />
                            設計變更待確認 ({designChangePendingCount})
                          </Badge>
                        )}
                        {dcAllApproved && !dcHasPending && (
                          <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200">
                            <Check className="h-3 w-3 mr-1" />
                            設計變更已確認
                          </Badge>
                        )}
                        {dcHasRejected && !dcHasPending && (
                          <Badge variant="outline" className="text-[11px] bg-red-50 text-red-700 border-red-200">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            設計變更已退回
                          </Badge>
                        )}
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
                    </div>
                    </div>
                    {(canProposeDesignChange || (canManage && curHasPending) || (canManage && (curHasPending || dcHasPending) && !curHasPendingOverride)) && (
                      <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 ml-6 sm:ml-0 sm:shrink-0">
                        <TooltipProvider>
                        {canProposeDesignChange && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 shrink-0 h-6 w-6 p-0 sm:h-7 sm:w-auto sm:px-2"
                                onClick={() => setDesignChangeOpen(true)}
                              >
                                <FileEdit className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1" />
                                <span className="hidden sm:inline text-xs">提出設計變更</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="sm:hidden">提出設計變更</TooltipContent>
                          </Tooltip>
                        )}
                        {canManage && curHasPending && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-blue-300 text-blue-700 hover:bg-blue-50 shrink-0 h-6 w-6 p-0 sm:h-7 sm:w-auto sm:px-2"
                                onClick={openNotifySigners}
                                disabled={notifyPreparing}
                              >
                                {notifyPreparing ? (
                                  <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin sm:mr-1" />
                                ) : (
                                  <Mail className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1" />
                                )}
                                <span className="hidden sm:inline text-xs">{notifyPreparing ? "準備中..." : "通知簽核人"}</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="sm:hidden">通知簽核人</TooltipContent>
                          </Tooltip>
                        )}
                        {canManage && (curHasPending || dcHasPending) && !curHasPendingOverride && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-orange-300 text-orange-700 hover:bg-orange-50 shrink-0 h-6 w-6 p-0 sm:h-7 sm:w-auto sm:px-2"
                                onClick={() => {
                                  setBoardOverrideKind(dcHasPending ? "DESIGN_CHANGE" : "PHASE")
                                  setBoardOverrideOpen(true)
                                }}
                              >
                                <ShieldCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1" />
                                <span className="hidden sm:inline text-xs">專案 Master 代簽</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="sm:hidden">專案 Master 代簽</TooltipContent>
                          </Tooltip>
                        )}
                        </TooltipProvider>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Board member signoff — inside card (org accounts excluded).
                Hidden if this user also has a pending design change at the
                same phase, OR if they just approved a DC this session — they
                shouldn't see a second "approve" prompt right after. The PHASE
                banner will reappear naturally on next page load. */}
            {!canManage && !user?.isOrgAccount && (() => {
              const mySignoff = currentPhaseSignoffs.find(
                (s) => s.status === "PENDING" && s.targetUserId === user?.id
              )
              const myPendingDc = currentDesignChangeSignoffs.find(
                (s) => s.status === "PENDING" && s.targetUserId === user?.id
              )
              if (!mySignoff || myPendingDc || justApprovedDc) return null
              return (
                <div className="mt-3">
                  <PhaseSignoffBanner
                    signoff={mySignoff}
                    demandId={demand.id}
                    token={token}
                    onComplete={fetchDemand}
                  />
                </div>
              )
            })()}

            {/* Design change signoff banner for requester/manager */}
            {!user?.isOrgAccount && (() => {
              const myDesignChange = currentDesignChangeSignoffs.find(
                (s) => s.status === "PENDING" && s.targetUserId === user?.id
              )
              return myDesignChange ? (
                <div className="mt-3">
                  <PhaseSignoffBanner
                    signoff={myDesignChange}
                    kind="DESIGN_CHANGE"
                    demandId={demand.id}
                    token={token}
                    onComplete={() => {
                      setJustApprovedDc(true)
                      fetchDemand()
                    }}
                  />
                </div>
              ) : null
            })()}

            {isRejected && (
              <div className="mt-3 text-center">
                <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">已駁回</Badge>
                {demand.rejectReason && (
                  <p className="text-xs text-muted-foreground mt-1">原因：{demand.rejectReason}</p>
                )}
              </div>
            )}
            {isOnHold && (
              <div className="mt-3 text-center">
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 text-xs">暫緩中</Badge>
                {demand.holdReason && (
                  <p className="text-xs text-muted-foreground mt-1">暫緩原因：{demand.holdReason}</p>
                )}
              </div>
            )}
            {/* Step Navigation */}
            {canManage && !isRejected && !isOnHold && (
              <div className="mt-3">
              <StepNavigation
                currentStatus={demand.status}
                demandId={demand.id}
                documents={demand.documents}
                token={token}
                completedDate={demand.completedDate}
                onStatusChange={() => { setActiveTab("overview"); setDocPhaseKey((k) => k + 1); fetchDemand() }}
                pendingSignoff={currentPhaseSignoff}
                onRefresh={fetchDemand}
                hideSignoffIndicator
                estimatedSp={demand.estimatedSp}
                confirmedSp={demand.confirmedSp}
                phasePlans={demand.phasePlans}
              />
              </div>
            )}

          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto scrollbar-hide">
          <TabsList className="inline-flex w-max sm:w-full justify-start h-10 p-1 bg-muted/60">
            <TabsTrigger value="overview" className="gap-1 sm:gap-1.5 px-2.5 sm:px-4 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <BarChart3 className="h-3.5 w-3.5 hidden sm:block" />
              概覽
            </TabsTrigger>
            <TabsTrigger value="gantt" className="gap-1 sm:gap-1.5 px-2.5 sm:px-4 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <GanttChart className="h-3.5 w-3.5 hidden sm:block" />
              甘特圖
            </TabsTrigger>
            <TabsTrigger value="deliverables" className="gap-1 sm:gap-1.5 px-2.5 sm:px-4 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
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
            <TabsTrigger value="documents" className="gap-1 sm:gap-1.5 px-2.5 sm:px-4 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <FolderOpen className="h-3.5 w-3.5 hidden sm:block" />
              文件
              {demand.documents.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 min-w-4 px-1 rounded-full ml-0.5">
                  {demand.documents.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="signoffs" className="gap-1 sm:gap-1.5 px-2.5 sm:px-4 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <ClipboardCheck className="h-3.5 w-3.5 hidden sm:block" />
              簽核紀錄
              {demand.phaseSignoffs && demand.phaseSignoffs.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 min-w-4 px-1 rounded-full ml-0.5">
                  {demand.phaseSignoffs.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          </div>

          {/* 概覽 Tab */}
          <TabsContent value="overview" className="mt-3 sm:mt-4">
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
              {/* Left column */}
              <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                {/* Phase-specific action cards */}
                {isAdminWithWrite && demand.status === "SP_REVIEW" && (
                  <Collapsible open={spPlanOpen ?? false} onOpenChange={setSpPlanOpen}>
                    <Card className="border-orange-200">
                      <CardHeader className="px-4 sm:px-6 pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
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
                            totalSp={demand.confirmedSp ?? demand.estimatedSp}
                            demandId={demand.id}
                            token={token}
                            staffUsers={staffUsers}
                            demandContext={{
                              developerId: demand.developer?.id,
                              contactPersonId: demand.contactPerson?.id,
                              organizationId: demand.organization.id,
                              organizationName: demand.organization.name,
                            }}
                            onSaved={() => { setSpPlanOpen(false); fetchDemand() }}
                          />
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                )}

                {isAdminWithWrite && demand.status === "PRD_REVIEW" && (!demand.manager || !demand.developer) && (
                  <Card className="border-amber-200">
                    <CardHeader className="px-4 sm:px-6 pb-3">
                      <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-amber-600" />
                        指派團隊成員
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">請在下方基本資訊區塊指派 PM 與工程師</p>
                    </CardHeader>
                    <CardContent className="px-4 sm:px-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs sm:text-sm">
                          <div className={cn("h-2 w-2 rounded-full", demand.manager ? "bg-emerald-500" : "bg-amber-400")} />
                          <span>PM：</span>
                          <span className={demand.manager ? "font-medium" : "text-muted-foreground"}>
                            {demand.manager?.name || "尚未指派"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs sm:text-sm">
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

                {isAdminWithWrite && !isClosed && (demand.status === "DEVELOPING" || (PIPELINE_STEPS.indexOf(demand.status as typeof PIPELINE_STEPS[number]) > PIPELINE_STEPS.indexOf("DEVELOPING") && demand.subTasks.length > 0 && demand.subTasks.every(t => t.status === "pending"))) && (() => {
                  const devPlan = demand.phasePlans.find((p) => p.phase === "DEVELOPING")
                  return (
                    <Collapsible open={subTasksOpen ?? false} onOpenChange={setSubTasksOpen}>
                      <Card className="border-violet-200">
                        <CardHeader className="px-4 sm:px-6 pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
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
                  <CardHeader className="px-4 sm:px-6 pb-3">
                    <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      需求說明
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 sm:px-6 space-y-0">
                    <div className="pb-4 prose prose-sm prose-neutral dark:prose-invert max-w-none prose-table:border-collapse prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-1.5 prose-th:bg-muted/50 prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-1.5">
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
              <div className="space-y-4 sm:space-y-6">
                {/* 基本資訊 */}
                <Card>
                  <CardHeader className="px-4 sm:px-6 pb-3">
                    <CardTitle className="text-sm sm:text-base">基本資訊</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 sm:px-6 space-y-2.5 sm:space-y-3">
                    <div className="flex items-center gap-2 text-xs sm:text-sm">
                      <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground w-14 sm:w-16 shrink-0">子公司</span>
                      <span className="font-medium">{demand.organization.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs sm:text-sm">
                      <Code2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground w-14 sm:w-16 shrink-0">開發商</span>
                      {isAdminWithWrite && !isClosed && vendorOptions.length > 1 ? (
                        <Select
                          value={demand.vendor}
                          onValueChange={(v) => handleVendorChange(v)}
                        >
                          <SelectTrigger className="h-7 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {vendorOptions.map((v) => (
                              <SelectItem key={v} value={v}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="font-medium">{demand.vendor}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs sm:text-sm">
                      <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground w-14 sm:w-16 shrink-0">PM</span>
                      {isAdminWithWrite && !isClosed && staffUsers.length > 0 ? (
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
                    <div className="flex items-center gap-2 text-xs sm:text-sm">
                      <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground w-14 sm:w-16 shrink-0">工程師</span>
                      {isAdminWithWrite && !isClosed && staffUsers.length > 0 ? (
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
                    <div className="flex items-center gap-2 text-xs sm:text-sm">
                      <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground w-14 sm:w-16 shrink-0">需求窗口</span>
                      {isAdminWithWrite && !isClosed ? (
                        <Select
                          value={demand.contactPerson?.id || "none"}
                          onValueChange={(v) => handleAssign("contactPersonId", v === "none" ? "" : v)}
                        >
                          <SelectTrigger className="h-7 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">尚未指派</SelectItem>
                            {accessUsers.filter((u) => u.signoffRole === "REQUESTER").map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={cn("font-medium", !demand.contactPerson && "text-muted-foreground")}>
                          {demand.contactPerson?.name || "尚未指派"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs sm:text-sm">
                      <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground w-14 sm:w-16 shrink-0">需求主管</span>
                      {isAdminWithWrite && !isClosed ? (
                        <Select
                          value={demand.demandManager?.id || "none"}
                          onValueChange={(v) => handleAssign("demandManagerId", v === "none" ? "" : v)}
                        >
                          <SelectTrigger className="h-7 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">尚未指派</SelectItem>
                            {accessUsers.filter((u) => u.signoffRole === "MANAGER").map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={cn("font-medium", !demand.demandManager && "text-muted-foreground")}>
                          {demand.demandManager?.name || "尚未指派"}
                        </span>
                      )}
                    </div>
                    <hr className="border-border/60" />
                    <div className="flex items-center gap-2 text-xs sm:text-sm">
                      <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground w-14 sm:w-16 shrink-0">估計 SP</span>
                      {demand.confirmedSp !== null && demand.confirmedSp !== demand.estimatedSp ? (
                        <span className="font-medium">
                          {demand.estimatedSp}
                          <span className="text-orange-500 mx-1">→</span>
                          <span className="text-orange-600">{demand.confirmedSp} SP</span>
                        </span>
                      ) : (
                        <span className="font-medium">{demand.estimatedSp} SP</span>
                      )}
                    </div>
                    {demand.confirmedSp !== null && demand.confirmedSp !== demand.estimatedSp && (() => {
                      const closedHistory = demand.statusHistory?.find(
                        (h: { toStatus: string; comment: string | null }) => h.toStatus === "CLOSED" && h.comment?.includes("SP_ADJUSTMENT")
                      )
                      if (!closedHistory?.comment) return null
                      try {
                        const adj = JSON.parse(closedHistory.comment)
                        return adj.reason ? (
                          <div className="ml-6 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                            <span className="font-medium text-foreground">調整原因：</span>{adj.reason}
                          </div>
                        ) : null
                      } catch { return null }
                    })()}
                    <hr className="border-border/60" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                        <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground shrink-0">開案時間</span>
                        <span className="font-medium">{formatDate(demand.phasePlans.find(p => p.phase === "SUBMITTED")?.plannedStart ?? demand.createdAt)}</span>
                      </div>
                      {demand.desiredDate && (
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                          <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground shrink-0">希望完成</span>
                          <span className="font-medium">{formatDate(demand.desiredDate)}</span>
                        </div>
                      )}
                    </div>
                    {demand.status === "CLOSED" && isAdminWithWrite && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs sm:text-sm">
                          <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
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
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground shrink-0">實際結案</span>
                        <span className="font-medium">{formatDate(demand.completedDate)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* SP 分配 */}
                <Card>
                  <CardHeader className="px-4 sm:px-6 pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm sm:text-base">SP 分配</CardTitle>
                      {isAdminWithWrite && (
                        <Button variant="outline" size="sm" className="h-7 sm:h-8 text-xs" onClick={() => setSpPlanDialogOpen(true)}>
                          <Pencil className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
                          編輯
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 sm:px-6">
                    <SpAllocationChart
                      phasePlans={demand.phasePlans}
                      totalSp={demand.confirmedSp ?? demand.estimatedSp}
                      estimatedSp={demand.estimatedSp}
                      settlementType={demand.confirmedSp != null && demand.confirmedSp !== demand.estimatedSp
                        ? (demand.phaseSignoffs?.some(s => s.targetRole === "BOARD_OVERRIDE" && s.status === "APPROVED") ? "override" : "adjustment")
                        : null}
                    />
                  </CardContent>
                </Card>

              </div>
            </div>
          </TabsContent>

          {/* 甘特圖 Tab */}
          <TabsContent value="gantt" className="mt-3 sm:mt-4">
            <Card>
              <CardHeader className="px-4 sm:px-6 pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <GanttChart className="h-4 w-4" />
                    甘特圖
                  </CardTitle>
                  {isAdminWithWrite && (
                    <Button variant="outline" size="sm" className="h-7 sm:h-8 text-xs" onClick={() => setSpPlanDialogOpen(true)}>
                      <Pencil className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
                      編輯時程
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-2 sm:px-6 overflow-x-auto">
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

          {/* 交付成果 Tab */}
          <TabsContent value="deliverables" className="mt-3 sm:mt-4">
            {(() => {
              const devLinks = demand.documents.filter(d => d.type === "APP_RESULT" && d.phase === "DEVELOPING")
              const prdLinks = demand.documents.filter(d => d.type === "APP_RESULT" && d.phase === "PRD_REVIEW")
              const deliverables = devLinks.length > 0 ? devLinks : prdLinks

              if (deliverables.length === 0) {
                return (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center min-h-[150px] sm:min-h-[200px] text-muted-foreground">
                      <Package className="h-10 w-10 sm:h-12 sm:w-12 mb-3 opacity-20" />
                      <p className="text-xs sm:text-sm">尚無交付成果</p>
                      <p className="text-[10px] sm:text-xs mt-1 text-center px-4">在「開發中」或「MVP 架構確認」階段上傳 APP 成果連結後會自動顯示</p>
                    </CardContent>
                  </Card>
                )
              }

              return (
                <Card>
                  <CardContent className="p-0">
                    <div className="relative min-h-[300px] sm:min-h-[520px]">
                      <div className="w-full min-h-[300px] sm:min-h-[520px] flex flex-col">
                        <div className="flex items-center justify-between px-2 sm:px-3 py-2 border-b bg-muted/30">
                          <p className="text-[10px] sm:text-xs text-muted-foreground truncate flex-1">{deliverables[0].fileUrl}</p>
                          <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" asChild>
                            <a href={deliverables[0].fileUrl!} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3 mr-1" />新分頁
                            </a>
                          </Button>
                        </div>
                        <iframe src={deliverables[0].fileUrl!} className="flex-1 w-full min-h-[260px] sm:min-h-[490px] border-0" title="APP 預覽" />
                      </div>
                      <div className="absolute inset-0 pointer-events-none z-10" style={{ backgroundImage: watermarkBg, backgroundRepeat: "repeat" }} />
                    </div>
                  </CardContent>
                </Card>
              )
            })()}
          </TabsContent>

          {/* 文件 Tab */}
          <TabsContent value="documents" className="mt-3 sm:mt-4">
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
              {/* Preview pane (hidden on mobile until doc selected) */}
              <div className={cn("lg:col-span-3 order-2 lg:order-1 min-w-0", !selectedDoc && "hidden lg:block")}>
                <Card className="h-full">
                  <CardContent className="p-0 h-full">
                    {selectedDoc ? (
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
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => {
                                      const activeShare = shareLinks.find(s => new Date(s.expiresAt) > new Date())
                                      if (!activeShare) {
                                        setShareDialogOpen(true)
                                        return
                                      }
                                      const docUrl = `${window.location.origin}/share/${activeShare.token}?doc=${selectedDoc.id}`
                                      navigator.clipboard.writeText(docUrl)
                                      setDocLinkCopied(true)
                                      setTimeout(() => setDocLinkCopied(false), 2000)
                                    }}
                                  >
                                    {docLinkCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Link2 className="h-3.5 w-3.5" />}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {shareLinks.some(s => new Date(s.expiresAt) > new Date())
                                    ? (docLinkCopied ? "已複製" : "複製文件分享連結")
                                    : "先建立分享連結"}
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFullScreenDoc(selectedDoc)}>
                                    <Maximize2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>全螢幕預覽</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                        <div className="flex-1 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
                          {(() => {
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
                                <div className="w-full h-full min-h-[300px] sm:min-h-[520px] flex flex-col">
                                  <div className="flex items-center justify-between px-2 sm:px-3 py-2 border-b bg-muted/30">
                                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate flex-1">{url}</p>
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
                              return <iframe src={`${url}#toolbar=0&navpanes=0`} className="w-full h-full min-h-[300px] sm:min-h-[520px] rounded border-0" title={selectedDoc.fileName} />
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
                                  <div className="w-full max-h-[300px] sm:max-h-[520px] overflow-auto p-3 sm:p-6 prose prose-sm prose-neutral dark:prose-invert max-w-none prose-table:border-collapse prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-1.5 prose-th:bg-muted/50 prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-1.5">
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
                                <pre className="text-sm whitespace-pre-wrap break-words w-full max-h-[520px] overflow-auto p-4 bg-muted/30 rounded-lg font-mono leading-relaxed">
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
                                return <iframe src={`${officePreviewUrl}#toolbar=0&navpanes=0`} className="w-full h-full min-h-[300px] sm:min-h-[520px] rounded border-0" title={selectedDoc.fileName} />
                              }
                              return (
                                <div className="text-center space-y-3">
                                  <FileText className="h-16 w-16 mx-auto text-muted-foreground/40" />
                                  <p className="text-sm font-medium">{selectedDoc.fileName}</p>
                                  <p className="text-xs text-muted-foreground">無法轉換預覽，請確認伺服器已安裝 LibreOffice 或 Microsoft Office</p>
                                  {(user?.role !== "admin" || isAdminWithWrite) && (
                                    <Button variant="outline" size="sm" asChild>
                                      <a href={url} download><Download className="h-3.5 w-3.5 mr-1.5" />下載檔案</a>
                                    </Button>
                                  )}
                                </div>
                              )
                            }

                            return (
                              <div className="text-center space-y-3">
                                <FileText className="h-16 w-16 mx-auto text-muted-foreground/40" />
                                <p className="text-sm font-medium">{selectedDoc.fileName}</p>
                                {(user?.role !== "admin" || isAdminWithWrite) && (
                                  <Button variant="outline" size="sm" asChild>
                                    <a href={url} download>
                                      <Download className="h-3.5 w-3.5 mr-1.5" />下載檔案
                                    </a>
                                  </Button>
                                )}
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
                      <div className="flex flex-col items-center justify-center min-h-[200px] sm:min-h-[350px] text-muted-foreground">
                        <Eye className="h-10 w-10 sm:h-12 sm:w-12 mb-3 opacity-20" />
                        <p className="text-xs sm:text-sm">請選擇文件以預覽</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Document list */}
              <div className={cn("lg:col-span-2 order-1 lg:order-2 min-w-0", selectedDoc && "hidden lg:block")}>
                <Card>
                  <CardHeader className="px-4 sm:px-6 pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm sm:text-base">階段文件</CardTitle>
                      {effectiveCanManage && (
                        <Button variant="outline" size="sm" id="doc-upload-trigger">
                          <Upload className="h-4 w-4 mr-1.5" />
                          上傳文件
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 sm:px-6">
                    <PhaseDocuments
                      key={`${demand.status}-${docPhaseKey}`}
                      documents={demand.documents}
                      currentPhase={demand.status}
                      demandId={demand.id}
                      canUpload={effectiveCanManage}
                      canDownload={user?.role !== "admin" || isAdminWithWrite}
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

          {/* 簽核紀錄 Tab */}
          <TabsContent value="signoffs" className="mt-3 sm:mt-4">
            <Card>
              <CardHeader className="px-4 sm:px-6 pb-3">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  簽核紀錄
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
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
        </Tabs>

        {/* SP 時程編輯 Dialog */}
        <Dialog open={spPlanDialogOpen} onOpenChange={setSpPlanDialogOpen}>
          <DialogContent className="sm:max-w-4xl w-[calc(100%-1rem)] sm:w-[95vw] p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-orange-600" />
                SP 與時程規劃
              </DialogTitle>
            </DialogHeader>
            <PhasePlanInlineEditor
              phasePlans={demand.phasePlans}
              totalSp={demand.estimatedSp}
              demandId={demand.id}
              token={token}
              staffUsers={staffUsers}
              demandContext={{
                developerId: demand.developer?.id,
                contactPersonId: demand.contactPerson?.id,
                organizationId: demand.organization.id,
                organizationName: demand.organization.name,
              }}
              onSaved={() => { setSpPlanDialogOpen(false); fetchDemand() }}
            />
          </DialogContent>
        </Dialog>
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

      {/* Full-screen document preview */}
      <FullScreenDocumentPreview
        open={!!fullScreenDoc}
        onOpenChange={(open) => { if (!open) setFullScreenDoc(null) }}
        doc={fullScreenDoc}
        watermarkBg={watermarkBg}
      />

      {/* Design change dialog */}
      {canProposeDesignChange && (
        <DesignChangeDialog
          open={designChangeOpen}
          onOpenChange={setDesignChangeOpen}
          demandId={demand.id}
          demandNumber={demand.demandNumber}
          demandTitle={demand.title}
          phaseLabel={STATUS_MAP[demand.status]?.label ?? demand.status}
          targets={[
            ...(demand.contactPerson
              ? [{ userId: demand.contactPerson.id, name: demand.contactPerson.name, role: "REQUESTER" }]
              : []),
            ...(demand.demandManager
              ? [{ userId: demand.demandManager.id, name: demand.demandManager.name, role: "MANAGER" }]
              : []),
          ]}
          token={token}
          onComplete={fetchDemand}
        />
      )}

      {/* Notify signers dialog */}
      <NotifySignersDialog
        open={notifySignersOpen}
        onOpenChange={setNotifySignersOpen}
        demandId={demand.id}
        demandNumber={demand.demandNumber}
        demandTitle={demand.title}
        phaseLabel={STATUS_MAP[demand.status]?.label ?? demand.status}
        pendingSignoffs={currentPhaseSignoffs.filter((s) => s.status === "PENDING")}
        organizationId={demand.organizationId}
        shareUrl={notifyShareUrl}
      />

      {/* Board override dialog */}
      <AlertDialog open={boardOverrideOpen} onOpenChange={(open) => { setBoardOverrideOpen(open); if (!open) { setBoardOverrideComment(""); setBoardOverrideTargetStatus("") } }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">專案 Master 代簽</AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              將通知專案 Master（董事會成員）代為確認{boardOverrideKind === "DESIGN_CHANGE" ? "設計變更" : "階段"}簽核。Master 確認後，其餘待確認簽核將自動略過。請填寫代簽原因。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            rows={3}
            placeholder="請輸入代簽原因（必填）"
            value={boardOverrideComment}
            onChange={(e) => setBoardOverrideComment(e.target.value)}
          />
          {boardOverrideKind === "PHASE" && demand && (() => {
            const curIdx = PIPELINE_STEPS.indexOf(demand.status as typeof PIPELINE_STEPS[number])
            const settlementStatuses = (["DEVELOPING", "ACCEPTANCE", "CLOSED"] as const)
              .filter((s) => PIPELINE_STEPS.indexOf(s) > curIdx)
            if (settlementStatuses.length === 0) return null
            const sp = demand.confirmedSp ?? demand.estimatedSp
            const previewRate = boardOverrideTargetStatus ? (SP_PROGRESS_RATE[boardOverrideTargetStatus] ?? 0) : null
            const previewUsed = previewRate !== null ? Math.round(sp * previewRate) : null
            return (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                  <span className="text-xs sm:text-sm font-medium text-foreground">代簽通過後直接結案</span>
                </div>
                <Select
                  value={boardOverrideTargetStatus || "NONE"}
                  onValueChange={(v) => setBoardOverrideTargetStatus(v === "NONE" ? "" : v)}
                >
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">
                      <span className="text-muted-foreground">維持流程（不直接結算）</span>
                    </SelectItem>
                    {settlementStatuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        <span className="flex items-center gap-2">
                          <Badge className={cn("text-[10px] font-normal", STATUS_MAP[s]?.color)}>
                            {STATUS_MAP[s]?.label ?? s}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            消耗 {Math.round((SP_PROGRESS_RATE[s] ?? 0) * 100)}%
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {previewUsed !== null ? (
                  <div className="rounded-md border border-orange-200 bg-orange-50/70 p-2.5 space-y-1.5">
                    <p className="flex items-center gap-1 text-xs text-orange-900/80">
                      <span>Master 通過後直接結案，依</span>
                      <Badge className={cn("text-[10px] font-normal", STATUS_MAP[boardOverrideTargetStatus]?.color)}>
                        {STATUS_MAP[boardOverrideTargetStatus]?.label}
                      </Badge>
                      <span>比例結算</span>
                    </p>
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="text-orange-900/60">結算 SP</span>
                      <span className="text-orange-900/70">
                        <span className="font-semibold text-orange-900">{Math.round((previewRate as number) * 100)}%</span>
                        {" × "}SP {sp}{" = "}
                        <span className="font-semibold text-sm text-orange-700">{previewUsed} SP</span>
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground leading-relaxed">不選則照原流程推進，僅完成本階段簽核、不直接結算。</p>
                )}
              </div>
            )
          })()}
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={!boardOverrideComment.trim() || boardOverrideSubmitting}
              onClick={(e) => { e.preventDefault(); handleBoardOverride() }}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {boardOverrideSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              發起代簽
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  )
}

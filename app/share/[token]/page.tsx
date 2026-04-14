"use client"

import React, { use, useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
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
  LogIn,
  LogOut,
  Link2,
  ClipboardCheck,
  ShieldAlert,
  Package,
  ChevronsUpDown,
  Check,
  Search,
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command"
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

function formatGherkinInMarkdown(md: string): string {
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
    const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`
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

const PIE_COLORS: Record<string, string> = {
  SUBMITTED: "#3b82f6",
  PRD_REVIEW: "#f59e0b",
  SP_REVIEW: "#ef4444",
  DEVELOPING: "#8b5cf6",
  ACCEPTANCE: "#06b6d4",
  CLOSED: "#10b981",
}

const CONFIDENTIAL_DOC_TYPES = new Set<string>(["GITHUB_REPO"])

interface ShareUser {
  id: string
  email: string
  name: string
  role: string
  subsidiary?: string
  organizationId?: string | null
  isOrgAccount?: boolean
}

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
  contactPerson: { id: string; name: string } | null
  demandManager: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
  organization: { id: string; name: string }
  submitter: { id: string; name: string; email: string }
  creator: { id: string; name: true }
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

function fmtDate(dateStr: string | null) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
}

function fmtDateFull(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

// ━━━━━━━━━━━━ Login Modal ━━━━━━━━━━━━
interface OrgWithUsers {
  id: string
  name: string
  users: { id: string; name: string; email: string }[]
}

function LoginModal({
  open,
  onOpenChange,
  shareToken,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  shareToken: string
  onSuccess: (user: ShareUser, token: string) => void
}) {
  const [organizations, setOrganizations] = useState<OrgWithUsers[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState("")
  const [selectedEmail, setSelectedEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [fetchingUsers, setFetchingUsers] = useState(false)
  const [error, setError] = useState("")
  const [accountOpen, setAccountOpen] = useState(false)

  // Fetch organizations & users when modal opens
  useEffect(() => {
    if (!open) return
    setFetchingUsers(true)
    fetch(`/api/share/${shareToken}/users`)
      .then((r) => r.json())
      .then((data) => {
        if (data.organizations) {
          setOrganizations(data.organizations)
          // Auto-select first org
          if (data.organizations.length > 0) {
            setSelectedOrgId(data.organizations[0].id)
          }
        }
      })
      .catch(() => {})
      .finally(() => setFetchingUsers(false))
  }, [open, shareToken])

  // Users in the selected organization
  const orgUsers = organizations.find((o) => o.id === selectedOrgId)?.users || []

  // Auto-select first account when org changes
  useEffect(() => {
    if (orgUsers.length > 0) {
      setSelectedEmail(orgUsers[0].email)
    } else {
      setSelectedEmail("")
    }
  }, [selectedOrgId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEmail || !password) { setError("請選擇帳號並輸入密碼"); return }
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/share/${shareToken}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: selectedEmail, password }),
      })
      const data = await res.json()
      if (res.ok) {
        onSuccess(data.user, data.token)
        onOpenChange(false)
      } else {
        setError(data.error || "登入失敗")
      }
    } catch {
      setError("網路錯誤")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5" />
            登入以執行操作
          </DialogTitle>
        </DialogHeader>
        {fetchingUsers ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* 公司 */}
          <div className="space-y-2">
            <Label>公司</Label>
            {organizations.length <= 1 ? (
              <div className="flex h-9 items-center rounded-md border border-input bg-muted/50 px-3 text-sm">
                {organizations[0]?.name || "—"}
              </div>
            ) : (
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={selectedOrgId}
                onChange={(e) => { setSelectedOrgId(e.target.value); setError("") }}
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            )}
          </div>
          {/* 帳號 */}
          <div className="space-y-2">
            <Label>帳號</Label>
            {orgUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">此公司尚無可用帳號</p>
            ) : (
              <Popover open={accountOpen} onOpenChange={setAccountOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={accountOpen}
                    className="w-full justify-between font-normal h-9"
                  >
                    <span className="truncate">
                      {selectedEmail
                        ? (() => { const u = orgUsers.find(u => u.email === selectedEmail); return u ? `${u.name}（${u.email}）` : selectedEmail })()
                        : "選擇帳號"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="搜尋姓名或信箱..." />
                    <CommandList>
                      <CommandEmpty>找不到符合的帳號</CommandEmpty>
                      {orgUsers.map((u) => (
                        <CommandItem
                          key={u.id}
                          value={`${u.name} ${u.email}`}
                          onSelect={() => {
                            setSelectedEmail(u.email)
                            setError("")
                            setAccountOpen(false)
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedEmail === u.email ? "opacity-100" : "opacity-0")} />
                          <span>{u.name}（{u.email}）</span>
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>
          {/* 密碼 */}
          <div className="space-y-2">
            <Label htmlFor="share-password">密碼</Label>
            <Input
              id="share-password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError("") }}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading || !selectedEmail}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            登入
          </Button>
        </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ━━━━━━━━━━━━ Main Page ━━━━━━━━━━━━
export default function ShareDemandPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: shareToken } = use(params)

  // Auth state — persisted in localStorage per share token
  const [authUser, setAuthUser] = useState<ShareUser | null>(() => {
    if (typeof window === "undefined") return null
    try {
      const saved = localStorage.getItem(`share_auth_${shareToken}`)
      if (saved) return JSON.parse(saved).user ?? null
    } catch { /* ignore */ }
    return null
  })
  const [authToken, setAuthToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    try {
      const saved = localStorage.getItem(`share_auth_${shareToken}`)
      if (saved) return JSON.parse(saved).token ?? null
    } catch { /* ignore */ }
    return null
  })
  const [loginOpen, setLoginOpen] = useState(false)

  // Demand state
  const [demand, setDemand] = useState<DemandDetail | null>(null)
  const [demandId, setDemandId] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
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

  const isLoggedIn = !!authUser && !!authToken

  const fetchDemand = useCallback(async () => {
    try {
      // If logged in, use authenticated demand API for fresh data (includes internal comments etc.)
      // Otherwise use public share API
      let res: Response
      if (authToken && demandId) {
        res = await fetch(`/api/demands/${demandId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        })
      } else {
        res = await fetch(`/api/share/${shareToken}`)
      }

      if (!res.ok) {
        // If stored token expired, auto-logout and retry with public API
        if (res.status === 401 && authToken) {
          handleLogout()
          return
        }
        const data = await res.json().catch(() => ({}))
        setError(data.error || "載入失敗")
        return
      }
      const data = await res.json()
      setDemand(data.demand)
      if (data.demandId) setDemandId(data.demandId)
      if (data.expiresAt) setExpiresAt(data.expiresAt)
    } catch {
      setError("網路錯誤，無法載入需求資料")
    } finally {
      setLoading(false)
    }
  }, [shareToken, authToken, demandId])

  useEffect(() => {
    fetchDemand()
  }, [fetchDemand])

  const handleLoginSuccess = (user: ShareUser, jwtToken: string) => {
    setAuthUser(user)
    setAuthToken(jwtToken)
    try {
      localStorage.setItem(`share_auth_${shareToken}`, JSON.stringify({ user, token: jwtToken }))
    } catch { /* ignore */ }
  }

  const handleLogout = () => {
    setAuthUser(null)
    setAuthToken(null)
    try {
      localStorage.removeItem(`share_auth_${shareToken}`)
    } catch { /* ignore */ }
  }

  // Document preview effects
  const isConfidential = selectedDoc ? CONFIDENTIAL_DOC_TYPES.has(selectedDoc.type) : false

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

  useEffect(() => {
    if (!selectedDoc?.fileUrl || isConfidential) { setExcelReady(false); return }
    const ext = selectedDoc.fileName.split(".").pop()?.toLowerCase() || ""
    setExcelReady(["xls", "xlsx"].includes(ext))
  }, [selectedDoc, isConfidential])

  useEffect(() => {
    if (!selectedDoc?.fileUrl || isConfidential) { setOfficePreviewUrl(null); return }
    const ext = selectedDoc.fileName.split(".").pop()?.toLowerCase() || ""
    if (!["ppt", "pptx", "doc", "docx"].includes(ext)) { setOfficePreviewUrl(null); return }
    setOfficeLoading(true)
    setOfficePreviewUrl(null)
    const previewUrl = `${selectedDoc.fileUrl}/preview`
    fetch(previewUrl, { method: "HEAD" })
      .then((res) => { if (res.ok) setOfficePreviewUrl(previewUrl) })
      .catch(() => {})
      .finally(() => setOfficeLoading(false))
  }, [selectedDoc, isConfidential])

  const watermarkBg = useMemo(() => {
    const name = authUser?.name || "訪客"
    const text = `${name}\u3000唯讀分享`
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150"><text transform="rotate(-30 150 75)" x="150" y="85" font-size="14" fill="rgba(0,0,0,0.05)" text-anchor="middle" font-family="sans-serif">${text}</text></svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  }, [authUser?.name])

  // Markdown components
  const mdComponents = useMemo(() => ({
    pre({ children }: { children?: React.ReactNode }) {
      if (React.isValidElement(children)) {
        const cp = children.props as { className?: string }
        if (/language-mermaid/.test(cp.className || "")) return <>{children}</>
      }
      return <pre>{children}</pre>
    },
    code({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
      const match = /language-(\w+)/.exec(className || "")
      if (match?.[1] === "mermaid") return <MermaidBlock code={String(children).trim()} />
      return <code className={className} {...props}>{children}</code>
    },
  }), [])

  // ── Loading / Error states ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !demand) {
    const isExpired = error === "分享連結已過期"
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="flex flex-col items-center gap-3 text-center">
          {isExpired ? (
            <AlertTriangle className="h-12 w-12 text-amber-400" />
          ) : (
            <Link2 className="h-12 w-12 text-muted-foreground/40" />
          )}
          <h1 className="text-lg font-semibold">{isExpired ? "連結已過期" : "無法載入"}</h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            {error || "找不到此需求"}
          </p>
        </div>
      </div>
    )
  }

  const statusInfo = STATUS_MAP[demand.status] || { label: demand.status, color: "bg-gray-100 text-gray-700" }
  const sp = demand.confirmedSp ?? demand.estimatedSp
  const isRejected = demand.status === "REJECTED"
  const isClosed = demand.status === "CLOSED"
  const currentStepIdx = PIPELINE_STEPS.indexOf(demand.status as typeof PIPELINE_STEPS[number])
  const phasePlanMap = Object.fromEntries(demand.phasePlans.map((p) => [p.phase, p]))

  // Find pending signoff strictly targeting the current logged-in user
  // Org accounts are read-only and can never sign
  const pendingSignoff = (!authUser?.isOrgAccount && demand.phaseSignoffs?.find(
    (s) => s.status === "PENDING" && s.targetUserId === authUser?.id
  )) || null

  const projectStartDate = demand.phasePlans.reduce<string | null>((earliest, p) => {
    const d = p.plannedStart || p.actualStart
    if (!d) return earliest
    if (!earliest) return d
    return new Date(d) < new Date(earliest) ? d : earliest
  }, null)

  const spPieData = demand.phasePlans
    .filter((p) => p.plannedSp && p.plannedSp > 0)
    .map((p) => ({ name: STATUS_MAP[p.phase]?.label || p.phase, value: p.plannedSp!, phase: p.phase }))

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between py-2.5">
          <div className="flex flex-col">
            <span className="font-bold text-sm leading-snug">JV 需求管理平台</span>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>唯讀分享</span>
              {expiresAt && (
                <>
                  <span>·</span>
                  <span>有效至 {fmtDate(expiresAt)}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <>
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {authUser.name}
                </span>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-1" />
                  登出
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setLoginOpen(true)}>
                <LogIn className="h-4 w-4 mr-1" />
                登入
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ── Login prompt banner (when not logged in) ── */}
      {!isLoggedIn && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
            <LogIn className="h-4.5 w-4.5 text-blue-500 shrink-0" />
            <p className="text-sm text-blue-700 flex-1">
              此為唯讀分享連結。
              <button className="font-medium underline ml-1" onClick={() => setLoginOpen(true)}>
                登入
              </button>
              後可執行簽核操作。
            </p>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Header */}
        <div>
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

        {/* Alert banners */}
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

        {/* Sign-off Banner (only when logged in) */}
        {isLoggedIn && pendingSignoff && (
          <PhaseSignoffBanner
            signoff={pendingSignoff}
            demandId={demand.id}
            token={authToken}
            onComplete={fetchDemand}
          />
        )}

        {/* Tabs */}
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
            <TabsTrigger value="deliverables" className="gap-1.5">
              <Package className="h-3.5 w-3.5" />
              交付成果
              {(() => {
                const devLinks = demand.documents.filter(d => d.type === "APP_RESULT" && d.phase === "DEVELOPING")
                const prdLinks = demand.documents.filter(d => d.type === "APP_RESULT" && d.phase === "PRD_REVIEW")
                const count = devLinks.length > 0 ? devLinks.length : prdLinks.length
                return count > 0 ? (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-0.5">
                    {count}
                  </Badge>
                ) : null
              })()}
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5">
              <Paperclip className="h-3.5 w-3.5" />
              文件
              {demand.documents.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-0.5">
                  {demand.documents.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="signoffs" className="gap-1.5">
              <ClipboardCheck className="h-3.5 w-3.5" />
              簽核紀錄
              {demand.phaseSignoffs?.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-0.5">
                  {demand.phaseSignoffs.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ══════ Tab: 概覽 ══════ */}
          <TabsContent value="overview" className="mt-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-5">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">需求內容</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0">
                    <div>
                      <p className="text-xs font-semibold text-blue-600 mb-1.5">需求說明</p>
                      <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none prose-table:border-collapse prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-1.5 prose-th:bg-muted/50 prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-1.5">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={mdComponents}>
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

              {/* Right sidebar */}
              <div className="space-y-5">
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
                                contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid var(--border)", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
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
                            : plan?.actualStart ? `${fmtDate(plan.actualStart)} 起` : null

                        return (
                          <div key={phase} className={cn("flex items-center gap-3 px-5 py-2.5", isCurrent && "bg-primary/[0.04]")}>
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
                              <span className={cn("text-[11px] shrink-0 hidden xl:inline", isCurrent ? "text-muted-foreground" : "text-muted-foreground/60")}>
                                {dateRange}
                              </span>
                            )}
                            <Badge variant="secondary" className={cn("text-[10px] h-5 px-1.5 rounded shrink-0", isFuture && "opacity-50")}>
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
                    token={authToken}
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
              <div className="lg:col-span-3">
                <Card className="h-full">
                  <CardContent className="p-0 h-full">
                    {selectedDoc ? (
                      <div className="relative min-h-[520px] h-full">
                        <div className="h-full min-h-[520px] flex items-center justify-center p-4 overflow-hidden">
                          {(() => {
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
                            const isExternalLink = (selectedDoc.type === "APP_RESULT") && url?.startsWith("http")

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

                            if (!url) return <p className="text-sm text-muted-foreground">此文件無預覽連結</p>

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

                            if (ext === "pdf") return <iframe src={`${url}#toolbar=0&navpanes=0`} className="w-full h-full min-h-[520px] rounded border-0" title={selectedDoc.fileName} />
                            if (["mp4", "webm"].includes(ext)) return <video src={url} controls className="max-w-full max-h-[480px] rounded" />
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
                              if (textLoading) return <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                              if (ext === "md") {
                                return (
                                  <div className="w-full max-h-[520px] overflow-auto p-6 prose prose-sm prose-neutral dark:prose-invert max-w-none prose-table:border-collapse prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-1.5 prose-th:bg-muted/50 prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-1.5">
                                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={mdComponents}>
                                      {formatGherkinInMarkdown(textContent)}
                                    </ReactMarkdown>
                                  </div>
                                )
                              }
                              return <pre className="text-sm whitespace-pre-wrap break-words w-full max-h-[520px] overflow-auto p-4 bg-muted/30 rounded-lg font-mono leading-relaxed">{textContent}</pre>
                            }
                            if (["xls", "xlsx"].includes(ext) && excelReady) {
                              return <div className="absolute inset-0"><ExcelPreview fileUrl={selectedDoc.fileUrl!} fileName={selectedDoc.fileName} /></div>
                            }
                            if (["ppt", "pptx", "doc", "docx"].includes(ext)) {
                              if (officeLoading) return <div className="flex flex-col items-center gap-3"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /><p className="text-xs text-muted-foreground">正在轉換預覽…</p></div>
                              if (officePreviewUrl) return <iframe src={`${officePreviewUrl}#toolbar=0&navpanes=0`} className="w-full h-full min-h-[520px] rounded border-0" title={selectedDoc.fileName} />
                              return <div className="text-center space-y-3"><FileText className="h-16 w-16 mx-auto text-muted-foreground/40" /><p className="text-sm font-medium">{selectedDoc.fileName}</p><p className="text-xs text-muted-foreground">無法轉換預覽</p></div>
                            }
                            return <div className="text-center space-y-3"><FileText className="h-16 w-16 mx-auto text-muted-foreground/40" /><p className="text-sm font-medium">{selectedDoc.fileName}</p></div>
                          })()}
                        </div>
                        <div className="absolute inset-0 pointer-events-none z-10" style={{ backgroundImage: watermarkBg, backgroundRepeat: "repeat" }} />
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
                      token={authToken}
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
                  demandId={isLoggedIn ? demand.id : undefined}
                  token={authToken}
                  userRole={authUser?.role}
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
      </main>

      {/* Image zoom overlay */}
      {zoomedImg && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center cursor-zoom-out" onClick={() => setZoomedImg(null)}>
          <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white hover:bg-white/20 h-10 w-10" onClick={() => setZoomedImg(null)}>
            <X className="h-6 w-6" />
          </Button>
          <img src={zoomedImg} alt="放大預覽" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Login modal */}
      <LoginModal
        open={loginOpen}
        onOpenChange={setLoginOpen}
        shareToken={shareToken}
        onSuccess={handleLoginSuccess}
      />
    </div>
  )
}

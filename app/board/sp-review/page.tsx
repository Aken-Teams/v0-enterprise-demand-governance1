"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useAuth } from "@/hooks/use-auth"
import { STATUS_MAP, SP_PROGRESS_RATE, settlementTierLabel } from "@/lib/constants/demand"
import Link from "next/link"
import {
  Building2, Coins, Loader2, Eye, Check, X, ExternalLink,
  FileIcon, Download, MessageSquare, CheckCircle2, Inbox,
  AlertTriangle, Paperclip, Trash2, ShieldCheck, FileEdit, CircleDollarSign,
} from "lucide-react"

interface SignoffDoc {
  id: string
  fileName: string
  fileUrl: string | null
  fileSize: number | null
}

interface SpReviewItem {
  signoff: {
    id: string
    phase: string
    status: string
    targetRole?: string | null
    requestComment: string | null
    overrideTargetStatus?: string | null
    requestedAt: string
    requestedBy: { id: string; name: string }
    documents: SignoffDoc[]
  }
  demand: {
    id: string
    demandNumber: string
    title: string
    status: string
    estimatedSp: number
    confirmedSp: number | null
    organization: { id: string; name: string }
    submitter: { id: string; name: string }
    contactPerson: { id: string; name: string } | null
    developer: { id: string; name: string } | null
  }
}

interface DesignChangeSp {
  reviewId: string
  revisionId: string
  dcId: string
  seq: number
  dcTitle: string
  version: number
  /** "GATE"(設計變更確認) | "CONTENT"(逐條確認) */
  stage: string
  affectsSp: boolean
  spCurrent: number | null
  spDelta: number | null
  spNote: string | null
  summary: string
  demand: { id: string; demandNumber: string; title: string; organization: { id: string; name: string } | null }
}

/** 結案時的 SP 調整，需 Scrum Master 同意後才真正結案 */
interface ClosingSpItem {
  signoffId: string
  requestedAt: string
  requestedBy: { id: string; name: string } | null
  oldSp: number
  newSp: number | null
  reason: string | null
  designChanges: { id: string; seq: number; title: string }[]
  demand: { id: string; demandNumber: string; title: string; status: string; organization: { id: string; name: string } | null }
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function DesignChangeSpCard({ dc, token, onComplete }: {
  dc: DesignChangeSp
  token: string | null
  onComplete: () => void
}) {
  const after = (dc.spCurrent ?? 0) + (dc.spDelta ?? 0)
  const isGate = dc.stage === "GATE"

  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState("")
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectReason, setRejectReason] = useState("")

  // 設計變更確認只裁決准不准開，無需逐條勾選，故可直接於此送出
  const handleAction = async (decision: "APPROVED" | "REJECTED") => {
    if (decision === "REJECTED" && !rejectReason.trim()) {
      setActionError("駁回時必須填寫原因")
      return
    }
    if (!token) return
    setActionLoading(true)
    setActionError("")
    try {
      const fd = new FormData()
      fd.append("revisionId", dc.revisionId)
      fd.append("decision", decision)
      if (decision === "REJECTED") fd.append("comment", rejectReason.trim())
      fd.append("items", "[]")
      const res = await fetch(`/api/demands/${dc.demand.id}/design-changes/${dc.dcId}/reviews`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (res.ok) {
        setShowRejectDialog(false)
        onComplete()
      } else {
        const data = await res.json().catch(() => ({}))
        setActionError(data.error || "操作失敗")
      }
    } catch {
      setActionError("網路錯誤")
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <>
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-3 sm:p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-mono text-muted-foreground">{dc.demand.demandNumber} · DC-{String(dc.seq).padStart(2, "0")}</span>
          <Badge className="bg-amber-100 text-amber-700 gap-1 shrink-0 text-[10px] sm:text-xs">
            <ShieldCheck className="h-3 w-3" />{isGate ? "設計變更確認" : "逐條確認"}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className="text-[10px] sm:text-xs gap-1"><Building2 className="h-3 w-3" />{dc.demand.organization?.name}</Badge>
          <Badge className="text-[10px] sm:text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 gap-0.5"><FileEdit className="h-3 w-3" />設計變更</Badge>
          {dc.affectsSp && (
            <Badge className="bg-violet-100 text-violet-700 gap-1 text-[10px] sm:text-xs"><CircleDollarSign className="h-3 w-3" />影響 SP</Badge>
          )}
        </div>
        <p className="font-semibold leading-snug text-sm sm:text-base">{dc.demand.title}</p>
        <p className="text-xs text-muted-foreground">變更：{dc.dcTitle}（v{dc.version}）</p>
        {dc.summary && (
          <p className="text-xs text-muted-foreground/90 line-clamp-3 whitespace-pre-line">{dc.summary}</p>
        )}

        {/* SP 影響（僅在該版本確實會動到 SP 時顯示） */}
        {dc.affectsSp && (
          <div className="rounded-md border border-violet-200 bg-violet-50 px-2.5 py-2 text-xs text-violet-900">
            <div className="flex items-center gap-1.5 flex-wrap">
              <CircleDollarSign className="h-3.5 w-3.5 shrink-0 text-violet-600" />
              <span className="font-medium">SP 影響</span>
              <span>目前 <strong>{dc.spCurrent}</strong> → 調整後 <strong>{after}</strong></span>
              <Badge className={`text-[10px] ${(dc.spDelta ?? 0) > 0 ? "bg-emerald-100 text-emerald-700" : (dc.spDelta ?? 0) < 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                {(dc.spDelta ?? 0) > 0 ? `上調 +${dc.spDelta}` : (dc.spDelta ?? 0) < 0 ? `下降 ${dc.spDelta}` : "±0"} SP
              </Badge>
            </div>
            {dc.spNote && <p className="mt-1 text-violet-700/80 whitespace-pre-line">{dc.spNote}</p>}
          </div>
        )}

        {actionError && (
          <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />{actionError}</p>
        )}

        <hr className="border-border/60" />
        {isGate ? (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Button size="sm" variant="ghost" className="text-muted-foreground justify-start h-8 sm:h-9" asChild>
              <Link href={`/governance/demands/${dc.demand.id}?tab=design-changes`}>
                <Eye className="h-3.5 w-3.5 mr-1" />
                查看詳情
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 sm:h-9 flex-1 sm:flex-none"
                onClick={() => handleAction("APPROVED")}
                disabled={actionLoading}
              >
                {actionLoading && !showRejectDialog ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                同意開立
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50 h-10 sm:h-9 flex-1 sm:flex-none"
                onClick={() => setShowRejectDialog(true)}
                disabled={actionLoading}
              >
                <X className="h-4 w-4 mr-1" />
                駁回
              </Button>
            </div>
          </div>
        ) : (
          // 逐條確認需逐項標記 checklist，仍須進專案詳情
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">需逐項確認變更內容</span>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white h-9" asChild>
              <Link href={`/governance/demands/${dc.demand.id}?tab=design-changes`}>
                <ExternalLink className="h-3.5 w-3.5 mr-1" />前往審核
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>

    <Dialog open={showRejectDialog} onOpenChange={(o) => { if (!actionLoading && !o) { setShowRejectDialog(false); setRejectReason(""); setActionError("") } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>駁回設計變更</DialogTitle>
          <DialogDescription>
            駁回後此設計變更即中止，不會進入逐條確認。開發端可修訂後重新提出新版本。
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="請說明駁回原因…"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={4}
        />
        {actionError && <p className="text-xs text-red-600">{actionError}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={actionLoading} onClick={() => { setShowRejectDialog(false); setRejectReason(""); setActionError("") }}>取消</Button>
          <Button variant="destructive" disabled={actionLoading} onClick={() => handleAction("REJECTED")}>
            {actionLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <X className="h-4 w-4 mr-1" />}
            確認駁回
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

/** 結案 SP 調整卡片：可直接在此通過／退回，不必進專案詳情 */
function ClosingSpCard({ item, token, onComplete }: {
  item: ClosingSpItem
  token: string | null
  onComplete: () => void
}) {
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState("")
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectReason, setRejectReason] = useState("")

  const delta = item.newSp != null ? item.newSp - item.oldSp : 0

  const handleAction = async (action: "approve" | "reject") => {
    if (action === "reject" && !rejectReason.trim()) {
      setActionError("退回時必須填寫原因")
      return
    }
    if (!token) return
    setActionLoading(true)
    setActionError("")
    try {
      const formData = new FormData()
      formData.append("action", action)
      if (action === "reject") formData.append("comment", rejectReason.trim())
      const res = await fetch(`/api/demands/${item.demand.id}/signoffs/${item.signoffId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (res.ok) {
        setShowRejectDialog(false)
        onComplete()
      } else {
        const data = await res.json().catch(() => ({}))
        setActionError(data.error || "操作失敗")
      }
    } catch {
      setActionError("網路錯誤")
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-3 sm:p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono text-muted-foreground">{item.demand.demandNumber}</span>
            <Badge className="bg-orange-100 text-orange-700 gap-1 shrink-0 text-[10px] sm:text-xs">
              <CircleDollarSign className="h-3 w-3" />結案 SP 調整
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className="text-[10px] sm:text-xs gap-1"><Building2 className="h-3 w-3" />{item.demand.organization?.name}</Badge>
            <Badge variant="outline" className="text-[10px] sm:text-xs">{STATUS_MAP[item.demand.status]?.label ?? item.demand.status}</Badge>
          </div>
          <p className="font-semibold leading-snug text-sm sm:text-base">{item.demand.title}</p>

          {/* SP 調整 */}
          <div className="rounded-md border border-orange-200 bg-orange-50 px-2.5 py-2 text-xs text-orange-900">
            <div className="flex items-center gap-1.5 flex-wrap">
              <CircleDollarSign className="h-3.5 w-3.5 shrink-0 text-orange-600" />
              <span className="font-medium">結案 SP</span>
              <span>目前 <strong>{item.oldSp}</strong> → 結算 <strong>{item.newSp ?? "—"}</strong></span>
              <Badge className={`text-[10px] ${delta > 0 ? "bg-emerald-100 text-emerald-700" : delta < 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                {delta > 0 ? `上調 +${delta}` : delta < 0 ? `下降 ${delta}` : "±0"} SP
              </Badge>
            </div>
            {item.reason && <p className="mt-1 text-orange-700/80 whitespace-pre-line">原因：{item.reason}</p>}
          </div>

          {/* 造成調整的設計變更（皆已經您簽核通過） */}
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">關聯設計變更</p>
            {item.designChanges.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {item.designChanges.map((d) => (
                  <span key={d.id} className="text-[11px] rounded border px-1.5 py-0.5 bg-muted/40">
                    DC-{String(d.seq).padStart(2, "0")} {d.title}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground/80">無（以調整原因說明）</p>
            )}
          </div>

          {actionError && (
            <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />{actionError}</p>
          )}

          <hr className="border-border/60" />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Button size="sm" variant="ghost" className="text-muted-foreground justify-start h-8 sm:h-9" asChild>
              <Link href={`/governance/demands/${item.demand.id}?tab=signoffs`}>
                <Eye className="h-3.5 w-3.5 mr-1" />
                查看詳情
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 sm:h-9 flex-1 sm:flex-none"
                onClick={() => handleAction("approve")}
                disabled={actionLoading}
              >
                {actionLoading && !showRejectDialog ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                同意並結案
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50 h-10 sm:h-9 flex-1 sm:flex-none"
                onClick={() => setShowRejectDialog(true)}
                disabled={actionLoading}
              >
                <X className="h-4 w-4 mr-1" />
                退回修改
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showRejectDialog} onOpenChange={(o) => { if (!actionLoading && !o) { setShowRejectDialog(false); setRejectReason(""); setActionError("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>退回結案 SP 調整</DialogTitle>
            <DialogDescription>
              退回後此需求不會結案，維持原狀態，管理者可修正後重新送審。
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="請說明退回原因…"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
          />
          {actionError && <p className="text-xs text-red-600">{actionError}</p>}
          <DialogFooter>
            <Button variant="outline" disabled={actionLoading} onClick={() => { setShowRejectDialog(false); setRejectReason(""); setActionError("") }}>取消</Button>
            <Button variant="destructive" disabled={actionLoading} onClick={() => handleAction("reject")}>
              {actionLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <X className="h-4 w-4 mr-1" />}
              確認退回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

function SpReviewCard({ item, token, onComplete }: {
  item: SpReviewItem
  token: string | null
  onComplete: () => void
}) {
  const sp = item.demand.confirmedSp ?? item.demand.estimatedSp
  const docs = item.signoff.documents?.filter((d) => d.fileUrl) || []
  const hasDetail = !!item.signoff.requestComment || docs.length > 0
  const isSettlement = item.signoff.targetRole === "BOARD_OVERRIDE" && !!item.signoff.overrideTargetStatus
  const approveLabel = isSettlement ? "確認結算" : "確認通過"
  const rejectLabel = isSettlement ? "需求繼續" : "退回修改"
  // 結算：依所選階段比例算出最終收取的 SP
  const settlementRate = item.signoff.overrideTargetStatus ? (SP_PROGRESS_RATE[item.signoff.overrideTargetStatus] ?? 0) : 0
  const settlementPct = Math.round(settlementRate * 100)
  const settledSp = Math.round(sp * settlementRate)

  // ── Action state ──
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState("")
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [rejectFiles, setRejectFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAction = async (action: "approve" | "reject") => {
    if (action === "reject" && !rejectReason.trim()) {
      setActionError("退回時必須填寫原因")
      return
    }
    if (!token) return
    setActionLoading(true)
    setActionError("")
    try {
      const formData = new FormData()
      formData.append("action", action)
      if (action === "reject" && rejectReason.trim()) formData.append("comment", rejectReason.trim())
      if (action === "reject") rejectFiles.forEach((f) => formData.append("files", f))

      const res = await fetch(`/api/demands/${item.demand.id}/signoffs/${item.signoff.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (res.ok) {
        setShowRejectDialog(false)
        setShowDetailDialog(false)
        onComplete()
      } else {
        const data = await res.json().catch(() => ({}))
        setActionError(data.error || "操作失敗")
      }
    } catch {
      setActionError("網路錯誤")
    } finally {
      setActionLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files)
      const oversized = selected.filter((f) => f.size > MAX_FILE_SIZE)
      if (oversized.length > 0) setActionError(`檔案「${oversized[0].name}」超過 10MB 限制`)
      setRejectFiles((prev) => [...prev, ...selected.filter((f) => f.size <= MAX_FILE_SIZE)])
      e.target.value = ""
    }
  }

  const closeRejectDialog = () => {
    if (actionLoading) return
    setShowRejectDialog(false)
    setRejectReason("")
    setRejectFiles([])
    setActionError("")
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-3 sm:p-4 space-y-2.5 sm:space-y-3">
        {/* Header row: demand number + SP */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-mono text-muted-foreground">{item.demand.demandNumber}</span>
          <Badge className="bg-orange-100 text-orange-700 gap-1 shrink-0 text-[10px] sm:text-xs">
            <Coins className="h-3 w-3" />
            {sp} SP
          </Badge>
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className="text-[10px] sm:text-xs gap-1">
            <Building2 className="h-3 w-3" />
            {item.demand.organization.name}
          </Badge>
          <Badge className={`text-[10px] sm:text-xs ${STATUS_MAP[item.signoff.phase]?.color || "bg-gray-100 text-gray-700"}`}>
            {STATUS_MAP[item.signoff.phase]?.label || item.signoff.phase}
          </Badge>
          {item.signoff.targetRole === "BOARD_OVERRIDE" && (
            <Badge className={`text-[10px] sm:text-xs gap-0.5 border ${isSettlement ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-orange-50 text-orange-600 border-orange-200"}`}>
              <ShieldCheck className="h-3 w-3" />
              {isSettlement ? "結算結案" : "代簽"}
            </Badge>
          )}
        </div>

        {/* Title */}
        <p className="font-semibold leading-snug text-sm sm:text-base">{item.demand.title}</p>

        {/* Meta info */}
        <div className="text-[11px] sm:text-xs text-muted-foreground space-y-0.5 sm:space-y-0 sm:flex sm:items-center sm:gap-2 sm:flex-wrap">
          <span>發起：{item.signoff.requestedBy.name} · {new Date(item.signoff.requestedAt).toLocaleDateString("zh-TW")}</span>
          <span className="hidden sm:inline">·</span>
          <span>需求窗口：{item.demand.contactPerson?.name || item.demand.submitter.name}</span>
          {item.demand.developer && (
            <>
              <span className="hidden sm:inline">·</span>
              <span>開發：{item.demand.developer.name}</span>
            </>
          )}
        </div>

        {/* Override info banner */}
        {item.signoff.targetRole === "BOARD_OVERRIDE" && (
          <div className="rounded-lg bg-orange-50 border border-orange-200 p-2.5 sm:p-3 space-y-1">
            <div className="flex items-start gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
              <div className="space-y-1 min-w-0">
                <span className="text-xs font-medium text-orange-700">
                  {item.signoff.overrideTargetStatus ? "提前結算並結案" : "代為確認（不結案）"}
                </span>
                {item.signoff.overrideTargetStatus ? (
                  <>
                    <p className="text-[11px] sm:text-xs text-orange-600/80 leading-relaxed">
                      管理者決定終止此需求並直接結案，結算落點為「{settlementTierLabel(item.signoff.overrideTargetStatus)}」，按 {settlementPct}% 計算。
                    </p>
                    <div className="mt-1 flex items-baseline gap-1.5 rounded-md bg-orange-100/70 px-2 py-1 text-xs">
                      <span className="text-orange-700/70">最終收取</span>
                      <span className="font-semibold text-orange-800">{settledSp} SP</span>
                      <span className="text-orange-600/60">（原估 {sp} SP × {settlementPct}%）</span>
                    </div>
                  </>
                ) : (
                  <p className="text-[11px] sm:text-xs text-orange-600/80 leading-relaxed">
                    需求方目前無法簽核，管理者申請由您代為確認，通過後<span className="font-medium">維持原流程繼續進行</span>（不結案、SP 不變）。
                  </p>
                )}
                {item.signoff.requestComment && (
                  <p className="text-[11px] sm:text-xs text-orange-600/70">原因：{item.signoff.requestComment}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <hr className="border-border/60" />

        {/* Action row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground justify-start h-8 sm:h-9"
            onClick={() => setShowDetailDialog(true)}
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            查看詳情
          </Button>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 sm:h-9 flex-1 sm:flex-none"
              onClick={() => handleAction("approve")}
              disabled={actionLoading}
            >
              {actionLoading && !showRejectDialog ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
              {approveLabel}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={isSettlement ? "border-blue-300 text-blue-600 hover:bg-blue-50 h-10 sm:h-9 flex-1 sm:flex-none" : "border-red-300 text-red-600 hover:bg-red-50 h-10 sm:h-9 flex-1 sm:flex-none"}
              onClick={() => setShowRejectDialog(true)}
              disabled={actionLoading}
            >
              <X className="h-4 w-4 mr-1" />
              {rejectLabel}
            </Button>
          </div>
        </div>

        {actionError && !showRejectDialog && <p className="text-xs text-red-600">{actionError}</p>}

        {/* ── Detail Dialog ── */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto w-[calc(100%-2rem)]">
            <DialogHeader>
              <DialogTitle className="text-base leading-snug">{item.demand.title}</DialogTitle>
              <DialogDescription asChild>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {item.demand.organization.name}
                  </span>
                  <span>{item.demand.demandNumber}</span>
                  <span>·</span>
                  <span>{sp} SP</span>
                  <Badge className={`text-[10px] ${STATUS_MAP[item.signoff.phase]?.color || "bg-gray-100 text-gray-700"}`}>
                    {STATUS_MAP[item.signoff.phase]?.label || item.signoff.phase}
                  </Badge>
                </div>
              </DialogDescription>
              {/* Meta — directly under header */}
              <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                <span>發起：{item.signoff.requestedBy.name}</span>
                <span>·</span>
                <span>{new Date(item.signoff.requestedAt).toLocaleDateString("zh-TW")}</span>
                <span>·</span>
                <span>需求窗口：{item.demand.contactPerson?.name || item.demand.submitter.name}</span>
                {item.demand.developer && (
                  <>
                    <span>·</span>
                    <span>開發：{item.demand.developer.name}</span>
                  </>
                )}
              </div>
            </DialogHeader>

            <div className="space-y-4">
              {/* Override info (with reason merged) */}
              {item.signoff.targetRole === "BOARD_OVERRIDE" && (
                <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium text-orange-700">
                      {item.signoff.overrideTargetStatus ? "提前結算並結案審核" : "代簽審核（不結案）"}
                    </span>
                  </div>
                  {item.signoff.overrideTargetStatus ? (
                    <>
                      <p className="text-sm text-orange-600/80 leading-relaxed">
                        管理者已決定終止此需求並<span className="font-medium text-orange-700">直接結案</span>，結算落點為「{settlementTierLabel(item.signoff.overrideTargetStatus)}」，按 <span className="font-semibold text-orange-700">{settlementPct}%</span> 計算。通過後專案即結束、不可重啟。請確認是否同意此結算方案。
                      </p>
                      <div className="flex items-baseline gap-2 rounded-md bg-orange-100/70 px-3 py-2 text-sm">
                        <span className="text-orange-700/70">最終收取</span>
                        <span className="text-base font-semibold text-orange-800">{settledSp} SP</span>
                        <span className="text-xs text-orange-600/60">原估 {sp} SP × {settlementPct}%</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-orange-600/80 leading-relaxed">
                      需求方目前無法簽核，管理者申請由您代為確認，通過後<span className="font-medium">維持原流程繼續進行</span>（不結案、SP 不變）。
                    </p>
                  )}
                  {item.signoff.requestComment && (
                    <div className="border-t border-orange-200 pt-2 mt-1">
                      <p className="text-xs text-orange-500 font-medium mb-0.5">代簽原因</p>
                      <p className="text-sm text-orange-700/80 whitespace-pre-line leading-relaxed">{item.signoff.requestComment}</p>
                    </div>
                  )}
                </div>
              )}

              {/* 提出說明 (non-override only) */}
              {item.signoff.targetRole !== "BOARD_OVERRIDE" && item.signoff.requestComment && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-xs font-medium text-blue-600">提出說明</span>
                  </div>
                  <p className="text-sm text-blue-700/80 whitespace-pre-line leading-relaxed">{item.signoff.requestComment}</p>
                </div>
              )}

              {/* 附件文件 */}
              {docs.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">附件文件</span>
                  </div>
                  {docs.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.fileUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-md bg-muted/30 border border-border/40 px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                    >
                      <FileIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1">{doc.fileName}</span>
                      {doc.fileSize && (
                        <span className="text-[10px] text-muted-foreground shrink-0">{formatFileSize(doc.fileSize)}</span>
                      )}
                      <Download className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                    </a>
                  ))}
                </div>
              )}

              {!hasDetail && item.signoff.targetRole !== "BOARD_OVERRIDE" && (
                <p className="text-sm text-muted-foreground text-center py-4">此需求無額外說明或附件</p>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 sm:h-9 flex-1 sm:flex-none"
                  onClick={() => handleAction("approve")}
                  disabled={actionLoading}
                >
                  {actionLoading && !showRejectDialog ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                  {approveLabel}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={isSettlement ? "border-blue-300 text-blue-600 hover:bg-blue-50 h-10 sm:h-9 flex-1 sm:flex-none" : "border-red-300 text-red-600 hover:bg-red-50 h-10 sm:h-9 flex-1 sm:flex-none"}
                  onClick={() => { setShowDetailDialog(false); setShowRejectDialog(true) }}
                  disabled={actionLoading}
                >
                  <X className="h-4 w-4 mr-1" />
                  {rejectLabel}
                </Button>
              </div>
              <Button variant="outline" size="sm" className="h-10 sm:h-9 w-full sm:w-auto" asChild>
                <Link href={`/governance/demands/${item.demand.id}`}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  前往需求頁面
                </Link>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Reject Dialog ── */}
        <Dialog open={showRejectDialog} onOpenChange={(open) => { if (!open) closeRejectDialog() }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className={`flex items-center gap-2 ${isSettlement ? "text-blue-700" : "text-red-700"}`}>
                <AlertTriangle className="h-5 w-5" />
                {isSettlement ? "需求繼續" : "退回修改"}
              </DialogTitle>
              <DialogDescription>
                {isSettlement
                  ? `不同意結算「${item.demand.title}」，需求將維持原流程繼續進行。`
                  : `退回「${item.demand.title}」的開案申請，發起者將收到通知並進行修改。`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  {isSettlement ? "繼續原因" : "退回原因"} <span className="text-red-500">*</span>
                </label>
                <Textarea
                  placeholder={isSettlement ? "請說明需求繼續的原因（必填）..." : "請說明退回原因（必填）..."}
                  value={rejectReason}
                  onChange={(e) => { setRejectReason(e.target.value); setActionError("") }}
                  rows={4}
                  className="text-sm resize-none"
                  autoFocus
                />
              </div>

              {/* File attachment */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.md,.txt,.jpg,.jpeg,.png,.gif,.webp"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-muted-foreground h-9 w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={actionLoading}
                >
                  <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                  附加檔案
                </Button>
              </div>

              {/* Selected files list */}
              {rejectFiles.length > 0 && (
                <div className="space-y-1.5">
                  {rejectFiles.map((f, i) => (
                    <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md bg-muted/50 border px-2.5 py-1.5 text-xs">
                      <FileIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1">{f.name}</span>
                      <span className="text-muted-foreground shrink-0">{formatFileSize(f.size)}</span>
                      <button
                        type="button"
                        className="text-red-400 hover:text-red-600 shrink-0"
                        onClick={() => setRejectFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {actionError && <p className="text-sm text-red-600">{actionError}</p>}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeRejectDialog} disabled={actionLoading}>
                取消
              </Button>
              <Button
                variant={isSettlement ? "default" : "destructive"}
                className={isSettlement ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}
                onClick={() => handleAction("reject")}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <X className="h-4 w-4 mr-1.5" />}
                {isSettlement ? "確認繼續" : "確認退回"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

export default function SpReviewPage() {
  const { token } = useAuth()
  const [items, setItems] = useState<SpReviewItem[]>([])
  const [designChanges, setDesignChanges] = useState<DesignChangeSp[]>([])
  const [closingSp, setClosingSp] = useState<ClosingSpItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchItems = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch("/api/board/sp-review", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) { setItems(data.items || []); setDesignChanges(data.designChanges || []); setClosingSp(data.closingSp || []) }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const handleComplete = (signoffId: string) => {
    setItems((prev) => prev.filter((item) => item.signoff.id !== signoffId))
  }

  const handleClosingComplete = (signoffId: string) => {
    setClosingSp((prev) => prev.filter((c) => c.signoffId !== signoffId))
  }

  const handleDcComplete = (reviewId: string) => {
    setDesignChanges((prev) => prev.filter((d) => d.reviewId !== reviewId))
  }

  const total = items.length + designChanges.length + closingSp.length

  return (
    <AppLayout userRole="viewer">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">開案審核</h1>
            {!loading && total > 0 && (
              <Badge className="bg-amber-100 text-amber-700 text-sm">{total} 件待審</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">審核待開案需求、Scrum Master 代簽、設計變更，以及結案時的 SP 調整</p>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="sp-review" className="w-full">
            <TabsList>
              <TabsTrigger value="sp-review" className="gap-1.5">
                <Coins className="h-3.5 w-3.5" />開案審核
                {items.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{items.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="design-changes" className="gap-1.5">
                <FileEdit className="h-3.5 w-3.5" />設計變更
                {designChanges.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-indigo-100 text-indigo-700">{designChanges.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="closing-sp" className="gap-1.5">
                <CircleDollarSign className="h-3.5 w-3.5" />結案 SP 調整
                {closingSp.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-orange-100 text-orange-700">{closingSp.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sp-review" className="mt-4">
              {items.length === 0 ? (
                <Card><CardContent className="flex flex-col items-center justify-center py-20">
                  <CheckCircle2 className="h-12 w-12 text-emerald-300 mb-4" />
                  <p className="text-muted-foreground font-medium">目前沒有待審核的開案需求</p>
                  <Button variant="outline" size="sm" className="mt-4" asChild>
                    <Link href="/governance/inbox"><Inbox className="h-3.5 w-3.5 mr-1.5" />前往需求列表</Link>
                  </Button>
                </CardContent></Card>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {items.map((item) => (
                    <SpReviewCard key={item.signoff.id} item={item} token={token} onComplete={() => handleComplete(item.signoff.id)} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="closing-sp" className="mt-4">
              {closingSp.length === 0 ? (
                <Card>
                  <CardContent className="py-12 sm:py-16 text-center">
                    <CheckCircle2 className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-3 sm:mb-4 text-emerald-500/60" />
                    <p className="text-muted-foreground font-medium">目前沒有待審核的結案 SP 調整</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                  {closingSp.map((c) => (
                    <ClosingSpCard key={c.signoffId} item={c} token={token} onComplete={() => handleClosingComplete(c.signoffId)} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="design-changes" className="mt-4">
              {designChanges.length === 0 ? (
                <Card><CardContent className="flex flex-col items-center justify-center py-20">
                  <CheckCircle2 className="h-12 w-12 text-emerald-300 mb-4" />
                  <p className="text-muted-foreground font-medium">目前沒有待審核的設計變更</p>
                </CardContent></Card>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {designChanges.map((dc) => (
                    <DesignChangeSpCard key={dc.reviewId} dc={dc} token={token} onComplete={() => handleDcComplete(dc.reviewId)} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  )
}

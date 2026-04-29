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
import { useAuth } from "@/hooks/use-auth"
import { STATUS_MAP } from "@/lib/constants/demand"
import Link from "next/link"
import {
  Building2, Coins, Loader2, Eye, Check, X, ExternalLink,
  FileIcon, Download, MessageSquare, CheckCircle2, Inbox,
  AlertTriangle, Paperclip, Trash2, ShieldCheck,
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

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
      <CardContent className="p-4 space-y-3">
        {/* Header: demand number + org + phase + SP */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-xs font-mono text-muted-foreground shrink-0">{item.demand.demandNumber}</span>
            <Badge variant="outline" className="text-[10px] sm:text-xs gap-1 shrink-0">
              <Building2 className="h-3 w-3" />
              {item.demand.organization.name}
            </Badge>
            <Badge className={`text-[10px] sm:text-xs shrink-0 ${STATUS_MAP[item.signoff.phase]?.color || "bg-gray-100 text-gray-700"}`}>
              {STATUS_MAP[item.signoff.phase]?.label || item.signoff.phase}
            </Badge>
            {item.signoff.targetRole === "BOARD_OVERRIDE" && (
              <Badge className="text-[10px] sm:text-xs bg-orange-50 text-orange-600 border border-orange-200 gap-0.5 shrink-0">
                <ShieldCheck className="h-3 w-3" />
                代簽
              </Badge>
            )}
          </div>
          <Badge className="bg-orange-100 text-orange-700 gap-1 shrink-0">
            <Coins className="h-3 w-3" />
            {sp} SP
          </Badge>
        </div>

        {/* Title */}
        <p className="font-semibold leading-snug">{item.demand.title}</p>

        {/* Meta info */}
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

        <hr className="border-border/60" />

        {/* Action row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground justify-start"
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
              確認通過
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
              {/* 提出說明 */}
              {item.signoff.requestComment && (
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

              {!hasDetail && (
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
                  確認通過
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50 h-10 sm:h-9 flex-1 sm:flex-none"
                  onClick={() => { setShowDetailDialog(false); setShowRejectDialog(true) }}
                  disabled={actionLoading}
                >
                  <X className="h-4 w-4 mr-1" />
                  退回修改
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
              <DialogTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                退回修改
              </DialogTitle>
              <DialogDescription>
                退回「{item.demand.title}」的開案申請，發起者將收到通知並進行修改。
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  退回原因 <span className="text-red-500">*</span>
                </label>
                <Textarea
                  placeholder="請說明退回原因（必填）..."
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
                variant="destructive"
                onClick={() => handleAction("reject")}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <X className="h-4 w-4 mr-1.5" />}
                確認退回
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
  const [loading, setLoading] = useState(true)

  const fetchItems = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch("/api/board/sp-review", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) setItems(data.items || [])
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

  return (
    <AppLayout userRole="viewer">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">開案審核</h1>
            {!loading && items.length > 0 && (
              <Badge className="bg-amber-100 text-amber-700 text-sm">{items.length} 件待審</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">審核待開案需求與專案 Master 代簽請求</p>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20">
              <CheckCircle2 className="h-12 w-12 text-emerald-300 mb-4" />
              <p className="text-muted-foreground font-medium">目前沒有待審核的開案需求</p>
              <p className="text-xs text-muted-foreground mt-1">所有開案申請已處理完畢</p>
              <Button variant="outline" size="sm" className="mt-4" asChild>
                <Link href="/governance/inbox">
                  <Inbox className="h-3.5 w-3.5 mr-1.5" />
                  前往需求列表
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {items.map((item) => (
              <SpReviewCard
                key={item.signoff.id}
                item={item}
                token={token}
                onComplete={() => handleComplete(item.signoff.id)}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

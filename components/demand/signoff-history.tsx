"use client"

import React, { useState, useMemo, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { STATUS_MAP, SIGNOFF_STATUS_MAP, SIGNOFF_REQUIRED_PHASES } from "@/lib/constants/demand"
import { cn } from "@/lib/utils"
import {
  Check, Clock, X, SkipForward, FileIcon, Download, Filter,
  Paperclip, Trash2, Loader2, Pencil, MessageSquare, Coins,
  ChevronDown, User, Users,
} from "lucide-react"

interface SignoffDocument {
  id: string
  fileName: string
  fileUrl: string | null
  fileSize: number | null
}

interface SignoffRecord {
  id: string
  phase: string
  status: string
  targetUserId: string | null
  targetUser: { id: string; name: string } | null
  targetRole: string | null
  comment: string | null
  requestComment?: string | null
  requestedAt: string
  respondedAt: string | null
  requestedBy: { id: string; name: string }
  respondedBy: { id: string; name: string } | null
  documents?: SignoffDocument[]
}

const TARGET_ROLE_LABELS: Record<string, string> = {
  REQUESTER: "需求窗口",
  MANAGER: "需求主管",
  BOARD: "董事會",
}

interface SpAdjustment {
  oldSp: number
  newSp: number
  reason?: string
}

interface SignoffHistoryProps {
  signoffs: SignoffRecord[]
  demandId?: string
  token?: string | null
  userRole?: string
  onRefresh?: () => void
  spAdjustment?: SpAdjustment | null
}

const STATUS_ICONS: Record<string, typeof Check> = {
  PENDING: Clock,
  APPROVED: Check,
  REJECTED: X,
  SKIPPED: SkipForward,
}

const STATUS_ICON_COLORS: Record<string, string> = {
  PENDING: "text-amber-500",
  APPROVED: "text-emerald-500",
  REJECTED: "text-red-500",
  SKIPPED: "text-gray-400",
}

const STATUS_BG: Record<string, string> = {
  PENDING: "bg-amber-50 border-amber-200",
  APPROVED: "bg-emerald-50 border-emerald-200",
  REJECTED: "bg-red-50 border-red-200",
  SKIPPED: "bg-gray-50 border-gray-200",
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// --- Grouping logic ---

interface SignoffGroup {
  key: string
  phase: string
  requestedAt: string
  requestedBy: { id: string; name: string }
  requestComment: string | null
  signoffs: SignoffRecord[]
  groupStatus: string
}

function computeGroupStatus(signoffs: SignoffRecord[]): string {
  if (signoffs.some((s) => s.status === "REJECTED")) return "REJECTED"
  if (signoffs.some((s) => s.status === "PENDING")) return "PENDING"
  if (signoffs.every((s) => s.status === "APPROVED")) return "APPROVED"
  return "SKIPPED"
}

/** Group signoffs into rounds (same phase + requestedAt within 5 seconds) */
function groupSignoffs(signoffs: SignoffRecord[]): SignoffGroup[] {
  const sorted = [...signoffs].sort(
    (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime(),
  )

  const groups: SignoffGroup[] = []
  const assigned = new Set<string>()

  for (const s of sorted) {
    if (assigned.has(s.id)) continue

    const time = new Date(s.requestedAt).getTime()
    const members = sorted.filter(
      (other) =>
        !assigned.has(other.id) &&
        other.phase === s.phase &&
        Math.abs(new Date(other.requestedAt).getTime() - time) <= 5000,
    )

    for (const m of members) assigned.add(m.id)

    // Sort members: REQUESTER first, MANAGER second, BOARD third, others last
    const roleOrder: Record<string, number> = { REQUESTER: 0, MANAGER: 1, BOARD: 2 }
    members.sort((a, b) => (roleOrder[a.targetRole || ""] ?? 9) - (roleOrder[b.targetRole || ""] ?? 9))

    groups.push({
      key: `${s.phase}:${s.id}`,
      phase: s.phase,
      requestedAt: s.requestedAt,
      requestedBy: s.requestedBy,
      requestComment: members.find((m) => m.requestComment)?.requestComment || null,
      signoffs: members,
      groupStatus: computeGroupStatus(members),
    })
  }

  return groups
}

type FilterPhase = "all" | string
type FilterStatus = "all" | string

const PAGE_SIZE = 10

export function SignoffHistory({ signoffs, demandId, token, userRole, onRefresh, spAdjustment }: SignoffHistoryProps) {
  const [filterPhase, setFilterPhase] = useState<FilterPhase>("all")
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all")
  const [page, setPage] = useState(1)

  // Expand/collapse: default expand first group (latest)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set(["__first__"]))
  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Document deletion
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
  const [confirmDeleteDocId, setConfirmDeleteDocId] = useState<string | null>(null)
  const [confirmDeleteDocName, setConfirmDeleteDocName] = useState("")

  // Response note deletion
  const [confirmDeleteCommentId, setConfirmDeleteCommentId] = useState<string | null>(null)

  const handleDeleteDoc = async (docId: string) => {
    if (!demandId || !token) return
    setConfirmDeleteDocId(null)
    setDeletingDocId(docId)
    try {
      const res = await fetch(`/api/demands/${demandId}/documents/${docId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) onRefresh?.()
    } catch { /* ignore */ } finally {
      setDeletingDocId(null)
    }
  }

  // Post-hoc requestComment editing
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editCommentText, setEditCommentText] = useState("")
  const [editCommentLoading, setEditCommentLoading] = useState(false)

  // Post-hoc upload state per signoff
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploadError, setUploadError] = useState("")
  const [uploadLoading, setUploadLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Collect unique phases present in signoffs
  const phases = useMemo(() => {
    const set = new Set(signoffs.map((s) => s.phase))
    return (SIGNOFF_REQUIRED_PHASES as readonly string[]).filter((p) => set.has(p))
  }, [signoffs])

  // Collect unique statuses present
  const statuses = useMemo(() => {
    const set = new Set(signoffs.map((s) => s.status))
    return ["PENDING", "APPROVED", "REJECTED", "SKIPPED"].filter((s) => set.has(s))
  }, [signoffs])

  const filtered = useMemo(() => {
    const result = signoffs.filter((s) => {
      // Hide PENDING signoffs with no assigned user (e.g., no manager exists)
      // Exclude orphan signoffs (no assigned user) regardless of status
      if (!s.targetUserId && !s.targetUser) return false
      if (filterPhase !== "all" && s.phase !== filterPhase) return false
      if (filterStatus !== "all" && s.status !== filterStatus) return false
      return true
    })
    setPage(1)
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signoffs, filterPhase, filterStatus])

  // Group filtered signoffs into rounds
  const groups = useMemo(() => groupSignoffs(filtered), [filtered])

  // Resolve __first__ key to actual first group key
  const resolvedExpanded = useMemo(() => {
    const set = new Set(expandedKeys)
    if (set.has("__first__") && groups.length > 0) {
      set.delete("__first__")
      set.add(groups[0].key)
    }
    return set
  }, [expandedKeys, groups])

  const totalPages = Math.ceil(groups.length / PAGE_SIZE)
  const pagedGroups = groups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const hasFilters = filterPhase !== "all" || filterStatus !== "all"

  const canUpload = !!demandId && !!token
  const canEditRequestComment = canUpload && (userRole === "admin" || userRole === "delivery")
  const canEditComment = canUpload && userRole === "subsidiary"

  // 審核回應 editing state
  const [editingResponseId, setEditingResponseId] = useState<string | null>(null)
  const [editResponseText, setEditResponseText] = useState("")
  const [editResponseLoading, setEditResponseLoading] = useState(false)
  const [confirmDeleteResponseId, setConfirmDeleteResponseId] = useState<string | null>(null)

  const startEditResponse = (signoffId: string, existing: string | null) => {
    setEditingResponseId(signoffId)
    setEditResponseText(existing || "")
  }

  const cancelEditResponse = () => {
    setEditingResponseId(null)
    setEditResponseText("")
  }

  const saveResponse = async (signoffId: string, text?: string) => {
    if (!demandId || !token) return
    const content = text !== undefined ? text : editResponseText.trim()
    setEditResponseLoading(true)
    try {
      const res = await fetch(`/api/demands/${demandId}/signoffs/${signoffId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ comment: content }),
      })
      if (res.ok) {
        cancelEditResponse()
        onRefresh?.()
      }
    } catch { /* ignore */ } finally {
      setEditResponseLoading(false)
    }
  }

  const startUpload = (signoffId: string) => {
    setUploadingId(signoffId)
    setPendingFiles([])
    setUploadError("")
  }

  const cancelUpload = () => {
    setUploadingId(null)
    setPendingFiles([])
    setUploadError("")
  }

  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files)
      const oversized = selected.filter((f) => f.size > MAX_FILE_SIZE)
      if (oversized.length > 0) {
        setUploadError(`檔案「${oversized[0].name}」超過 10MB 限制`)
      }
      setPendingFiles((prev) => [...prev, ...selected.filter((f) => f.size <= MAX_FILE_SIZE)])
      e.target.value = ""
    }
  }

  const removeFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const submitFiles = async () => {
    if (!uploadingId || !demandId || !token || pendingFiles.length === 0) return
    setUploadLoading(true)
    setUploadError("")
    try {
      const formData = new FormData()
      pendingFiles.forEach((f) => formData.append("files", f))

      const res = await fetch(`/api/demands/${demandId}/signoffs/${uploadingId}/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (res.ok) {
        cancelUpload()
        onRefresh?.()
      } else {
        const data = await res.json().catch(() => ({}))
        setUploadError(data.error || "上傳失敗")
      }
    } catch {
      setUploadError("網路錯誤")
    } finally {
      setUploadLoading(false)
    }
  }

  const startEditComment = (signoffId: string, existing: string | null) => {
    setEditingCommentId(signoffId)
    setEditCommentText(existing || "")
  }

  const cancelEditComment = () => {
    setEditingCommentId(null)
    setEditCommentText("")
  }

  const saveComment = async (signoffId: string, text?: string) => {
    if (!demandId || !token) return
    const content = text !== undefined ? text : editCommentText.trim()
    setEditCommentLoading(true)
    try {
      const res = await fetch(`/api/demands/${demandId}/signoffs/${signoffId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requestComment: content }),
      })
      if (res.ok) {
        cancelEditComment()
        onRefresh?.()
      }
    } catch { /* ignore */ } finally {
      setEditCommentLoading(false)
    }
  }

  if (signoffs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground/40 text-center py-4">尚無簽核紀錄</p>
    )
  }

  // --- Render helpers ---

  /** Render the per-signer detail row (comment, response, docs) */
  const renderSignerDetail = (s: SignoffRecord, isMulti: boolean) => {
    const Icon = STATUS_ICONS[s.status] || Clock
    const iconColor = STATUS_ICON_COLORS[s.status] || "text-gray-400"
    const statusInfo = SIGNOFF_STATUS_MAP[s.status]
    const docs = s.documents?.filter((d) => d.fileUrl) || []
    const isUploading = uploadingId === s.id
    const isPending = s.status === "PENDING"
    const canAddDocs = canUpload && isPending
    const name = s.targetUser?.name || s.respondedBy?.name || null
    const roleLabel = s.targetRole ? TARGET_ROLE_LABELS[s.targetRole] || s.targetRole : null

    return (
      <div key={s.id} className={cn(
        "space-y-2",
        isMulti && "rounded-lg border border-border/30 bg-background/50 p-3",
      )}>
        {/* Signer header (only for multi-signer) */}
        {isMulti && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className={cn(
              "h-5 w-5 rounded-full flex items-center justify-center shrink-0",
              s.status === "PENDING" ? "bg-amber-100" :
              s.status === "APPROVED" ? "bg-emerald-100" :
              s.status === "REJECTED" ? "bg-red-100" : "bg-gray-100",
            )}>
              <Icon className={cn("h-3 w-3", iconColor)} />
            </div>
            {roleLabel && (
              <Badge variant="outline" className="text-[10px] border-violet-200 text-violet-600 bg-violet-50">
                {roleLabel}
              </Badge>
            )}
            {name && (
              <span className="text-sm font-medium">{name}</span>
            )}
            {statusInfo && (
              <Badge className={cn("text-[10px]", statusInfo.color)}>
                {statusInfo.label}
              </Badge>
            )}
            {s.respondedAt && (
              <span className="text-[11px] text-muted-foreground/60">{fmtDate(s.respondedAt)}</span>
            )}
          </div>
        )}

        {/* 審核回應 */}
        {canEditComment && editingResponseId === s.id ? (
          <div className="space-y-2 rounded-lg border border-gray-200 bg-muted/20 p-2.5">
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              rows={3}
              placeholder="填寫審核回應..."
              value={editResponseText}
              onChange={(e) => setEditResponseText(e.target.value)}
            />
            <div className="flex items-center gap-2 justify-end">
              <Button size="sm" variant="outline" className="h-6 text-xs" onClick={cancelEditResponse} disabled={editResponseLoading}>
                取消
              </Button>
              <Button size="sm" className="h-6 text-xs" onClick={() => saveResponse(s.id)} disabled={editResponseLoading}>
                {editResponseLoading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                儲存
              </Button>
            </div>
          </div>
        ) : s.comment ? (
          <div className="group/resp">
            <span className="text-[11px] font-medium text-muted-foreground/70">審核回應</span>
            <div className="flex items-start gap-1.5 mt-0.5">
              <p className="text-sm text-muted-foreground/80 whitespace-pre-line bg-muted/30 rounded px-2.5 py-2 flex-1">
                {s.comment}
              </p>
              {canEditComment && (
                <div className="flex items-center gap-1 opacity-0 group-hover/resp:opacity-100 transition-opacity pt-2">
                  <button
                    className="text-muted-foreground/50 hover:text-muted-foreground"
                    onClick={() => startEditResponse(s.id, s.comment)}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    className="text-muted-foreground/50 hover:text-red-500"
                    onClick={() => setConfirmDeleteResponseId(s.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : canEditComment ? (
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            onClick={() => startEditResponse(s.id, null)}
          >
            <MessageSquare className="h-3 w-3" />
            補充審核回應
          </button>
        ) : null}

        {/* 附件 */}
        {docs.length > 0 && (
          <div className="space-y-1">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-2 rounded-md bg-white/80 border border-border/40 px-3 py-2 text-sm group/doc">
                <a
                  href={doc.fileUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 flex-1 min-w-0 hover:text-foreground transition-colors"
                >
                  <FileIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1 text-muted-foreground group-hover/doc:text-foreground">
                    {doc.fileName}
                  </span>
                  {doc.fileSize != null && (
                    <span className="text-muted-foreground/60 shrink-0">
                      {formatFileSize(doc.fileSize)}
                    </span>
                  )}
                  <Download className="h-3 w-3 text-muted-foreground/40 group-hover/doc:text-foreground shrink-0" />
                </a>
                {canUpload && isPending && (
                  <button
                    className="opacity-0 group-hover/doc:opacity-100 transition-opacity text-muted-foreground/50 hover:text-red-500 shrink-0"
                    onClick={() => { setConfirmDeleteDocId(doc.id); setConfirmDeleteDocName(doc.fileName) }}
                    disabled={deletingDocId === doc.id}
                  >
                    {deletingDocId === doc.id
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Trash2 className="h-3 w-3" />}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {canAddDocs && !isUploading && (
          <button
            className="flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            onClick={() => startUpload(s.id)}
          >
            <Paperclip className="h-3 w-3" />
            補充文件
          </button>
        )}

        {isUploading && (
          <div className="space-y-2 rounded-lg border border-border/60 bg-white/50 p-2.5">
            {pendingFiles.length > 0 && (
              <div className="space-y-1">
                {pendingFiles.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded bg-white border border-border/60 px-2 py-1 text-xs">
                    <FileIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{f.name}</span>
                    <span className="text-muted-foreground shrink-0">{formatFileSize(f.size)}</span>
                    <button
                      type="button"
                      className="text-red-400 hover:text-red-600 shrink-0"
                      onClick={() => removeFile(i)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadLoading}
              >
                <Paperclip className="h-3 w-3 mr-1" />
                選擇檔案
              </Button>
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={cancelUpload}
                  disabled={uploadLoading}
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={submitFiles}
                  disabled={uploadLoading || pendingFiles.length === 0}
                >
                  {uploadLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  上傳
                </Button>
              </div>
            </div>
            {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
          </div>
        )}
      </div>
    )
  }

  /** Render requestComment (shared per group) */
  const renderRequestComment = (group: SignoffGroup) => {
    // Use the first signoff that has a requestComment for display/editing
    const commentSignoff = group.signoffs.find((s) => s.requestComment) || group.signoffs[0]

    if (canEditRequestComment && editingCommentId === commentSignoff.id) {
      return (
        <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/30 p-2.5">
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            rows={3}
            placeholder="說明已調整的內容..."
            value={editCommentText}
            onChange={(e) => setEditCommentText(e.target.value)}
          />
          <div className="flex items-center gap-2 justify-end">
            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={cancelEditComment} disabled={editCommentLoading}>
              取消
            </Button>
            <Button size="sm" className="h-6 text-xs" onClick={() => saveComment(commentSignoff.id)} disabled={editCommentLoading}>
              {editCommentLoading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              儲存
            </Button>
          </div>
        </div>
      )
    }

    if (group.requestComment) {
      return (
        <div className="group/rc">
          <span className="text-[11px] font-medium text-blue-500/70">提出說明</span>
          <div className="flex items-start gap-1.5 mt-0.5">
            <MessageSquare className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-600/80 whitespace-pre-line flex-1">{group.requestComment}</p>
            {canEditRequestComment && (
              <div className="flex items-center gap-1 opacity-0 group-hover/rc:opacity-100 transition-opacity">
                <button
                  className="text-muted-foreground/50 hover:text-muted-foreground"
                  onClick={() => startEditComment(commentSignoff.id, group.requestComment)}
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  className="text-muted-foreground/50 hover:text-red-500"
                  onClick={() => setConfirmDeleteCommentId(commentSignoff.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      )
    }

    if (canEditRequestComment) {
      return (
        <button
          className="flex items-center gap-1 text-xs text-blue-400/60 hover:text-blue-500 transition-colors"
          onClick={() => startEditComment(commentSignoff.id, null)}
        >
          <MessageSquare className="h-3 w-3" />
          補充提出說明
        </button>
      )
    }

    return null
  }

  return (
    <div className="space-y-3">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.md,.txt,.jpg,.jpeg,.png,.gif,.webp"
      />

      {/* Filter bar */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap overflow-x-auto rounded-lg bg-muted/40 border border-border/60 px-2 sm:px-3 py-2 scrollbar-none">
        <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

        {/* Phase filter */}
        <span className="text-[10px] sm:text-[11px] text-muted-foreground/70 font-medium shrink-0">階段</span>
        <button
          className={cn(
            "text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full border transition-colors whitespace-nowrap shrink-0",
            filterPhase === "all"
              ? "bg-foreground text-background border-foreground"
              : "text-muted-foreground border-border hover:border-foreground/30",
          )}
          onClick={() => setFilterPhase("all")}
        >
          全部
        </button>
        {phases.map((p) => (
          <button
            key={p}
            className={cn(
              "text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full border transition-colors whitespace-nowrap shrink-0",
              filterPhase === p
                ? "bg-foreground text-background border-foreground"
                : "text-muted-foreground border-border hover:border-foreground/30",
            )}
            onClick={() => setFilterPhase(filterPhase === p ? "all" : p)}
          >
            {STATUS_MAP[p]?.label || p}
          </button>
        ))}

        <div className="w-px h-4 bg-border/80 mx-0.5 sm:mx-1 shrink-0" />

        {/* Status filter */}
        <span className="text-[10px] sm:text-[11px] text-muted-foreground/70 font-medium shrink-0">狀態</span>
        <button
          className={cn(
            "text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full border transition-colors whitespace-nowrap shrink-0",
            filterStatus === "all"
              ? "bg-foreground text-background border-foreground"
              : "text-muted-foreground border-border hover:border-foreground/30",
          )}
          onClick={() => setFilterStatus("all")}
        >
          全部
        </button>
        {statuses.map((st) => {
          const info = SIGNOFF_STATUS_MAP[st]
          return (
            <button
              key={st}
              className={cn(
                "text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full border transition-colors whitespace-nowrap shrink-0",
                filterStatus === st
                  ? "bg-foreground text-background border-foreground"
                  : "text-muted-foreground border-border hover:border-foreground/30",
              )}
              onClick={() => setFilterStatus(filterStatus === st ? "all" : st)}
            >
              {info?.label || st}
            </button>
          )
        })}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground/40 text-center py-4">
          無符合篩選條件的紀錄
          {hasFilters && (
            <button
              className="ml-2 text-primary hover:underline"
              onClick={() => { setFilterPhase("all"); setFilterStatus("all") }}
            >
              清除篩選
            </button>
          )}
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {(() => {
              const showSpAdj = spAdjustment && (filterPhase === "all" || filterPhase === "CLOSED")
              let spAdjRendered = false

              return pagedGroups.map((group) => {
                const isMulti = group.signoffs.length > 1
                const GroupIcon = STATUS_ICONS[group.groupStatus] || Clock
                const groupIconColor = STATUS_ICON_COLORS[group.groupStatus] || "text-gray-400"
                const groupStatusInfo = SIGNOFF_STATUS_MAP[group.groupStatus]
                const phaseLabel = STATUS_MAP[group.phase]?.label || group.phase
                const isExpanded = resolvedExpanded.has(group.key)

                // For single-signer groups, use the signoff's own status for the card
                const singleSignoff = isMulti ? null : group.signoffs[0]
                const cardStatus = isMulti ? group.groupStatus : (singleSignoff?.status || "PENDING")
                const reviewerName = singleSignoff ? (singleSignoff.targetUser?.name || singleSignoff.respondedBy?.name || null) : null

                const renderSpAdj = showSpAdj && group.phase === "CLOSED" && !spAdjRendered
                if (renderSpAdj) spAdjRendered = true

                return (
                  <React.Fragment key={group.key}>
                    {renderSpAdj && (
                      <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50/50 px-3 py-2">
                        <Coins className="h-4 w-4 text-orange-500 shrink-0" />
                        <Badge variant="outline" className="text-[11px] border-orange-300 text-orange-700 bg-white">SP 調整</Badge>
                        <span className="text-sm font-medium">{spAdjustment!.oldSp} → {spAdjustment!.newSp} SP</span>
                        {spAdjustment!.reason && (
                          <span className="text-xs text-muted-foreground ml-2">{spAdjustment!.reason}</span>
                        )}
                      </div>
                    )}

                    {/* Group card */}
                    <div className={cn(
                      "rounded-lg border transition-colors",
                      isExpanded ? STATUS_BG[cardStatus] || "bg-white border-border" : "bg-white border-border/60 hover:border-border",
                    )}>
                      {/* Collapsed header */}
                      <button
                        type="button"
                        className="w-full flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-2 sm:py-2.5 text-left flex-wrap"
                        onClick={() => toggleExpand(group.key)}
                      >
                        {/* Group status icon */}
                        <div className={cn(
                          "h-5 w-5 sm:h-6 sm:w-6 rounded-full flex items-center justify-center shrink-0",
                          cardStatus === "PENDING" ? "bg-amber-100" :
                          cardStatus === "APPROVED" ? "bg-emerald-100" :
                          cardStatus === "REJECTED" ? "bg-red-100" : "bg-gray-100",
                        )}>
                          <GroupIcon className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", groupIconColor)} />
                        </div>

                        {/* Phase label */}
                        <span className="text-xs sm:text-sm font-medium shrink-0">{phaseLabel}</span>

                        {/* Single-signer: role badge + status + name */}
                        {!isMulti && singleSignoff && (
                          <>
                            {singleSignoff.targetRole && (
                              <Badge variant="outline" className="text-[9px] sm:text-[10px] border-violet-200 text-violet-600 bg-violet-50 shrink-0">
                                {TARGET_ROLE_LABELS[singleSignoff.targetRole] || singleSignoff.targetRole}
                              </Badge>
                            )}
                            {groupStatusInfo && (
                              <Badge className={cn("text-[9px] sm:text-[10px] shrink-0", groupStatusInfo.color)}>
                                {groupStatusInfo.label}
                              </Badge>
                            )}
                            {reviewerName && (
                              <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                                <User className="h-3 w-3" />
                                {reviewerName}
                              </span>
                            )}
                          </>
                        )}

                        {/* Multi-signer: group status + per-signer mini indicators */}
                        {isMulti && (
                          <>
                            {groupStatusInfo && (
                              <Badge className={cn("text-[9px] sm:text-[10px] shrink-0", groupStatusInfo.color)}>
                                {groupStatusInfo.label}
                              </Badge>
                            )}
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                              {group.signoffs.map((s) => {
                                const SIcon = STATUS_ICONS[s.status] || Clock
                                const sColor = STATUS_ICON_COLORS[s.status] || "text-gray-400"
                                const sName = s.targetUser?.name || s.respondedBy?.name || "?"
                                return (
                                  <span key={s.id} className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs text-muted-foreground">
                                    <SIcon className={cn("h-3 w-3", sColor)} />
                                    <span>{sName}</span>
                                  </span>
                                )
                              })}
                            </div>
                          </>
                        )}

                        {/* Spacer + date + chevron */}
                        <span className="flex-1" />
                        <span className="text-[10px] sm:text-[11px] text-muted-foreground/60 shrink-0">
                          {fmtDate(group.requestedAt)}
                        </span>
                        <ChevronDown className={cn(
                          "h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground/40 shrink-0 transition-transform",
                          isExpanded && "rotate-180",
                        )} />
                      </button>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-0 space-y-2.5 border-t border-border/40 mx-3">
                          {/* Meta info */}
                          <div className="pt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>
                              發起：<span className="font-medium text-foreground">{group.requestedBy.name}</span>
                              <span className="ml-1 text-muted-foreground/60">{fmtDate(group.requestedAt)}</span>
                            </span>
                            {isMulti && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                <span>共 {group.signoffs.length} 位審核人</span>
                              </span>
                            )}
                            {!isMulti && singleSignoff?.targetUser && (
                              <span>
                                指定審核：<span className="font-medium text-foreground">{singleSignoff.targetUser.name}</span>
                              </span>
                            )}
                            {!isMulti && singleSignoff?.respondedBy && singleSignoff.respondedAt && (
                              <span>
                                回應：<span className="font-medium text-foreground">{singleSignoff.respondedBy.name}</span>
                                <span className="ml-1 text-muted-foreground/60">{fmtDate(singleSignoff.respondedAt)}</span>
                              </span>
                            )}
                          </div>
                          <div className="border-t border-border/40" />

                          {/* 提出說明 (shared per group) */}
                          {renderRequestComment(group)}

                          {/* Multi-signer: each signer as a sub-card */}
                          {isMulti && (
                            <div className="space-y-2">
                              {group.signoffs.map((s) => renderSignerDetail(s, true))}
                            </div>
                          )}

                          {/* Single-signer: flat layout */}
                          {!isMulti && singleSignoff && renderSignerDetail(singleSignoff, false)}
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                )
              })
            })()}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-border/40">
              <span className="text-xs text-muted-foreground">
                共 {groups.length} 筆，第 {page}/{totalPages} 頁
              </span>
              <div className="flex items-center gap-1">
                <button
                  className="text-xs px-2 py-1 rounded border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  上一頁
                </button>
                <button
                  className="text-xs px-2 py-1 rounded border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一頁
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Confirm delete document dialog */}
      <AlertDialog open={!!confirmDeleteDocId} onOpenChange={(open) => { if (!open) setConfirmDeleteDocId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除文件</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除「{confirmDeleteDocName}」嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => confirmDeleteDocId && handleDeleteDoc(confirmDeleteDocId)}
            >
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete 提出說明 dialog */}
      <AlertDialog open={!!confirmDeleteCommentId} onOpenChange={(open) => { if (!open) setConfirmDeleteCommentId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除提出說明</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除此提出說明嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { if (confirmDeleteCommentId) { saveComment(confirmDeleteCommentId, ""); setConfirmDeleteCommentId(null) } }}
            >
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete 審核回應 dialog */}
      <AlertDialog open={!!confirmDeleteResponseId} onOpenChange={(open) => { if (!open) setConfirmDeleteResponseId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除審核回應</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除此審核回應嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { if (confirmDeleteResponseId) { saveResponse(confirmDeleteResponseId, ""); setConfirmDeleteResponseId(null) } }}
            >
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

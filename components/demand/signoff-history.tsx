"use client"

import { useState, useMemo, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { STATUS_MAP, SIGNOFF_STATUS_MAP, SIGNOFF_REQUIRED_PHASES } from "@/lib/constants/demand"
import { cn } from "@/lib/utils"
import { Check, Clock, X, SkipForward, FileIcon, Download, Filter, Paperclip, Trash2, Loader2 } from "lucide-react"

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
  comment: string | null
  requestedAt: string
  respondedAt: string | null
  requestedBy: { id: string; name: string }
  respondedBy: { id: string; name: string } | null
  documents?: SignoffDocument[]
}

interface SignoffHistoryProps {
  signoffs: SignoffRecord[]
  demandId?: string
  token?: string | null
  onRefresh?: () => void
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

function fmtDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type FilterPhase = "all" | string
type FilterStatus = "all" | string

const PAGE_SIZE = 10

export function SignoffHistory({ signoffs, demandId, token, onRefresh }: SignoffHistoryProps) {
  const [filterPhase, setFilterPhase] = useState<FilterPhase>("all")
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all")
  const [page, setPage] = useState(1)

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
      if (filterPhase !== "all" && s.phase !== filterPhase) return false
      if (filterStatus !== "all" && s.status !== filterStatus) return false
      return true
    })
    setPage(1) // reset page when filters change
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signoffs, filterPhase, filterStatus])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const hasFilters = filterPhase !== "all" || filterStatus !== "all"

  const canUpload = !!demandId && !!token

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPendingFiles((prev) => [...prev, ...Array.from(e.target.files!)])
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

  if (signoffs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground/40 text-center py-4">尚無簽核紀錄</p>
    )
  }

  return (
    <div className="space-y-4">
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
      <div className="flex items-center gap-2 flex-wrap rounded-lg bg-muted/40 border border-border/60 px-3 py-2">
        <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

        {/* Phase filter */}
        <span className="text-[11px] text-muted-foreground/70 font-medium shrink-0">階段</span>
        <button
          className={cn(
            "text-xs px-2 py-0.5 rounded-full border transition-colors",
            filterPhase === "all"
              ? "bg-foreground text-background border-foreground"
              : "text-muted-foreground border-border hover:border-foreground/30"
          )}
          onClick={() => setFilterPhase("all")}
        >
          全部
        </button>
        {phases.map((p) => (
          <button
            key={p}
            className={cn(
              "text-xs px-2 py-0.5 rounded-full border transition-colors",
              filterPhase === p
                ? "bg-foreground text-background border-foreground"
                : "text-muted-foreground border-border hover:border-foreground/30"
            )}
            onClick={() => setFilterPhase(filterPhase === p ? "all" : p)}
          >
            {STATUS_MAP[p]?.label || p}
          </button>
        ))}

        <div className="w-px h-4 bg-border/80 mx-1" />

        {/* Status filter */}
        <span className="text-[11px] text-muted-foreground/70 font-medium shrink-0">狀態</span>
        <button
          className={cn(
            "text-xs px-2 py-0.5 rounded-full border transition-colors",
            filterStatus === "all"
              ? "bg-foreground text-background border-foreground"
              : "text-muted-foreground border-border hover:border-foreground/30"
          )}
          onClick={() => setFilterStatus("all")}
        >
          全部
        </button>
        {statuses.map((s) => {
          const info = SIGNOFF_STATUS_MAP[s]
          return (
            <button
              key={s}
              className={cn(
                "text-xs px-2 py-0.5 rounded-full border transition-colors",
                filterStatus === s
                  ? "bg-foreground text-background border-foreground"
                  : "text-muted-foreground border-border hover:border-foreground/30"
              )}
              onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
            >
              {info?.label || s}
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
          <div className="space-y-3">
            {paged.map((s) => {
              const Icon = STATUS_ICONS[s.status] || Clock
              const iconColor = STATUS_ICON_COLORS[s.status] || "text-gray-400"
              const statusInfo = SIGNOFF_STATUS_MAP[s.status]
              const phaseLabel = STATUS_MAP[s.phase]?.label || s.phase
              const docs = s.documents?.filter((d) => d.fileUrl) || []
              const isUploading = uploadingId === s.id
              const canAddDocs = canUpload && (s.status === "REJECTED" || s.status === "APPROVED")

              return (
                <div key={s.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn("h-6 w-6 rounded-full flex items-center justify-center shrink-0",
                      s.status === "PENDING" ? "bg-amber-50" :
                      s.status === "APPROVED" ? "bg-emerald-50" :
                      s.status === "REJECTED" ? "bg-red-50" : "bg-gray-50"
                    )}>
                      <Icon className={cn("h-3.5 w-3.5", iconColor)} />
                    </div>
                    <div className="w-px flex-1 bg-border/60 mt-1" />
                  </div>
                  <div className="flex-1 min-w-0 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{phaseLabel}</span>
                      {statusInfo && (
                        <Badge className={cn("text-[10px]", statusInfo.color)}>
                          {statusInfo.label}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {s.requestedBy.name} 發起 · {fmtDate(s.requestedAt)}
                      {s.respondedBy && s.respondedAt && (
                        <> · {s.respondedBy.name} 回應 · {fmtDate(s.respondedAt)}</>
                      )}
                    </p>
                    {s.comment && (
                      <p className="text-xs text-muted-foreground/80 mt-1 whitespace-pre-line bg-muted/30 rounded px-2 py-1.5">
                        {s.comment}
                      </p>
                    )}
                    {docs.length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {docs.map((doc) => (
                          <a
                            key={doc.id}
                            href={doc.fileUrl!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded bg-muted/30 px-2 py-1 text-xs hover:bg-muted/50 transition-colors group"
                          >
                            <FileIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="truncate flex-1 text-muted-foreground group-hover:text-foreground">
                              {doc.fileName}
                            </span>
                            {doc.fileSize != null && (
                              <span className="text-muted-foreground/60 shrink-0">
                                {formatFileSize(doc.fileSize)}
                              </span>
                            )}
                            <Download className="h-3 w-3 text-muted-foreground/40 group-hover:text-foreground shrink-0" />
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Post-hoc upload area */}
                    {canAddDocs && !isUploading && (
                      <button
                        className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                        onClick={() => startUpload(s.id)}
                      >
                        <Paperclip className="h-3 w-3" />
                        補充文件
                      </button>
                    )}

                    {isUploading && (
                      <div className="mt-2 space-y-2 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                        {/* Pending file list */}
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

                        {/* Action buttons */}
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
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-border/40">
              <span className="text-xs text-muted-foreground">
                共 {filtered.length} 筆，第 {page}/{totalPages} 頁
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
    </div>
  )
}

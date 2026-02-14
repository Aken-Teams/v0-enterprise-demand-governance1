"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  FileText, FileSpreadsheet, FileImage, FileVideo2, FileAudio, File, Presentation,
  Download, Upload, Loader2, Check, Circle, ExternalLink, Link, Trash2,
  ChevronRight, ChevronLeft,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  STATUS_MAP,
  PIPELINE_STEPS,
  PHASE_COLORS,
  PHASE_DOCUMENT_MAP,
  DOCUMENT_TYPE_LABELS,
} from "@/lib/constants/demand"
import { cn } from "@/lib/utils"

interface Document {
  id: string
  type: string
  phase: string | null
  fileName: string
  fileUrl: string | null
  fileSize: number | null
  uploadedBy: string
  createdAt: string
}

interface PhaseDocumentsProps {
  documents: Document[]
  currentPhase: string
  demandId: string
  canUpload: boolean
  canDownload?: boolean
  token: string | null
  onRefresh: () => void
  uploadTriggerSelector?: string
  onDocumentSelect?: (doc: Document) => void
  selectedDocId?: string | null
  userId?: string
  userRole?: string
}

function getFileIconAndColor(fileName: string): { icon: typeof File; color: string } {
  const ext = fileName.split(".").pop()?.toLowerCase() || ""
  switch (ext) {
    case "xls": case "xlsx": case "csv":
      return { icon: FileSpreadsheet, color: "text-emerald-600" }
    case "ppt": case "pptx":
      return { icon: Presentation, color: "text-orange-500" }
    case "jpg": case "jpeg": case "png": case "gif": case "webp": case "svg":
      return { icon: FileImage, color: "text-violet-500" }
    case "mp4": case "webm": case "mov": case "avi":
      return { icon: FileVideo2, color: "text-rose-500" }
    case "mp3": case "wav": case "ogg": case "m4a":
      return { icon: FileAudio, color: "text-sky-500" }
    case "pdf": case "doc": case "docx": case "txt": case "md":
      return { icon: FileText, color: "text-blue-500" }
    default:
      return { icon: File, color: "text-muted-foreground" }
  }
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function PhaseDocuments({
  documents,
  currentPhase,
  demandId,
  canUpload,
  canDownload = true,
  token,
  onRefresh,
  uploadTriggerSelector,
  onDocumentSelect,
  selectedDocId,
  userId,
  userRole,
}: PhaseDocumentsProps) {
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadPhase, setUploadPhase] = useState(currentPhase)
  const [uploadType, setUploadType] = useState("ATTACHMENT")
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [appResultUrl, setAppResultUrl] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [activePhase, setActivePhase] = useState<string | null>(null)

  const isLinkType = uploadType === "APP_RESULT"

  // Bind external upload trigger button
  useEffect(() => {
    if (!uploadTriggerSelector) return
    const el = document.querySelector(uploadTriggerSelector)
    if (!el) return
    const handler = () => setShowUploadDialog(true)
    el.addEventListener("click", handler)
    return () => el.removeEventListener("click", handler)
  }, [uploadTriggerSelector])

  const getPhaseDocuments = (phase: string) =>
    documents.filter((d) => d.phase === phase)

  const getUnassignedDocuments = () =>
    documents.filter((d) => !d.phase)

  const getRequiredStatus = (phase: string) => {
    const config = PHASE_DOCUMENT_MAP[phase]
    if (!config) return []
    return config.required.map((type) => ({
      type,
      label: DOCUMENT_TYPE_LABELS[type] || type,
      uploaded: documents.some((d) => d.phase === phase && d.type === type),
    }))
  }

  const handleUpload = async () => {
    if (!token || selectedFiles.length === 0) return
    setUploading(true)
    setUploadError("")
    try {
      const formData = new FormData()
      formData.set("phase", uploadPhase)
      formData.set("type", uploadType)
      for (const file of selectedFiles) {
        formData.append("files", file)
      }
      const res = await fetch(`/api/demands/${demandId}/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (res.ok) {
        setShowUploadDialog(false)
        setSelectedFiles([])
        setUploadError("")
        onRefresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setUploadError(data.error || `上傳失敗 (${res.status})`)
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "網路錯誤")
    } finally {
      setUploading(false)
    }
  }

  const handleSubmitLink = async () => {
    if (!token || !appResultUrl.trim()) return
    setUploading(true)
    setUploadError("")
    try {
      const res = await fetch(`/api/demands/${demandId}/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ phase: uploadPhase, type: uploadType, url: appResultUrl.trim() }),
      })
      if (res.ok) {
        setShowUploadDialog(false)
        setAppResultUrl("")
        setUploadError("")
        onRefresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setUploadError(data.error || `儲存失敗 (${res.status})`)
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "網路錯誤")
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (docId: string) => {
    if (!token) return
    setDeletingId(docId)
    try {
      const res = await fetch(`/api/demands/${demandId}/documents/${docId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) onRefresh()
    } catch { /* ignore */ } finally {
      setDeletingId(null)
    }
  }

  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const handleDownload = useCallback(async (doc: Document) => {
    if (!token) return
    setDownloadingId(doc.id)
    try {
      const res = await fetch(`/api/demands/${demandId}/documents/${doc.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = doc.fileName.replace(/\.[^.]+$/, ".pdf")
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch { /* ignore */ } finally {
      setDownloadingId(null)
    }
  }, [token, demandId])

  // Get available doc types for selected phase
  const availableTypes = () => {
    const config = PHASE_DOCUMENT_MAP[uploadPhase]
    if (!config) return [{ value: "ATTACHMENT", label: "一般附件" }]
    const all = [...config.required, ...config.optional]
    const unique = [...new Set(all)]
    return unique.map((t) => ({ value: t, label: DOCUMENT_TYPE_LABELS[t] || t }))
  }

  const renderDocRow = (doc: Document) => {
    const isExternalLink = doc.type === "APP_RESULT" && doc.fileUrl?.startsWith("http")
    const { icon: Icon, color: iconColor } = isExternalLink
      ? { icon: ExternalLink, color: "text-blue-500" }
      : getFileIconAndColor(doc.fileName)
    const isOwnDoc = userId && doc.uploadedBy === userId
    const isAdmin = userRole === "admin"
    const docCanDownload = canDownload && (isAdmin || isOwnDoc)
    const docCanDelete = canUpload && (isAdmin || isOwnDoc)
    return (
      <div
        key={doc.id}
        className={cn(
          "flex items-center justify-between rounded-md border px-3 py-2.5 transition-colors",
          onDocumentSelect && "cursor-pointer hover:bg-muted/50",
          selectedDocId === doc.id && "ring-2 ring-primary/40 bg-primary/[0.03]",
        )}
        onClick={() => onDocumentSelect?.(doc)}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />
          <div className="min-w-0">
            {isExternalLink ? (
              <a
                href={doc.fileUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-blue-600 hover:underline truncate block"
                onClick={(e) => e.stopPropagation()}
              >
                {doc.fileUrl}
              </a>
            ) : (
              <p className="text-sm font-medium truncate">{doc.fileName}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {DOCUMENT_TYPE_LABELS[doc.type] || doc.type}
              {doc.fileSize ? ` · ${formatFileSize(doc.fileSize)}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {docCanDownload && doc.fileUrl && !isExternalLink && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleDownload(doc)}
              disabled={downloadingId === doc.id}
            >
              {downloadingId === doc.id
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Download className="h-4 w-4" />}
            </Button>
          )}
          {docCanDownload && isExternalLink && (
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <a href={doc.fileUrl!} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
          {docCanDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground/40 hover:text-destructive"
              onClick={() => handleDelete(doc.id)}
              disabled={deletingId === doc.id}
            >
              {deletingId === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
      </div>
    )
  }

  const allPhases = [
    ...PIPELINE_STEPS.map((phase) => ({
      key: phase,
      label: STATUS_MAP[phase]?.label || phase,
      color: PHASE_COLORS[phase],
      docs: getPhaseDocuments(phase),
      required: getRequiredStatus(phase),
    })),
    ...(getUnassignedDocuments().length > 0
      ? [{ key: "OTHER", label: "其他", color: "oklch(0.6 0 0)", docs: getUnassignedDocuments(), required: [] as ReturnType<typeof getRequiredStatus> }]
      : []),
  ]

  const activeData = allPhases.find((p) => p.key === activePhase)

  return (
    <div>
      {!activeData ? (
        /* ── Phase list ── */
        allPhases.map((phase, idx) => {
          const count = phase.docs.length
          const reqDone = phase.required.filter((r) => r.uploaded).length
          const reqTotal = phase.required.length
          return (
            <div key={phase.key}>
              {idx > 0 && <Separator />}
              <button
                className="flex items-center w-full gap-2.5 px-3 py-3 text-left transition-colors hover:bg-muted/40"
                onClick={() => setActivePhase(phase.key)}
              >
                <div
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: phase.color }}
                />
                <span className="text-sm font-medium text-muted-foreground">
                  {phase.label}
                </span>
                {count > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 rounded-full font-medium">
                    {count}
                  </Badge>
                )}
                <span className="flex-1" />
                {reqTotal > 0 && (
                  <span className={cn(
                    "text-[11px] font-medium tabular-nums",
                    reqDone === reqTotal ? "text-emerald-600" : "text-muted-foreground/50",
                  )}>
                    {reqDone}/{reqTotal}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
              </button>
            </div>
          )
        })
      ) : (
        /* ── Selected phase detail ── */
        <div>
          {/* Back + phase title */}
          <button
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-left"
            onClick={() => setActivePhase(null)}
          >
            <ChevronLeft className="h-4 w-4" />
            <span>返回</span>
          </button>
          <Separator />
          <div className="flex items-center gap-2.5 px-3 py-3">
            <div
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: activeData.color }}
            />
            <span className="text-sm font-semibold">{activeData.label}</span>
            {activeData.docs.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 rounded-full font-medium">
                {activeData.docs.length}
              </Badge>
            )}
          </div>

          <div className="px-3 pb-3 space-y-2">
            {/* Required checklist */}
            {activeData.required.length > 0 && (
              <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">必要文件</p>
                {activeData.required.map((item) => (
                  <div key={item.type} className="flex items-center gap-2.5">
                    {item.uploaded ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/30" />
                    )}
                    <span className={cn("text-sm", item.uploaded ? "text-foreground" : "text-muted-foreground/50")}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {/* Document list */}
            {activeData.docs.length > 0 ? (
              <div className="space-y-1.5">
                {activeData.docs.map(renderDocRow)}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/40 text-center py-4">尚無文件</p>
            )}
          </div>
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isLinkType ? "新增 APP 連結" : "上傳文件"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">所屬階段</label>
              <Select value={uploadPhase} onValueChange={setUploadPhase}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STEPS.map((phase) => (
                    <SelectItem key={phase} value={phase}>
                      {STATUS_MAP[phase]?.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">文件類型</label>
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableTypes().map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isLinkType ? (
              <div>
                <label className="text-sm font-medium">APP 連結</label>
                <Input
                  className="mt-1"
                  placeholder="https://..."
                  value={appResultUrl}
                  onChange={(e) => setAppResultUrl(e.target.value)}
                />
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium">選擇檔案</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.md,.txt,.jpg,.jpeg,.png,.gif,.webp,.mp3,.wav,.ogg,.mp4,.webm"
                  onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                />
                <Button
                  variant="outline"
                  className="w-full mt-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {selectedFiles.length > 0
                    ? `已選擇 ${selectedFiles.length} 個檔案`
                    : "點擊選擇檔案"}
                </Button>
              </div>
            )}
          </div>
          {uploadError && (
            <p className="text-sm text-destructive font-medium">{uploadError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>取消</Button>
            {isLinkType ? (
              <Button onClick={handleSubmitLink} disabled={!appResultUrl.trim() || uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Link className="h-4 w-4 mr-1" />}
                儲存連結
              </Button>
            ) : (
              <Button onClick={handleUpload} disabled={selectedFiles.length === 0 || uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                上傳
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

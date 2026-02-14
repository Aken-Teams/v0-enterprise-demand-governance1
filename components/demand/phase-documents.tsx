"use client"

import { useState, useRef, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
} from "lucide-react"
import { Input } from "@/components/ui/input"
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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit",
  })
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

  // Default tab to current phase
  const defaultTab = PIPELINE_STEPS.includes(currentPhase as typeof PIPELINE_STEPS[number])
    ? currentPhase
    : "all"

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

  // Get available doc types for selected phase
  const availableTypes = () => {
    const config = PHASE_DOCUMENT_MAP[uploadPhase]
    if (!config) return [{ value: "ATTACHMENT", label: "一般附件" }]
    const all = [...config.required, ...config.optional]
    const unique = [...new Set(all)]
    return unique.map((t) => ({ value: t, label: DOCUMENT_TYPE_LABELS[t] || t }))
  }

  return (
    <div className="space-y-3">
      <Tabs defaultValue={defaultTab}>
        <TabsList className="w-full h-auto p-1 bg-muted/50 justify-start gap-0">
          {PIPELINE_STEPS.map((phase, idx) => {
            const count = getPhaseDocuments(phase).length
            const required = getRequiredStatus(phase)
            const reqDone = required.filter((r) => r.uploaded).length
            const reqTotal = required.length
            return (
              <TabsTrigger
                key={phase}
                value={phase}
                className={cn(
                  "text-sm px-2.5 py-1.5 gap-1 rounded-md transition-all",
                  "data-[state=active]:bg-background data-[state=active]:shadow-sm",
                  idx > 0 && "border-l border-l-border/30",
                )}
              >
                <div
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: PHASE_COLORS[phase] }}
                />
                {STATUS_MAP[phase]?.label}
                {(count > 0 || reqTotal > 0) && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px] h-4 px-1 ml-0.5 rounded-full",
                      reqTotal > 0 && reqDone === reqTotal && "bg-emerald-100 text-emerald-700",
                    )}
                  >
                    {count > 0 ? count : `${reqDone}/${reqTotal}`}
                  </Badge>
                )}
              </TabsTrigger>
            )
          })}
          {getUnassignedDocuments().length > 0 && (
            <TabsTrigger value="all" className="text-sm px-2.5 py-1.5 rounded-md border-l border-l-border/30">
              其他
            </TabsTrigger>
          )}
        </TabsList>

        {PIPELINE_STEPS.map((phase) => {
          const phaseDocs = getPhaseDocuments(phase)
          const requiredChecklist = getRequiredStatus(phase)

          return (
            <TabsContent key={phase} value={phase} className="space-y-4 mt-4">
              {/* Required checklist */}
              {requiredChecklist.length > 0 && (
                <div className="rounded-lg border border-border/60 p-4 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">必要文件</p>
                  {requiredChecklist.map((item) => (
                    <div key={item.type} className="flex items-center gap-2.5">
                      {item.uploaded ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground/40" />
                      )}
                      <span className={cn("text-sm", item.uploaded ? "text-foreground" : "text-muted-foreground")}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Documents */}
              {phaseDocs.length > 0 ? (
                <div className="space-y-2">
                  {phaseDocs.map((doc) => {
                    const isExternalLink = doc.type === "APP_RESULT" && doc.fileUrl?.startsWith("http")
                    const { icon: Icon, color: iconColor } = isExternalLink
                      ? { icon: ExternalLink, color: "text-blue-500" }
                      : getFileIconAndColor(doc.fileName)
                    return (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className={cn("h-5 w-5 shrink-0", iconColor)} />
                        <div className="min-w-0">
                          {isExternalLink ? (
                            <a
                              href={doc.fileUrl!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-blue-600 hover:underline truncate block"
                            >
                              {doc.fileUrl}
                            </a>
                          ) : (
                            <p className="text-sm font-medium truncate">{doc.fileName}</p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            {DOCUMENT_TYPE_LABELS[doc.type] || doc.type}
                            {doc.fileSize ? ` · ${formatFileSize(doc.fileSize)}` : ""}
                            {" · "}{formatDate(doc.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {canDownload && doc.fileUrl && !isExternalLink && (
                          <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                            <a href={doc.fileUrl} download><Download className="h-4.5 w-4.5" /></a>
                          </Button>
                        )}
                        {canDownload && isExternalLink && (
                          <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                            <a href={doc.fileUrl!} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4.5 w-4.5" />
                            </a>
                          </Button>
                        )}
                        {canUpload && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground/40 hover:text-destructive"
                            onClick={() => handleDelete(doc.id)}
                            disabled={deletingId === doc.id}
                          >
                            {deletingId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                    </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">此階段尚無文件</p>
              )}
            </TabsContent>
          )
        })}

        {getUnassignedDocuments().length > 0 && (
          <TabsContent value="all" className="mt-4">
            <div className="space-y-2">
              {getUnassignedDocuments().map((doc) => {
                const { icon: Icon, color: iconColor } = getFileIconAndColor(doc.fileName)
                return (
                <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={cn("h-5 w-5 shrink-0", iconColor)} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{doc.fileName}</p>
                      <p className="text-sm text-muted-foreground">
                        {DOCUMENT_TYPE_LABELS[doc.type] || doc.type}
                        {doc.fileSize ? ` · ${formatFileSize(doc.fileSize)}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {canDownload && doc.fileUrl && (
                      <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                        <a href={doc.fileUrl} download><Download className="h-4.5 w-4.5" /></a>
                      </Button>
                    )}
                    {canUpload && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground/40 hover:text-destructive"
                        onClick={() => handleDelete(doc.id)}
                        disabled={deletingId === doc.id}
                      >
                        {deletingId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                </div>
                )
              })}
            </div>
          </TabsContent>
        )}
      </Tabs>

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

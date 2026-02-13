"use client"

import { useState, useRef } from "react"
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
  FileText, Download, Upload, Loader2, Check, Circle,
} from "lucide-react"
import {
  STATUS_MAP,
  PIPELINE_STEPS,
  PHASE_DOCUMENT_MAP,
  DOCUMENT_TYPE_LABELS,
} from "@/lib/constants/demand"

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
  token: string | null
  onRefresh: () => void
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
  token,
  onRefresh,
}: PhaseDocumentsProps) {
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadPhase, setUploadPhase] = useState(currentPhase)
  const [uploadType, setUploadType] = useState("ATTACHMENT")
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

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
        onRefresh()
      }
    } catch { /* ignore */ } finally {
      setUploading(false)
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
        <div className="flex items-center justify-between">
          <TabsList className="h-8">
            {PIPELINE_STEPS.map((phase) => {
              const count = getPhaseDocuments(phase).length
              return (
                <TabsTrigger key={phase} value={phase} className="text-xs px-2 py-1 gap-1">
                  {STATUS_MAP[phase]?.label}
                  {count > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-0.5">
                      {count}
                    </Badge>
                  )}
                </TabsTrigger>
              )
            })}
            {getUnassignedDocuments().length > 0 && (
              <TabsTrigger value="all" className="text-xs px-2 py-1">
                其他
              </TabsTrigger>
            )}
          </TabsList>
          {canUpload && (
            <Button variant="outline" size="sm" onClick={() => setShowUploadDialog(true)}>
              <Upload className="h-3.5 w-3.5 mr-1" />
              上傳文件
            </Button>
          )}
        </div>

        {PIPELINE_STEPS.map((phase) => {
          const phaseDocs = getPhaseDocuments(phase)
          const requiredChecklist = getRequiredStatus(phase)

          return (
            <TabsContent key={phase} value={phase} className="space-y-3 mt-3">
              {/* Required checklist */}
              {requiredChecklist.length > 0 && (
                <div className="rounded-lg border border-border/60 p-3 space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">必要文件</p>
                  {requiredChecklist.map((item) => (
                    <div key={item.type} className="flex items-center gap-2 text-sm">
                      {item.uploaded ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                      )}
                      <span className={item.uploaded ? "text-foreground" : "text-muted-foreground"}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Documents */}
              {phaseDocs.length > 0 ? (
                <div className="space-y-2">
                  {phaseDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-sm truncate">{doc.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {DOCUMENT_TYPE_LABELS[doc.type] || doc.type}
                            {doc.fileSize ? ` · ${formatFileSize(doc.fileSize)}` : ""}
                            {" · "}{formatDate(doc.createdAt)}
                          </p>
                        </div>
                      </div>
                      {doc.fileUrl && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                          <a href={doc.fileUrl} download><Download className="h-4 w-4" /></a>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">此階段尚無文件</p>
              )}
            </TabsContent>
          )
        })}

        {getUnassignedDocuments().length > 0 && (
          <TabsContent value="all" className="mt-3">
            <div className="space-y-2">
              {getUnassignedDocuments().map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm truncate">{doc.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {DOCUMENT_TYPE_LABELS[doc.type] || doc.type}
                        {doc.fileSize ? ` · ${formatFileSize(doc.fileSize)}` : ""}
                      </p>
                    </div>
                  </div>
                  {doc.fileUrl && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                      <a href={doc.fileUrl} download><Download className="h-4 w-4" /></a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>上傳文件</DialogTitle>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>取消</Button>
            <Button onClick={handleUpload} disabled={selectedFiles.length === 0 || uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              上傳
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

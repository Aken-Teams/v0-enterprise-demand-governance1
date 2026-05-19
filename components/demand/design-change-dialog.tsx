"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  FileEdit,
  FileIcon,
  Loader2,
  Paperclip,
  Trash2,
  Users,
} from "lucide-react"

interface SignoffTarget {
  userId: string
  name: string
  role: string
}

interface DesignChangeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  demandId: string
  demandNumber: string
  demandTitle: string
  phaseLabel: string
  targets: SignoffTarget[]
  token: string | null
  onComplete: () => void
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const ROLE_LABELS: Record<string, string> = {
  REQUESTER: "需求窗口",
  MANAGER: "需求主管",
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function DesignChangeDialog({
  open,
  onOpenChange,
  demandId,
  demandNumber,
  demandTitle,
  phaseLabel,
  targets,
  token,
  onComplete,
}: DesignChangeDialogProps) {
  const [reason, setReason] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetForm = () => {
    setReason("")
    setFiles([])
    setError("")
  }

  const handleClose = () => {
    if (loading) return
    resetForm()
    onOpenChange(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const selected = Array.from(e.target.files)
    const oversized = selected.filter((f) => f.size > MAX_FILE_SIZE)
    if (oversized.length > 0) {
      setError(`檔案「${oversized[0].name}」超過 10MB 限制`)
    }
    setFiles((prev) => [...prev, ...selected.filter((f) => f.size <= MAX_FILE_SIZE)])
    e.target.value = ""
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError("請填寫設計變更原因")
      return
    }
    if (!token) return
    setLoading(true)
    setError("")
    try {
      const formData = new FormData()
      formData.append("requestComment", reason.trim())
      files.forEach((f) => formData.append("files", f))

      const res = await fetch(`/api/demands/${demandId}/design-changes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (res.ok) {
        resetForm()
        onOpenChange(false)
        onComplete()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "提交失敗")
      }
    } catch {
      setError("網路錯誤")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-xl max-h-[90vh] flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <FileEdit className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
            提出設計變更
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            於「{phaseLabel}」階段針對需求 {demandNumber}「{demandTitle}」提出設計變更。
            送出後由指定審核人確認；僅留下紀錄，不會改變需求狀態或 SP。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 overflow-y-auto px-1 py-1">
          {/* Target signers */}
          <div className="rounded-md bg-indigo-50/60 border border-indigo-200 p-2.5 sm:p-3">
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-medium text-indigo-700 mb-1.5 sm:mb-2">
              <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              審核人員
            </div>
            <div className="flex flex-wrap gap-1.5">
              {targets.length === 0 ? (
                <span className="text-[10px] sm:text-xs text-muted-foreground">尚無指定審核人</span>
              ) : (
                targets.map((t) => (
                  <Badge key={t.userId} variant="outline" className="bg-white text-[10px] sm:text-xs">
                    {t.name}
                    <span className="ml-1 text-muted-foreground">
                      · {ROLE_LABELS[t.role] || t.role}
                    </span>
                  </Badge>
                ))
              )}
            </div>
            {targets.length > 1 && (
              <p className="text-[11px] text-indigo-700/70 mt-2">
                所有審核人皆需通過，才算設計變更確認完成。
              </p>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label htmlFor="design-change-reason" className="text-xs sm:text-sm">
              變更原因 <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="design-change-reason"
              placeholder="請說明討論/測試中提出的新需求內容與變更說明..."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                setError("")
              }}
              rows={4}
              className="text-xs sm:text-sm"
              disabled={loading}
            />
          </div>

          {/* Files */}
          {files.length > 0 && (
            <div className="space-y-1">
              {files.map((f, i) => (
                <div
                  key={`${f.name}-${i}`}
                  className="flex items-center gap-2 rounded bg-muted/40 border px-2 py-1.5 text-xs"
                >
                  <FileIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1">{f.name}</span>
                  <span className="text-muted-foreground shrink-0">
                    {formatFileSize(f.size)}
                  </span>
                  <button
                    type="button"
                    className="text-red-400 hover:text-red-600 shrink-0"
                    onClick={() => removeFile(i)}
                    disabled={loading}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

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
            className="h-7 sm:h-8 text-xs"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
          >
            <Paperclip className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
            附加檔案
          </Button>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" className="h-8 text-xs sm:text-sm" onClick={handleClose} disabled={loading}>
            取消
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs sm:text-sm bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={handleSubmit}
            disabled={loading || targets.length === 0}
          >
            {loading ? (
              <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin mr-1" />
            ) : (
              <FileEdit className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
            )}
            提交設計變更
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

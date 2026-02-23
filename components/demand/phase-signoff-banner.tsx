"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ClipboardCheck, Check, X, Loader2, Paperclip, FileIcon, Trash2 } from "lucide-react"
import { STATUS_MAP, SIGNOFF_STATUS_MAP } from "@/lib/constants/demand"
import { cn } from "@/lib/utils"

interface PhaseSignoffBannerProps {
  signoff: {
    id: string
    phase: string
    status: string
    requestedAt: string
    requestedBy: { id: string; name: string }
  }
  demandId: string
  token: string | null
  onComplete: () => void
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function PhaseSignoffBanner({
  signoff,
  demandId,
  token,
  onComplete,
}: PhaseSignoffBannerProps) {
  const [comment, setComment] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const phaseLabel = STATUS_MAP[signoff.phase]?.label || signoff.phase

  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files)
      const oversized = selected.filter((f) => f.size > MAX_FILE_SIZE)
      if (oversized.length > 0) {
        setError(`檔案「${oversized[0].name}」超過 10MB 限制`)
      }
      setFiles((prev) => [...prev, ...selected.filter((f) => f.size <= MAX_FILE_SIZE)])
      e.target.value = "" // reset so same file can be re-added
    }
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAction = async (action: "approve" | "reject") => {
    if (action === "reject" && !comment.trim()) {
      setError("退回時必須填寫原因")
      return
    }
    if (!token) return
    setLoading(true)
    setError("")
    try {
      const formData = new FormData()
      formData.append("action", action)
      if (comment.trim()) formData.append("comment", comment.trim())
      files.forEach((f) => formData.append("files", f))

      const res = await fetch(`/api/demands/${demandId}/signoffs/${signoff.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (res.ok) {
        onComplete()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "操作失敗")
      }
    } catch {
      setError("網路錯誤")
    } finally {
      setLoading(false)
    }
  }

  if (signoff.status !== "PENDING") return null

  return (
    <div className="rounded-lg border-2 border-amber-300 bg-amber-50/80 p-4">
      <div className="flex items-start gap-3">
        <ClipboardCheck className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-amber-900 text-sm">
              「{phaseLabel}」階段等待您的確認
            </p>
            <Badge className={cn("text-[10px]", SIGNOFF_STATUS_MAP.PENDING.color)}>
              {SIGNOFF_STATUS_MAP.PENDING.label}
            </Badge>
          </div>
          <p className="text-xs text-amber-700/70 mt-1">
            由 {signoff.requestedBy.name} 於 {new Date(signoff.requestedAt).toLocaleDateString("zh-TW")} 發起簽核請求
          </p>

          {!showForm ? (
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => handleAction("approve")}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                確認通過
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => setShowForm(true)}
                disabled={loading}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                退回修改
              </Button>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <Textarea
                placeholder="請說明退回原因（必填）..."
                value={comment}
                onChange={(e) => { setComment(e.target.value); setError("") }}
                rows={3}
                className="text-sm bg-white border-amber-200 focus-visible:ring-amber-300"
              />

              {/* Selected files list */}
              {files.length > 0 && (
                <div className="space-y-1">
                  {files.map((f, i) => (
                    <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded bg-white border border-amber-200 px-2 py-1 text-xs">
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

              {/* Action row: buttons left, attach right */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.md,.txt,.jpg,.jpeg,.png,.gif,.webp"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-muted-foreground"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                >
                  <Paperclip className="h-3.5 w-3.5 mr-1" />
                  附加檔案
                </Button>
                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-muted-foreground"
                    onClick={() => { setShowForm(false); setComment(""); setError(""); setFiles([]) }}
                    disabled={loading}
                  >
                    取消
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleAction("reject")}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                    確認退回
                  </Button>
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>
      </div>
    </div>
  )
}

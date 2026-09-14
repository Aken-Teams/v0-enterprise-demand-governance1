"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ClipboardCheck, Check, X, Loader2, Paperclip, FileIcon, Trash2, FileEdit, Download, ShieldCheck, Smartphone } from "lucide-react"
import { STATUS_MAP, SIGNOFF_STATUS_MAP, SP_PROGRESS_RATE, formatSp } from "@/lib/constants/demand"
import { cn } from "@/lib/utils"

interface PhaseSignoffBannerProps {
  signoff: {
    id: string
    phase: string
    status: string
    targetRole?: string | null
    overrideTargetStatus?: string | null
    requestedAt: string
    requestedBy: { id: string; name: string }
    requestComment?: string | null
    documents?: { id: string; fileName: string; fileUrl?: string | null; fileSize?: number | null }[]
  }
  demandId: string
  token: string | null
  onComplete: () => void
  /** 需求目前的有效 SP（confirmedSp ?? estimatedSp）— 用於顯示結算後的實際 SP */
  effectiveSp?: number | null
  /** Render only the action buttons without the outer wrapper/header */
  inline?: boolean
  /** "PHASE" (default) / "DESIGN_CHANGE" / "DEV_LINK"（開發中 APP 交付連結確認） */
  kind?: "PHASE" | "DESIGN_CHANGE" | "DEV_LINK"
  /** 有未通過的設計變更時，鎖住階段簽核 */
  blocked?: boolean
  blockedMessage?: string
  onGoToDesignChange?: () => void
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
  effectiveSp,
  inline,
  kind = "PHASE",
  blocked = false,
  blockedMessage,
  onGoToDesignChange,
}: PhaseSignoffBannerProps) {
  const [comment, setComment] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const phaseLabel = STATUS_MAP[signoff.phase]?.label || signoff.phase
  const isDesignChange = kind === "DESIGN_CHANGE"
  const isDevLink = kind === "DEV_LINK"
  // 確認後直接帶使用者去看連結，而不是讓他自己回文件分頁翻找
  const devLinkNote = isDevLink
    ? "本需求只需確認這一次。確認後連結立即開啟；日後開發端更新或重新上傳連結都會直接顯示，不會再請您確認。"
    : null
  const isBoardOverride = signoff.targetRole === "BOARD_OVERRIDE"
  const isSettlement = isBoardOverride && !!signoff.overrideTargetStatus

  const titleText = isBoardOverride
    ? "Scrum Master 代簽"
    : isDevLink
    ? "開發端已首次交付 APP，請確認收到"
    : isDesignChange
    ? "「設計變更」等待您的確認"
    : `「${phaseLabel}」階段等待您的確認`
  const Icon = isBoardOverride ? ShieldCheck : isDevLink ? Smartphone : isDesignChange ? FileEdit : ClipboardCheck
  const borderClass = isBoardOverride ? "border-orange-300" : isDevLink ? "border-sky-300" : isDesignChange ? "border-indigo-300" : "border-amber-300"
  const bgClass = isBoardOverride ? "bg-orange-50/80" : isDevLink ? "bg-sky-50/80" : isDesignChange ? "bg-indigo-50/80" : "bg-amber-50/80"
  const iconClass = isBoardOverride ? "text-orange-600" : isDevLink ? "text-sky-600" : isDesignChange ? "text-indigo-600" : "text-amber-600"
  const titleClass = isBoardOverride ? "text-orange-900" : isDevLink ? "text-sky-900" : isDesignChange ? "text-indigo-900" : "text-amber-900"
  const subTextClass = isBoardOverride ? "text-orange-700/70" : isDevLink ? "text-sky-700/70" : isDesignChange ? "text-indigo-700/70" : "text-amber-700/70"
  const textareaClass = isBoardOverride
    ? "bg-white border-orange-200 focus-visible:ring-orange-300"
    : isDevLink
    ? "bg-white border-sky-200 focus-visible:ring-sky-300"
    : isDesignChange
    ? "bg-white border-indigo-200 focus-visible:ring-indigo-300"
    : "bg-white border-amber-200 focus-visible:ring-amber-300"
  const fileBorderClass = isBoardOverride ? "border-orange-200" : isDevLink ? "border-sky-200" : isDesignChange ? "border-indigo-200" : "border-amber-200"

  // DC / board-override content to display inline (only when banner is not in inline/compact mode)
  const dcDocs = (signoff.documents || []).filter((d) => d.fileUrl)
  const showDcContent = (isDesignChange || isBoardOverride) && !inline && (signoff.requestComment || dcDocs.length > 0)

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

  // Shared action buttons content (used by both modes)
  const actionContent = (
    <div className={inline ? "" : "flex-1 min-w-0"}>
      {!inline && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn("font-semibold text-[15px] sm:text-sm leading-tight", titleClass)}>
              {titleText}
            </p>
            <Badge className={cn("text-[10px]", SIGNOFF_STATUS_MAP.PENDING.color)}>
              {SIGNOFF_STATUS_MAP.PENDING.label}
            </Badge>
          </div>
          <p className={cn("text-xs mt-1 leading-relaxed", subTextClass)}>
            由 {signoff.requestedBy.name} 於 {new Date(signoff.requestedAt).toLocaleDateString("zh-TW")}
            {isDesignChange ? ` 在「${phaseLabel}」階段發起設計變更` : isDevLink ? " 交付" : ""}
          </p>
        </>
      )}

      {/* 交付連結確認：確認即認列，按下之前先講清楚 */}
      {isDevLink && !inline && (
        <div className="mt-3 rounded-md bg-white/80 border border-sky-200 p-2.5 sm:p-3">
          <p className="text-[13px] sm:text-sm text-sky-900/80 leading-relaxed">
            {devLinkNote}
          </p>
        </div>
      )}

      {/* DC inline content: request comment + attachments */}
      {showDcContent && (
        <div className="mt-3 space-y-2">
          {signoff.requestComment && (
            <div className={cn("rounded-md bg-white/80 border p-2.5 sm:p-3", isBoardOverride ? "border-orange-200" : "border-indigo-200")}>
              <p className={cn("text-[13px] sm:text-sm whitespace-pre-line break-words leading-relaxed", isBoardOverride ? "text-orange-900/80" : "text-indigo-900/80")}>
                <span className={cn("font-medium", isBoardOverride ? "text-orange-700" : "text-indigo-700")}>{isBoardOverride ? "代簽原因：" : "提出說明："}</span>
                {signoff.requestComment}
              </p>
            </div>
          )}

          {isBoardOverride && signoff.overrideTargetStatus && (() => {
            const pct = Math.round((SP_PROGRESS_RATE[signoff.overrideTargetStatus] ?? 0) * 100)
            const settled = effectiveSp != null ? effectiveSp * (SP_PROGRESS_RATE[signoff.overrideTargetStatus] ?? 0) : null
            return (
              <div className="rounded-md bg-orange-100/70 border border-orange-300 p-2.5 sm:p-3 flex items-start gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-orange-600 mt-0.5 shrink-0" />
                <p className="text-[13px] sm:text-sm text-orange-900/80 leading-relaxed">
                  確認後<span className="font-medium">直接結案</span>，
                  {settled != null
                    ? <>結算 <span className="font-semibold">{formatSp(settled)} SP</span>（原 {effectiveSp != null ? formatSp(effectiveSp) : "-"} × {pct}%）。</>
                    : <>依目前進度消耗 <span className="font-semibold">{pct}%</span> SP。</>}
                </p>
              </div>
            )
          })()}

          {dcDocs.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Paperclip className={cn("h-3.5 w-3.5", isBoardOverride ? "text-orange-500" : "text-indigo-500")} />
                <span className={cn("text-xs font-medium", isBoardOverride ? "text-orange-700" : "text-indigo-700")}>附件文件</span>
              </div>
              <div className="space-y-1">
                {dcDocs.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.fileUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn("flex items-center gap-2 rounded-md bg-white/80 border px-3 py-1.5 text-xs sm:text-sm hover:bg-white transition-colors", isBoardOverride ? "border-orange-200" : "border-indigo-200")}
                  >
                    <FileIcon className={cn("h-3.5 w-3.5 shrink-0", isBoardOverride ? "text-orange-500" : "text-indigo-500")} />
                    <span className={cn("truncate flex-1", isBoardOverride ? "text-orange-900/80" : "text-indigo-900/80")}>{doc.fileName}</span>
                    {doc.fileSize != null && (
                      <span className={cn("text-[10px] shrink-0", isBoardOverride ? "text-orange-500/70" : "text-indigo-500/70")}>
                        {formatFileSize(doc.fileSize)}
                      </span>
                    )}
                    <Download className={cn("h-3 w-3 shrink-0", isBoardOverride ? "text-orange-400" : "text-indigo-400")} />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {blocked && !isDesignChange && !isBoardOverride ? (
            <div className={cn("flex items-center gap-1.5 text-xs text-indigo-700 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5", !inline && "mt-2")}>
              <FileEdit className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 min-w-0">{blockedMessage || "有尚未通過的設計變更，需先完成審核並通過才能進行此階段確認。"}</span>
              {onGoToDesignChange && (
                <button onClick={onGoToDesignChange} className="font-medium hover:underline shrink-0 whitespace-nowrap">前往設計變更 →</button>
              )}
            </div>
          ) : !showForm ? (
            <div className={cn("flex items-center gap-2 sm:justify-end", !inline && "mt-3")}>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1 sm:flex-none h-10 sm:h-9"
                onClick={() => handleAction("approve")}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                {isSettlement ? "確認結算" : isDevLink ? "確認收到，開啟連結" : "確認通過"}
              </Button>
              {!isDevLink && (
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    "bg-white flex-1 sm:flex-none h-10 sm:h-9",
                    isSettlement ? "border-blue-300 text-blue-600 hover:bg-blue-50" : "border-red-300 text-red-600 hover:bg-red-50"
                  )}
                  onClick={() => setShowForm(true)}
                  disabled={loading}
                >
                  <X className="h-4 w-4 mr-1" />
                  {isSettlement ? "需求繼續" : "退回修改"}
                </Button>
              )}
            </div>
          ) : (
            <div className={cn("space-y-2", !inline && "mt-3")}>
              <Textarea
                placeholder={isSettlement ? "請說明需求繼續的原因（必填）..." : "請說明退回原因（必填）..."}
                value={comment}
                onChange={(e) => { setComment(e.target.value); setError("") }}
                rows={3}
                className={cn("text-sm", textareaClass)}
              />

              {/* Selected files list */}
              {files.length > 0 && (
                <div className="space-y-1">
                  {files.map((f, i) => (
                    <div key={`${f.name}-${i}`} className={cn("flex items-center gap-2 rounded bg-white border px-2 py-1 text-xs", fileBorderClass)}>
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

              {/* Action row: attach left, cancel/reject right (wraps on mobile) */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.md,.txt,.jpg,.jpeg,.png,.gif,.webp"
              />
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-muted-foreground bg-white h-10 sm:h-9 w-full sm:w-auto"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                >
                  <Paperclip className="h-3.5 w-3.5 mr-1" />
                  附加檔案
                </Button>
                <div className="flex items-center gap-2 sm:ml-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-muted-foreground bg-white flex-1 sm:flex-none h-10 sm:h-9"
                    onClick={() => { setShowForm(false); setComment(""); setError(""); setFiles([]) }}
                    disabled={loading}
                  >
                    取消
                  </Button>
                  <Button
                    size="sm"
                    variant={isSettlement ? "default" : "destructive"}
                    onClick={() => handleAction("reject")}
                    disabled={loading}
                    className={cn("flex-1 sm:flex-none h-10 sm:h-9", isSettlement && "bg-blue-600 hover:bg-blue-700 text-white")}
                  >
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                    {isSettlement ? "確認繼續" : "確認退回"}
                  </Button>
                </div>
              </div>
            </div>
          )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )

  if (inline) return actionContent

  return (
    <div className={cn("rounded-lg border-2 p-3 sm:p-4", borderClass, bgClass)}>
      <div className="flex items-start gap-2.5 sm:gap-3">
        <Icon className={cn("h-5 w-5 shrink-0 mt-px sm:mt-0.5", iconClass)} />
        {actionContent}
      </div>
    </div>
  )
}

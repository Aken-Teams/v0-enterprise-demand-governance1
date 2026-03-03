"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ChevronLeft, ChevronRight, Check, Circle, Info, AlertTriangle, ClipboardCheck, RefreshCw, Loader2 } from "lucide-react"
import {
  PIPELINE_STEPS,
  STATUS_MAP,
  PHASE_DOCUMENT_MAP,
  DOCUMENT_TYPE_LABELS,
  SIGNOFF_REQUIRED_PHASES,
} from "@/lib/constants/demand"

interface SignoffInfo {
  id: string
  phase: string
  status: string
}

interface StepNavigationProps {
  currentStatus: string
  demandId: string
  documents: { type: string; phase: string | null }[]
  token: string | null
  completedDate: string | null
  onStatusChange: (newStatus: string) => void
  /** Latest signoff for the current phase (if any) */
  pendingSignoff?: SignoffInfo | null
  /** Called after re-requesting signoff or force advance */
  onRefresh?: () => void
  /** Hide the signoff status indicator (when parent already shows it) */
  hideSignoffIndicator?: boolean
}

export function StepNavigation({
  currentStatus,
  demandId,
  documents,
  token,
  completedDate: existingCompletedDate,
  onStatusChange,
  pendingSignoff,
  onRefresh,
  hideSignoffIndicator,
}: StepNavigationProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [direction, setDirection] = useState<"next" | "prev">("next")
  const [loading, setLoading] = useState(false)
  const [inputCompletedDate, setInputCompletedDate] = useState("")
  const [forceComment, setForceComment] = useState("")
  const [showForceDialog, setShowForceDialog] = useState(false)
  const [reRequesting, setReRequesting] = useState(false)
  const [showReRequestDialog, setShowReRequestDialog] = useState(false)
  const [reRequestComment, setReRequestComment] = useState("")

  const currentIdx = PIPELINE_STEPS.indexOf(currentStatus as typeof PIPELINE_STEPS[number])
  if (currentIdx < 0) return null

  const canGoPrev = currentIdx > 0
  const canGoNext = currentIdx < PIPELINE_STEPS.length - 1

  const nextPhase = canGoNext ? PIPELINE_STEPS[currentIdx + 1] : null
  const prevPhase = canGoPrev ? PIPELINE_STEPS[currentIdx - 1] : null

  const signoffPhases = SIGNOFF_REQUIRED_PHASES as readonly string[]
  const isSignoffPhase = signoffPhases.includes(currentStatus)
  const hasPendingSignoff = pendingSignoff?.status === "PENDING"
  const isApproved = pendingSignoff?.status === "APPROVED"
  const isRejected = pendingSignoff?.status === "REJECTED"
  // Show re-request button if rejected and no new pending
  const canReRequest = isRejected && !hasPendingSignoff

  // Check required documents for current phase
  const requiredDocs = PHASE_DOCUMENT_MAP[currentStatus]?.required || []
  const missingDocs = requiredDocs.filter(
    (type) => !documents.some((d) => d.phase === currentStatus && d.type === type)
  )

  const handleClick = (dir: "next" | "prev") => {
    if (dir === "next" && hasPendingSignoff) {
      // Show force advance dialog instead
      setShowForceDialog(true)
      return
    }
    setDirection(dir)
    setShowConfirm(true)
  }

  const isMovingToClosed = direction === "next" && nextPhase === "CLOSED"

  const handleConfirm = async () => {
    if (!token) return
    setLoading(true)
    const targetStatus = direction === "next" ? nextPhase : prevPhase
    const payload: Record<string, unknown> = { status: targetStatus }
    if (targetStatus === "CLOSED" && inputCompletedDate) {
      payload.completedDate = inputCompletedDate
    }
    try {
      const res = await fetch(`/api/demands/${demandId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setShowConfirm(false)
        onStatusChange(targetStatus!)
      }
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  const handleForceAdvance = async () => {
    if (!token || !forceComment.trim()) return
    setLoading(true)
    const targetStatus = nextPhase
    const payload: Record<string, unknown> = {
      status: targetStatus,
      forceAdvance: true,
      forceComment: forceComment.trim(),
    }
    if (targetStatus === "CLOSED" && inputCompletedDate) {
      payload.completedDate = inputCompletedDate
    }
    try {
      const res = await fetch(`/api/demands/${demandId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setShowForceDialog(false)
        setForceComment("")
        onStatusChange(targetStatus!)
      }
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  const handleReRequest = async () => {
    if (!token) return
    setReRequesting(true)
    try {
      const res = await fetch(`/api/demands/${demandId}/signoffs`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ phase: currentStatus, requestComment: reRequestComment.trim() || null }),
      })
      if (res.ok) {
        setShowReRequestDialog(false)
        setReRequestComment("")
        onRefresh?.()
      }
    } catch { /* ignore */ } finally {
      setReRequesting(false)
    }
  }

  const targetLabel =
    direction === "next"
      ? STATUS_MAP[nextPhase || ""]?.label
      : STATUS_MAP[prevPhase || ""]?.label

  return (
    <div className="space-y-3">
      {/* Signoff status indicator */}
      {isSignoffPhase && !hideSignoffIndicator && (
        <div className="space-y-2">
          {hasPendingSignoff && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm text-amber-700">
              <ClipboardCheck className="h-4 w-4 shrink-0" />
              <span>等待需求者簽核確認中</span>
            </div>
          )}
          {isApproved && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-sm text-emerald-700">
              <Check className="h-4 w-4 shrink-0" />
              <span>需求者已簽核確認</span>
            </div>
          )}
        </div>
      )}
      {/* Re-request button (always show when rejected, even if indicator is hidden) */}
      {isSignoffPhase && canReRequest && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50/50 px-3 py-2 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>需求者已退回簽核</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-red-300 text-red-600 hover:bg-red-50"
            onClick={() => setShowReRequestDialog(true)}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            重新發起簽核
          </Button>
        </div>
      )}

      {currentStatus === "CLOSED" && !existingCompletedDate && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm text-amber-700">
          <Info className="h-4 w-4 shrink-0" />
          <span>請記得至下方基本資訊填寫<strong>實際結案日期</strong>，以確保交付率計算正確</span>
        </div>
      )}
      {currentStatus !== "CLOSED" && (
        <div className="flex items-center justify-between pt-3 border-t border-border/40">
          <Button
            variant="outline"
            size="sm"
            disabled={!canGoPrev}
            onClick={() => handleClick("prev")}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            上一步
          </Button>
          <Button
            size="sm"
            disabled={!canGoNext}
            onClick={() => handleClick("next")}
          >
            下一步
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Normal advance dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {direction === "next" ? "確認進入下一階段" : "確認回到上一階段"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  將狀態從「{STATUS_MAP[currentStatus]?.label}」變更為「{targetLabel}」
                </p>
                {direction === "next" && isApproved && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                    <div className="flex items-center gap-2 text-sm text-emerald-700">
                      <Check className="h-4 w-4" />
                      <span className="font-medium">需求者已簽核確認</span>
                    </div>
                  </div>
                )}
                {direction === "next" && missingDocs.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-amber-600">
                      以下必要文件尚未上傳：
                    </p>
                    {missingDocs.map((type) => (
                      <div key={type} className="flex items-center gap-2 text-sm text-amber-700">
                        <Circle className="h-3 w-3" />
                        {DOCUMENT_TYPE_LABELS[type] || type}
                      </div>
                    ))}
                    <p className="text-xs text-amber-600 mt-2">
                      您仍然可以繼續，但建議先補齊文件。
                    </p>
                  </div>
                )}
                {direction === "next" && missingDocs.length === 0 && requiredDocs.length > 0 && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-emerald-600">必要文件已齊全</p>
                    {requiredDocs.map((type) => (
                      <div key={type} className="flex items-center gap-2 text-sm text-emerald-700">
                        <Check className="h-3 w-3" />
                        {DOCUMENT_TYPE_LABELS[type] || type}
                      </div>
                    ))}
                  </div>
                )}
              {isMovingToClosed && (
                <>
                  <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                      <p className="text-xs font-semibold text-red-600">結案後注意事項</p>
                    </div>
                    <ul className="text-xs text-red-600 space-y-0.5 ml-6 list-disc">
                      <li>結案後先前內容將不可再修改</li>
                      <li>PM、工程師欄位與甘特圖將鎖定</li>
                      <li>已上傳的文件將無法刪除或修改</li>
                      <li>僅管理者可補充資料</li>
                    </ul>
                  </div>
                  <div className="rounded-lg border p-3 space-y-2">
                    <Label htmlFor="completedDate" className="text-sm font-medium">實際結案日期</Label>
                    <Input
                      id="completedDate"
                      type="date"
                      value={inputCompletedDate}
                      onChange={(e) => setInputCompletedDate(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">此日期將用於交付率計算，可稍後於基本資訊中補填</p>
                  </div>
                </>
              )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={loading}>
              確認變更
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Re-request signoff dialog */}
      <AlertDialog open={showReRequestDialog} onOpenChange={setShowReRequestDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>重新發起簽核</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  請說明針對退回意見所做的調整，讓需求者了解已修改的項目。此內容可稍後補填。
                </p>
                <Textarea
                  placeholder="說明已調整的內容（選填）..."
                  value={reRequestComment}
                  onChange={(e) => setReRequestComment(e.target.value)}
                  rows={4}
                  className="text-sm"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reRequesting}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleReRequest} disabled={reRequesting}>
              {reRequesting && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              送出簽核
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Force advance dialog (when signoff is pending) */}
      <AlertDialog open={showForceDialog} onOpenChange={setShowForceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>需求者尚未簽核</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  <div className="flex items-center gap-2 text-sm text-amber-700">
                    <ClipboardCheck className="h-4 w-4" />
                    <span>此階段的簽核請求仍在等待需求者確認</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  如確定要強制推進，系統將記錄為「管理者略過簽核」。請填寫略過原因：
                </p>
                <Textarea
                  placeholder="請說明略過簽核的原因（必填）..."
                  value={forceComment}
                  onChange={(e) => setForceComment(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>等待簽核</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForceAdvance}
              disabled={loading || !forceComment.trim()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              強制推進
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

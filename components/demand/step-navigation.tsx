"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ChevronLeft, ChevronRight, Check, Circle, Info, AlertTriangle } from "lucide-react"
import {
  PIPELINE_STEPS,
  STATUS_MAP,
  PHASE_DOCUMENT_MAP,
  DOCUMENT_TYPE_LABELS,
} from "@/lib/constants/demand"

interface StepNavigationProps {
  currentStatus: string
  demandId: string
  documents: { type: string; phase: string | null }[]
  token: string | null
  completedDate: string | null
  onStatusChange: (newStatus: string) => void
}

export function StepNavigation({
  currentStatus,
  demandId,
  documents,
  token,
  completedDate: existingCompletedDate,
  onStatusChange,
}: StepNavigationProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [direction, setDirection] = useState<"next" | "prev">("next")
  const [loading, setLoading] = useState(false)
  const [inputCompletedDate, setInputCompletedDate] = useState("")

  const currentIdx = PIPELINE_STEPS.indexOf(currentStatus as typeof PIPELINE_STEPS[number])
  if (currentIdx < 0) return null

  const canGoPrev = currentIdx > 0
  const canGoNext = currentIdx < PIPELINE_STEPS.length - 1

  const nextPhase = canGoNext ? PIPELINE_STEPS[currentIdx + 1] : null
  const prevPhase = canGoPrev ? PIPELINE_STEPS[currentIdx - 1] : null

  // Check required documents for current phase
  const requiredDocs = PHASE_DOCUMENT_MAP[currentStatus]?.required || []
  const missingDocs = requiredDocs.filter(
    (type) => !documents.some((d) => d.phase === currentStatus && d.type === type)
  )

  const handleClick = (dir: "next" | "prev") => {
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

  const targetLabel =
    direction === "next"
      ? STATUS_MAP[nextPhase || ""]?.label
      : STATUS_MAP[prevPhase || ""]?.label

  return (
    <>
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
    </>
  )
}

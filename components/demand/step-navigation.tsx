"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ChevronLeft, ChevronRight, Check, Circle } from "lucide-react"
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
  onStatusChange: () => void
}

export function StepNavigation({
  currentStatus,
  demandId,
  documents,
  token,
  onStatusChange,
}: StepNavigationProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [direction, setDirection] = useState<"next" | "prev">("next")
  const [loading, setLoading] = useState(false)

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

  const handleConfirm = async () => {
    if (!token) return
    setLoading(true)
    const targetStatus = direction === "next" ? nextPhase : prevPhase
    try {
      const res = await fetch(`/api/demands/${demandId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      })
      if (res.ok) {
        setShowConfirm(false)
        onStatusChange()
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
      <div className="flex items-center justify-between pt-3 border-t border-border/40">
        <Button
          variant="outline"
          size="sm"
          disabled={!canGoPrev}
          onClick={() => handleClick("prev")}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          上一步
          {prevPhase && (
            <span className="text-muted-foreground ml-1">
              ({STATUS_MAP[prevPhase]?.label})
            </span>
          )}
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

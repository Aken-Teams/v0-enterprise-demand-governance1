"use client"

import { useState, useRef } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronLeft, ChevronRight, Check, Circle, Info, AlertTriangle, ClipboardCheck, RefreshCw, Loader2, Paperclip, FileIcon, Trash2, ShieldCheck, X } from "lucide-react"
import {
  PIPELINE_STEPS,
  STATUS_MAP,
  PHASE_DOCUMENT_MAP,
  DOCUMENT_TYPE_LABELS,
  SIGNOFF_REQUIRED_PHASES,
} from "@/lib/constants/demand"

const CLOSING_STEP_BASE = ["簽核確認", "文件確認", "SP 調整"] as const
/** SP 有調整時，需勾選造成調整的設計變更並送董事會簽核，故多一個步驟 */
const CLOSING_STEP_DC = "關聯設計變更"
const CLOSING_STEP_LAST = "確認結案"

interface ApprovedDesignChange {
  id: string
  seq: number
  title: string
  /** 該設計變更最終通過版本的 SP 增減（未影響 SP 則為 0） */
  delta: number
}

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
  /** SP fields for closing adjustment */
  estimatedSp?: number
  confirmedSp?: number | null
  phasePlans?: { phase: string; plannedSp: number | null }[]
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
  estimatedSp,
  confirmedSp,
  phasePlans: propPhasePlans,
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
  const [reRequestFiles, setReRequestFiles] = useState<File[]>([])
  const reRequestFileRef = useRef<HTMLInputElement>(null)

  // SP adjustment state
  const [hasSpAdjustment, setHasSpAdjustment] = useState(false)
  const [adjustedSp, setAdjustedSp] = useState("")
  const [adjustmentReason, setAdjustmentReason] = useState("")
  const [phaseAllocations, setPhaseAllocations] = useState<Record<string, string>>({})

  // Closing wizard state
  const [showClosingWizard, setShowClosingWizard] = useState(false)
  const [closingStep, setClosingStep] = useState(0)
  // 結案 SP 調整需經董事會簽核，並附上造成調整的設計變更（僅限已通過者）
  const [approvedDcs, setApprovedDcs] = useState<ApprovedDesignChange[]>([])
  const [selectedDcIds, setSelectedDcIds] = useState<string[]>([])
  const [dcLoading, setDcLoading] = useState(false)
  /** 手動覆寫自動推算的 SP（例外情況才用，需寫明原因） */
  const [spOverride, setSpOverride] = useState(false)
  /** 推算明細預設收合——設計變更多時整片數字很雜 */
  const [spDetailOpen, setSpDetailOpen] = useState(false)
  /** 是否略過本階段簽核——由使用者明確勾選，不因前面階段略過而預設 */
  const [skipSignoff, setSkipSignoff] = useState(false)

  // 動態步驟：有 SP 調整才需要「關聯設計變更」
  const closingSteps = hasSpAdjustment
    ? [...CLOSING_STEP_BASE, CLOSING_STEP_DC, CLOSING_STEP_LAST]
    : [...CLOSING_STEP_BASE, CLOSING_STEP_LAST]
  const dcStepIndex = CLOSING_STEP_BASE.length // 3
  const lastStepIndex = closingSteps.length - 1

  // 開啟精靈時載入本需求已通過的設計變更
  const loadApprovedDcs = async () => {
    if (!token) return
    setDcLoading(true)
    try {
      const res = await fetch(`/api/demands/${demandId}/design-changes`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        type Rev = { version: number; status: string; affectsSp: boolean; spDelta: number | null }
        const list = (data.designChanges ?? []) as { id: string; seq: number; title: string; status: string; revisions: Rev[] }[]

        // 只認「最終通過版本」的 SP 增減：中途被駁回的版本不計入，
        // 例如提 +2 被退、改 +1 通過 → 只算 +1。
        const dcs: ApprovedDesignChange[] = list
          .filter((d) => d.status === "APPROVED")
          .map((d) => {
            const finalRev = [...(d.revisions ?? [])].reverse().find((r) => r.status === "APPROVED")
            const delta = finalRev?.affectsSp ? (finalRev.spDelta ?? 0) : 0
            return { id: d.id, seq: d.seq, title: d.title, delta }
          })
        setApprovedDcs(dcs)

        // 依設計變更紀錄自動帶入 SP，避免結案時重算或填出不一致的數字
        const totalDelta = dcs.reduce((sum, d) => sum + d.delta, 0)
        if (totalDelta !== 0) {
          setHasSpAdjustment(true)
          setAdjustedSp(String(currentEffectiveSp + totalDelta))
          setSelectedDcIds(dcs.filter((d) => d.delta !== 0).map((d) => d.id))
          const allocs: Record<string, string> = {}
          for (const phase of PIPELINE_STEPS) {
            const plan = propPhasePlans?.find((p) => p.phase === phase)
            if (plan?.plannedSp) allocs[phase] = String(plan.plannedSp)
          }
          setPhaseAllocations(allocs)
        }
      }
    } catch { /* 清單載入失敗不阻擋結案流程 */ } finally {
      setDcLoading(false)
    }
  }

  const currentEffectiveSp = confirmedSp ?? estimatedSp ?? 0
  // 已通過設計變更的 SP 累計影響 → 結案應有的 SP
  const dcTotalDelta = approvedDcs.reduce((sum, d) => sum + d.delta, 0)
  const suggestedSp = currentEffectiveSp + dcTotalDelta
  /** 有設計變更可依循且未勾選覆寫時，SP 由系統決定 */
  const spLocked = dcTotalDelta !== 0 && !spOverride

  // All-phase document status for closing wizard
  const allPhaseDocs = PIPELINE_STEPS.filter(p => p !== "CLOSED").map(phase => {
    const required = PHASE_DOCUMENT_MAP[phase]?.required || []
    const missing = required.filter(type => !documents.some(d => d.phase === phase && d.type === type))
    return { phase, required, missing, allUploaded: missing.length === 0 }
  }).filter(p => p.required.length > 0)
  const hasAnyMissingDocs = allPhaseDocs.some(p => !p.allUploaded)

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
    if (dir === "next" && nextPhase === "CLOSED") {
      setDirection("next")
      // 「略過本階段簽核」與「結案流程」是兩件事，各自獨立：
      // 先用本階段的略過對話框做決定（與其他階段一致），再進入結案精靈。
      if (hasPendingSignoff && !skipSignoff) {
        setShowForceDialog(true)
        return
      }
      setClosingStep(0)
      setShowClosingWizard(true)
      loadApprovedDcs()
      return
    }
    if (dir === "next" && hasPendingSignoff) {
      // Show force advance dialog instead
      setShowForceDialog(true)
      return
    }
    setDirection(dir)
    setShowConfirm(true)
  }

  const buildSpAdjustmentPayload = () => {
    if (!hasSpAdjustment || !adjustedSp) return null
    const newSp = parseInt(adjustedSp, 10)
    if (isNaN(newSp) || newSp < 1) return null
    const allocs: Record<string, number> = {}
    for (const phase of PIPELINE_STEPS) {
      if (phase === "CLOSED") continue
      const v = parseInt(phaseAllocations[phase] || "0", 10)
      allocs[phase] = Math.max(0, v)
    }
    return {
      newSp,
      reason: adjustmentReason.trim() || null,
      phaseAllocations: Object.keys(allocs).length > 0 ? allocs : null,
    }
  }

  const handleConfirm = async () => {
    if (!token) return
    setLoading(true)
    const targetStatus = direction === "next" ? nextPhase : prevPhase
    // 註：CLOSED 一律由結案精靈處理（見 handleClick），此路徑不會結案
    const payload: Record<string, unknown> = { status: targetStatus }
    try {
      const res = await fetch(`/api/demands/${demandId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setShowConfirm(false)
        onStatusChange(targetStatus!)
      } else {
        const e = await res.json().catch(() => ({}))
        toast.error(e.error || "推進失敗")
      }
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  const handleClosingConfirm = async () => {
    if (!token) return
    // 尚有待簽核時，必須由使用者明確選擇略過，並留下原因
    if (hasPendingSignoff && !skipSignoff) {
      toast.error("此階段仍有待簽核，請先完成簽核，或於第一步勾選「略過此階段簽核」")
      setClosingStep(0)
      return
    }
    if (skipSignoff && !forceComment.trim()) {
      toast.error("請於第一步填寫略過簽核的原因")
      setClosingStep(0)
      return
    }
    setLoading(true)
    const spAdj = buildSpAdjustmentPayload()

    // SP 有調整 → 先送董事會簽核，董事會全數同意後才由簽核端實際結案
    if (spAdj) {
      try {
        const res = await fetch(`/api/demands/${demandId}/closing-sp`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            newSp: spAdj.newSp,
            reason: spAdj.reason,
            phaseAllocations: spAdj.phaseAllocations,
            completedDate: inputCompletedDate || null,
            designChangeIds: selectedDcIds,
            override: spOverride,
            // 略過決定必須跟著送出，否則本階段簽核會一直停在待確認
            skipSignoff: hasPendingSignoff && skipSignoff,
            skipComment: forceComment.trim() || null,
          }),
        })
        if (res.ok) {
          setShowClosingWizard(false)
          toast.success("已送出董事會簽核，董事會同意後即完成結案")
          onRefresh?.()
        } else {
          const e = await res.json().catch(() => ({}))
          toast.error(e.error || "送出簽核失敗")
        }
      } catch { /* ignore */ } finally {
        setLoading(false)
      }
      return
    }

    // SP 未調整 → 照原流程直接結案
    const payload: Record<string, unknown> = { status: "CLOSED" }
    if (inputCompletedDate) payload.completedDate = inputCompletedDate
    if (hasPendingSignoff && skipSignoff) {
      payload.forceAdvance = true
      payload.forceComment = forceComment.trim()
    }
    try {
      const res = await fetch(`/api/demands/${demandId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setShowClosingWizard(false)
        onStatusChange("CLOSED")
      } else {
        const e = await res.json().catch(() => ({}))
        toast.error(e.error || "結案失敗")
      }
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  const handleForceAdvance = async () => {
    if (!token || !forceComment.trim()) return

    // 結案不在這裡送出——略過只是本階段的決定，
    // 結案仍須走完精靈（文件確認／SP 調整／關聯設計變更／董事會簽核）。
    if (nextPhase === "CLOSED") {
      setSkipSignoff(true)
      setShowForceDialog(false)
      setClosingStep(0)
      setShowClosingWizard(true)
      loadApprovedDcs()
      return
    }

    setLoading(true)
    const targetStatus = nextPhase
    const payload: Record<string, unknown> = {
      status: targetStatus,
      forceAdvance: true,
      forceComment: forceComment.trim(),
    }
    // 註：結案不會走到這裡（handleClick 已讓 CLOSED 一律進入結案精靈），
    // 故不再處理完成日期與 SP 調整——SP 調整必須經董事會簽核。
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
      } else {
        const e = await res.json().catch(() => ({}))
        toast.error(e.error || "推進失敗")
      }
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  const handleReRequest = async () => {
    if (!token) return
    setReRequesting(true)
    try {
      let res: Response
      if (reRequestFiles.length > 0) {
        const formData = new FormData()
        formData.set("phase", currentStatus)
        if (reRequestComment.trim()) formData.set("requestComment", reRequestComment.trim())
        for (const file of reRequestFiles) formData.append("files", file)
        res = await fetch(`/api/demands/${demandId}/signoffs`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        })
      } else {
        res = await fetch(`/api/demands/${demandId}/signoffs`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ phase: currentStatus, requestComment: reRequestComment.trim() || null }),
        })
      }
      if (res.ok) {
        setShowReRequestDialog(false)
        setReRequestComment("")
        setReRequestFiles([])
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
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/50 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-amber-700">
              <ClipboardCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span>等待需求者簽核確認中</span>
            </div>
          )}
          {isApproved && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-emerald-700">
              <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span>需求者已簽核確認</span>
            </div>
          )}
        </div>
      )}
      {/* Re-request button (always show when rejected, even if indicator is hidden) */}
      {isSignoffPhase && canReRequest && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50/50 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-red-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span>需求者已退回簽核</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-6 sm:h-7 text-[10px] sm:text-xs border-red-300 text-red-600 hover:bg-red-50"
            onClick={() => setShowReRequestDialog(true)}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            重新發起簽核
          </Button>
        </div>
      )}

      {currentStatus === "CLOSED" && !existingCompletedDate && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/50 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-amber-700">
          <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
          <span>請記得至下方基本資訊填寫<strong>實際結案日期</strong>，以確保交付率計算正確</span>
        </div>
      )}
      {currentStatus !== "CLOSED" && (
        <div className="flex items-center justify-between pt-2.5 sm:pt-3 border-t border-border/40">
          <Button
            variant="outline"
            size="sm"
            className="h-7 sm:h-8 text-xs sm:text-sm px-2.5 sm:px-3"
            disabled={!canGoPrev}
            onClick={() => handleClick("prev")}
          >
            <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
            上一步
          </Button>
          <Button
            size="sm"
            className="h-7 sm:h-8 text-xs sm:text-sm px-2.5 sm:px-3"
            disabled={!canGoNext}
            onClick={() => handleClick("next")}
          >
            下一步
            <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-0.5 sm:ml-1" />
          </Button>
        </div>
      )}

      {/* Normal advance dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[85vh] flex flex-col p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {direction === "next" ? "確認進入下一階段" : "確認回到上一階段"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 overflow-y-auto max-h-[60vh] pr-1">
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

      {/* Closing wizard dialog */}
      <AlertDialog open={showClosingWizard} onOpenChange={(open) => {
        setShowClosingWizard(open)
        if (!open) {
          setClosingStep(0)
          setHasSpAdjustment(false)
          setAdjustedSp("")
          setAdjustmentReason("")
          setPhaseAllocations({})
          setInputCompletedDate("")
          setSkipSignoff(false)
          setForceComment("")
          setSpOverride(false)
          setSpDetailOpen(false)
          setSelectedDcIds([])
        }
      }}>
        <AlertDialogContent className="max-w-[calc(100%-1rem)] sm:max-w-xl max-h-[90vh] sm:max-h-[85vh] flex flex-col p-0 gap-0">
          <AlertDialogTitle className="sr-only">結案確認</AlertDialogTitle>
          {/* Header with step indicator */}
          <div className="border-b px-3 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 shrink-0 relative">
            <button
              type="button"
              onClick={() => setShowClosingWizard(false)}
              className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="text-xs sm:text-sm text-muted-foreground mb-2.5 sm:mb-3 pr-6">
              將狀態從「{STATUS_MAP[currentStatus]?.label}」變更為「{STATUS_MAP["CLOSED"]?.label}」
            </p>
            {/* Step indicator */}
            <div className="flex items-center gap-0.5 overflow-x-auto pb-1 -mb-1">
              {closingSteps.map((title, i) => {
                const isActive = i === closingStep
                const isDone = i < closingStep
                return (
                  <div key={i} className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => i <= closingStep && setClosingStep(i)}
                      disabled={i > closingStep}
                      className={`flex items-center justify-center gap-1 sm:gap-1.5 rounded-md px-1.5 sm:px-2 py-1.5 sm:py-2 text-[10px] sm:text-xs font-medium transition-colors whitespace-nowrap
                        ${isActive ? "bg-primary text-primary-foreground" : isDone ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 cursor-pointer" : "bg-muted text-muted-foreground/50"}
                      `}
                    >
                      <span className={`flex items-center justify-center h-4 w-4 rounded-full text-[10px] font-bold shrink-0
                        ${isActive ? "bg-primary-foreground/20 text-primary-foreground" : isDone ? "bg-emerald-600 text-white" : "bg-muted-foreground/20 text-muted-foreground/50"}
                      `}>
                        {isDone ? <Check className="h-2.5 w-2.5" /> : i + 1}
                      </span>
                      <span className="whitespace-nowrap hidden sm:inline">{title}</span>
                    </button>
                    {i < closingSteps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Step content — scrollable */}
          <div className="px-3 sm:px-6 py-3 sm:py-4 overflow-y-auto flex-1 min-h-0">
            {/* Step 1: 簽核與注意事項 */}
            {closingStep === 0 && (
              <div className="space-y-3">
                {isApproved ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                    <div className="flex items-center gap-2 text-sm text-emerald-700">
                      <Check className="h-4 w-4 shrink-0" />
                      <span className="font-medium">需求者已簽核確認</span>
                    </div>
                  </div>
                ) : isRejected ? (
                  <div className="rounded-lg border border-red-200 bg-red-50/50 p-3">
                    <div className="flex items-center gap-2 text-sm text-red-700">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span className="font-medium">需求者已退回簽核，尚未重新發起</span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                    <div className="flex items-center gap-2 text-sm text-amber-700">
                      <ClipboardCheck className="h-4 w-4 shrink-0" />
                      <span className="font-medium">尚未取得需求者簽核</span>
                    </div>
                  </div>
                )}

                {/* 略過與否已在前一個對話框決定，這裡只呈現結果 */}
                {hasPendingSignoff && skipSignoff && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <p className="text-[13px] font-semibold text-amber-800">已選擇略過本階段簽核</p>
                    </div>
                    <p className="text-xs text-amber-700">
                      本輪待簽核將標記為「管理者略過」。原因：{forceComment.trim() || "（未填寫）"}
                    </p>
                  </div>
                )}

                <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                    <p className="text-sm font-semibold text-red-600">結案後注意事項</p>
                  </div>
                  <ul className="text-sm text-red-600 space-y-0.5 ml-6 list-disc">
                    <li>結案後先前內容將不可再修改</li>
                    <li>PM、工程師欄位與甘特圖將鎖定</li>
                    <li>已上傳的文件將無法刪除或修改</li>
                    <li>僅管理者可補充資料</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Step 2: 文件確認 */}
            {closingStep === 1 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">請確認各階段所需的文件是否已上傳完成：</p>
                {allPhaseDocs.map((pd, idx) => (
                  <div
                    key={pd.phase}
                    className={`rounded-lg border p-3 space-y-1.5 ${pd.allUploaded ? "border-emerald-200 bg-emerald-50/30" : "border-amber-200 bg-amber-50/30"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold shrink-0 ${pd.allUploaded ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"}`}>
                        {idx + 1}
                      </span>
                      <p className={`text-xs font-semibold ${pd.allUploaded ? "text-emerald-600" : "text-amber-600"}`}>
                        {STATUS_MAP[pd.phase]?.label}
                      </p>
                    </div>
                    {pd.required.map(type => {
                      const uploaded = documents.some(d => d.phase === pd.phase && d.type === type)
                      return (
                        <div key={type} className={`flex items-center gap-2 text-sm ml-7 ${uploaded ? "text-emerald-700" : "text-amber-700"}`}>
                          {uploaded ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Circle className="h-3 w-3 shrink-0" />}
                          {DOCUMENT_TYPE_LABELS[type] || type}
                        </div>
                      )
                    })}
                  </div>
                ))}
                {hasAnyMissingDocs && (
                  <p className="text-xs text-muted-foreground">部分文件尚未上傳，您仍然可以繼續結案，但建議先補齊。</p>
                )}
              </div>
            )}

            {/* Step 3: SP 與結案日期 */}
            {closingStep === 2 && (
              <div className="space-y-4">
                {/* SP Adjustment */}
                <div className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="spAdjustment"
                      checked={hasSpAdjustment}
                      disabled={spLocked}
                      onCheckedChange={(checked) => {
                        setHasSpAdjustment(!!checked)
                        if (checked && !adjustedSp) {
                          setAdjustedSp(String(currentEffectiveSp))
                          const allocs: Record<string, string> = {}
                          for (const phase of PIPELINE_STEPS) {
                            const plan = propPhasePlans?.find((p) => p.phase === phase)
                            if (plan?.plannedSp) allocs[phase] = String(plan.plannedSp)
                          }
                          setPhaseAllocations(allocs)
                        }
                      }}
                    />
                    <Label htmlFor="spAdjustment" className="text-sm font-medium cursor-pointer">是否有 SP 調整？</Label>
                    <span className="text-xs text-muted-foreground ml-auto">目前 {currentEffectiveSp} SP</span>
                  </div>

                  {/* 依已通過的設計變更自動推算，數字與設計變更紀錄保持一致 */}
                  {dcTotalDelta !== 0 && (() => {
                    const contributing = approvedDcs.filter((d) => d.delta !== 0)
                    return (
                      <div className="rounded-md border border-indigo-200 bg-indigo-50/60 p-2.5 space-y-1.5">
                        {/* 一行結論就夠——明細收在下方，設計變更再多也不會洗版 */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-indigo-900">
                            {currentEffectiveSp} → {suggestedSp} SP
                          </span>
                          <span className={`text-[11px] font-medium rounded px-1.5 py-px ${dcTotalDelta > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                            {dcTotalDelta > 0 ? `+${dcTotalDelta}` : String(dcTotalDelta)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSpDetailOpen((v) => !v)}
                            className="ml-auto text-xs text-indigo-600 hover:underline shrink-0"
                          >
                            {spDetailOpen ? "收合" : `${contributing.length} 筆設計變更明細`}
                          </button>
                        </div>

                        {spDetailOpen && (
                          <div className="space-y-0.5 border-t border-indigo-200 pt-1.5">
                            <div className="flex items-center justify-between text-xs text-indigo-700">
                              <span>專案原始 SP</span><span className="font-medium">{currentEffectiveSp}</span>
                            </div>
                            {contributing.map((d) => (
                              <div key={d.id} className="flex items-center justify-between text-xs text-indigo-700">
                                <span className="truncate">DC-{String(d.seq).padStart(2, "0")} {d.title}</span>
                                <span className="font-medium shrink-0 ml-2">{d.delta > 0 ? `+${d.delta}` : String(d.delta)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox checked={spOverride} onCheckedChange={(c) => setSpOverride(!!c)} />
                          <span className="text-xs text-indigo-700">手動覆寫（需說明原因）</span>
                        </label>
                      </div>
                    )
                  })()}
                  {hasSpAdjustment && (
                    <div className="space-y-3 pt-1">
                      {!spLocked && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">調整後 SP</Label>
                          <Input
                            type="number"
                            min={1}
                            value={adjustedSp}
                            onChange={(e) => setAdjustedSp(e.target.value)}
                            placeholder="輸入新的 SP"
                            className="h-8"
                          />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          調整原因{spOverride ? "（必填）" : dcTotalDelta !== 0 ? "（選填）" : ""}
                        </Label>
                        <Textarea
                          value={adjustmentReason}
                          onChange={(e) => setAdjustmentReason(e.target.value)}
                          placeholder="說明 SP 調整的原因..."
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">各階段 SP 分配</Label>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                          {PIPELINE_STEPS.filter((p) => p !== "CLOSED").map((phase) => (
                            <div key={phase} className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground w-16 shrink-0 truncate">{STATUS_MAP[phase]?.label}</span>
                              <Input
                                type="number"
                                min={0}
                                className="h-7 text-xs"
                                placeholder="0"
                                value={phaseAllocations[phase] || ""}
                                onChange={(e) => setPhaseAllocations((prev) => ({ ...prev, [phase]: e.target.value }))}
                              />
                            </div>
                          ))}
                        </div>
                        {(() => {
                          const allocated = PIPELINE_STEPS.reduce((sum, p) => sum + (parseInt(phaseAllocations[p] || "0", 10) || 0), 0)
                          const total = parseInt(adjustedSp, 10) || 0
                          const diff = total - allocated
                          return (
                            <p className={`text-xs ${diff === 0 ? "text-emerald-600" : diff > 0 ? "text-amber-600" : "text-destructive"}`}>
                              已分配 {allocated} / {total} SP
                              {diff !== 0 && (diff > 0 ? ` （剩餘 ${diff}）` : ` （超出 ${Math.abs(diff)}）`)}
                            </p>
                          )
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Completed Date */}
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
              </div>
            )}

            {/* Step 4: 確認結案 */}
            {hasSpAdjustment && closingStep === dcStepIndex && (
              <div className="space-y-3">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-[13px] text-amber-800 font-medium">此次結案調整了 SP，需經董事會簽核</p>
                  <p className="text-xs text-amber-700 mt-1">
                    {dcTotalDelta !== 0
                      ? "影響 SP 的設計變更已自動勾選，數字即依這些變更推算而來。送出後需求不會立即結案，待董事會同意後才完成結案。"
                      : "請勾選造成本次 SP 調整的設計變更，讓董事會了解調整來由（這些變更董事會皆已簽核過）。送出後需求不會立即結案，待董事會同意後才完成結案。"}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground line-through">{currentEffectiveSp} SP</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  <span className="font-semibold text-primary">{adjustedSp} SP</span>
                </div>

                {dcLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />載入設計變更…
                  </div>
                ) : approvedDcs.length === 0 ? (
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">此需求沒有已通過的設計變更。</p>
                    <p className="text-[11px] text-muted-foreground mt-1">請於上一步填寫 SP 調整原因，董事會將依此判斷。</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {approvedDcs.map((dc) => (
                      <label
                        key={dc.id}
                        className="flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer hover:bg-muted/40"
                      >
                        <Checkbox
                          checked={selectedDcIds.includes(dc.id)}
                          onCheckedChange={(c) =>
                            setSelectedDcIds((prev) =>
                              c ? [...prev, dc.id] : prev.filter((x) => x !== dc.id)
                            )
                          }
                          className="mt-0.5"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-mono text-xs text-muted-foreground mr-1.5">
                            DC-{String(dc.seq).padStart(2, "0")}
                          </span>
                          <span className="text-sm">{dc.title}</span>
                        </span>
                        {dc.delta !== 0 && (
                          <span className={`text-xs font-medium shrink-0 ${dc.delta > 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {dc.delta > 0 ? `+${dc.delta}` : String(dc.delta)} SP
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}

                {approvedDcs.length > 0 && selectedDcIds.length === 0 && !adjustmentReason.trim() && (
                  <p className="text-[11px] text-amber-600">
                    請至少勾選一項設計變更，或回上一步填寫調整原因。
                  </p>
                )}
              </div>
            )}

            {closingStep === lastStepIndex && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-2">
                  {hasSpAdjustment
                    ? "請確認以下資訊無誤後送出。因本次調整了 SP，將先送董事會簽核，同意後才完成結案。"
                    : "請確認以下結案資訊無誤後，按下「確認結案」完成操作。"}
                </p>

                {/* Summary: 簽核 */}
                <div className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">簽核狀態</span>
                    <button type="button" onClick={() => setClosingStep(0)} className="text-xs text-primary hover:underline font-medium">修改</button>
                  </div>
                  {isApproved ? (
                    <div className="flex items-center gap-1.5 text-sm text-emerald-700">
                      <Check className="h-3.5 w-3.5" />
                      需求者已簽核確認
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-sm text-amber-700">
                      <ClipboardCheck className="h-3.5 w-3.5" />
                      {isRejected ? "需求者已退回簽核" : "尚未取得需求者簽核"}
                    </div>
                  )}
                </div>

                {/* Summary: 文件 */}
                <div className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">文件狀態</span>
                    <button type="button" onClick={() => setClosingStep(1)} className="text-xs text-primary hover:underline font-medium">查看</button>
                  </div>
                  <div className={`flex items-center gap-1.5 text-sm ${hasAnyMissingDocs ? "text-amber-700" : "text-emerald-700"}`}>
                    {hasAnyMissingDocs ? <AlertTriangle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    {hasAnyMissingDocs ? "部分階段文件尚未上傳" : "全部階段必要文件已齊全"}
                  </div>
                </div>

                {/* Summary: SP */}
                <div className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">SP 點數</span>
                    <button type="button" onClick={() => setClosingStep(2)} className="text-xs text-primary hover:underline font-medium">修改</button>
                  </div>
                  {hasSpAdjustment ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground line-through">{currentEffectiveSp} SP</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <span className="font-semibold text-primary">{adjustedSp} SP</span>
                      </div>
                      {adjustmentReason && <p className="text-xs text-muted-foreground">原因：{adjustmentReason}</p>}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        {PIPELINE_STEPS.filter(p => p !== "CLOSED").map(phase => {
                          const v = parseInt(phaseAllocations[phase] || "0", 10) || 0
                          if (v <= 0) return null
                          return (
                            <span key={phase} className="text-xs text-muted-foreground">
                              {STATUS_MAP[phase]?.label}: <span className="font-medium text-foreground">{v}</span>
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm">{currentEffectiveSp} SP（未調整）</p>
                  )}
                </div>

                {/* Summary: 關聯設計變更 */}
                {hasSpAdjustment && (
                  <div className="rounded-lg border p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">關聯設計變更</span>
                      <button type="button" onClick={() => setClosingStep(dcStepIndex)} className="text-xs text-primary hover:underline font-medium">修改</button>
                    </div>
                    {selectedDcIds.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {approvedDcs.filter((d) => selectedDcIds.includes(d.id)).map((d) => (
                          <span key={d.id} className="text-xs rounded border px-1.5 py-0.5 bg-muted/40">
                            DC-{String(d.seq).padStart(2, "0")} {d.title}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">未勾選（將以調整原因說明）</p>
                    )}
                  </div>
                )}

                {/* Summary: 結案日期 */}
                <div className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">實際結案日期</span>
                    <button type="button" onClick={() => setClosingStep(2)} className="text-xs text-primary hover:underline font-medium">修改</button>
                  </div>
                  <p className="text-sm">
                    {inputCompletedDate || <span className="text-muted-foreground">未填寫（可稍後補填）</span>}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer with navigation */}
          <div className="border-t px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between shrink-0">
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => { if (closingStep === 0) setShowClosingWizard(false); else setClosingStep(closingStep - 1) }}
            >
              {closingStep === 0 ? "取消" : <><ChevronLeft className="h-4 w-4 mr-1" />上一步</>}
            </Button>
            <span className="text-xs text-muted-foreground">{closingStep + 1} / {closingSteps.length}</span>
            {closingStep < lastStepIndex ? (
              <Button size="sm" onClick={() => setClosingStep(closingStep + 1)}>
                下一步<ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                size="sm"
                variant="default"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={handleClosingConfirm}
                disabled={
                  loading ||
                  (hasSpAdjustment && (
                    !adjustedSp ||
                    parseInt(adjustedSp, 10) < 1 ||
                    // 需可歸因：有已通過的設計變更就得勾選，否則要有調整原因
                    (selectedDcIds.length === 0 && !adjustmentReason.trim())
                  ))
                }
              >
                {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
                {hasSpAdjustment ? "送出董事會簽核" : "確認結案"}
              </Button>
            )}
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hidden file input for re-request */}
      <input
        ref={reRequestFileRef}
        type="file"
        multiple
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.md,.txt,.jpg,.jpeg,.png,.gif,.webp"
        onChange={(e) => {
          if (e.target.files) {
            const selected = Array.from(e.target.files).filter((f) => f.size <= 10 * 1024 * 1024)
            setReRequestFiles((prev) => [...prev, ...selected])
            e.target.value = ""
          }
        }}
      />

      {/* Re-request signoff dialog */}
      <AlertDialog open={showReRequestDialog} onOpenChange={(open) => { setShowReRequestDialog(open); if (!open) setReRequestFiles([]) }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg p-4 sm:p-6">
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
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">附件（選填）</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => reRequestFileRef.current?.click()}
                      disabled={reRequesting}
                    >
                      <Paperclip className="h-3 w-3 mr-1" />
                      選擇檔案
                    </Button>
                  </div>
                  {reRequestFiles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {reRequestFiles.map((f, i) => (
                        <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded bg-muted/50 border border-border/60 px-2 py-1.5 text-xs">
                          <FileIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate flex-1">{f.name}</span>
                          <span className="text-muted-foreground shrink-0">
                            {f.size < 1024 ? `${f.size} B` : f.size < 1024 * 1024 ? `${(f.size / 1024).toFixed(1)} KB` : `${(f.size / (1024 * 1024)).toFixed(1)} MB`}
                          </span>
                          <button
                            type="button"
                            className="text-red-400 hover:text-red-600 shrink-0"
                            onClick={() => setReRequestFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
        <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg p-4 sm:p-6">
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
                  {nextPhase === "CLOSED"
                    ? "如確定略過，系統將記錄為「管理者略過簽核」；確認後會接著進入結案流程。請填寫略過原因："
                    : "如確定要強制推進，系統將記錄為「管理者略過簽核」。請填寫略過原因："}
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
              {nextPhase === "CLOSED" ? "略過並繼續結案" : "強制推進"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

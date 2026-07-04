"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { FileEdit, FileIcon, Loader2, Paperclip, Trash2, ListChecks } from "lucide-react"

const MAX_FILE_SIZE = 10 * 1024 * 1024

/** 前端輕量解析 checklist 行數（與後端 parseChecklistMarkdown 對齊） */
function countChecklist(md: string): number {
  return md.split(/\r?\n/).filter((l) => /^(?:[-*+]|\d+\.)\s+\[[ xX]\]\s+\S/.test(l.trim())).length
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  demandId: string
  demandNumber: string
  phaseLabel: string
  token: string | null
  mode: "create" | "revise"
  dcId?: string
  /** 需求目前 SP（供 SP 影響評估） */
  currentSp: number
  /** revise 時帶入上一版內容 */
  initial?: { title: string; summary: string; checklistMd: string; affectsSp: boolean; spNote: string; spDelta: number | null }
  onComplete: () => void
}

export function DesignChangeEditorDialog({
  open, onOpenChange, demandId, demandNumber, phaseLabel, token, mode, dcId, currentSp, initial, onComplete,
}: Props) {
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [checklistMd, setChecklistMd] = useState("")
  const [affectsSp, setAffectsSp] = useState(false)
  const [spDirection, setSpDirection] = useState<"up" | "down">("up")
  const [spAmount, setSpAmount] = useState("")
  const [spNote, setSpNote] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "")
      setSummary(initial?.summary ?? "")
      setChecklistMd(initial?.checklistMd ?? "")
      setAffectsSp(initial?.affectsSp ?? false)
      const d = initial?.spDelta
      setSpDirection(d != null && d < 0 ? "down" : "up")
      setSpAmount(d != null ? String(Math.abs(d)) : "")
      setSpNote(initial?.spNote ?? "")
      setFiles([])
      setError("")
    }
  }, [open, initial])

  const spAmountNum = Number(spAmount)
  const spDelta = spDirection === "up" ? spAmountNum : -spAmountNum
  const spAfter = currentSp + (Number.isFinite(spDelta) ? spDelta : 0)
  // 下降不可超過目前 SP（調整後不可為負）
  const spExceeds = affectsSp && spDirection === "down" && Number.isFinite(spAmountNum) && spAmountNum > currentSp

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const selected = Array.from(e.target.files)
    const oversized = selected.filter((f) => f.size > MAX_FILE_SIZE)
    if (oversized.length > 0) setError(`檔案「${oversized[0].name}」超過 10MB 限制`)
    setFiles((prev) => [...prev, ...selected.filter((f) => f.size <= MAX_FILE_SIZE)])
    e.target.value = ""
  }

  const handleSubmit = async () => {
    if (mode === "create" && !title.trim()) { setError("請填寫變更標題"); return }
    if (!summary.trim()) { setError("請填寫變更摘要說明"); return }
    if (affectsSp && (!Number.isFinite(spAmountNum) || spAmountNum <= 0)) { setError("請填寫 SP 增減數量"); return }
    if (spExceeds) { setError(`下降不可超過目前 SP（${currentSp}），調整後不可為負數`); return }
    if (!token) return
    setLoading(true); setError("")
    try {
      const fd = new FormData()
      if (mode === "create") fd.append("title", title.trim())
      fd.append("summary", summary.trim())
      fd.append("checklistMd", checklistMd)
      fd.append("affectsSp", String(affectsSp))
      if (affectsSp) { fd.append("spDelta", String(spDelta)); fd.append("spNote", spNote.trim()) }
      files.forEach((f) => fd.append("files", f))

      const url = mode === "create"
        ? `/api/demands/${demandId}/design-changes`
        : `/api/demands/${demandId}/design-changes/${dcId}/revisions`
      const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd })
      if (res.ok) { onOpenChange(false); onComplete() }
      else { const d = await res.json().catch(() => ({})); setError(d.error || "提交失敗") }
    } catch { setError("網路錯誤") } finally { setLoading(false) }
  }

  const itemCount = countChecklist(checklistMd)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!loading) onOpenChange(o) }}>
      <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-2xl max-h-[90vh] flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <FileEdit className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
            {mode === "create" ? "提出設計變更" : "修訂設計變更（開新版本）"}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            於「{phaseLabel}」階段，需求 {demandNumber}。貼上 Markdown 檢查清單，系統會拆成逐條供需求方確認；僅留紀錄，不改變需求狀態或 SP。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 overflow-y-auto px-1 py-1">
          {mode === "create" && (
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">變更標題 <span className="text-red-500">*</span></Label>
              <Input value={title} onChange={(e) => { setTitle(e.target.value); setError("") }}
                placeholder="例如：KM 回答機器人 — 檔案格式限制調整" disabled={loading} className="text-sm" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs sm:text-sm">變更摘要說明 <span className="text-red-500">*</span></Label>
            <Textarea value={summary} onChange={(e) => { setSummary(e.target.value); setError("") }}
              placeholder="說明討論/測試中提出的變更內容（支援 Markdown）..." rows={4} disabled={loading} className="text-xs sm:text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs sm:text-sm flex items-center gap-1.5">
              <ListChecks className="h-3.5 w-3.5" />檢查清單 (Markdown)
              {itemCount > 0 && <span className="text-[11px] text-indigo-600 font-normal">偵測到 {itemCount} 個項目</span>}
            </Label>
            <Textarea value={checklistMd} onChange={(e) => setChecklistMd(e.target.value)}
              placeholder={"貼上 checklist，例如：\n- [x] 已更新 PRD 3.2 節\n- [ ] 已評估時程影響\n- [ ] 已通知需求方"}
              rows={5} disabled={loading} className="text-xs sm:text-sm font-mono" />
            <p className="text-[11px] text-muted-foreground">支援 <code>- [ ]</code> / <code>- [x]</code>，需求方會逐條確認或標記問題。</p>
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50/60 p-2.5 sm:p-3 space-y-2">
            <div className="flex items-start gap-2">
              <Checkbox id="dc-affects-sp" checked={affectsSp} onCheckedChange={(v) => setAffectsSp(!!v)} disabled={loading} className="mt-0.5" />
              <Label htmlFor="dc-affects-sp" className="text-xs sm:text-sm font-medium cursor-pointer leading-snug">
                此變更影響 SP（需求方通過後將送<strong>董事會</strong>審核）
              </Label>
            </div>
            {affectsSp && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-3 text-xs sm:text-sm flex-wrap">
                  <span className="text-muted-foreground">目前 SP：<strong className="text-foreground">{currentSp}</strong></span>
                  <div className="flex rounded-md border overflow-hidden">
                    <button type="button" onClick={() => setSpDirection("up")} disabled={loading}
                      className={spDirection === "up" ? "px-2.5 py-1 bg-emerald-600 text-white" : "px-2.5 py-1 text-muted-foreground hover:bg-muted"}>上調</button>
                    <button type="button" onClick={() => setSpDirection("down")} disabled={loading}
                      className={spDirection === "down" ? "px-2.5 py-1 bg-red-600 text-white border-l" : "px-2.5 py-1 text-muted-foreground hover:bg-muted border-l"}>下降</button>
                  </div>
                  <Input type="number" min="0" step="0.5" value={spAmount} onChange={(e) => { setSpAmount(e.target.value); setError("") }}
                    placeholder="數量" disabled={loading} className="h-8 w-24 text-sm" />
                  <span className="text-muted-foreground">SP</span>
                  <span className="text-muted-foreground">→ 調整後：<strong className={spExceeds ? "text-red-600" : spDelta > 0 ? "text-emerald-600" : spDelta < 0 ? "text-red-600" : "text-foreground"}>{Number.isFinite(spAfter) ? spAfter : currentSp} SP</strong>
                    {Number.isFinite(spDelta) && spDelta !== 0 && <span className="ml-1 text-[11px]">（{spDelta > 0 ? "+" : ""}{spDelta}）</span>}
                  </span>
                </div>
                {spExceeds && <p className="text-[11px] text-red-600">下降不可超過目前 SP（{currentSp}），調整後不可為負數。</p>}
                <Textarea value={spNote} onChange={(e) => setSpNote(e.target.value)}
                  placeholder="補充說明（選填，例如：因新增檔案格式解析）..." rows={2} disabled={loading} className="text-xs sm:text-sm" />
              </div>
            )}
          </div>

          {files.length > 0 && (
            <div className="space-y-1">
              {files.map((f, i) => (
                <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded bg-muted/40 border px-2 py-1.5 text-xs">
                  <FileIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1">{f.name}</span>
                  <button type="button" className="text-red-400 hover:text-red-600 shrink-0"
                    onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} disabled={loading}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.md,.txt,.jpg,.jpeg,.png,.gif,.webp" />
          <Button type="button" size="sm" variant="outline" className="h-7 sm:h-8 text-xs"
            onClick={() => fileInputRef.current?.click()} disabled={loading}>
            <Paperclip className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />附加檔案
          </Button>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs sm:text-sm" onClick={() => onOpenChange(false)} disabled={loading}>取消</Button>
          <Button size="sm" className="h-8 text-xs sm:text-sm bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50" onClick={handleSubmit} disabled={loading || spExceeds}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FileEdit className="h-3.5 w-3.5 mr-1" />}
            {mode === "create" ? "提交設計變更" : "送出新版本"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

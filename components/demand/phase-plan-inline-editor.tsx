"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { STATUS_MAP, PIPELINE_STEPS, PHASE_COLORS } from "@/lib/constants/demand"
import { Save, Loader2 } from "lucide-react"

interface PhasePlan {
  phase: string
  plannedSp: number | null
  plannedStart: string | null
  plannedEnd: string | null
}

interface PhasePlanInlineEditorProps {
  phasePlans: PhasePlan[]
  totalSp: number
  demandId: string
  token: string | null
  onSaved: () => void
}

function toDateInput(val: string | null) {
  if (!val) return ""
  return new Date(val).toISOString().slice(0, 10)
}

export function PhasePlanInlineEditor({
  phasePlans,
  totalSp,
  demandId,
  token,
  onSaved,
}: PhasePlanInlineEditorProps) {
  const [rows, setRows] = useState<
    { phase: string; plannedSp: string; plannedStart: string; plannedEnd: string }[]
  >([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setRows(
      PIPELINE_STEPS.map((phase) => {
        const plan = phasePlans.find((p) => p.phase === phase)
        return {
          phase,
          plannedSp: plan?.plannedSp != null ? String(plan.plannedSp) : "",
          plannedStart: toDateInput(plan?.plannedStart ?? null),
          plannedEnd: toDateInput(plan?.plannedEnd ?? null),
        }
      })
    )
  }, [phasePlans])

  const updateRow = (idx: number, field: string, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)))
  }

  const allocatedSp = rows.reduce((sum, r) => sum + (parseFloat(r.plannedSp) || 0), 0)
  const remaining = totalSp - allocatedSp

  const handleSave = async () => {
    if (!token) return
    setSaving(true)
    try {
      const phases = rows.map((r) => ({
        phase: r.phase,
        plannedSp: r.plannedSp ? parseFloat(r.plannedSp) : null,
        plannedStart: r.plannedStart || null,
        plannedEnd: r.plannedEnd || null,
      }))
      const res = await fetch(`/api/demands/${demandId}/phase-plans`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ phases }),
      })
      if (res.ok) onSaved()
    } catch {
      /* ignore */
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="grid grid-cols-[1fr_80px_120px_120px] gap-2 text-xs font-medium text-muted-foreground px-1">
        <span>階段</span>
        <span>SP</span>
        <span>計畫開始</span>
        <span>計畫結束</span>
      </div>

      {/* Rows */}
      {rows.map((row, idx) => (
        <div key={row.phase} className="grid grid-cols-[1fr_80px_120px_120px] gap-2 items-center">
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-sm shrink-0"
              style={{ backgroundColor: PHASE_COLORS[row.phase] }}
            />
            <span className="text-sm truncate">{STATUS_MAP[row.phase]?.label}</span>
          </div>
          <Input
            type="number"
            min={0}
            className="h-8 text-xs"
            placeholder="0"
            value={row.plannedSp}
            onChange={(e) => updateRow(idx, "plannedSp", e.target.value)}
          />
          <Input
            type="date"
            className="h-8 text-xs"
            value={row.plannedStart}
            onChange={(e) => updateRow(idx, "plannedStart", e.target.value)}
          />
          <Input
            type="date"
            className="h-8 text-xs"
            value={row.plannedEnd}
            onChange={(e) => updateRow(idx, "plannedEnd", e.target.value)}
          />
        </div>
      ))}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <div className="text-sm">
          <span className="text-muted-foreground">已分配：</span>
          <span className="font-semibold">{allocatedSp}</span>
          <span className="text-muted-foreground"> / {totalSp} SP</span>
          {remaining !== 0 && (
            <span className={remaining > 0 ? "text-amber-600 ml-2" : "text-destructive ml-2"}>
              ({remaining > 0 ? `剩餘 ${remaining}` : `超出 ${Math.abs(remaining)}`})
            </span>
          )}
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          儲存規劃
        </Button>
      </div>
    </div>
  )
}

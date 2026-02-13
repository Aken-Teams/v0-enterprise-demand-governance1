"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { STATUS_MAP, PIPELINE_STEPS, PHASE_COLORS } from "@/lib/constants/demand"
import { Save, Loader2 } from "lucide-react"

interface PhasePlan {
  phase: string
  plannedSp: number | null
  plannedStart: string | null
  plannedEnd: string | null
  engineer: { id: string; name: string } | null
  pm: { id: string; name: string } | null
}

interface PhasePlanInlineEditorProps {
  phasePlans: PhasePlan[]
  totalSp: number
  demandId: string
  token: string | null
  staffUsers: { id: string; name: string }[]
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
  staffUsers,
  onSaved,
}: PhasePlanInlineEditorProps) {
  const [rows, setRows] = useState<
    { phase: string; plannedSp: string; plannedStart: string; plannedEnd: string; engineerId: string }[]
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
          engineerId: plan?.engineer?.id || "",
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
        engineerId: r.engineerId || null,
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
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-center">階段</TableHead>
            <TableHead className="text-center w-[80px]">SP</TableHead>
            <TableHead className="text-center w-[130px]">計畫開始</TableHead>
            <TableHead className="text-center w-[130px]">計畫結束</TableHead>
            <TableHead className="text-center w-[140px]">負責人</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, idx) => (
            <TableRow key={row.phase} className="hover:bg-muted/30">
              <TableCell>
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-sm shrink-0"
                    style={{ backgroundColor: PHASE_COLORS[row.phase] }}
                  />
                  <span className="text-sm">{STATUS_MAP[row.phase]?.label}</span>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Input
                  type="number"
                  min={0}
                  className="h-8 text-xs text-center"
                  placeholder="0"
                  value={row.plannedSp}
                  onChange={(e) => updateRow(idx, "plannedSp", e.target.value)}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={row.plannedStart}
                  onChange={(e) => updateRow(idx, "plannedStart", e.target.value)}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={row.plannedEnd}
                  onChange={(e) => updateRow(idx, "plannedEnd", e.target.value)}
                />
              </TableCell>
              <TableCell>
                <Select
                  value={row.engineerId || "none"}
                  onValueChange={(v) => updateRow(idx, "engineerId", v === "none" ? "" : v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">未指派</SelectItem>
                    {staffUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

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

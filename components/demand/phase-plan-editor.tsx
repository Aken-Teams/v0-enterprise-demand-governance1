"use client"

import { useState, useEffect } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { STATUS_MAP, PIPELINE_STEPS } from "@/lib/constants/demand"

interface PhasePlan {
  phase: string
  plannedSp: number | null
  plannedStart: string | null
  plannedEnd: string | null
  engineer: { id: string; name: string } | null
  pm: { id: string; name: string } | null
}

interface UserOption {
  id: string
  name: string
}

interface PhasePlanEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  demandId: string
  phasePlans: PhasePlan[]
  totalSp: number
  token: string | null
  onSave: () => void
}

function toDateInput(dateStr: string | null): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  return d.toISOString().split("T")[0]
}

export function PhasePlanEditor({
  open,
  onOpenChange,
  demandId,
  phasePlans,
  totalSp,
  token,
  onSave,
}: PhasePlanEditorProps) {
  const [rows, setRows] = useState<
    {
      phase: string
      plannedSp: string
      plannedStart: string
      plannedEnd: string
      engineerId: string
      pmId: string
    }[]
  >([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setRows(
        PIPELINE_STEPS.map((phase) => {
          const plan = phasePlans.find((p) => p.phase === phase)
          return {
            phase,
            plannedSp: plan?.plannedSp?.toString() || "",
            plannedStart: toDateInput(plan?.plannedStart || null),
            plannedEnd: toDateInput(plan?.plannedEnd || null),
            engineerId: plan?.engineer?.id || "",
            pmId: plan?.pm?.id || "",
          }
        })
      )
      // Fetch delivery/admin users for engineer/PM selects
      if (token) {
        fetch("/api/organizations", {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(() => {
            // Use a simpler approach: fetch users from demands API filters
          })
          .catch(() => {})

        // Fetch available users (admin + delivery)
        fetch("/api/demands?_usersOnly=1", {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.filters?.developers) {
              setUsers(data.filters.developers)
            }
          })
          .catch(() => {})
      }
    }
  }, [open, phasePlans, token])

  const updateRow = (index: number, field: string, value: string) => {
    setRows((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const allocatedSp = rows.reduce((sum, r) => sum + (parseFloat(r.plannedSp) || 0), 0)
  const overAllocated = allocatedSp > totalSp

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
        pmId: r.pmId || null,
      }))

      const res = await fetch(`/api/demands/${demandId}/phase-plans`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phases }),
      })

      if (res.ok) {
        onOpenChange(false)
        onSave()
      }
    } catch { /* ignore */ } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>編輯階段規劃</DialogTitle>
        </DialogHeader>

        <div className="space-y-1">
          {/* Header row */}
          <div className="grid grid-cols-[130px_70px_110px_110px_110px_110px] gap-2 text-xs font-medium text-muted-foreground px-1">
            <span>階段</span>
            <span>SP</span>
            <span>計畫開始</span>
            <span>計畫結束</span>
            <span>工程師</span>
            <span>PM</span>
          </div>

          {rows.map((row, i) => {
            const showAssignment = i >= 1 // PRD_REVIEW onwards
            return (
              <div
                key={row.phase}
                className="grid grid-cols-[130px_70px_110px_110px_110px_110px] gap-2 items-center py-1"
              >
                <span className="text-sm font-medium truncate">
                  {STATUS_MAP[row.phase]?.label}
                </span>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={row.plannedSp}
                  onChange={(e) => updateRow(i, "plannedSp", e.target.value)}
                  className="h-8 text-sm"
                  placeholder="0"
                />
                <Input
                  type="date"
                  value={row.plannedStart}
                  onChange={(e) => updateRow(i, "plannedStart", e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  type="date"
                  value={row.plannedEnd}
                  onChange={(e) => updateRow(i, "plannedEnd", e.target.value)}
                  className="h-8 text-xs"
                />
                {showAssignment ? (
                  <Select
                    value={row.engineerId}
                    onValueChange={(v) => updateRow(i, "engineerId", v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="選擇" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">未指派</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
                {showAssignment ? (
                  <Select
                    value={row.pmId}
                    onValueChange={(v) => updateRow(i, "pmId", v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="選擇" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">未指派</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            )
          })}
        </div>

        {/* SP summary */}
        <div className="flex items-center justify-between text-sm px-1 pt-2 border-t">
          <span className="text-muted-foreground">
            已分配：{allocatedSp} / {totalSp} SP
          </span>
          {overAllocated && (
            <span className="text-destructive text-xs font-medium">
              超過估計 SP！
            </span>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

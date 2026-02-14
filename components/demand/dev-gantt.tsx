"use client"

import { useMemo, useState } from "react"
import { differenceInDays, format, addDays, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns"
import { zhTW } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2 } from "lucide-react"
import { DEFAULT_SUBTASK_TEMPLATES } from "@/lib/constants/demand"

interface SubTask {
  id: string
  name: string
  plannedStart: string | null
  plannedEnd: string | null
  actualStart: string | null
  actualEnd: string | null
  status: string
  assignee: { id: string; name: string } | null
  order: number
}

interface DevGanttProps {
  subTasks: SubTask[]
  demandId: string
  canEdit: boolean
  token: string | null
  onRefresh: () => void
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-400",
  in_progress: "bg-blue-500",
  completed: "bg-emerald-500",
}

const STATUS_LABELS: Record<string, string> = {
  pending: "待開始",
  in_progress: "進行中",
  completed: "已完成",
}

export function DevGantt({ subTasks, demandId, canEdit, token, onRefresh }: DevGanttProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newTaskName, setNewTaskName] = useState("")
  const [newTaskStart, setNewTaskStart] = useState("")
  const [newTaskEnd, setNewTaskEnd] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const { timelineStart, totalDays, months, rows } = useMemo(() => {
    const dates: Date[] = []
    for (const t of subTasks) {
      if (t.plannedStart) dates.push(new Date(t.plannedStart))
      if (t.plannedEnd) dates.push(new Date(t.plannedEnd))
      if (t.actualStart) dates.push(new Date(t.actualStart))
      if (t.actualEnd) dates.push(new Date(t.actualEnd))
    }
    dates.push(new Date())

    if (subTasks.length === 0) {
      return { timelineStart: null, totalDays: 0, months: [], rows: [] }
    }

    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))
    const tStart = startOfMonth(addDays(minDate, -7))
    const tEnd = endOfMonth(addDays(maxDate, 14))
    const total = differenceInDays(tEnd, tStart) || 1

    const monthsList = eachMonthOfInterval({ start: tStart, end: tEnd }).map((m) => {
      const mEnd = endOfMonth(m)
      const clampedEnd = mEnd > tEnd ? tEnd : mEnd
      return {
        date: m,
        left: (differenceInDays(m, tStart) / total) * 100,
        width: (differenceInDays(clampedEnd, m) / total) * 100,
        label: format(m, "M月", { locale: zhTW }),
      }
    })

    const rowData = subTasks.map((task) => {
      const pStart = task.plannedStart ? new Date(task.plannedStart) : null
      const pEnd = task.plannedEnd ? new Date(task.plannedEnd) : null
      const aStart = task.actualStart ? new Date(task.actualStart) : null
      const aEnd = task.actualEnd ? new Date(task.actualEnd) : null

      return {
        ...task,
        plannedBar:
          pStart && pEnd
            ? {
                left: (differenceInDays(pStart, tStart) / total) * 100,
                width: (differenceInDays(pEnd, pStart) / total) * 100,
              }
            : null,
        actualBar:
          aStart
            ? {
                left: (differenceInDays(aStart, tStart) / total) * 100,
                width: (differenceInDays(aEnd || new Date(), aStart) / total) * 100,
              }
            : null,
      }
    })

    return { timelineStart: tStart, totalDays: total, months: monthsList, rows: rowData }
  }, [subTasks])

  const handleAddTask = async () => {
    if (!token || !newTaskName.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/demands/${demandId}/sub-tasks`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTaskName.trim(),
          plannedStart: newTaskStart || null,
          plannedEnd: newTaskEnd || null,
          order: subTasks.length,
        }),
      })
      if (res.ok) {
        setShowAddDialog(false)
        setNewTaskName("")
        setNewTaskStart("")
        setNewTaskEnd("")
        onRefresh()
      }
    } catch { /* ignore */ } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!token) return
    try {
      const res = await fetch(`/api/demands/${demandId}/sub-tasks/${taskId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) onRefresh()
    } catch { /* ignore */ }
  }

  const handleStatusToggle = async (task: SubTask) => {
    if (!token || !canEdit) return
    const nextStatus =
      task.status === "pending" ? "in_progress" : task.status === "in_progress" ? "completed" : "pending"
    const today = new Date(new Date().toISOString().slice(0, 10)).toISOString()
    const body: Record<string, unknown> = { status: nextStatus }
    if (nextStatus === "in_progress" && !task.actualStart) body.actualStart = today
    if (nextStatus === "completed") body.actualEnd = today

    try {
      const res = await fetch(`/api/demands/${demandId}/sub-tasks/${task.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) onRefresh()
    } catch { /* ignore */ }
  }

  const todayLeft =
    timelineStart && totalDays > 0
      ? (differenceInDays(new Date(), timelineStart) / totalDays) * 100
      : -1

  const hasTimeline = totalDays > 0

  return (
    <TooltipProvider>
      <div className="space-y-2">
        {hasTimeline ? (
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Header */}
              <div className="grid grid-cols-[160px_1fr] border-b border-border/50 pb-1 mb-1">
                <div className="text-xs text-muted-foreground font-medium px-2">子任務</div>
                <div className="relative h-5">
                  {months.map((m, i) => (
                    <div
                      key={i}
                      className="absolute text-[10px] text-muted-foreground border-l border-border/30 pl-1"
                      style={{ left: `${m.left}%` }}
                    >
                      {m.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Rows */}
              {rows.map((row) => (
                <div key={row.id} className="grid grid-cols-[160px_1fr] items-center py-1.5 border-b border-border/20">
                  <div className="px-2 flex items-center gap-1.5 min-w-0">
                    {canEdit && (
                      <button
                        onClick={() => handleStatusToggle(row)}
                        className={cn("h-3 w-3 rounded-full shrink-0 transition-colors", STATUS_COLORS[row.status])}
                        title={STATUS_LABELS[row.status]}
                      />
                    )}
                    {!canEdit && (
                      <div className={cn("h-3 w-3 rounded-full shrink-0", STATUS_COLORS[row.status])} />
                    )}
                    <span className="text-xs truncate">{row.name}</span>
                    {row.assignee && (
                      <span className="text-[10px] text-muted-foreground ml-auto truncate">
                        {row.assignee.name}
                      </span>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => handleDeleteTask(row.id)}
                        className="text-muted-foreground/50 hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="relative h-6">
                    {row.plannedBar && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="absolute top-0.5 h-2.5 rounded-sm bg-violet-400/30"
                            style={{
                              left: `${row.plannedBar.left}%`,
                              width: `${Math.max(row.plannedBar.width, 0.5)}%`,
                            }}
                          />
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">計畫時程</TooltipContent>
                      </Tooltip>
                    )}
                    {row.actualBar && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="absolute top-3 h-2.5 rounded-sm bg-violet-500"
                            style={{
                              left: `${row.actualBar.left}%`,
                              width: `${Math.max(row.actualBar.width, 0.5)}%`,
                            }}
                          />
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">實際進度</TooltipContent>
                      </Tooltip>
                    )}
                    {todayLeft >= 0 && todayLeft <= 100 && row === rows[0] && (
                      <div
                        className="absolute top-0 h-[calc(100%+200px)] w-px border-l border-dashed border-destructive/50 z-10"
                        style={{ left: `${todayLeft}%` }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : subTasks.length > 0 ? (
          <div className="space-y-1">
            {subTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-2 py-1.5 px-2 rounded border border-border/30">
                {canEdit ? (
                  <button
                    onClick={() => handleStatusToggle(task)}
                    className={cn("h-3 w-3 rounded-full shrink-0", STATUS_COLORS[task.status])}
                  />
                ) : (
                  <div className={cn("h-3 w-3 rounded-full shrink-0", STATUS_COLORS[task.status])} />
                )}
                <span className="text-sm flex-1">{task.name}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {STATUS_LABELS[task.status]}
                </Badge>
                {canEdit && (
                  <button onClick={() => handleDeleteTask(task.id)} className="text-muted-foreground/50 hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-4">
            尚未建立子任務
          </div>
        )}

        {canEdit && (
          <div className="flex items-center gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              新增子任務
            </Button>
            {subTasks.length === 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={async () => {
                  if (!token) return
                  for (let i = 0; i < DEFAULT_SUBTASK_TEMPLATES.length; i++) {
                    await fetch(`/api/demands/${demandId}/sub-tasks`, {
                      method: "POST",
                      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                      body: JSON.stringify({ name: DEFAULT_SUBTASK_TEMPLATES[i], order: i }),
                    })
                  }
                  onRefresh()
                }}
              >
                使用預設模板
              </Button>
            )}
          </div>
        )}

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>新增子任務</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-sm">任務名稱</Label>
                <Input
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  placeholder="例如：前端開發"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">計畫開始</Label>
                  <Input type="date" value={newTaskStart} onChange={(e) => setNewTaskStart(e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm">計畫結束</Label>
                  <Input type="date" value={newTaskEnd} onChange={(e) => setNewTaskEnd(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>取消</Button>
              <Button onClick={handleAddTask} disabled={!newTaskName.trim() || submitting}>
                新增
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}

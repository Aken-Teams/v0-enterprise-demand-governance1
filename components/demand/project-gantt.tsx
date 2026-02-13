"use client"

import { useMemo, useState } from "react"
import { differenceInDays, format, addDays, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns"
import { zhTW } from "date-fns/locale"
import { STATUS_MAP, PIPELINE_STEPS, PHASE_COLORS } from "@/lib/constants/demand"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronRight, Plus, Trash2 } from "lucide-react"
import { DEFAULT_SUBTASK_TEMPLATES } from "@/lib/constants/demand"

interface PhasePlan {
  phase: string
  plannedSp: number | null
  plannedStart: string | null
  plannedEnd: string | null
  actualStart: string | null
  actualEnd: string | null
}

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

interface ProjectGanttProps {
  phasePlans: PhasePlan[]
  currentStatus: string
  subTasks?: SubTask[]
  demandId?: string
  canEdit?: boolean
  token?: string | null
  onRefresh?: () => void
}

const SUB_STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-400",
  in_progress: "bg-blue-500",
  completed: "bg-emerald-500",
}

const SUB_STATUS_LABELS: Record<string, string> = {
  pending: "待開始",
  in_progress: "進行中",
  completed: "已完成",
}

export function ProjectGantt({
  phasePlans,
  currentStatus,
  subTasks = [],
  demandId,
  canEdit = false,
  token,
  onRefresh,
}: ProjectGanttProps) {
  const [devExpanded, setDevExpanded] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newTaskName, setNewTaskName] = useState("")
  const [newTaskStart, setNewTaskStart] = useState("")
  const [newTaskEnd, setNewTaskEnd] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const { timelineStart, totalDays, months, rows, subRows } = useMemo(() => {
    const dates: Date[] = []
    for (const p of phasePlans) {
      if (p.plannedStart) dates.push(new Date(p.plannedStart))
      if (p.plannedEnd) dates.push(new Date(p.plannedEnd))
      if (p.actualStart) dates.push(new Date(p.actualStart))
      if (p.actualEnd) dates.push(new Date(p.actualEnd))
    }
    for (const t of subTasks) {
      if (t.plannedStart) dates.push(new Date(t.plannedStart))
      if (t.plannedEnd) dates.push(new Date(t.plannedEnd))
      if (t.actualStart) dates.push(new Date(t.actualStart))
      if (t.actualEnd) dates.push(new Date(t.actualEnd))
    }

    if (dates.length === 0) {
      return { timelineStart: null, totalDays: 0, months: [], rows: [], subRows: [] }
    }

    dates.push(new Date())
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))
    const tStart = startOfMonth(addDays(minDate, -7))
    const tEnd = endOfMonth(addDays(maxDate, 14))
    const total = differenceInDays(tEnd, tStart) || 1

    const monthsList = eachMonthOfInterval({ start: tStart, end: tEnd }).map((m) => {
      const mEnd = endOfMonth(m)
      const clampedEnd = mEnd > tEnd ? tEnd : mEnd
      return { date: m, left: (differenceInDays(m, tStart) / total) * 100, width: (differenceInDays(clampedEnd, m) / total) * 100, label: format(m, "M月", { locale: zhTW }) }
    })

    const phasePlanMap = Object.fromEntries(phasePlans.map((p) => [p.phase, p]))

    const calcBar = (start: Date | null, end: Date | null) => {
      if (!start || !end) return null
      return {
        left: (differenceInDays(start, tStart) / total) * 100,
        width: (differenceInDays(end, start) / total) * 100,
      }
    }

    const calcActualBar = (start: Date | null, end: Date | null) => {
      if (!start) return null
      return {
        left: (differenceInDays(start, tStart) / total) * 100,
        width: (differenceInDays(end || new Date(), start) / total) * 100,
      }
    }

    const rowData = PIPELINE_STEPS.map((phase) => {
      const plan = phasePlanMap[phase]
      const pStart = plan?.plannedStart ? new Date(plan.plannedStart) : null
      const pEnd = plan?.plannedEnd ? new Date(plan.plannedEnd) : null
      const aStart = plan?.actualStart ? new Date(plan.actualStart) : null
      const aEnd = plan?.actualEnd ? new Date(plan.actualEnd) : null
      return { phase, plannedBar: calcBar(pStart, pEnd), actualBar: calcActualBar(aStart, aEnd), sp: plan?.plannedSp }
    })

    const subRowData = subTasks.map((task) => {
      const pStart = task.plannedStart ? new Date(task.plannedStart) : null
      const pEnd = task.plannedEnd ? new Date(task.plannedEnd) : null
      const aStart = task.actualStart ? new Date(task.actualStart) : null
      const aEnd = task.actualEnd ? new Date(task.actualEnd) : null
      return { ...task, plannedBar: calcBar(pStart, pEnd), actualBar: calcActualBar(aStart, aEnd) }
    })

    return { timelineStart: tStart, totalDays: total, months: monthsList, rows: rowData, subRows: subRowData }
  }, [phasePlans, subTasks])

  // Sub-task actions
  const handleAddTask = async () => {
    if (!token || !newTaskName.trim() || !demandId) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/demands/${demandId}/sub-tasks`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTaskName.trim(), plannedStart: newTaskStart || null, plannedEnd: newTaskEnd || null, order: subTasks.length }),
      })
      if (res.ok) { setShowAddDialog(false); setNewTaskName(""); setNewTaskStart(""); setNewTaskEnd(""); onRefresh?.() }
    } catch { /* ignore */ } finally { setSubmitting(false) }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!token || !demandId) return
    try {
      const res = await fetch(`/api/demands/${demandId}/sub-tasks/${taskId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) onRefresh?.()
    } catch { /* ignore */ }
  }

  const handleStatusToggle = async (task: SubTask) => {
    if (!token || !canEdit || !demandId) return
    const nextStatus = task.status === "pending" ? "in_progress" : task.status === "in_progress" ? "completed" : "pending"
    const now = new Date().toISOString()
    const body: Record<string, unknown> = { status: nextStatus }
    if (nextStatus === "in_progress" && !task.actualStart) body.actualStart = now
    if (nextStatus === "completed") body.actualEnd = now
    try {
      const res = await fetch(`/api/demands/${demandId}/sub-tasks/${task.id}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (res.ok) onRefresh?.()
    } catch { /* ignore */ }
  }

  if (!timelineStart || totalDays === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
        尚未設定時程規劃
      </div>
    )
  }

  const todayLeft = (differenceInDays(new Date(), timelineStart) / totalDays) * 100
  const currentIdx = PIPELINE_STEPS.indexOf(currentStatus as typeof PIPELINE_STEPS[number])
  const devIdx = PIPELINE_STEPS.indexOf("DEVELOPING")
  const hasSubTasks = subTasks.length > 0
  const showDevSection = currentIdx >= PIPELINE_STEPS.indexOf("SP_REVIEW") || hasSubTasks

  // Count total rows for today marker height
  const expandedSubCount = devExpanded ? subRows.length : 0

  return (
    <TooltipProvider>
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Timeline header */}
          <div className="grid grid-cols-[160px_1fr] border-b border-border/50 pb-1 mb-1">
            <div className="text-sm text-muted-foreground font-medium px-2">階段</div>
            <div className="relative h-5">
              {months.map((m, i) => (
                <div key={i} className="absolute text-xs text-muted-foreground border-l border-border/30 pl-1" style={{ left: `${m.left}%` }}>
                  {m.label}
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          {rows.map((row, i) => {
            const info = STATUS_MAP[row.phase]
            const color = PHASE_COLORS[row.phase]
            const isCurrent = i === currentIdx
            const isPast = currentIdx >= 0 && i < currentIdx
            const isDev = row.phase === "DEVELOPING"
            const isExpandable = isDev && showDevSection

            return (
              <div key={row.phase}>
                {/* Phase row */}
                <div
                  className={cn(
                    "grid grid-cols-[160px_1fr] items-center py-2 border-b border-border/20",
                    isCurrent && "bg-primary/5",
                    isExpandable && "cursor-pointer",
                  )}
                  onClick={isExpandable ? () => setDevExpanded((v) => !v) : undefined}
                >
                  <div className="px-2 flex items-center gap-1.5">
                    {isExpandable && (
                      <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", devExpanded && "rotate-90")} />
                    )}
                    <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                    <span className={cn("text-sm truncate", isCurrent && "font-semibold", isPast && "text-muted-foreground")}>
                      {info?.label}
                    </span>
                    {hasSubTasks && isDev && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 rounded-full ml-auto">
                        {subTasks.length}
                      </Badge>
                    )}
                    {!isDev && row.sp != null && row.sp > 0 && (
                      <span className="text-xs text-muted-foreground ml-auto">{row.sp}SP</span>
                    )}
                  </div>
                  <div className="relative h-6">
                    {row.plannedBar && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="absolute top-0.5 h-2.5 rounded-sm opacity-30" style={{ left: `${row.plannedBar.left}%`, width: `${Math.max(row.plannedBar.width, 0.5)}%`, backgroundColor: color }} />
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">計畫時程</TooltipContent>
                      </Tooltip>
                    )}
                    {row.actualBar && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="absolute top-3 h-2.5 rounded-sm" style={{ left: `${row.actualBar.left}%`, width: `${Math.max(row.actualBar.width, 0.5)}%`, backgroundColor: color }} />
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">實際進度</TooltipContent>
                      </Tooltip>
                    )}
                    {todayLeft >= 0 && todayLeft <= 100 && i === 0 && (
                      <div className="absolute top-0 w-px border-l border-dashed border-destructive/50 z-10" style={{ left: `${todayLeft}%`, height: `calc(100% + ${(rows.length - 1 + expandedSubCount) * 36 + 16}px)` }} />
                    )}
                  </div>
                </div>

                {/* Sub-task rows (expanded under DEVELOPING) */}
                {isDev && devExpanded && (
                  <div className="bg-muted/30">
                    {subRows.length > 0 ? subRows.map((sub) => (
                      <div key={sub.id} className="grid grid-cols-[160px_1fr] items-center py-1.5 border-b border-border/10">
                        <div className="pl-8 pr-2 flex items-center gap-1.5 min-w-0">
                          {canEdit ? (
                            <button onClick={(e) => { e.stopPropagation(); handleStatusToggle(sub) }} className={cn("h-3 w-3 rounded-full shrink-0 transition-colors", SUB_STATUS_COLORS[sub.status])} title={SUB_STATUS_LABELS[sub.status]} />
                          ) : (
                            <div className={cn("h-3 w-3 rounded-full shrink-0", SUB_STATUS_COLORS[sub.status])} />
                          )}
                          <span className="text-xs truncate text-muted-foreground">{sub.name}</span>
                          {canEdit && (
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(sub.id) }} className="ml-auto text-muted-foreground/40 hover:text-destructive shrink-0">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        <div className="relative h-5">
                          {sub.plannedBar && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="absolute top-0.5 h-2 rounded-sm bg-violet-400/30" style={{ left: `${sub.plannedBar.left}%`, width: `${Math.max(sub.plannedBar.width, 0.5)}%` }} />
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">計畫時程</TooltipContent>
                            </Tooltip>
                          )}
                          {sub.actualBar && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="absolute top-2.5 h-2 rounded-sm bg-violet-500" style={{ left: `${sub.actualBar.left}%`, width: `${Math.max(sub.actualBar.width, 0.5)}%` }} />
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">實際進度</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    )) : (
                      <div className="py-2 text-center text-sm text-muted-foreground">尚未建立子任務</div>
                    )}
                    {canEdit && (
                      <div className="flex items-center gap-2 px-8 py-1.5">
                        <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={(e) => { e.stopPropagation(); setShowAddDialog(true) }}>
                          <Plus className="h-3 w-3 mr-1" />
                          新增子任務
                        </Button>
                        {subTasks.length === 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs px-2 text-muted-foreground"
                            onClick={async (e) => {
                              e.stopPropagation()
                              if (!token || !demandId) return
                              for (let i = 0; i < DEFAULT_SUBTASK_TEMPLATES.length; i++) {
                                await fetch(`/api/demands/${demandId}/sub-tasks`, {
                                  method: "POST",
                                  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                                  body: JSON.stringify({ name: DEFAULT_SUBTASK_TEMPLATES[i], order: i }),
                                })
                              }
                              onRefresh?.()
                            }}
                          >
                            使用預設模板
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Today label */}
          {todayLeft >= 0 && todayLeft <= 100 && (
            <div className="grid grid-cols-[160px_1fr]">
              <div />
              <div className="relative h-4">
                <span className="absolute text-[10px] text-destructive/70 -translate-x-1/2" style={{ left: `${todayLeft}%` }}>
                  今天
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Sub-task Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新增子任務</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">任務名稱</Label>
              <Input value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} placeholder="例如：前端開發" />
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
            <Button onClick={handleAddTask} disabled={!newTaskName.trim() || submitting}>新增</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}

"use client"

import { useMemo, useState, useRef, useCallback } from "react"
import { differenceInDays, format, addDays, startOfMonth, endOfMonth, startOfWeek, eachMonthOfInterval, eachWeekOfInterval, eachDayOfInterval } from "date-fns"
import { zhTW } from "date-fns/locale"
import { STATUS_MAP, PIPELINE_STEPS, PHASE_COLORS } from "@/lib/constants/demand"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronRight, Plus, Trash2, Calendar, User, ZoomIn, ZoomOut, RotateCcw } from "lucide-react"
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
  pending: "bg-amber-400",
  in_progress: "bg-blue-500",
  completed: "bg-emerald-500",
}

const SUB_BAR_COLORS: Record<string, string> = {
  pending: "bg-amber-400/25",
  in_progress: "bg-blue-500/25",
  completed: "bg-emerald-500/25",
}

const SUB_STATUS_LABELS: Record<string, string> = {
  pending: "待開始",
  in_progress: "進行中",
  completed: "已完成",
}

function fmtDate(d: string | null) {
  if (!d) return "未設定"
  return format(new Date(d), "yyyy/MM/dd")
}

function daysBetween(start: string | null, end: string | null) {
  if (!start || !end) return null
  return differenceInDays(new Date(end), new Date(start)) + 1
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
  const [devExpanded, setDevExpanded] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newTaskName, setNewTaskName] = useState("")
  const [newTaskStart, setNewTaskStart] = useState("")
  const [newTaskEnd, setNewTaskEnd] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(0) // 0=auto, 1..4=zoom levels

  // Focus range (drag-to-zoom)
  const [focusRange, setFocusRange] = useState<{ start: Date; end: Date } | null>(null)
  const [dragSelection, setDragSelection] = useState<{ startPct: number; endPct: number } | null>(null)
  const dragStartRef = useRef<number | null>(null)

  // Hover state
  const [hoverX, setHoverX] = useState<number | null>(null)
  const [hoverDate, setHoverDate] = useState<string | null>(null)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  const { timelineStart, totalDays, months, weeks, days, rows, subRows, dataSpanDays, showDayLabels } = useMemo(() => {
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
      return { timelineStart: null, totalDays: 0, months: [], weeks: [], days: [], rows: [], subRows: [], dataSpanDays: 0, showDayLabels: false }
    }

    dates.push(new Date())
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))
    const dataSpan = differenceInDays(maxDate, minDate) || 1

    // Compute timeline bounds
    let tStart: Date
    let tEnd: Date

    if (focusRange) {
      // Focused zoom: use selected range with small padding
      const focusSpan = differenceInDays(focusRange.end, focusRange.start) || 1
      const focusPad = Math.max(1, Math.round(focusSpan * 0.12))
      tStart = addDays(focusRange.start, -focusPad)
      tEnd = addDays(focusRange.end, focusPad)
    } else {
      // Compute padding based on zoom level
      // zoom 0 = auto (tight fit), 1-4 = progressively more padding
      let padBefore: number
      let padAfter: number
      if (zoomLevel === 0) {
        padBefore = Math.max(3, Math.round(dataSpan * 0.15))
        padAfter = Math.max(3, Math.round(dataSpan * 0.15))
      } else {
        const multiplier = zoomLevel
        padBefore = Math.max(7, Math.round(dataSpan * 0.3 * multiplier))
        padAfter = Math.max(7, Math.round(dataSpan * 0.3 * multiplier))
      }
      tStart = startOfWeek(addDays(minDate, -padBefore), { weekStartsOn: 1 })
      const rawEnd = addDays(maxDate, padAfter)
      tEnd = zoomLevel === 0 && dataSpan < 45 ? rawEnd : endOfMonth(rawEnd)
    }

    const total = differenceInDays(tEnd, tStart) || 1

    const monthsList = eachMonthOfInterval({ start: tStart, end: tEnd }).map((m) => {
      const mEnd = endOfMonth(m)
      const clampedStart = m < tStart ? tStart : m
      const clampedEnd = mEnd > tEnd ? tEnd : mEnd
      return {
        date: m,
        left: (differenceInDays(clampedStart, tStart) / total) * 100,
        width: ((differenceInDays(clampedEnd, clampedStart) + 1) / total) * 100,
        label: format(m, "M月", { locale: zhTW }),
      }
    })

    const weeksList = eachWeekOfInterval({ start: tStart, end: tEnd }, { weekStartsOn: 1 }).map((w) => ({
      left: (differenceInDays(w, tStart) / total) * 100,
    }))

    // Day labels — always show for reasonable spans
    const showDays = total <= 90
    const daysList = showDays
      ? eachDayOfInterval({ start: tStart, end: tEnd }).map((d) => ({
          date: d,
          left: (differenceInDays(d, tStart) / total) * 100,
          width: (1 / total) * 100,
          label: format(d, "d"),
          isWeekend: d.getDay() === 0 || d.getDay() === 6,
          isToday: differenceInDays(d, new Date()) === 0,
          isMonday: d.getDay() === 1,
        }))
      : []

    const phasePlanMap = Object.fromEntries(phasePlans.map((p) => [p.phase, p]))

    // Clamp bar to visible [0, 100] range; return null if fully outside
    const clampBar = (rawLeft: number, rawWidth: number) => {
      const right = rawLeft + rawWidth
      if (right <= 0 || rawLeft >= 100) return null
      const left = Math.max(0, rawLeft)
      const width = Math.min(100, right) - left
      return { left, width: Math.max(width, 0.5) }
    }

    const calcBar = (start: Date | null, end: Date | null) => {
      if (!start || !end) return null
      // +1 so same-day range (e.g. 2/11~2/11) fills the entire day cell
      const days = differenceInDays(end, start) + 1
      return clampBar((differenceInDays(start, tStart) / total) * 100, (days / total) * 100)
    }

    const calcActualBar = (start: Date | null, end: Date | null) => {
      if (!start) return null
      const e = end || new Date()
      const days = differenceInDays(e, start) + 1
      return clampBar((differenceInDays(start, tStart) / total) * 100, (days / total) * 100)
    }

    const rowData = PIPELINE_STEPS.map((phase) => {
      const plan = phasePlanMap[phase]
      const pStart = plan?.plannedStart ? new Date(plan.plannedStart) : null
      const pEnd = plan?.plannedEnd ? new Date(plan.plannedEnd) : null
      const aStart = plan?.actualStart ? new Date(plan.actualStart) : null
      const aEnd = plan?.actualEnd ? new Date(plan.actualEnd) : null
      return { phase, plan, plannedBar: calcBar(pStart, pEnd), actualBar: calcActualBar(aStart, aEnd), sp: plan?.plannedSp }
    })

    const subRowData = subTasks.map((task) => {
      const pStart = task.plannedStart ? new Date(task.plannedStart) : null
      const pEnd = task.plannedEnd ? new Date(task.plannedEnd) : null
      const aStart = task.actualStart ? new Date(task.actualStart) : null
      const aEnd = task.actualEnd ? new Date(task.actualEnd) : null
      return { ...task, plannedBar: calcBar(pStart, pEnd), actualBar: calcActualBar(aStart, aEnd) }
    })

    return { timelineStart: tStart, totalDays: total, months: monthsList, weeks: weeksList, days: daysList, rows: rowData, subRows: subRowData, dataSpanDays: dataSpan, showDayLabels: showDays }
  }, [phasePlans, subTasks, zoomLevel, focusRange])

  // Mouse tracking for crosshair + drag-to-zoom
  const getPct = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current) return null
    const rect = timelineRef.current.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    return pct >= 0 && pct <= 1 ? pct : null
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!timelineStart) return
      const pct = getPct(e)
      if (pct === null) {
        setHoverX(null)
        setHoverDate(null)
        return
      }
      // Update crosshair
      setHoverX(pct * 100)
      const day = Math.round(pct * totalDays)
      setHoverDate(format(addDays(timelineStart, day), "yyyy/MM/dd (EEE)", { locale: zhTW }))
      // Update drag selection
      if (dragStartRef.current !== null) {
        const startPct = Math.min(dragStartRef.current, pct * 100)
        const endPct = Math.max(dragStartRef.current, pct * 100)
        setDragSelection({ startPct, endPct })
      }
    },
    [timelineStart, totalDays, getPct],
  )

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const pct = getPct(e)
    if (pct === null) return
    dragStartRef.current = pct * 100
    setDragSelection(null)
  }, [getPct])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const dragStart = dragStartRef.current
    dragStartRef.current = null
    setDragSelection(null)
    if (dragStart === null || !timelineStart) return
    const pct = getPct(e)
    if (pct === null) return
    const minPct = Math.min(dragStart / 100, pct)
    const maxPct = Math.max(dragStart / 100, pct)
    // Need at least 3% drag to trigger zoom
    if (maxPct - minPct < 0.03) return
    const startDay = Math.floor(minPct * totalDays)
    const endDay = Math.ceil(maxPct * totalDays)
    setFocusRange({
      start: addDays(timelineStart, startDay),
      end: addDays(timelineStart, endDay),
    })
  }, [timelineStart, totalDays, getPct])

  const handleMouseLeave = useCallback(() => {
    setHoverX(null)
    setHoverDate(null)
    dragStartRef.current = null
    setDragSelection(null)
  }, [])

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
  const hasSubTasks = subTasks.length > 0
  const showDevSection = currentIdx >= PIPELINE_STEPS.indexOf("SP_REVIEW") || hasSubTasks

  const LEFT_COL = "220px"

  return (
    <>
      {/* Zoom controls */}
      <div className="flex items-center justify-end gap-1 mb-2">
        {focusRange && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs px-2 mr-1 text-primary"
            onClick={() => setFocusRange(null)}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            重置檢視
          </Button>
        )}
        <span className="text-[11px] text-muted-foreground mr-1">
          {totalDays <= 45 ? `${totalDays} 天` : `${Math.round(totalDays / 7)} 週`}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-6 w-6"
          onClick={() => setZoomLevel((z) => Math.max(0, z - 1))}
          disabled={zoomLevel === 0 || !!focusRange}
          title="放大（縮短時間範圍）"
        >
          <ZoomIn className="h-3 w-3" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-6 w-6"
          onClick={() => setZoomLevel((z) => Math.min(4, z + 1))}
          disabled={zoomLevel === 4 || !!focusRange}
          title="縮小（擴大時間範圍）"
        >
          <ZoomOut className="h-3 w-3" />
        </Button>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: focusRange ? "700px" : showDayLabels ? `${Math.max(700, totalDays * 28)}px` : "700px" }}>
          {/* Timeline header */}
          <div className="grid" style={{ gridTemplateColumns: `${LEFT_COL} 1fr` }}>
            <div className="border-b border-border/30" />
            <div>
              {/* Month row */}
              <div className="relative h-6 border-b border-border/30">
                {months.map((m, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full flex items-center text-xs font-medium text-muted-foreground border-l border-border/30 pl-2"
                    style={{ left: `${m.left}%`, width: `${m.width}%` }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
              {/* Day row */}
              {showDayLabels && (
                <div className="relative h-7 border-b border-border/30">
                  {days.map((d, i) => (
                    <div
                      key={i}
                      className={cn(
                        "absolute top-0 h-full flex items-center justify-center text-xs",
                        d.isMonday ? "border-l border-border/30 font-medium" : "border-l border-border/10",
                        d.isWeekend && "bg-muted/40 text-muted-foreground/50",
                        d.isToday && "bg-rose-500/10 font-bold text-rose-600",
                      )}
                      style={{ left: `${d.left}%`, width: `${d.width}%` }}
                    >
                      {d.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main body with crosshair area */}
          <div
            className="relative select-none"
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          >
            {/* Gridlines */}
            <div className="absolute inset-0 pointer-events-none" style={{ left: LEFT_COL }}>
              <div className="relative h-full w-full" ref={timelineRef}>
                {/* Weekend shading when day-level visible */}
                {showDayLabels && days.filter((d) => d.isWeekend).map((d, i) => (
                  <div
                    key={`we-${i}`}
                    className="absolute top-0 h-full bg-muted/20"
                    style={{ left: `${d.left}%`, width: `${d.width}%` }}
                  />
                ))}
                {/* Week lines */}
                {weeks.map((w, i) => (
                  <div
                    key={i}
                    className={cn("absolute top-0 h-full border-l", showDayLabels ? "border-border/20" : "border-border/10")}
                    style={{ left: `${w.left}%` }}
                  />
                ))}
              </div>
            </div>

            {/* Today marker */}
            {todayLeft >= 0 && todayLeft <= 100 && (
              <div
                className="absolute top-0 bottom-0 z-20 pointer-events-none"
                style={{ left: `calc(${LEFT_COL} + (100% - ${LEFT_COL}) * ${todayLeft / 100})` }}
              >
                <div className="w-px h-full bg-rose-400/60" />
                <div className="absolute -top-0 -translate-x-1/2 bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-b font-medium">
                  今天
                </div>
              </div>
            )}

            {/* Hover crosshair */}
            {hoverX !== null && (
              <div
                className="absolute top-0 bottom-0 z-30 pointer-events-none"
                style={{ left: `calc(${LEFT_COL} + (100% - ${LEFT_COL}) * ${hoverX / 100})` }}
              >
                <div className="w-px h-full bg-foreground/15" />
                {hoverDate && (
                  <div className="absolute -bottom-6 -translate-x-1/2 bg-foreground text-background text-[10px] px-2 py-0.5 rounded whitespace-nowrap font-medium">
                    {hoverDate}
                  </div>
                )}
              </div>
            )}

            {/* Drag selection overlay */}
            {dragSelection && dragSelection.endPct - dragSelection.startPct > 1 && (
              <div
                className="absolute top-0 bottom-0 z-10 pointer-events-none"
                style={{
                  left: `calc(${LEFT_COL} + (100% - ${LEFT_COL}) * ${dragSelection.startPct / 100})`,
                  width: `calc((100% - ${LEFT_COL}) * ${(dragSelection.endPct - dragSelection.startPct) / 100})`,
                }}
              >
                <div className="w-full h-full bg-primary/10 border-l border-r border-primary/40 rounded-sm" />
                <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded whitespace-nowrap font-medium">
                  放開以放大此區間
                </div>
              </div>
            )}

            {/* Phase rows */}
            {rows.map((row, i) => {
              const info = STATUS_MAP[row.phase]
              const color = PHASE_COLORS[row.phase]
              const isCurrent = i === currentIdx
              const isPast = currentIdx >= 0 && i < currentIdx
              const isFuture = currentIdx >= 0 && i > currentIdx
              const isDev = row.phase === "DEVELOPING"
              const isExpandable = isDev && showDevSection
              const isHovered = hoveredRow === row.phase
              const isEven = i % 2 === 0

              return (
                <div key={row.phase}>
                  <div
                    className={cn(
                      "grid items-center transition-colors",
                      isEven ? "bg-muted/[0.03]" : "bg-transparent",
                      isCurrent && "bg-primary/[0.06]",
                      isHovered && "bg-muted/60",
                      isExpandable && "cursor-pointer",
                    )}
                    style={{ gridTemplateColumns: `${LEFT_COL} 1fr`, height: "44px" }}
                    onClick={isExpandable ? () => setDevExpanded((v) => !v) : undefined}
                    onMouseEnter={() => setHoveredRow(row.phase)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    {/* Label */}
                    <div className="px-3 flex items-center gap-2 h-full border-r border-border/30 border-b border-b-border/20">
                      {isExpandable && (
                        <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-200", devExpanded && "rotate-90")} />
                      )}
                      {!isExpandable && <div className="w-3.5 shrink-0" />}
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className={cn(
                        "text-sm truncate",
                        isCurrent && "font-semibold text-foreground",
                        isPast && "text-muted-foreground",
                        isFuture && "text-muted-foreground/60",
                      )}>
                        {info?.label}
                      </span>
                      {hasSubTasks && isDev && (
                        <Badge variant="outline" className="text-[10px] h-[18px] px-1.5 rounded-md ml-auto">
                          {subTasks.length}
                        </Badge>
                      )}
                      <Badge variant="secondary" className={cn("text-[10px] h-[18px] px-1.5 rounded-md font-medium", !(hasSubTasks && isDev) && "ml-auto")}>
                        {row.sp ?? 0} SP
                      </Badge>
                    </div>

                    {/* Bar area */}
                    <div className="relative h-full flex items-center border-b border-border/20">
                      {/* Planned bar */}
                      {row.plannedBar && (
                        <div className="group/bar absolute" style={{ left: `${row.plannedBar.left}%`, width: `${row.plannedBar.width}%` }}>
                          <div
                            className={cn(
                              "h-7 rounded-md transition-all duration-150",
                              isHovered ? "shadow-sm" : "",
                            )}
                            style={{ backgroundColor: color, opacity: isPast ? 0.3 : isFuture ? 0.2 : 0.4 }}
                          />
                          {/* Tooltip popup on hover */}
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover/bar:opacity-100 transition-opacity duration-150 pointer-events-none z-40">
                            <div className="bg-popover border border-border shadow-lg rounded-lg px-3 py-2.5 text-xs whitespace-nowrap">
                              <div className="font-semibold text-sm mb-1.5 flex items-center gap-1.5">
                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                                {info?.label}
                                <span className="text-muted-foreground font-normal">({row.sp ?? 0} SP)</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                <span className="text-foreground">{fmtDate(row.plan?.plannedStart ?? null)} ~ {fmtDate(row.plan?.plannedEnd ?? null)}</span>
                                {daysBetween(row.plan?.plannedStart ?? null, row.plan?.plannedEnd ?? null) && (
                                  <span className="text-muted-foreground/70">({daysBetween(row.plan?.plannedStart ?? null, row.plan?.plannedEnd ?? null)} 天)</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      {/* No dates indicator */}
                      {!row.plannedBar && isCurrent && (
                        <div className="absolute inset-x-4 flex items-center justify-center">
                          <span className="text-[10px] text-muted-foreground/50">尚未設定時程</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sub-task rows */}
                  {isDev && devExpanded && (
                    <div>
                      {subRows.length > 0 ? subRows.map((sub, si) => {
                        const subHovered = hoveredRow === `sub-${sub.id}`
                        return (
                          <div
                            key={sub.id}
                            className={cn(
                              "grid items-center transition-colors",
                              si % 2 === 0 ? "bg-muted/[0.04]" : "bg-transparent",
                              subHovered && "bg-muted/40",
                            )}
                            style={{ gridTemplateColumns: `${LEFT_COL} 1fr`, height: "36px" }}
                            onMouseEnter={() => setHoveredRow(`sub-${sub.id}`)}
                            onMouseLeave={() => setHoveredRow(null)}
                          >
                            <div className="pl-10 pr-3 flex items-center gap-2 h-full border-r border-border/30 border-b border-b-border/10">
                              {canEdit ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleStatusToggle(sub) }}
                                  className={cn("h-2.5 w-2.5 rounded-full shrink-0 transition-colors ring-2 ring-offset-1 ring-offset-background",
                                    sub.status === "completed" ? "bg-emerald-500 ring-emerald-500/30" :
                                    sub.status === "in_progress" ? "bg-blue-500 ring-blue-500/30" :
                                    "bg-amber-400 ring-amber-400/30"
                                  )}
                                  title={`${SUB_STATUS_LABELS[sub.status]}（點擊切換）`}
                                />
                              ) : (
                                <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", SUB_STATUS_COLORS[sub.status])} />
                              )}
                              <span className={cn(
                                "text-xs truncate",
                                sub.status === "completed" ? "text-muted-foreground line-through" : "text-foreground/80",
                              )}>
                                {sub.name}
                              </span>
                              {canEdit && (
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(sub.id) }} className="ml-auto text-muted-foreground/30 hover:text-destructive shrink-0 transition-colors">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            <div className="relative h-full flex items-center border-b border-border/10">
                              {sub.plannedBar && (
                                <div className="group/sub absolute" style={{ left: `${sub.plannedBar.left}%`, width: `${sub.plannedBar.width}%` }}>
                                  <div className={cn("h-5 rounded", SUB_BAR_COLORS[sub.status] || "bg-amber-400/25")} />
                                  {/* Sub-task tooltip */}
                                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover/sub:opacity-100 transition-opacity duration-150 pointer-events-none z-40">
                                    <div className="bg-popover border border-border shadow-lg rounded-lg px-3 py-2.5 text-xs whitespace-nowrap">
                                      <div className="font-semibold text-sm mb-1.5 flex items-center gap-1.5">
                                        <div className={cn("h-2 w-2 rounded-full",
                                          sub.status === "completed" ? "bg-emerald-500" :
                                          sub.status === "in_progress" ? "bg-blue-500" : "bg-amber-400"
                                        )} />
                                        {sub.name}
                                        <Badge variant="secondary" className="text-[9px] h-[14px] px-1 rounded">
                                          {SUB_STATUS_LABELS[sub.status]}
                                        </Badge>
                                      </div>
                                      <div className="space-y-1 text-muted-foreground">
                                        <div className="flex items-center gap-1.5">
                                          <Calendar className="h-3 w-3" />
                                          <span>{fmtDate(sub.plannedStart)} ~ {fmtDate(sub.plannedEnd)}</span>
                                          {daysBetween(sub.plannedStart, sub.plannedEnd) && (
                                            <span className="text-muted-foreground/70">({daysBetween(sub.plannedStart, sub.plannedEnd)} 天)</span>
                                          )}
                                        </div>
                                        {sub.assignee && (
                                          <div className="flex items-center gap-1.5">
                                            <User className="h-3 w-3" />
                                            <span>{sub.assignee.name}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      }) : (
                        <div className="py-3 text-center text-xs text-muted-foreground/60">尚未建立子任務</div>
                      )}
                      {canEdit && (
                        <div className="flex items-center gap-2 pl-10 py-2 border-b border-border/10">
                          <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); setShowAddDialog(true) }}>
                            <Plus className="h-3 w-3 mr-1" />
                            新增子任務
                          </Button>
                          {subTasks.length === 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs px-2 text-muted-foreground/60"
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

            {/* Bottom padding for hover date label */}
            <div className="h-6" />
          </div>

        </div>
      </div>

      {/* Legend – sticky at bottom, outside scroll container */}
      <div className="sticky bottom-0 bg-background z-10 flex items-center gap-4 pt-3 pb-1 border-t border-border/30 px-3">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <div className="h-2.5 w-6 rounded-sm bg-primary/30" />
          <span>計畫時程</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <div className="h-3 w-px bg-rose-400/60" />
          <span>今天</span>
        </div>
        {showDayLabels && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <div className="h-2.5 w-4 rounded-sm bg-muted/40" />
            <span>週末</span>
          </div>
        )}
        <div className="ml-auto text-[11px] text-muted-foreground/60">
          拖曳時間軸可放大區間
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
    </>
  )
}

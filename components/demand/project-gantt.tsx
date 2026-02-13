"use client"

import { useMemo } from "react"
import { differenceInDays, format, addDays, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns"
import { zhTW } from "date-fns/locale"
import { STATUS_MAP, PIPELINE_STEPS, PHASE_COLORS } from "@/lib/constants/demand"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface PhasePlan {
  phase: string
  plannedSp: number | null
  plannedStart: string | null
  plannedEnd: string | null
  actualStart: string | null
  actualEnd: string | null
}

interface ProjectGanttProps {
  phasePlans: PhasePlan[]
  currentStatus: string
}

export function ProjectGantt({ phasePlans, currentStatus }: ProjectGanttProps) {
  const { timelineStart, timelineEnd, totalDays, months, rows } = useMemo(() => {
    const dates: Date[] = []
    for (const p of phasePlans) {
      if (p.plannedStart) dates.push(new Date(p.plannedStart))
      if (p.plannedEnd) dates.push(new Date(p.plannedEnd))
      if (p.actualStart) dates.push(new Date(p.actualStart))
      if (p.actualEnd) dates.push(new Date(p.actualEnd))
    }

    if (dates.length === 0) {
      return { timelineStart: null, timelineEnd: null, totalDays: 0, months: [], rows: [] }
    }

    // Add today
    dates.push(new Date())

    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))

    const tStart = startOfMonth(addDays(minDate, -7))
    const tEnd = endOfMonth(addDays(maxDate, 14))
    const total = differenceInDays(tEnd, tStart) || 1

    const monthsList = eachMonthOfInterval({ start: tStart, end: tEnd }).map((m) => {
      const mEnd = endOfMonth(m)
      const clampedEnd = mEnd > tEnd ? tEnd : mEnd
      const left = (differenceInDays(m, tStart) / total) * 100
      const width = (differenceInDays(clampedEnd, m) / total) * 100
      return { date: m, left, width, label: format(m, "M月", { locale: zhTW }) }
    })

    const phasePlanMap = Object.fromEntries(phasePlans.map((p) => [p.phase, p]))

    const rowData = PIPELINE_STEPS.map((phase) => {
      const plan = phasePlanMap[phase]
      const pStart = plan?.plannedStart ? new Date(plan.plannedStart) : null
      const pEnd = plan?.plannedEnd ? new Date(plan.plannedEnd) : null
      const aStart = plan?.actualStart ? new Date(plan.actualStart) : null
      const aEnd = plan?.actualEnd ? new Date(plan.actualEnd) : null

      const plannedBar =
        pStart && pEnd
          ? {
              left: (differenceInDays(pStart, tStart) / total) * 100,
              width: (differenceInDays(pEnd, pStart) / total) * 100,
            }
          : null

      const actualBar =
        aStart
          ? {
              left: (differenceInDays(aStart, tStart) / total) * 100,
              width: ((differenceInDays(aEnd || new Date(), aStart)) / total) * 100,
            }
          : null

      return { phase, plannedBar, actualBar, sp: plan?.plannedSp }
    })

    return { timelineStart: tStart, timelineEnd: tEnd, totalDays: total, months: monthsList, rows: rowData }
  }, [phasePlans])

  if (!timelineStart || totalDays === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
        尚未設定時程規劃
      </div>
    )
  }

  const todayLeft = (differenceInDays(new Date(), timelineStart) / totalDays) * 100
  const currentIdx = PIPELINE_STEPS.indexOf(currentStatus as typeof PIPELINE_STEPS[number])

  return (
    <TooltipProvider>
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Timeline header */}
          <div className="grid grid-cols-[120px_1fr] border-b border-border/50 pb-1 mb-1">
            <div className="text-xs text-muted-foreground font-medium px-2">階段</div>
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
          {rows.map((row, i) => {
            const info = STATUS_MAP[row.phase]
            const color = PHASE_COLORS[row.phase]
            const isCurrent = i === currentIdx
            const isPast = currentIdx >= 0 && i < currentIdx

            return (
              <div
                key={row.phase}
                className={cn(
                  "grid grid-cols-[120px_1fr] items-center py-1.5 border-b border-border/20",
                  isCurrent && "bg-primary/5",
                )}
              >
                <div className="px-2 flex items-center gap-1.5">
                  <div
                    className="h-2.5 w-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className={cn("text-xs truncate", isCurrent && "font-semibold", isPast && "text-muted-foreground")}>
                    {info?.label}
                  </span>
                  {row.sp != null && row.sp > 0 && (
                    <span className="text-[10px] text-muted-foreground ml-auto">{row.sp}SP</span>
                  )}
                </div>
                <div className="relative h-6">
                  {/* Planned bar */}
                  {row.plannedBar && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="absolute top-0.5 h-2.5 rounded-sm opacity-30"
                          style={{
                            left: `${row.plannedBar.left}%`,
                            width: `${Math.max(row.plannedBar.width, 0.5)}%`,
                            backgroundColor: color,
                          }}
                        />
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">
                        計畫時程
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {/* Actual bar */}
                  {row.actualBar && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="absolute top-3 h-2.5 rounded-sm"
                          style={{
                            left: `${row.actualBar.left}%`,
                            width: `${Math.max(row.actualBar.width, 0.5)}%`,
                            backgroundColor: color,
                          }}
                        />
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">
                        實際進度
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {/* Today marker */}
                  {todayLeft >= 0 && todayLeft <= 100 && i === 0 && (
                    <div
                      className="absolute top-0 h-[calc(100%+200px)] w-px border-l border-dashed border-destructive/50 z-10"
                      style={{ left: `${todayLeft}%` }}
                    />
                  )}
                </div>
              </div>
            )
          })}

          {/* Today label */}
          {todayLeft >= 0 && todayLeft <= 100 && (
            <div className="grid grid-cols-[120px_1fr]">
              <div />
              <div className="relative h-4">
                <span
                  className="absolute text-[9px] text-destructive/70 -translate-x-1/2"
                  style={{ left: `${todayLeft}%` }}
                >
                  今天
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

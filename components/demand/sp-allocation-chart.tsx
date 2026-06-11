"use client"

import { PieChart, Pie, Cell, Label } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { STATUS_MAP, PIPELINE_STEPS, PHASE_COLORS } from "@/lib/constants/demand"

interface PhasePlan {
  phase: string
  plannedSp: number | null
}

interface SpAllocationChartProps {
  phasePlans: PhasePlan[]
  totalSp: number
  estimatedSp?: number
}

export function SpAllocationChart({ phasePlans, totalSp, estimatedSp }: SpAllocationChartProps) {
  const data = PIPELINE_STEPS
    .map((phase) => {
      const plan = phasePlans.find((p) => p.phase === phase)
      return {
        phase,
        label: STATUS_MAP[phase]?.label || phase,
        sp: plan?.plannedSp || 0,
        fill: PHASE_COLORS[phase] || "var(--chart-1)",
      }
    })
    .filter((d) => d.sp > 0)

  const allocatedSp = data.reduce((sum, d) => sum + d.sp, 0)

  if (data.length === 0) {
    const hasAdjustment = estimatedSp != null && estimatedSp !== totalSp
    return (
      <div className="flex flex-col items-center justify-center h-[200px] gap-2">
        {hasAdjustment ? (
          <>
            <div className="text-center space-y-1">
              <p className="text-xs text-muted-foreground">原始 SP</p>
              <p className="text-2xl font-bold text-muted-foreground/60 line-through">{estimatedSp}</p>
            </div>
            <span className="text-muted-foreground">↓</span>
            <div className="text-center space-y-1">
              <p className="text-xs text-muted-foreground">結算 SP</p>
              <p className="text-3xl font-bold text-primary">{totalSp}</p>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">尚未分配 SP</p>
        )}
      </div>
    )
  }

  const chartConfig: ChartConfig = Object.fromEntries(
    data.map((d) => [
      d.phase,
      { label: d.label, color: d.fill },
    ])
  )

  return (
    <div className="flex items-center gap-4">
      <ChartContainer config={chartConfig} className="aspect-square h-[180px] shrink-0">
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                nameKey="phase"
                formatter={(value, name) => {
                  const item = data.find((d) => d.phase === name)
                  return (
                    <span>
                      {item?.label}: {value} SP ({totalSp > 0 ? Math.round(((value as number) / totalSp) * 100) : 0}%)
                    </span>
                  )
                }}
              />
            }
          />
          <Pie
            data={data}
            dataKey="sp"
            nameKey="phase"
            innerRadius={50}
            outerRadius={75}
            strokeWidth={2}
            stroke="var(--background)"
          >
            {data.map((d) => (
              <Cell key={d.phase} fill={d.fill} />
            ))}
            <Label
              content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                  return (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan x={viewBox.cx} y={(viewBox.cy || 0) - 8} className="fill-foreground text-2xl font-bold">
                        {allocatedSp}
                      </tspan>
                      <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 12} className="fill-muted-foreground text-xs">
                        / {totalSp} SP
                      </tspan>
                    </text>
                  )
                }
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>

      {/* Legend */}
      <div className="flex flex-col gap-2 min-w-0">
        {data.map((d) => (
          <div key={d.phase} className="flex items-center gap-2 text-sm">
            <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.fill }} />
            <span className="text-muted-foreground truncate">{d.label}</span>
            <span className="font-medium shrink-0">{d.sp} SP</span>
          </div>
        ))}
      </div>
    </div>
  )
}

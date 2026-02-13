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
}

export function SpAllocationChart({ phasePlans, totalSp }: SpAllocationChartProps) {
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
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
        尚未分配 SP
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
    <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[250px]">
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
          innerRadius={60}
          outerRadius={90}
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
  )
}

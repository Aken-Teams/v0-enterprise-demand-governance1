"use client"

import { PieChart, Pie, Cell, Label } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { STATUS_MAP, PIPELINE_STEPS, PHASE_COLORS } from "@/lib/constants/demand"
import { cn } from "@/lib/utils"

interface PhasePlan {
  phase: string
  plannedSp: number | null
  originalPlannedSp?: number | null
}

interface SpAllocationChartProps {
  phasePlans: PhasePlan[]
  totalSp: number
  estimatedSp?: number
  settlementType?: "override" | "adjustment" | null
  settlementReason?: string | null
  /** 已終止（代簽直接結案）：只呈現結算金額，不把 SP 攤到各階段 */
  terminated?: boolean
}

export function SpAllocationChart({ phasePlans, totalSp, estimatedSp, settlementType, settlementReason, terminated }: SpAllocationChartProps) {
  const hasSettlement = estimatedSp != null && estimatedSp !== totalSp
  const isOverride = hasSettlement && settlementType === "override"
  const ratio = isOverride && estimatedSp ? totalSp / estimatedSp : 1
  const settlementRate = hasSettlement && estimatedSp ? Math.round((totalSp / estimatedSp) * 100) : null

  const isAdjustment = hasSettlement && settlementType === "adjustment"
  const hasOriginalData = isAdjustment && phasePlans.some((p) => p.originalPlannedSp != null)

  // 已終止：不顯示各階段分配（避免誤會後段階段有完成），只呈現結算金額
  if (terminated) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-center gap-4 py-2">
          <div className="text-center">
            <p className="text-[11px] text-muted-foreground">原規劃</p>
            <p className="text-lg font-bold text-muted-foreground/50 line-through">{estimatedSp ?? totalSp}</p>
          </div>
          <div className="text-muted-foreground text-lg">→</div>
          <div className="text-center">
            <p className="text-[11px] text-muted-foreground">終止結算</p>
            <p className="text-3xl font-bold text-primary leading-none">{totalSp}<span className="text-sm font-normal text-muted-foreground ml-1">SP</span></p>
          </div>
        </div>
        {hasSettlement && (
          <div className="rounded-lg border border-orange-200 bg-orange-50/50 px-4 py-2.5 text-sm">
            <div className="flex items-center justify-center gap-2">
              <span className="text-muted-foreground line-through">{estimatedSp} SP</span>
              <span className="text-muted-foreground">×</span>
              <span className="font-semibold text-orange-600">{settlementRate}%</span>
              <span className="text-muted-foreground">=</span>
              <span className="font-semibold text-primary">{totalSp} SP</span>
            </div>
            {settlementReason && <p className="text-xs text-muted-foreground mt-1.5 text-center">{settlementReason}</p>}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground/70 text-center leading-relaxed">
          此為專案<span className="font-medium">終止時的結算金額</span>，非各階段實際完成的 SP 分配。
        </p>
      </div>
    )
  }

  const rawData = PIPELINE_STEPS
    .map((phase) => {
      const plan = phasePlans.find((p) => p.phase === phase)
      const currentSp = plan?.plannedSp || 0
      const displaySp = isOverride ? Math.round(currentSp * ratio * 10) / 10 : currentSp
      const originalSp = isOverride ? currentSp
        : (hasOriginalData && plan?.originalPlannedSp != null) ? plan.originalPlannedSp
        : currentSp
      return {
        phase,
        label: STATUS_MAP[phase]?.label || phase,
        originalSp,
        sp: displaySp,
        fill: PHASE_COLORS[phase] || "var(--chart-1)",
      }
    })

  const data = rawData.filter((d) => d.sp > 0 || d.originalSp > 0)
  const pieData = data.filter((d) => d.sp > 0)
  const allocatedSp = data.reduce((sum, d) => sum + d.sp, 0)

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[200px] gap-2">
        {hasSettlement ? (
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
    <div className="space-y-4">
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
              data={pieData}
              dataKey="sp"
              nameKey="phase"
              innerRadius={50}
              outerRadius={75}
              strokeWidth={2}
              stroke="var(--background)"
            >
              {pieData.map((d) => (
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
              <span className="font-medium shrink-0">
                {(isOverride || hasOriginalData) && d.originalSp !== d.sp && d.originalSp > 0
                  ? <>{d.originalSp} → {d.sp} SP</>
                  : <>{d.sp} SP</>}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Settlement calculation */}
      {hasSettlement && (
        <div className={cn(
          "rounded-lg px-4 py-2.5 text-sm",
          settlementType === "adjustment"
            ? "border border-blue-200 bg-blue-50/50"
            : "border border-orange-200 bg-orange-50/50"
        )}>
          <div className="flex items-center justify-center gap-2">
            {settlementType === "adjustment" ? (
              <>
                <span className="text-blue-600 font-medium">SP 調整</span>
                <span className="text-muted-foreground">{estimatedSp}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-semibold text-primary">{totalSp} SP</span>
              </>
            ) : (
              <>
                <span className="text-muted-foreground line-through">{estimatedSp} SP</span>
                <span className="text-muted-foreground">×</span>
                <span className="font-semibold text-orange-600">{settlementRate}%</span>
                <span className="text-muted-foreground">=</span>
                <span className="font-semibold text-primary">{totalSp} SP</span>
              </>
            )}
          </div>
          {settlementReason && (
            <p className="text-xs text-muted-foreground mt-1.5 text-center">{settlementReason}</p>
          )}
        </div>
      )}
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  FileText,
  Coins,
  Timer,
  ListTodo,
  ChartLine,
  PieChart,
  Gauge,
  Loader2,
  Radio,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"

/** Donut chart where `total` is the full ring (gray bg), and `segments` fill on top. */
const SpDonutChart = ({ total, segments, availableSp, size = 150 }: {
  total: number
  segments: { value: number; color: string; label: string }[]
  availableSp: number
  size?: number
}) => {
  const sw = size * 0.09
  const radius = (size - sw) / 2 - 4
  const circumference = 2 * Math.PI * radius
  let cumulativePercent = 0
  const [tooltip, setTooltip] = useState<{ label: string; value: number; pct: string; x: number; y: number } | null>(null)

  // Pre-compute segment midpoints for tooltip positioning (in un-rotated coords)
  const segMeta = segments.map((seg) => {
    const pct = total > 0 ? (seg.value / total) * 100 : 0
    const midPct = cumulativePercent + pct / 2
    cumulativePercent += pct
    // Convert percentage to angle (0% = top, clockwise). SVG is rotated -90deg so 0% starts at top.
    const angle = (midPct / 100) * 2 * Math.PI - Math.PI / 2
    return {
      ...seg, pct,
      mx: size / 2 + radius * Math.cos(angle),
      my: size / 2 + radius * Math.sin(angle),
    }
  })
  // Available segment midpoint
  const availPct = total > 0 ? (availableSp / total) * 100 : 100
  const availMidPct = cumulativePercent + availPct / 2
  const availAngle = (availMidPct / 100) * 2 * Math.PI - Math.PI / 2
  const availMx = size / 2 + radius * Math.cos(availAngle)
  const availMy = size / 2 + radius * Math.sin(availAngle)

  // Reset for render
  cumulativePercent = 0

  return (
    <div className="relative"
      onMouseLeave={() => setTooltip(null)}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Gray background ring = available */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={sw}
          className="cursor-pointer"
          onMouseEnter={(e) => {
            const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect()
            setTooltip({ label: "可用", value: availableSp, pct: `${total > 0 ? Math.round((availableSp / total) * 100) : 0}%`, x: availMx, y: availMy })
          }}
        />
        {/* Colored segments on top */}
        {segMeta.map((seg, i) => {
          const pct = total > 0 ? (seg.value / total) * 100 : 0
          const offset = circumference - (cumulativePercent / 100) * circumference
          const dash = `${(pct / 100) * circumference} ${circumference}`
          cumulativePercent += pct
          return (
            <circle key={i} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={seg.color} strokeWidth={sw}
              strokeDasharray={dash} strokeDashoffset={-offset} strokeLinecap="round"
              className="transition-all duration-1000 ease-out cursor-pointer"
              onMouseEnter={() => {
                setTooltip({ label: seg.label, value: seg.value, pct: `${Math.round(seg.pct)}%`, x: seg.mx, y: seg.my })
              }}
            />
          )
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <div className="text-lg font-bold">{total}</div>
          <div className="text-xs text-muted-foreground">總配額</div>
        </div>
      </div>
      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-10 pointer-events-none rounded-md bg-popover border px-3 py-1.5 shadow-md text-sm"
          style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -140%)" }}
        >
          <span className="font-medium">{tooltip.label}</span>
          <span className="text-muted-foreground ml-2">{tooltip.value}</span>
          <span className="text-muted-foreground ml-1">({tooltip.pct})</span>
        </div>
      )}
    </div>
  )
}

// --- Types ---

interface DashboardData {
  kpi: {
    totalDemands: number
    inProgress: number
    completed: number
    completionRate: number
  }
  sp: {
    totalQuota: number
    usedSp: number
    committedSp: number
    availableSp: number
    availablePercent: number
  }
  performance: {
    deliveryRate: number
    deliveryOnTime: number
    deliveryTotal: number
    passRate: number
    passClosed: number
    passTotal: number
    avgProcessingDays: number
  }
  monthlyTrends: { month: string; submitted: number; completed: number }[]
  recentChanges: {
    demandNumber: string
    title: string
    status: string
    statusLabel: string
    priority: string
    sp: number
    statusChangedAt: string
  }[]
}

export default function SubsidiaryDashboard() {
  const { token } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    fetch("/api/subsidiary/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <AppLayout userRole="subsidiary">
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  const kpi = data?.kpi ?? { totalDemands: 0, inProgress: 0, completed: 0, completionRate: 0 }
  const sp = data?.sp ?? { totalQuota: 0, usedSp: 0, committedSp: 0, availableSp: 0, availablePercent: 0 }
  const perf = data?.performance ?? { deliveryRate: 0, deliveryOnTime: 0, deliveryTotal: 0, passRate: 0, passClosed: 0, passTotal: 0, avgProcessingDays: 0 }
  const monthlyTrends = data?.monthlyTrends ?? []
  const recentChanges = data?.recentChanges ?? []

  // Only used & committed are colored segments; available = gray background
  const spSegments = [
    { value: sp.usedSp, color: "#3b82f6", label: "已使用" },
    { value: sp.committedSp, color: "#f59e0b", label: "已承諾" },
  ]

  const maxMonthlyVal = Math.max(...monthlyTrends.map((m) => Math.max(m.submitted, m.completed)), 1)

  return (
    <AppLayout userRole="subsidiary">
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">子公司總覽</h1>
            <p className="text-muted-foreground">查看您的需求進度與 SP 使用概況</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href="/subsidiary/demands">
                <ListTodo className="mr-2 h-4 w-4" />
                需求列表
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/subsidiary/wallet">
                <Coins className="mr-2 h-4 w-4" />
                SP 錢包
              </Link>
            </Button>
          </div>
        </div>

        {/* KPI Summary */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* 需求概況 */}
          <Card className="py-4">
            <CardContent className="flex items-center gap-6 pb-0">
              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">{kpi.totalDemands}</span>
                <span className="text-sm text-muted-foreground">需求</span>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-purple-500" />
                  <span className="text-muted-foreground">進行中</span>
                  <span className="font-medium">{kpi.inProgress}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-cyan-500" />
                  <span className="text-muted-foreground">已完成</span>
                  <span className="font-medium">{kpi.completed}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SP 配額 */}
          <Card className="py-4">
            <CardContent className="flex items-center gap-6 pb-0">
              <Coins className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">{sp.totalQuota}</span>
                <span className="text-sm text-muted-foreground">SP 配額</span>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-muted-foreground">已使用</span>
                  <span className="font-medium">{sp.usedSp}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-muted-foreground">已承諾</span>
                  <span className="font-medium">{sp.committedSp}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">可用</span>
                  <span className="font-medium">{sp.availableSp}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Visual Dashboard */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left - SP 使用分析 */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                SP 使用分析
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <SpDonutChart total={sp.totalQuota} segments={spSegments} availableSp={sp.availableSp} size={200} />
              <div className="grid grid-cols-3 gap-4 w-full text-center">
                <div className="space-y-1">
                  <div className="flex items-center justify-center"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /></div>
                  <div className="text-sm font-medium">{sp.usedSp}</div>
                  <div className="text-xs text-muted-foreground">已使用</div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /></div>
                  <div className="text-sm font-medium">{sp.committedSp}</div>
                  <div className="text-xs text-muted-foreground">已承諾</div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center"><div className="w-2.5 h-2.5 rounded-full bg-gray-300" /></div>
                  <div className="text-sm font-medium">{sp.availableSp}</div>
                  <div className="text-xs text-muted-foreground">可用</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Center - 績效儀表板 */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Gauge className="h-5 w-5" />
                績效儀表板
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* 交付率 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">交付率</div>
                    <div className="text-xs text-muted-foreground">預計完成日前結案</div>
                  </div>
                  <span className="text-2xl font-bold">{perf.deliveryRate}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${perf.deliveryRate}%` }} />
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  {perf.deliveryOnTime} / {perf.deliveryTotal} 需求準時交付
                </div>
              </div>

              <div className="border-t" />

              {/* 通過率 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">通過率</div>
                    <div className="text-xs text-muted-foreground">開案確認後成功結案</div>
                  </div>
                  <span className="text-2xl font-bold">{perf.passRate}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all duration-700" style={{ width: `${perf.passRate}%` }} />
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  {perf.passClosed} / {perf.passTotal} 需求結案
                </div>
              </div>

              <div className="border-t" />

              {/* 平均處理時間 */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">平均處理時間</div>
                  <div className="text-xs text-muted-foreground">提出到結案</div>
                </div>
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">{perf.avgProcessingDays > 0 ? `${perf.avgProcessingDays}` : "—"}</span>
                  {perf.avgProcessingDays > 0 && <span className="text-sm text-muted-foreground">天</span>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right - 月度趨勢 */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ChartLine className="h-5 w-5" />
                月度趨勢
              </CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyTrends.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">尚無資料</div>
              ) : (
                <div className="space-y-3">
                  {/* Legend */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      <span>提交</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span>完成</span>
                    </div>
                  </div>
                  {/* Rows */}
                  {monthlyTrends.map((d, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-10 shrink-0 tabular-nums">{d.month}</span>
                      {/* Stacked bar: gray bg = max, blue = submitted, green = completed overlaid */}
                      <div className="flex-1 bg-secondary rounded h-5 relative overflow-hidden">
                        {/* Blue: submitted */}
                        <div
                          className="absolute left-0 top-0 h-full bg-blue-500/20 rounded transition-all duration-700"
                          style={{ width: `${maxMonthlyVal > 0 ? (d.submitted / maxMonthlyVal) * 100 : 0}%` }}
                        />
                        {/* Green: completed, overlaid */}
                        <div
                          className="absolute left-0 top-0 h-full bg-green-500 rounded transition-all duration-700"
                          style={{ width: `${maxMonthlyVal > 0 ? (d.completed / maxMonthlyVal) * 100 : 0}%` }}
                        />
                      </div>
                      {/* Numbers */}
                      <div className="flex items-center gap-2 shrink-0 text-xs tabular-nums w-16 justify-end">
                        <span className="text-blue-600 font-medium">{d.submitted}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-green-600 font-medium">{d.completed}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Demand Changes */}
        {recentChanges.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Radio className="h-5 w-5" />
                  最近需求動態
                </CardTitle>
                <Button variant="link" className="p-0 h-auto text-sm" asChild>
                  <Link href="/subsidiary/demands">查看更多</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {recentChanges.map((item, i) => (
                  <div key={i} className="rounded-lg border p-4 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{item.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{item.demandNumber} · {item.statusLabel} · {item.sp} SP</div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <div className="text-sm font-medium tabular-nums">
                        {new Date(item.statusChangedAt).toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" })}
                      </div>
                      <div className="text-[10px] text-muted-foreground">狀態更新</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </AppLayout>
  )
}

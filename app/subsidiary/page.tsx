"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  FileText,
  Coins,
  Timer,
  ListTodo,
  ChartLine,
  PieChart as PieChartIcon,
  Gauge,
  Loader2,
  Radio,
} from "lucide-react"
import { PieChart, Pie, Cell, Label } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"

/** Vendor color palette — first vendor gets blue, then rotate */
const VENDOR_COLORS = ["#3b82f6", "#f59e0b", "#8b5cf6", "#10b981", "#ef4444", "#06b6d4"]

/** SP donut chart config for Recharts + shadcn ChartContainer */
const spChartConfig = {
  used: { label: "已使用", color: "#3b82f6" },
  available: { label: "可用", color: "#e5e7eb" },
} satisfies ChartConfig

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
    availableSp: number
    availablePercent: number
    byVendor?: { vendor: string; totalQuota: number; usedSp: number; availableSp: number }[]
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
  const { token, user } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.restrictedView) router.replace("/subsidiary/demands")
  }, [user?.restrictedView, router])

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
  const sp = data?.sp ?? { totalQuota: 0, usedSp: 0, availableSp: 0, availablePercent: 0 }
  const perf = data?.performance ?? { deliveryRate: 0, deliveryOnTime: 0, deliveryTotal: 0, passRate: 0, passClosed: 0, passTotal: 0, avgProcessingDays: 0 }
  const monthlyTrends = data?.monthlyTrends ?? []
  const recentChanges = data?.recentChanges ?? []

  // Recharts data for SP donut — per-vendor colored segments + available
  const spDonutData = sp.byVendor && sp.byVendor.length > 1
    ? [
        ...sp.byVendor.map((v, i) => ({
          key: `vendor-${v.vendor}`,
          label: v.vendor,
          value: v.usedSp,
          fill: VENDOR_COLORS[i % VENDOR_COLORS.length],
        })),
        { key: "available", label: "可用", value: sp.availableSp, fill: "#e5e7eb" },
      ]
    : [
        { key: "used", label: "已使用", value: sp.usedSp, fill: "#3b82f6" },
        { key: "available", label: "可用", value: sp.availableSp, fill: "#e5e7eb" },
      ]

  const maxMonthlyVal = Math.max(...monthlyTrends.map((m) => Math.max(m.submitted, m.completed)), 1)

  return (
    <AppLayout userRole="subsidiary">
      <div className="space-y-4 sm:space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">子公司總覽</h1>
            <p className="text-xs sm:text-base text-muted-foreground">查看您的需求進度與 SP 使用概況</p>
          </div>
          <div className="flex gap-2 sm:gap-3">
            <Button variant="outline" size="sm" className="h-8 sm:h-9 text-xs sm:text-sm" asChild>
              <Link href="/subsidiary/demands">
                <ListTodo className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                需求列表
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="h-8 sm:h-9 text-xs sm:text-sm" asChild>
              <Link href="/subsidiary/wallet">
                <Coins className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                SP 錢包
              </Link>
            </Button>
          </div>
        </div>

        {/* KPI Summary */}
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
          {/* 需求概況 */}
          <Card className="py-3 sm:py-4">
            <CardContent className="flex items-center gap-3 sm:gap-6 pb-0 px-3 sm:px-6">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
              <div className="flex items-baseline gap-1">
                <span className="text-xl sm:text-2xl font-bold">{kpi.totalDemands}</span>
                <span className="text-xs sm:text-sm text-muted-foreground">需求</span>
              </div>
              <div className="h-6 sm:h-8 w-px bg-border" />
              <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-purple-500 shrink-0" />
                  <span className="text-muted-foreground">進行中</span>
                  <span className="font-medium">{kpi.inProgress}</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-cyan-500 shrink-0" />
                  <span className="text-muted-foreground">已完成</span>
                  <span className="font-medium">{kpi.completed}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SP 配額 */}
          <Card className="py-3 sm:py-4">
            <CardContent className="pb-0 px-3 sm:px-6">
              <TooltipProvider>
                <div className="flex items-center gap-3 sm:gap-6">
                  <Coins className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-baseline gap-1 cursor-default">
                        <span className="text-xl sm:text-2xl font-bold">{sp.totalQuota}</span>
                        <span className="text-xs sm:text-sm text-muted-foreground">SP 配額</span>
                      </div>
                    </TooltipTrigger>
                    {sp.byVendor && sp.byVendor.length > 1 && (
                      <TooltipContent>
                        <div className="space-y-1 text-xs">
                          {sp.byVendor.map((v) => (
                            <div key={v.vendor} className="flex justify-between gap-4">
                              <span>{v.vendor}</span>
                              <span className="font-medium">{v.totalQuota}</span>
                            </div>
                          ))}
                        </div>
                      </TooltipContent>
                    )}
                  </Tooltip>
                  <div className="h-6 sm:h-8 w-px bg-border" />
                  <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 sm:gap-1.5 cursor-default">
                          <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-blue-500 shrink-0" />
                          <span className="text-muted-foreground">已使用</span>
                          <span className="font-medium">{sp.usedSp}</span>
                        </div>
                      </TooltipTrigger>
                      {sp.byVendor && sp.byVendor.length > 1 && (
                        <TooltipContent>
                          <div className="space-y-1 text-xs">
                            {sp.byVendor.map((v) => (
                              <div key={v.vendor} className="flex justify-between gap-4">
                                <span>{v.vendor}</span>
                                <span className="font-medium">{v.usedSp}</span>
                              </div>
                            ))}
                          </div>
                        </TooltipContent>
                      )}
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 sm:gap-1.5 cursor-default">
                          <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-green-500 shrink-0" />
                          <span className="text-muted-foreground">可用</span>
                          <span className="font-medium">{sp.availableSp}</span>
                        </div>
                      </TooltipTrigger>
                      {sp.byVendor && sp.byVendor.length > 1 && (
                        <TooltipContent>
                          <div className="space-y-1 text-xs">
                            {sp.byVendor.map((v) => (
                              <div key={v.vendor} className="flex justify-between gap-4">
                                <span>{v.vendor}</span>
                                <span className="font-medium">{v.availableSp}</span>
                              </div>
                            ))}
                          </div>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </div>
                </div>
              </TooltipProvider>
            </CardContent>
          </Card>
        </div>

        {/* Main Visual Dashboard */}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Left - SP 使用分析 */}
          <Card className="lg:col-span-1">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                SP 使用分析
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-3 sm:space-y-4 px-4 sm:px-6">
              <ChartContainer config={spChartConfig} className="aspect-square w-[140px] sm:w-[200px]">
                <PieChart>
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload
                      const pct = sp.totalQuota > 0 ? Math.round((d.value / sp.totalQuota) * 100) : 0
                      return (
                        <div className="rounded-md bg-popover border px-2.5 py-1 sm:px-3 sm:py-1.5 shadow-md text-xs sm:text-sm">
                          <span className="font-medium">{d.label}</span>
                          <span className="text-muted-foreground ml-2">{d.value} SP</span>
                          <span className="text-muted-foreground ml-1">({pct}%)</span>
                        </div>
                      )
                    }}
                  />
                  <Pie
                    data={spDonutData}
                    dataKey="value"
                    nameKey="key"
                    innerRadius="55%"
                    outerRadius="80%"
                    paddingAngle={4}
                    cornerRadius={6}
                    minAngle={12}
                    strokeWidth={0}
                  >
                    {spDonutData.map((d) => (
                      <Cell key={d.key} fill={d.fill} />
                    ))}
                    <Label
                      content={({ viewBox }) => {
                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                          return (
                            <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                              <tspan x={viewBox.cx} y={(viewBox.cy || 0) - 6} className="fill-foreground text-xl sm:text-2xl font-bold">
                                {sp.totalQuota}
                              </tspan>
                              <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 10} className="fill-muted-foreground text-[10px] sm:text-xs">
                                總配額
                              </tspan>
                            </text>
                          )
                        }
                      }}
                    />
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-5 w-full">
                {sp.byVendor && sp.byVendor.length > 1 ? (
                  <>
                    {sp.byVendor.map((v, i) => (
                      <div key={v.vendor} className="flex items-center gap-1.5 text-center">
                        <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0" style={{ backgroundColor: VENDOR_COLORS[i % VENDOR_COLORS.length] }} />
                        <div className="text-xs sm:text-sm font-medium">{v.usedSp}</div>
                        <div className="text-[10px] sm:text-xs text-muted-foreground">{v.vendor}</div>
                      </div>
                    ))}
                    <div className="flex items-center gap-1.5 text-center">
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-gray-300 shrink-0" />
                      <div className="text-xs sm:text-sm font-medium">{sp.availableSp}</div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground">可用</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 text-center">
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-blue-500 shrink-0" />
                      <div className="text-xs sm:text-sm font-medium">{sp.usedSp}</div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground">已使用</div>
                    </div>
                    <div className="flex items-center gap-1.5 text-center">
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-gray-300 shrink-0" />
                      <div className="text-xs sm:text-sm font-medium">{sp.availableSp}</div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground">可用</div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Center - 績效儀表板 */}
          <Card className="lg:col-span-1">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <Gauge className="h-4 w-4 sm:h-5 sm:w-5" />
                績效儀表板
              </CardTitle>
              <p className="text-[10px] sm:text-xs text-muted-foreground">僅統計已進入驗收或結案階段的需求</p>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-5 px-4 sm:px-6">
              {/* 交付率 */}
              <div className="space-y-1.5 sm:space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs sm:text-sm font-medium">交付率</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">預計完成日前結案</div>
                  </div>
                  <span className="text-lg sm:text-2xl font-bold">{perf.deliveryRate}%</span>
                </div>
                <div className="h-1.5 sm:h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${perf.deliveryRate}%` }} />
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground text-right">
                  {perf.deliveryOnTime} / {perf.deliveryTotal} 需求準時交付
                </div>
              </div>

              <div className="border-t" />

              {/* 通過率 */}
              <div className="space-y-1.5 sm:space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs sm:text-sm font-medium">通過率</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">開案確認後成功結案</div>
                  </div>
                  <span className="text-lg sm:text-2xl font-bold">{perf.passRate}%</span>
                </div>
                <div className="h-1.5 sm:h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all duration-700" style={{ width: `${perf.passRate}%` }} />
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground text-right">
                  {perf.passClosed} / {perf.passTotal} 需求結案
                </div>
              </div>

              <div className="border-t" />

              {/* 平均開發天數 */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs sm:text-sm font-medium">平均開發天數</div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">開發實際開始到完成</div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Timer className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                  <span className="text-lg sm:text-2xl font-bold">{perf.avgProcessingDays > 0 ? `${perf.avgProcessingDays}` : "—"}</span>
                  {perf.avgProcessingDays > 0 && <span className="text-xs sm:text-sm text-muted-foreground">天</span>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right - 月度趨勢 */}
          <Card className="lg:col-span-1">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <ChartLine className="h-4 w-4 sm:h-5 sm:w-5" />
                月度趨勢
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              {monthlyTrends.length === 0 ? (
                <div className="text-xs sm:text-sm text-muted-foreground text-center py-6 sm:py-8">尚無資料</div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {/* Legend */}
                  <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground mb-2 sm:mb-3">
                    <div className="flex items-center gap-1 sm:gap-1.5">
                      <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-blue-500" />
                      <span>提交</span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-1.5">
                      <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-green-500" />
                      <span>完成</span>
                    </div>
                  </div>
                  {/* Rows */}
                  {monthlyTrends.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 sm:gap-3">
                      <span className="text-[10px] sm:text-xs text-muted-foreground w-8 sm:w-10 shrink-0 tabular-nums">{d.month}</span>
                      {/* Stacked bar: gray bg = max, blue = submitted, green = completed overlaid */}
                      <div className="flex-1 bg-secondary rounded h-4 sm:h-5 relative overflow-hidden">
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
                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 text-[10px] sm:text-xs tabular-nums w-12 sm:w-16 justify-end">
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
          <Card className="overflow-hidden">
            <CardHeader className="px-4 sm:px-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Radio className="h-4 w-4 sm:h-5 sm:w-5" />
                  最近需求動態
                </CardTitle>
                <Button variant="link" className="p-0 h-auto text-xs sm:text-sm" asChild>
                  <Link href="/subsidiary/demands">查看更多</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
                {recentChanges.map((item, i) => (
                  <div key={i} className="rounded-lg border p-3 sm:p-4 flex items-center justify-between min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-medium truncate">{item.title}</div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">{item.demandNumber} · {item.statusLabel} · {item.sp} SP</div>
                    </div>
                    <div className="text-right shrink-0 ml-3 sm:ml-4">
                      <div className="text-xs sm:text-sm font-medium tabular-nums">
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

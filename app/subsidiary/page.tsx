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
  Radio, Info } from "lucide-react"
import { PieChart, Pie, Cell, Label } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { formatSp } from "@/lib/constants/demand"
import { cn } from "@/lib/utils"

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
    /** 已開案、尚未認列（必然會發生） */
    committedSp?: number
    /** 已提出但尚未開案（含暫緩） */
    plannedSp?: number
    /** 扣掉已認列與已承諾後真正可規劃的額度 */
    plannableSp?: number
    availableSp: number
    availablePercent: number
    byVendor?: { vendor: string; totalQuota: number; usedSp: number; committedSp?: number; plannedSp?: number; availableSp: number; plannableSp?: number }[]
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
  const [spVendor, setSpVendor] = useState<string>("all")

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
  const committedSp = sp.committedSp ?? 0
  const plannedSp = sp.plannedSp ?? 0
  const plannableSp = sp.plannableSp ?? (sp.availableSp - committedSp - plannedSp)
  const perf = data?.performance ?? { deliveryRate: 0, deliveryOnTime: 0, deliveryTotal: 0, passRate: 0, passClosed: 0, passTotal: 0, avgProcessingDays: 0 }
  const monthlyTrends = data?.monthlyTrends ?? []
  /** SP 甜甜圈的開發商篩選：all = 全部合計 */
  const spVendorList = data?.sp?.byVendor?.map((v) => v.vendor) ?? []
  const recentChanges = data?.recentChanges ?? []

  /**
   * SP 甜甜圈：改以「四層額度」呈現（已認列／已承諾／規劃中／尚可規劃），
   * 不再用開發商切片——開發商改成右上角的篩選，選了就只看那一家的四層。
   */
  const spScope = spVendor === "all"
    ? { totalQuota: sp.totalQuota, usedSp: sp.usedSp, committedSp, plannedSp, plannableSp }
    : (() => {
        const v = sp.byVendor?.find((x) => x.vendor === spVendor)
        return {
          totalQuota: v?.totalQuota ?? 0,
          usedSp: v?.usedSp ?? 0,
          committedSp: v?.committedSp ?? 0,
          plannedSp: v?.plannedSp ?? 0,
          plannableSp: v?.plannableSp ?? 0,
        }
      })()

  const SP_TIERS = [
    { key: "used", label: "已認列", value: spScope.usedSp, fill: "#3b82f6",
      desc: "已實際扣除的 SP，不會再變動。" },
    { key: "committed", label: "已承諾", value: spScope.committedSp, fill: "#fbbf24",
      desc: "已通過開案確認、尚未走到認列節點，後續必然扣除。" },
    { key: "planned", label: "規劃中", value: spScope.plannedSp, fill: "#7dd3fc",
      desc: "已提出但尚未開案（含暫緩），可能調整估點或取消釋放。" },
    { key: "plannable", label: "尚可規劃", value: Math.max(0, spScope.plannableSp), fill: "#e5e7eb",
      desc: "扣掉上述三層後，還能安心提出新需求的額度。" },
  ]
  const spDonutData = SP_TIERS.filter((t) => t.value > 0)

  /** 取某一層在單一開發商下的數值，供 tooltip 的分廠明細使用 */
  type VendorSp = NonNullable<DashboardData["sp"]["byVendor"]>[number]
  const tierValueOf = (key: string, v: VendorSp) =>
    key === "used" ? v.usedSp
    : key === "committed" ? (v.committedSp ?? 0)
    : key === "planned" ? (v.plannedSp ?? 0)
    : Math.max(0, v.plannableSp ?? 0)

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
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 cursor-default sm:gap-1.5">
                        <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-cyan-500 shrink-0" />
                        <span className="text-muted-foreground">已完成</span>
                        <span className="font-medium">{kpi.completed}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs text-background">含「終止並結案」的需求——終止同樣是案子已結束並完成結算</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
                        <span className="text-xl sm:text-2xl font-bold">{formatSp(sp.totalQuota)}</span>
                        <span className="text-xs sm:text-sm text-muted-foreground">SP 配額</span>
                      </div>
                    </TooltipTrigger>
                    {sp.byVendor && sp.byVendor.length > 1 && (
                      <TooltipContent>
                        <div className="space-y-1 text-xs text-background">
                          {sp.byVendor.map((v) => (
                            <div key={v.vendor} className="flex justify-between gap-4">
                              <span className="text-background/80">{v.vendor}</span>
                              <span className="font-medium tabular-nums">{formatSp(v.totalQuota)}</span>
                            </div>
                          ))}
                        </div>
                      </TooltipContent>
                    )}
                  </Tooltip>
                  <div className="h-6 sm:h-8 w-px bg-border" />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:gap-x-4 sm:text-sm">
                    {/* 四層額度；每一項的 tooltip 給該層自己的定義與分廠數字 */}
                    {SP_TIERS.map((t) => (
                      <Tooltip key={t.key}>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1 cursor-default sm:gap-1.5">
                            <div className="h-1.5 w-1.5 shrink-0 rounded-full sm:h-2 sm:w-2" style={{ backgroundColor: t.fill }} />
                            <span className="text-muted-foreground">{t.label}</span>
                            <span className="font-medium tabular-nums">{formatSp(t.value)}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {/* tooltip 底色是 bg-foreground（深色），內文一律用白字，
                              不能用 text-muted-foreground——在深底上會糊成看不清的灰 */}
                          <div className="max-w-[15rem] space-y-1.5 text-xs text-background">
                            <p className="leading-relaxed">{t.desc}</p>
                            {spVendor === "all" && (sp.byVendor?.length ?? 0) > 1 && (
                              <div className="space-y-0.5 border-t border-background/25 pt-1.5">
                                {sp.byVendor!.map((v) => (
                                  <div key={v.vendor} className="flex justify-between gap-4">
                                    <span className="text-background/80">{v.vendor}</span>
                                    <span className="font-medium tabular-nums text-background">{formatSp(tierValueOf(t.key, v))}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ))}
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
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                  SP 使用分析
                </CardTitle>
                <div className="flex items-center gap-1.5 shrink-0">
                  {spVendorList.length > 1 && (
                    <div className="flex items-center rounded-md border p-0.5">
                      {["all", ...spVendorList].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setSpVendor(v)}
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] transition-colors sm:text-[11px]",
                            spVendor === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {v === "all" ? "全部" : v}
                        </button>
                      ))}
                    </div>
                  )}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon" className="h-6 w-6 shrink-0" title="欄位說明">
                        <Info className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-[18rem] text-xs">
                      <p className="mb-2 font-medium text-foreground">四層額度怎麼看</p>
                      <div className="space-y-2">
                        {SP_TIERS.map((t) => (
                          <div key={t.key} className="flex gap-2">
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: t.fill }} />
                            <div>
                              <p className="font-medium text-foreground">{t.label}</p>
                              <p className="text-muted-foreground leading-relaxed">{t.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-3 sm:space-y-4 px-4 sm:px-6">
              <ChartContainer config={spChartConfig} className="aspect-square w-[140px] sm:w-[200px]">
                <PieChart>
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload
                      const pct = spScope.totalQuota > 0 ? Math.round((d.value / spScope.totalQuota) * 100) : 0
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
                                {formatSp(spScope.totalQuota)}
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
              <div className="grid w-full grid-cols-2 gap-x-3 gap-y-1.5">
                {SP_TIERS.map((t) => (
                  <div key={t.key} className="flex items-center gap-1.5 min-w-0">
                    <span className="h-2 w-2 shrink-0 rounded-full sm:h-2.5 sm:w-2.5" style={{ backgroundColor: t.fill }} />
                    <span className="text-[10px] text-muted-foreground sm:text-xs">{t.label}</span>
                    <span className="ml-auto text-xs font-medium tabular-nums sm:text-sm">{formatSp(t.value)}</span>
                  </div>
                ))}
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
                      <span>完成（含終止）</span>
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

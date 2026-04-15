"use client"

import React, { useEffect, useState, useCallback } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { useAuth } from "@/hooks/use-auth"
import { STATUS_MAP } from "@/lib/constants/demand"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell,
  LineChart, Line,
} from "recharts"
import {
  BarChart3, FileText, Coins, TrendingUp, AlertTriangle,
  CheckCircle, Clock, Loader2, Users, DollarSign, ChevronDown, ChevronRight,
} from "lucide-react"

interface AnalyticsData {
  kpi: {
    activeDemands: number
    thisMonthClosed: number
    ytdUsedSp: number
    avgDays: number
    avgDaysCount: number
    totalDemands: number
  }
  statusCounts: Record<string, number>
  orgDemandCounts: Record<string, number>
  devDemandCounts: Record<string, number>
  monthlyTrends: { month: string; submitted: number; completed: number }[]
  sp: {
    totalQuota: number
    totalUsedSp: number
    totalAvailable: number
    byOrganization: {
      name: string
      totalQuota: number
      usedSp: number
      availableSp: number
      demandCount: number
    }[]
  }
  performance: {
    onTimeRate: number
    onTimeCount: number
    deliverableTotal: number
    passRate: number
    passClosed: number
    passTotal: number
  }
  risks: {
    overdueDemands: {
      demandNumber: string
      title: string
      status: string
      organization: string
      expectedDate: string
      overdueDays: number
    }[]
    staleDemands: {
      demandNumber: string
      title: string
      status: string
      organization: string
      lastUpdated: string
      idleDays: number
    }[]
  }
  phaseAvgDays: { phase: string; avgDays: number; count: number }[]
  devWorkload: { name: string; count: number; usedSp: number; totalSp: number }[]
  financial?: {
    totalQuotaSp: number
    totalQuotaAmount: number
    orgSummary: { name: string; quotaSp: number; quotaAmount: number; totalSp: number; usedSp: number; amount: number; usedAmount: number; demandCount: number }[]
    demandDetail: { organization: string; demandNumber: string; title: string; status: string; sp: number; usedSp: number; amount: number; usedAmount: number }[]
    monthlyTrend: { month: string; data: { organization: string; sp: number; amount: number }[] }[]
  }
}

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "#3b82f6",
  PRD_REVIEW: "#f59e0b",
  SP_REVIEW: "#f97316",
  DEVELOPING: "#8b5cf6",
  ACCEPTANCE: "#ec4899",
  CLOSED: "#22c55e",
  REJECTED: "#ef4444",
}

const ORG_COLORS = ["#0ea5e9", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"]

const fmtAmount = (n: number) =>
  `NT$${n.toLocaleString("zh-TW")}`

export default function GovernanceAnalyticsPage() {
  const { token, user } = useAuth()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch("/api/governance/analytics", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setData(await res.json())
      }
    } catch (e) {
      console.error("Failed to fetch analytics:", e)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <AppLayout userRole="admin">
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  if (!data) {
    return (
      <AppLayout userRole="admin">
        <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
          <BarChart3 className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">無法載入分析資料</p>
        </div>
      </AppLayout>
    )
  }

  const d = data

  // Prepare chart data
  const statusChartData = Object.entries(d?.statusCounts ?? {}).map(([status, count]) => ({
    name: STATUS_MAP[status]?.label ?? status,
    value: count,
    fill: STATUS_COLORS[status] ?? "#6b7280",
  }))

  const orgChartData = Object.entries(d?.orgDemandCounts ?? {}).map(([name, count], i) => ({
    name,
    value: count,
    fill: ORG_COLORS[i % ORG_COLORS.length],
  }))

  const DEV_COLORS = ["#f97316", "#10b981", "#3b82f6", "#ec4899", "#f59e0b", "#8b5cf6", "#14b8a6", "#ef4444"]
  const devChartData = Object.entries(d?.devDemandCounts ?? {}).map(([name, count], i) => ({
    name,
    value: count,
    fill: DEV_COLORS[i % DEV_COLORS.length],
  }))

  const phaseChartData = (d?.phaseAvgDays ?? [])
    .filter((p) => p.phase !== "CLOSED" && p.count > 0)
    .map((p) => ({
      name: STATUS_MAP[p.phase]?.label ?? p.phase,
      days: p.avgDays,
      count: p.count,
    }))

  const orgSpChartData = (d?.sp.byOrganization ?? [])
    .map((o) => ({
      name: o.name,
      已使用: o.usedSp,
      可用: o.availableSp,
      _total: o.totalQuota,
    }))
    .sort((a, b) => b._total - a._total)

  const spPieData = [
    { name: "已使用", value: d?.sp.totalUsedSp ?? 0, fill: "#8b5cf6" },
    { name: "可用", value: d?.sp.totalAvailable ?? 0, fill: "#22c55e" },
  ].filter((i) => i.value > 0)

  const trendChartConfig = {
    submitted: { label: "新增需求", color: "#3b82f6" },
    completed: { label: "完成結案", color: "#22c55e" },
  }

  const statusChartConfig = Object.fromEntries(
    statusChartData.map((s) => [s.name, { label: s.name, color: s.fill }])
  )

  const spAllocationConfig = {
    已使用: { label: "已使用", color: "#8b5cf6" },
    可用: { label: "可用", color: "#22c55e" },
  }

  const spPieConfig = Object.fromEntries(
    spPieData.map((s) => [s.name, { label: s.name, color: s.fill }])
  )

  return (
    <AppLayout userRole="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">分析報表</h1>
          <p className="text-muted-foreground">治理數據分析與決策支援報表</p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard color="#6366f1" icon={FileText} title="活躍需求" value={d.kpi.activeDemands} sub={`共 ${d.kpi.totalDemands} 筆`} />
          <KpiCard color="#f59e0b" icon={CheckCircle} title="本月交付" value={d.kpi.thisMonthClosed} sub="本月結案" />
          <KpiCard color="#8b5cf6" icon={Coins} title="SP" value={`${d.sp.totalUsedSp} / ${d.sp.totalQuota}`} sub={`可用 ${d.sp.totalAvailable}`} />
          <KpiCard color="#10b981" icon={TrendingUp} title="交付率" value={d.performance.deliverableTotal > 0 ? `${d.performance.onTimeRate}%` : "—"} sub={d.performance.deliverableTotal > 0 ? `${d.performance.onTimeCount} / ${d.performance.deliverableTotal} 準時交付` : "尚無驗收/結案需求"} />
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className={`grid w-full ${d.financial ? "grid-cols-4" : "grid-cols-3"}`}>
            <TabsTrigger value="overview">總覽</TabsTrigger>
            <TabsTrigger value="metrics">指標分析</TabsTrigger>
            <TabsTrigger value="sp-usage">SP 分析</TabsTrigger>
            {d.financial && <TabsTrigger value="financial">金額報表</TabsTrigger>}
          </TabsList>

          {/* ====== 總覽 ====== */}
          <TabsContent value="overview">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">需求狀態分佈</CardTitle>
                </CardHeader>
                <CardContent>
                  {statusChartData.length > 0 ? (
                    <ChartContainer config={statusChartConfig} className="h-[260px] w-full">
                      <PieChart>
                        <Pie
                          data={statusChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          label={({ name, value, cx: cxVal, cy: cyVal, midAngle, outerRadius: or }) => { const rad = (Math.PI / 180) * midAngle; const x = Number(cxVal) + (Number(or) + 20) * Math.cos(-rad); const y = Number(cyVal) + (Number(or) + 20) * Math.sin(-rad); return (<text x={x} y={y} textAnchor={x > Number(cxVal) ? "start" : "end"} dominantBaseline="central" fontSize={14} fill="currentColor">{`${name} ${value}`}</text>); }}
                        >
                          {statusChartData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ChartContainer>
                  ) : (
                    <EmptyState />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">需求者分佈</CardTitle>
                </CardHeader>
                <CardContent>
                  {orgChartData.length > 0 ? (
                    <ChartContainer
                      config={Object.fromEntries(orgChartData.map((o) => [o.name, { label: o.name, color: o.fill }]))}
                      className="h-[260px] w-full"
                    >
                      <PieChart>
                        <Pie
                          data={orgChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          label={({ name, value, cx: cxVal, cy: cyVal, midAngle, outerRadius: or }) => { const rad = (Math.PI / 180) * midAngle; const x = Number(cxVal) + (Number(or) + 20) * Math.cos(-rad); const y = Number(cyVal) + (Number(or) + 20) * Math.sin(-rad); return (<text x={x} y={y} textAnchor={x > Number(cxVal) ? "start" : "end"} dominantBaseline="central" fontSize={14} fill="currentColor">{`${name} ${value}`}</text>); }}
                        >
                          {orgChartData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ChartContainer>
                  ) : (
                    <EmptyState />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">開發者分佈</CardTitle>
                </CardHeader>
                <CardContent>
                  {devChartData.length > 0 ? (
                    <ChartContainer
                      config={Object.fromEntries(devChartData.map((o) => [o.name, { label: o.name, color: o.fill }]))}
                      className="h-[260px] w-full"
                    >
                      <PieChart>
                        <Pie
                          data={devChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          label={({ name, value, cx: cxVal, cy: cyVal, midAngle, outerRadius: or }) => { const rad = (Math.PI / 180) * midAngle; const x = Number(cxVal) + (Number(or) + 20) * Math.cos(-rad); const y = Number(cyVal) + (Number(or) + 20) * Math.sin(-rad); return (<text x={x} y={y} textAnchor={x > Number(cxVal) ? "start" : "end"} dominantBaseline="central" fontSize={14} fill="currentColor">{`${name} ${value}`}</text>); }}
                        >
                          {devChartData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ChartContainer>
                  ) : (
                    <EmptyState />
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base">月度需求趨勢</CardTitle>
                <CardDescription>近 8 個月新增與完成需求數</CardDescription>
              </CardHeader>
              <CardContent>
                {d.monthlyTrends.some((m) => m.submitted > 0 || m.completed > 0) ? (
                  <ChartContainer config={trendChartConfig} className="h-[300px] w-full">
                    <LineChart data={d.monthlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" fontSize={12} />
                      <YAxis allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="submitted" name="新增需求" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="completed" name="完成結案" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ChartContainer>
                ) : (
                  <EmptyState />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ====== 指標分析 ====== */}
          <TabsContent value="metrics">
            <div className="grid grid-cols-3 divide-x rounded-lg border bg-card text-center">
              <div className="px-4 py-3">
                <p className="text-xs text-muted-foreground">準時交付率</p>
                <p className="text-2xl font-bold mt-0.5">{d.performance.deliverableTotal > 0 ? `${d.performance.onTimeRate}%` : "—"}</p>
                <p className="text-[11px] text-muted-foreground">{d.performance.onTimeCount}/{d.performance.deliverableTotal} 筆準時</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-muted-foreground">開案通過率</p>
                <p className="text-2xl font-bold mt-0.5">{d.performance.passTotal > 0 ? `${d.performance.passRate}%` : "—"}</p>
                <p className="text-[11px] text-muted-foreground">{d.performance.passClosed}/{d.performance.passTotal} 筆結案</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-muted-foreground">平均開發天數</p>
                <p className="text-2xl font-bold mt-0.5">{d.kpi.avgDaysCount > 0 ? `${d.kpi.avgDays} 天` : "—"}</p>
                <p className="text-[11px] text-muted-foreground">{d.kpi.avgDaysCount > 0 ? `${d.kpi.avgDaysCount} 筆` : "尚無資料"}</p>
              </div>
            </div>

            {/* Developer workload */}
            {d.devWorkload.length > 0 && (
              <div className="mt-4 rounded-lg border bg-card overflow-hidden">
                <div className="px-4 py-2.5 border-b bg-muted/30">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    開發人員負載
                  </p>
                </div>
                <div className="divide-y">
                  {d.devWorkload.map((dev) => {
                    const usedPct = dev.totalSp > 0 ? (dev.usedSp / dev.totalSp) * 100 : 0
                    return (
                      <div key={dev.name} className="px-4 py-2.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{dev.name}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">{dev.count} 筆 · {dev.totalSp} SP</span>
                        </div>
                        {dev.totalSp > 0 && (
                          <>
                            <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                              {dev.usedSp > 0 && <div className="bg-violet-500" style={{ width: `${usedPct}%` }} />}
                            </div>
                            <div className="flex gap-3 text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-violet-500" />已使用 {dev.usedSp} / {dev.totalSp} SP</span>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Risk cards */}
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    逾期需求
                    {d.risks.overdueDemands.length > 0 && (
                      <Badge variant="destructive">{d.risks.overdueDemands.length}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {d.risks.overdueDemands.length > 0 ? (
                    <div className="space-y-3">
                      {d.risks.overdueDemands.map((item) => (
                        <div key={item.demandNumber} className="flex items-center justify-between rounded-lg border p-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-muted-foreground">{item.demandNumber}</span>
                              <span className={STATUS_MAP[item.status]?.color + " text-xs px-2 py-0.5 rounded-full"}>{STATUS_MAP[item.status]?.label}</span>
                            </div>
                            <p className="text-sm font-medium">{item.title}</p>
                            <p className="text-xs text-muted-foreground">{item.organization}</p>
                          </div>
                          <Badge variant="destructive">逾期 {item.overdueDays} 天</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">目前沒有逾期需求</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    停滯需求
                    {d.risks.staleDemands.length > 0 && (
                      <Badge variant="secondary">{d.risks.staleDemands.length}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {d.risks.staleDemands.length > 0 ? (
                    <div className="space-y-3">
                      {d.risks.staleDemands.map((item) => (
                        <div key={item.demandNumber} className="flex items-center justify-between rounded-lg border p-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-muted-foreground">{item.demandNumber}</span>
                              <span className={STATUS_MAP[item.status]?.color + " text-xs px-2 py-0.5 rounded-full"}>{STATUS_MAP[item.status]?.label}</span>
                            </div>
                            <p className="text-sm font-medium">{item.title}</p>
                            <p className="text-xs text-muted-foreground">{item.organization}</p>
                          </div>
                          <Badge variant="outline">{item.idleDays} 天未更新</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">目前沒有停滯需求</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ====== SP 分析 ====== */}
          <TabsContent value="sp-usage">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">SP 配額使用總覽</CardTitle>
                  <CardDescription>
                    全組織合計配額 {d.sp.totalQuota} SP
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {spPieData.length > 0 ? (
                    <ChartContainer config={spPieConfig} className="h-[260px] w-full">
                      <PieChart>
                        <Pie
                          data={spPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          label={({ name, value, cx: cxVal, cy: cyVal, midAngle, outerRadius: or }) => { const rad = (Math.PI / 180) * midAngle; const x = Number(cxVal) + (Number(or) + 20) * Math.cos(-rad); const y = Number(cyVal) + (Number(or) + 20) * Math.sin(-rad); return (<text x={x} y={y} textAnchor={x > Number(cxVal) ? "start" : "end"} dominantBaseline="central" fontSize={14} fill="currentColor">{`${name} ${value}`}</text>); }}
                        >
                          {spPieData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ChartContainer>
                  ) : (
                    <EmptyState message="尚未配置 SP 配額" />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">各組織 SP 使用</CardTitle>
                </CardHeader>
                <CardContent>
                  {orgSpChartData.length > 0 ? (
                    <ChartContainer config={spAllocationConfig} className="h-[340px] w-full">
                      <BarChart data={orgSpChartData} margin={{ bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" fontSize={12} angle={-35} textAnchor="end" interval={0} />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="已使用" stackId="a" fill="#8b5cf6" />
                        <Bar dataKey="可用" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <EmptyState message="尚未配置 SP 配額" />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* SP detail table */}
            {d.sp.byOrganization.length > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base">組織 SP 明細</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 font-medium">組織</th>
                          <th className="pb-2 font-medium text-right">配額</th>
                          <th className="pb-2 font-medium text-right">已使用</th>
                          <th className="pb-2 font-medium text-right">可用</th>
                          <th className="pb-2 font-medium text-right">需求數</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.sp.byOrganization.map((org) => (
                          <tr key={org.name} className="border-b last:border-0">
                            <td className="py-2 font-medium">{org.name}</td>
                            <td className="py-2 text-right">{org.totalQuota}</td>
                            <td className="py-2 text-right">{org.usedSp}</td>
                            <td className="py-2 text-right">{org.availableSp}</td>
                            <td className="py-2 text-right">{org.demandCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ====== 金額報表 ====== */}
          {d.financial && (
            <TabsContent value="financial">
              {/* Row 1: Charts — Org pie + Org stacked bar */}
              {(() => {
                const fin = d.financial!
                const totalCommittedAmount = fin.orgSummary.reduce((s, o) => s + o.amount, 0)
                const totalUsedAmount = fin.orgSummary.reduce((s, o) => s + o.usedAmount, 0)
                const totalCommittedSp = fin.orgSummary.reduce((s, o) => s + o.totalSp, 0)
                const totalUsedSp = fin.orgSummary.reduce((s, o) => s + o.usedSp, 0)
                const sorted = [...fin.orgSummary].sort((a, b) => b.quotaAmount - a.quotaAmount || b.amount - a.amount)

                // Pie: committed amount by org
                const orgPieData = sorted.filter((o) => o.amount > 0).map((o, i) => ({
                  name: o.name,
                  value: o.amount,
                  fill: ORG_COLORS[i % ORG_COLORS.length],
                }))
                const orgPieConfig = Object.fromEntries(
                  orgPieData.map((o) => [o.name, { label: o.name, color: o.fill }])
                )

                // Stacked bar: quota breakdown per org (consumed / committed-not-consumed / remaining quota)
                const orgBarData = sorted.filter((o) => o.quotaAmount > 0 || o.amount > 0).map((o) => ({
                  name: o.name,
                  已消耗: o.usedAmount,
                  已提出未消耗: o.amount - o.usedAmount,
                  剩餘預算: Math.max(0, o.quotaAmount - o.amount),
                }))
                const barConfig = {
                  已消耗: { label: "已消耗", color: "#8b5cf6" },
                  已提出未消耗: { label: "已提出(未消耗)", color: "#f59e0b" },
                  剩餘預算: { label: "剩餘預算", color: "#d4d4d8" },
                }

                return (
                  <>
                    {/* KPI strip: 預算 → 已提出 → 已消耗 */}
                    <div className="grid grid-cols-2 md:grid-cols-4 divide-x rounded-lg border bg-card text-center mb-4">
                      <div className="px-4 py-3">
                        <p className="text-xs text-muted-foreground">年度預算</p>
                        <p className="text-xl font-bold mt-0.5">{fmtAmount(fin.totalQuotaAmount)}</p>
                        <p className="text-[11px] text-muted-foreground">{fin.totalQuotaSp} SP</p>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-xs text-muted-foreground">已提出金額</p>
                        <p className="text-xl font-bold mt-0.5 text-amber-600">{fmtAmount(totalCommittedAmount)}</p>
                        <p className="text-[11px] text-muted-foreground">{totalCommittedSp} SP · 佔預算 {fin.totalQuotaAmount > 0 ? Math.round((totalCommittedAmount / fin.totalQuotaAmount) * 100) : 0}%</p>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-xs text-muted-foreground">已消耗金額</p>
                        <p className="text-xl font-bold mt-0.5 text-violet-600">{fmtAmount(totalUsedAmount)}</p>
                        <p className="text-[11px] text-muted-foreground">{totalUsedSp} SP · 佔預算 {fin.totalQuotaAmount > 0 ? Math.round((totalUsedAmount / fin.totalQuotaAmount) * 100) : 0}%</p>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-xs text-muted-foreground">剩餘預算</p>
                        <p className="text-xl font-bold mt-0.5 text-emerald-600">{fmtAmount(Math.max(0, fin.totalQuotaAmount - totalCommittedAmount))}</p>
                        <p className="text-[11px] text-muted-foreground">{Math.max(0, fin.totalQuotaSp - totalCommittedSp)} SP · 1 SP = NT$20,000</p>
                      </div>
                    </div>

                    {/* Budget progress bar */}
                    {fin.totalQuotaAmount > 0 && (
                      <div className="rounded-lg border bg-card px-4 py-3 mb-4">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                          <span>預算使用進度</span>
                          <span>{Math.round((totalCommittedAmount / fin.totalQuotaAmount) * 100)}% 已提出 · {Math.round((totalUsedAmount / fin.totalQuotaAmount) * 100)}% 已消耗</span>
                        </div>
                        <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                          {totalUsedAmount > 0 && (
                            <div className="bg-violet-500" style={{ width: `${(totalUsedAmount / fin.totalQuotaAmount) * 100}%` }} title="已消耗" />
                          )}
                          {totalCommittedAmount - totalUsedAmount > 0 && (
                            <div className="bg-amber-400" style={{ width: `${((totalCommittedAmount - totalUsedAmount) / fin.totalQuotaAmount) * 100}%` }} title="已提出(未消耗)" />
                          )}
                        </div>
                        <div className="flex gap-4 mt-1.5 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-violet-500" />已消耗</span>
                          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-amber-400" />已提出(未消耗)</span>
                          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-muted" />剩餘預算</span>
                        </div>
                      </div>
                    )}

                    {/* Charts row */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">各組織提出金額佔比</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ChartContainer config={orgPieConfig} className="h-[280px] w-full">
                            <PieChart>
                              <Pie
                                data={orgPieData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={90}
                                label={({ name, cx: cxVal, cy: cyVal, midAngle, outerRadius: or }) => {
                                  const rad = (Math.PI / 180) * midAngle
                                  const x = Number(cxVal) + (Number(or) + 18) * Math.cos(-rad)
                                  const y = Number(cyVal) + (Number(or) + 18) * Math.sin(-rad)
                                  return <text x={x} y={y} textAnchor={x > Number(cxVal) ? "start" : "end"} dominantBaseline="central" fontSize={13} fill="currentColor">{name}</text>
                                }}
                              >
                                {orgPieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                              </Pie>
                              <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => (
                                <span className="flex items-center justify-between w-full gap-2">
                                  <span className="text-muted-foreground">{name}</span>
                                  <span className="font-medium tabular-nums">{fmtAmount(value as number)}</span>
                                </span>
                              )} />} />
                            </PieChart>
                          </ChartContainer>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">各組織預算使用狀況</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ChartContainer config={barConfig} className="h-[280px] w-full">
                            <BarChart data={orgBarData} layout="vertical" margin={{ left: 10, right: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" tickFormatter={(v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}萬` : v.toLocaleString()} />
                              <YAxis dataKey="name" type="category" width={100} fontSize={12} />
                              <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => (
                                <span className="flex items-center justify-between w-full gap-2">
                                  <span className="text-muted-foreground">{barConfig[name as keyof typeof barConfig]?.label ?? name}</span>
                                  <span className="font-medium tabular-nums">{fmtAmount(value as number)}</span>
                                </span>
                              )} />} />
                              <Bar dataKey="已消耗" stackId="a" fill="#8b5cf6" />
                              <Bar dataKey="已提出未消耗" stackId="a" fill="#f59e0b" />
                              <Bar dataKey="剩餘預算" stackId="a" fill="#d4d4d8" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ChartContainer>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                )
              })()}

              {/* Row 2: Monthly trend chart */}
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-violet-500" />
                    月度結案金額趨勢
                  </CardTitle>
                  <CardDescription>近 8 個月各組織結案 SP 對應金額</CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const allOrgNames = Array.from(new Set(d.financial!.monthlyTrend.flatMap((m) => m.data.map((dd) => dd.organization))))
                    const trendBarData = d.financial!.monthlyTrend.map((m) => {
                      const row: Record<string, string | number> = { month: m.month }
                      for (const orgName of allOrgNames) {
                        const entry = m.data.find((dd) => dd.organization === orgName)
                        row[orgName] = entry ? entry.amount : 0
                      }
                      return row
                    })
                    const hasData = trendBarData.some((row) => allOrgNames.some((n) => (row[n] as number) > 0))
                    if (!hasData) return <EmptyState message="尚無結案金額資料" />

                    const trendConfig = Object.fromEntries(
                      allOrgNames.map((name, i) => [name, { label: name, color: ORG_COLORS[i % ORG_COLORS.length] }])
                    )
                    return (
                      <ChartContainer config={trendConfig} className="h-[300px] w-full">
                        <BarChart data={trendBarData} margin={{ bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" fontSize={12} />
                          <YAxis tickFormatter={(v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}萬` : v.toLocaleString()} />
                          <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => (
                            <span className="flex items-center justify-between w-full gap-2">
                              <span className="text-muted-foreground">{name}</span>
                              <span className="font-medium tabular-nums">{fmtAmount(value as number)}</span>
                            </span>
                          )} />} />
                          {allOrgNames.map((name, i) => (
                            <Bar key={name} dataKey={name} stackId="a" fill={ORG_COLORS[i % ORG_COLORS.length]} radius={i === allOrgNames.length - 1 ? [4, 4, 0, 0] : undefined} />
                          ))}
                        </BarChart>
                      </ChartContainer>
                    )
                  })()}
                </CardContent>
              </Card>

              {/* Row 3: Org summary table (simplified) */}
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-500" />
                    組織金額明細
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 font-medium">組織</th>
                          <th className="pb-2 font-medium text-right">預算</th>
                          <th className="pb-2 font-medium text-right">已提出</th>
                          <th className="pb-2 font-medium text-right">已消耗</th>
                          <th className="pb-2 font-medium text-right">預算使用率</th>
                          <th className="pb-2 font-medium text-right">需求數</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...d.financial.orgSummary].sort((a, b) => b.quotaAmount - a.quotaAmount || b.amount - a.amount).map((org) => {
                          const commitPct = org.quotaAmount > 0 ? Math.round((org.amount / org.quotaAmount) * 100) : 0
                          const usePct = org.quotaAmount > 0 ? Math.round((org.usedAmount / org.quotaAmount) * 100) : 0
                          return (
                            <tr key={org.name} className="border-b last:border-0">
                              <td className="py-2 font-medium">{org.name}</td>
                              <td className="py-2 text-right tabular-nums">{fmtAmount(org.quotaAmount)}</td>
                              <td className="py-2 text-right tabular-nums">{fmtAmount(org.amount)}</td>
                              <td className="py-2 text-right tabular-nums">{fmtAmount(org.usedAmount)}</td>
                              <td className="py-2 text-right">
                                <div className="inline-flex items-center gap-2">
                                  <div className="relative w-20 h-2 rounded-full bg-muted overflow-hidden">
                                    {usePct > 0 && <div className="absolute h-full bg-violet-500 rounded-full" style={{ width: `${Math.min(usePct, 100)}%` }} />}
                                    {commitPct > usePct && <div className="absolute h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(commitPct, 100)}%`, opacity: 0.5 }} />}
                                    {usePct > 0 && <div className="absolute h-full bg-violet-500 rounded-full" style={{ width: `${Math.min(usePct, 100)}%` }} />}
                                  </div>
                                  <span className="tabular-nums text-xs text-muted-foreground w-8 text-right">{commitPct}%</span>
                                </div>
                              </td>
                              <td className="py-2 text-right tabular-nums">{org.demandCount}</td>
                            </tr>
                          )
                        })}
                        <tr className="border-t-2 font-bold">
                          <td className="py-2">合計</td>
                          <td className="py-2 text-right tabular-nums">{fmtAmount(d.financial.orgSummary.reduce((s, o) => s + o.quotaAmount, 0))}</td>
                          <td className="py-2 text-right tabular-nums">{fmtAmount(d.financial.orgSummary.reduce((s, o) => s + o.amount, 0))}</td>
                          <td className="py-2 text-right tabular-nums">{fmtAmount(d.financial.orgSummary.reduce((s, o) => s + o.usedAmount, 0))}</td>
                          <td className="py-2" />
                          <td className="py-2 text-right tabular-nums">{d.financial.orgSummary.reduce((s, o) => s + o.demandCount, 0)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Row 4: Expandable demand detail */}
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    需求明細
                  </CardTitle>
                  <CardDescription>按組織展開查看各需求 SP 與金額</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {[...d.financial.orgSummary].sort((a, b) => b.amount - a.amount).map((org) => {
                      const isExpanded = expandedOrgs.has(org.name)
                      const orgDemands = d.financial!.demandDetail.filter((dd) => dd.organization === org.name)
                      return (
                        <div key={org.name} className="rounded-lg border overflow-hidden">
                          <button
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
                            onClick={() => {
                              setExpandedOrgs((prev) => {
                                const next = new Set(prev)
                                if (next.has(org.name)) next.delete(org.name)
                                else next.add(org.name)
                                return next
                              })
                            }}
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <span>{org.name}</span>
                            <Badge variant="secondary" className="ml-auto text-xs">{org.demandCount} 筆 · {fmtAmount(org.amount)}</Badge>
                          </button>
                          {isExpanded && (
                            <div className="border-t">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-muted/30 text-left text-muted-foreground text-xs">
                                    <th className="px-4 py-1.5 font-medium">編號</th>
                                    <th className="px-4 py-1.5 font-medium">需求名稱</th>
                                    <th className="px-4 py-1.5 font-medium">狀態</th>
                                    <th className="px-4 py-1.5 font-medium text-right">金額</th>
                                    <th className="px-4 py-1.5 font-medium text-right">已消耗</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {orgDemands.map((dd) => (
                                    <tr key={dd.demandNumber} className="border-b last:border-0">
                                      <td className="px-4 py-1.5 font-mono text-xs text-muted-foreground">{dd.demandNumber}</td>
                                      <td className="px-4 py-1.5 max-w-[240px] truncate">{dd.title}</td>
                                      <td className="px-4 py-1.5">
                                        <span className={`${STATUS_MAP[dd.status]?.color} text-xs px-2 py-0.5 rounded-full`}>
                                          {STATUS_MAP[dd.status]?.label}
                                        </span>
                                      </td>
                                      <td className="px-4 py-1.5 text-right tabular-nums">{fmtAmount(dd.amount)}</td>
                                      <td className="px-4 py-1.5 text-right tabular-nums">{fmtAmount(dd.usedAmount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  )
}

function KpiCard({ color, icon: Icon, title, value, sub }: { color: string; icon: React.ComponentType<{ className?: string }>; title: string; value: React.ReactNode; sub: string }) {
  return (
    <div className="flex gap-3 rounded-lg bg-card px-4 py-3">
      <div className="w-1 shrink-0 self-stretch rounded-full" style={{ backgroundColor: color }} />
      <div className="flex flex-1 items-end justify-between">
        <div>
          <span className="text-2xl font-bold">{value}</span>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
        <div className="flex items-center gap-1.5 self-start">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ message = "尚無資料" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <BarChart3 className="h-10 w-10 text-muted-foreground/30 mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, AlertCircle } from "lucide-react"
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

export default function TrendsPage() {
  const monthlyData = [
    { month: "2023-02", submitted: 20, completed: 17, avgSP: 15.9 },
    { month: "2023-03", submitted: 24, completed: 19, avgSP: 16.8 },
    { month: "2023-04", submitted: 21, completed: 18, avgSP: 16.5 },
    { month: "2023-05", submitted: 25, completed: 21, avgSP: 17.1 },
    { month: "2023-06", submitted: 23, completed: 20, avgSP: 16.9 },
    { month: "2023-07", submitted: 27, completed: 22, avgSP: 17.5 },
    { month: "2023-08", submitted: 24, completed: 20, avgSP: 16.8 },
    { month: "2023-09", submitted: 26, completed: 21, avgSP: 17.2 },
    { month: "2023-10", submitted: 30, completed: 24, avgSP: 18.9 },
    { month: "2023-11", submitted: 22, completed: 19, avgSP: 17.8 },
    { month: "2023-12", submitted: 25, completed: 22, avgSP: 18.5 },
    { month: "2024-01", submitted: 28, completed: 23, avgSP: 19.2 },
  ]

  const complexityData = [
    { name: "1-5 SP (簡單)", value: 42, percentage: 28 },
    { name: "8-13 SP (中等)", value: 68, percentage: 45 },
    { name: "21-34 SP (複雜)", value: 32, percentage: 21 },
    { name: "55+ SP (極複雜)", value: 9, percentage: 6 },
  ]

  const CHART_COLORS = {
    primary: "rgb(59, 130, 246)", // blue-500
    success: "rgb(34, 197, 94)", // green-500
    warning: "rgb(251, 146, 60)", // orange-400
    danger: "rgb(239, 68, 68)", // red-500
    purple: "rgb(168, 85, 247)", // purple-500
  }

  const COLORS = [CHART_COLORS.success, CHART_COLORS.primary, CHART_COLORS.warning, CHART_COLORS.danger]

  const highSPDemands = [
    {
      id: "REQ-2024-005",
      title: "跨平台電商系統",
      subsidiary: "子公司 A",
      sp: 55,
      status: "進行中",
      risk: "高",
      spChange: "+8 SP",
    },
    {
      id: "REQ-2024-012",
      title: "ERP 供應鏈模組",
      subsidiary: "子公司 B",
      sp: 42,
      status: "評估中",
      risk: "中",
      spChange: "無",
    },
    {
      id: "REQ-2023-089",
      title: "多語系CMS平台",
      subsidiary: "子公司 C",
      sp: 38,
      status: "已完成",
      risk: "低",
      spChange: "-5 SP",
    },
    {
      id: "REQ-2024-018",
      title: "數據分析平台整合",
      subsidiary: "子公司 A",
      sp: 55,
      status: "進行中",
      risk: "高",
      spChange: "+13 SP",
    },
    {
      id: "REQ-2024-021",
      title: "行動支付系統",
      subsidiary: "子公司 B",
      sp: 44,
      status: "進行中",
      risk: "中",
      spChange: "無",
    },
  ]

  return (
    <AppLayout userRole="board">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">需求趨勢分析</h1>
          <p className="text-muted-foreground">需求量、複雜度與優先度變化趨勢</p>
        </div>

        {/* Trend Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">需求成長率</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">+15%</div>
              <p className="text-xs text-chart-3">
                <TrendingUp className="mr-1 inline h-3 w-3" />
                較去年同期
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">平均 SP</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">18.5</div>
              <p className="text-xs text-chart-4">
                <TrendingUp className="mr-1 inline h-3 w-3" />
                複雜度上升
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">重複需求率</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">12%</div>
              <p className="text-xs text-chart-3">
                <TrendingDown className="mr-1 inline h-3 w-3" />
                較上季改善
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Trends */}
        <Card>
          <CardHeader>
            <CardTitle>月度需求量趨勢</CardTitle>
            <CardDescription>過去 12 個月需求提交與完成統計</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="colorSubmitted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.success} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={CHART_COLORS.success} stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="submitted"
                  name="提交"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorSubmitted)"
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  name="完成"
                  stroke={CHART_COLORS.success}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorCompleted)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Complexity Analysis */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>需求複雜度分布</CardTitle>
              <CardDescription>依 Story Points 範圍劃分</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={complexityData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${percentage}%`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {complexityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {complexityData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                      <span className="text-foreground">{item.name}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {item.value} 個 ({item.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>高 SP 需求分析</CardTitle>
              <CardDescription>超過 34 Story Points 的需求</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium text-foreground">需特別關注</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  本季 9 個超過 34 SP 的需求中，3 個出現 SP 調整，建議強化初期評估
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="text-2xl font-bold text-foreground">9</div>
                  <p className="text-xs text-muted-foreground">高SP需求</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="text-2xl font-bold text-chart-4">3</div>
                  <p className="text-xs text-muted-foreground">SP 調整</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="text-2xl font-bold text-chart-3">48</div>
                  <p className="text-xs text-muted-foreground">平均 SP</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">典型高 SP 需求類型</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>跨平台開發</span>
                    <Badge variant="outline" className="border-primary text-primary">
                      平均 55 SP
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>系統整合</span>
                    <Badge variant="outline" className="border-primary text-primary">
                      平均 42 SP
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>多語系實作</span>
                    <Badge variant="outline" className="border-primary text-primary">
                      平均 38 SP
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-sm font-medium text-foreground">風險模式分析</p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <li>• 跨平台需求 SP 調整率達 40%</li>
                  <li>• 整合類需求平均延期 15 天</li>
                  <li>• 建議拆分成 2-3 個子需求</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>高 SP 需求清單</CardTitle>
            <CardDescription>當前進行中與評估中的高複雜度需求</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-3 text-left font-medium text-muted-foreground">需求編號</th>
                    <th className="pb-3 text-left font-medium text-muted-foreground">需求名稱</th>
                    <th className="pb-3 text-left font-medium text-muted-foreground">子公司</th>
                    <th className="pb-3 text-center font-medium text-muted-foreground">Story Points</th>
                    <th className="pb-3 text-center font-medium text-muted-foreground">狀態</th>
                    <th className="pb-3 text-center font-medium text-muted-foreground">風險</th>
                    <th className="pb-3 text-center font-medium text-muted-foreground">SP 變更</th>
                  </tr>
                </thead>
                <tbody>
                  {highSPDemands.map((demand, i) => (
                    <tr key={demand.id} className="border-b border-border last:border-0">
                      <td className="py-3 font-mono text-xs text-muted-foreground">{demand.id}</td>
                      <td className="py-3 font-medium text-foreground">{demand.title}</td>
                      <td className="py-3 text-muted-foreground">{demand.subsidiary}</td>
                      <td className="py-3 text-center">
                        <Badge variant="outline" className="border-primary text-primary">
                          {demand.sp} SP
                        </Badge>
                      </td>
                      <td className="py-3 text-center">
                        <Badge
                          variant={demand.status === "已完成" ? "default" : "secondary"}
                          className={
                            demand.status === "已完成"
                              ? "bg-chart-3 hover:bg-chart-3"
                              : demand.status === "進行中"
                                ? "bg-chart-1 hover:bg-chart-1"
                                : ""
                          }
                        >
                          {demand.status}
                        </Badge>
                      </td>
                      <td className="py-3 text-center">
                        <Badge
                          variant={
                            demand.risk === "高" ? "destructive" : demand.risk === "中" ? "secondary" : "outline"
                          }
                        >
                          {demand.risk}
                        </Badge>
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={
                            demand.spChange.includes("+")
                              ? "text-destructive"
                              : demand.spChange.includes("-")
                                ? "text-chart-3"
                                : "text-muted-foreground"
                          }
                        >
                          {demand.spChange}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">平均完成時間</p>
                <p className="text-xl font-bold text-foreground">58 天</p>
                <p className="text-xs text-muted-foreground">較標準需求多 2.3x</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">SP 調整率</p>
                <p className="text-xl font-bold text-chart-4">33%</p>
                <p className="text-xs text-muted-foreground">需求範疇變更頻繁</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">成功交付率</p>
                <p className="text-xl font-bold text-chart-3">78%</p>
                <p className="text-xs text-muted-foreground">22% 需拆分或調整</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Duplicate Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>重複需求識別</CardTitle>
            <CardDescription>可能重複或相似的需求模式</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="mb-2 text-2xl font-bold text-foreground">8</div>
                  <p className="text-sm text-muted-foreground">相似報表需求</p>
                  <p className="mt-1 text-xs text-muted-foreground">建議整合為共用報表平台</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="mb-2 text-2xl font-bold text-foreground">5</div>
                  <p className="text-sm text-muted-foreground">匯出功能需求</p>
                  <p className="mt-1 text-xs text-muted-foreground">可統一為標準匯出模組</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="mb-2 text-2xl font-bold text-foreground">6</div>
                  <p className="text-sm text-muted-foreground">權限控管需求</p>
                  <p className="mt-1 text-xs text-muted-foreground">建議強化基礎權限系統</p>
                </div>
              </div>

              <div className="rounded-lg border border-primary/50 bg-primary/10 p-4">
                <h4 className="mb-2 text-sm font-semibold text-foreground">優化建議</h4>
                <p className="text-sm text-muted-foreground">
                  整合相似需求可節省約 18% 的開發資源。建議建立共用元件庫，減少重複開發。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Insights */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>趨勢洞察</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-chart-3" />
                  <h4 className="text-sm font-semibold text-foreground">正向趨勢</h4>
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• 需求完成率穩定提升，流程持續優化</li>
                  <li>• 重複需求識別機制見效，減少 12% 重工</li>
                  <li>• 子公司需求品質提升，退回率降低</li>
                </ul>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-chart-4" />
                  <h4 className="text-sm font-semibold text-foreground">需關注趨勢</h4>
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• 平均 SP 上升反映需求複雜度增加</li>
                  <li>• 跨平台與整合需求持續增長</li>
                  <li>• 需強化高 SP 需求的拆分與評估</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

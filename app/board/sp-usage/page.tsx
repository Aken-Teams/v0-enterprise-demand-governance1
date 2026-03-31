"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, AlertCircle } from "lucide-react"
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts"

export default function SPUsagePage() {
  const burnRateData = [
    { month: "2023-08", burned: 128, target: 140 },
    { month: "2023-09", burned: 134, target: 140 },
    { month: "2023-10", burned: 156, target: 140 },
    { month: "2023-11", burned: 125, target: 140 },
    { month: "2023-12", burned: 142, target: 140 },
    { month: "2024-01", burned: 158, target: 140 },
  ]

  const subsidiaryEfficiency = [
    { subsidiary: "子公司 A", efficiency: 92, onTime: 94, quality: 90, capacity: 85 },
    { subsidiary: "子公司 B", efficiency: 88, onTime: 89, quality: 86, capacity: 80 },
    { subsidiary: "子公司 C", efficiency: 95, onTime: 96, quality: 93, capacity: 90 },
  ]

  const CHART_COLORS = {
    primary: "rgb(59, 130, 246)", // blue-500
    success: "rgb(34, 197, 94)", // green-500
    warning: "rgb(251, 146, 60)", // orange-400
    danger: "rgb(239, 68, 68)", // red-500
    purple: "rgb(168, 85, 247)", // purple-500
  }

  return (
    <AppLayout userRole="board">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">SP 使用分析</h1>
          <p className="text-muted-foreground">Story Points 投入效率與資源配置分析</p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">總配額</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">1,100</div>
              <p className="text-xs text-muted-foreground">2024 年度</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">使用率</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">49.5%</div>
              <p className="text-xs text-chart-3">
                <TrendingUp className="mr-1 inline h-3 w-3" />
                符合預期進度
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Burn Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">136</div>
              <p className="text-xs text-muted-foreground">SP / 月平均</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">投資效率</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">1.82</div>
              <p className="text-xs text-chart-3">
                <TrendingUp className="mr-1 inline h-3 w-3" />
                ROI 指數
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Burn Rate Trend */}
        <Card>
          <CardHeader>
            <CardTitle>SP 消耗趨勢</CardTitle>
            <CardDescription>月度 Story Points 消耗趨勢</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={burnRateData}>
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
                <Bar dataKey="burned" name="消耗 SP" fill={CHART_COLORS.primary} />
                <Line type="monotone" dataKey="target" name="目標" stroke={CHART_COLORS.warning} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Subsidiary Usage */}
        <Card>
          <CardHeader>
            <CardTitle>子公司 SP 使用效率</CardTitle>
            <CardDescription>各子公司資源使用與產出效率比較</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[
                {
                  name: "子公司 A",
                  allocation: 500,
                  used: 244,
                  efficiency: 92,
                  avgCycle: 28,
                  onTime: 94,
                },
                {
                  name: "子公司 B",
                  allocation: 350,
                  used: 180,
                  efficiency: 88,
                  avgCycle: 31,
                  onTime: 89,
                },
                {
                  name: "子公司 C",
                  allocation: 250,
                  used: 120,
                  efficiency: 95,
                  avgCycle: 26,
                  onTime: 96,
                },
              ].map((sub) => (
                <div key={sub.name} className="rounded-lg border border-border p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">{sub.name}</h3>
                    <Badge variant="outline" className="border-primary text-primary">
                      效率: {sub.efficiency}%
                    </Badge>
                  </div>

                  <div className="mb-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">配額使用</span>
                      <span className="font-medium text-foreground">
                        {sub.used} / {sub.allocation} SP ({Math.round((sub.used / sub.allocation) * 100)}%)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-chart-1" style={{ width: `${(sub.used / sub.allocation) * 100}%` }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">平均週期</p>
                      <p className="font-semibold text-foreground">{sub.avgCycle} 天</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">準時率</p>
                      <p className="font-semibold text-foreground">{sub.onTime}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Subsidiary Efficiency Radar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>子公司績效雷達圖</CardTitle>
            <CardDescription>多維度效率評估</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={subsidiaryEfficiency}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="subsidiary" stroke="#1f2937" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#6b7280" />
                <Radar
                  name="效率"
                  dataKey="efficiency"
                  stroke={CHART_COLORS.primary}
                  fill={CHART_COLORS.primary}
                  fillOpacity={0.6}
                />
                <Radar
                  name="準時率"
                  dataKey="onTime"
                  stroke={CHART_COLORS.success}
                  fill={CHART_COLORS.success}
                  fillOpacity={0.6}
                />
                <Radar
                  name="品質"
                  dataKey="quality"
                  stroke={CHART_COLORS.warning}
                  fill={CHART_COLORS.warning}
                  fillOpacity={0.6}
                />
                <Legend />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Long Running Items */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>長期未結案 SP</CardTitle>
              <CardDescription>超過 60 天未完成驗收的需求</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { id: "REQ-2023-042", title: "ERP 系統整合", sp: 55, days: 78, subsidiary: "子公司 B" },
                  { id: "REQ-2023-048", title: "數據倉儲建置", sp: 89, days: 65, subsidiary: "子公司 A" },
                ].map((item) => (
                  <div key={item.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{item.id}</span>
                        <h4 className="text-sm font-medium text-foreground">{item.title}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.subsidiary} • {item.sp} SP • 已 {item.days} 天
                      </p>
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      超時
                    </Badge>
                  </div>
                ))}

                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">144 SP</span> 處於長期未結案狀態
                  </p>
                  <p className="text-xs text-muted-foreground">建議進行專案檢討與資源調整</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>投資效率指標</CardTitle>
              <CardDescription>Story Points 投入與產出效益</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="mb-2 text-4xl font-bold text-primary">1.82</div>
                <p className="text-sm text-muted-foreground">投資報酬指數 (ROI)</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">平均商業價值</span>
                  <span className="font-medium text-foreground">8.2 / 10</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">SP 完成率</span>
                  <span className="font-medium text-foreground">91%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">重工成本</span>
                  <span className="font-medium text-foreground">8%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">技術債比例</span>
                  <span className="font-medium text-foreground">15%</span>
                </div>
              </div>

              <div className="rounded-lg border border-chart-3/50 bg-chart-3/10 p-3">
                <p className="text-sm font-medium text-foreground">效率評級: 優良</p>
                <p className="text-xs text-muted-foreground">ROI 指數超過業界平均 1.5，顯示資源運用有效</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Insights */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>SP 使用洞察</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-chart-3" />
                  <h4 className="text-sm font-semibold text-foreground">效率亮點</h4>
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• 子公司 C 的 SP 效率達 95%，值得其他單位學習</li>
                  <li>• 整體 ROI 指數 1.82，資源投入產生良好價值</li>
                  <li>• Burn Rate 穩定，符合年度規劃進度</li>
                </ul>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-chart-4" />
                  <h4 className="text-sm font-semibold text-foreground">改善建議</h4>
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• 144 SP 長期未結案需進行專案檢討</li>
                  <li>• 考慮調整子公司 B 的配額與支援資源</li>
                  <li>• 建立 SP 預警機制，及早發現異常項目</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

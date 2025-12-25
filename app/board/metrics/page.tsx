"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertCircle, TrendingUp } from "lucide-react"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts"

export default function MetricsPage() {
  const deliveryMetricsData = [
    { metric: "準時驗收率", Q1: 85, Q2: 86, Q3: 87, Q4: 88 },
    { metric: "Sprint完成率", Q1: 88, Q2: 89, Q3: 90, Q4: 91 },
    { metric: "首次通過率", Q1: 89, Q2: 90, Q3: 91, Q4: 92 },
    { metric: "需求變更率", Q1: 15, Q2: 14, Q3: 13, Q4: 12 },
  ]

  const sprintStabilityData = [
    { sprint: "23-10", score: 8.3, completion: 87 },
    { sprint: "23-11", score: 8.1, completion: 84 },
    { sprint: "23-12", score: 8.6, completion: 90 },
    { sprint: "24-01", score: 8.2, completion: 86 },
    { sprint: "24-02", score: 9.1, completion: 95 },
    { sprint: "24-03", score: 8.8, completion: 89 },
  ]

  const heatmapData = [
    { week: "W1", evaluationTime: 3.5, rejectionRate: 8, spAdjustment: 20, x: 1, y: 1, value: 85 },
    { week: "W2", evaluationTime: 4.2, rejectionRate: 10, spAdjustment: 25, x: 2, y: 1, value: 78 },
    { week: "W3", evaluationTime: 3.8, rejectionRate: 7, spAdjustment: 22, x: 3, y: 1, value: 82 },
    { week: "W4", evaluationTime: 3.2, rejectionRate: 6, spAdjustment: 18, x: 4, y: 1, value: 90 },
    { week: "W5", evaluationTime: 3.9, rejectionRate: 9, spAdjustment: 24, x: 5, y: 1, value: 80 },
    { week: "W6", evaluationTime: 3.6, rejectionRate: 8, spAdjustment: 21, x: 6, y: 1, value: 84 },
  ]

  return (
    <AppLayout userRole="board">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">交付與治理指標</h1>
          <p className="text-muted-foreground">開發交付品質與治理流程效能</p>
        </div>

        {/* Overall Health Score */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle>治理健康度總評</CardTitle>
            <CardDescription>綜合關鍵指標評估</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="mb-2 flex items-center gap-3">
                  <div className="text-5xl font-bold text-primary">87</div>
                  <div>
                    <p className="text-sm font-medium text-foreground">健康度分數</p>
                    <p className="text-xs text-muted-foreground">滿分 100</p>
                  </div>
                </div>
                <Badge className="bg-chart-3 text-white">良好</Badge>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>較上季 +5 分</p>
                <p>持續改善中</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>交付指標</CardTitle>
            <CardDescription>需求完成與驗收相關指標</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[
                {
                  metric: "準時驗收率",
                  value: 88,
                  target: 90,
                  unit: "%",
                  trend: "up",
                  status: "warning",
                  description: "需求在預期時間內完成驗收的比例",
                },
                {
                  metric: "Sprint 完成率",
                  value: 91,
                  target: 85,
                  unit: "%",
                  trend: "up",
                  status: "good",
                  description: "Sprint 承諾的 SP 實際完成比例",
                },
                {
                  metric: "首次驗收通過率",
                  value: 92,
                  target: 85,
                  unit: "%",
                  trend: "up",
                  status: "good",
                  description: "需求首次提交驗收即通過的比例",
                },
                {
                  metric: "需求變更率",
                  value: 12,
                  target: 15,
                  unit: "%",
                  trend: "down",
                  status: "good",
                  description: "需求在開發過程中發生變更的比例",
                },
              ].map((item, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <h4 className="font-medium text-foreground">{item.metric}</h4>
                        {item.status === "good" ? (
                          <CheckCircle className="h-4 w-4 text-chart-3" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-chart-4" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-2xl font-bold text-foreground">
                          {item.value}
                          {item.unit}
                        </span>
                        <TrendingUp
                          className={`h-4 w-4 ${item.trend === "down" ? "rotate-180 text-chart-3" : "text-chart-3"}`}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        目標: {item.target}
                        {item.unit}
                      </p>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full ${item.status === "good" ? "bg-chart-3" : "bg-chart-4"}`}
                      style={{ width: `${(item.value / 100) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>交付指標趨勢</CardTitle>
            <CardDescription>季度表現變化</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={deliveryMetricsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="metric" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="Q1" name="Q1" stroke="hsl(var(--chart-1))" strokeWidth={2} />
                <Line type="monotone" dataKey="Q2" name="Q2" stroke="hsl(var(--chart-3))" strokeWidth={2} />
                <Line type="monotone" dataKey="Q3" name="Q3" stroke="hsl(var(--chart-4))" strokeWidth={2} />
                <Line type="monotone" dataKey="Q4" name="Q4" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Sprint Stability */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Sprint 穩定度指數</CardTitle>
              <CardDescription>過去 6 個 Sprint 的穩定性評估</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sprintStabilityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="sprint" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 10]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="score" name="穩定度分數" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-sm text-muted-foreground">
                  穩定度考量因素：完成率、承諾準確度、中途異動次數、團隊產能波動
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>超量承諾頻率</CardTitle>
              <CardDescription>Sprint 容量規劃與實際的差異</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="mb-2 text-center">
                  <div className="text-4xl font-bold text-foreground">15%</div>
                  <p className="text-sm text-muted-foreground">超量承諾比例</p>
                </div>
                <Badge variant="outline" className="w-full justify-center border-chart-3 text-chart-3">
                  在可接受範圍內
                </Badge>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="mb-2 text-sm font-medium text-foreground">超量承諾案例</h4>
                  <div className="space-y-2">
                    {[
                      { sprint: "Sprint 24-01", capacity: 100, committed: 112, reason: "緊急需求插入" },
                      { sprint: "Sprint 23-11", capacity: 100, committed: 108, reason: "評估偏樂觀" },
                    ].map((item, i) => (
                      <div key={i} className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-medium text-foreground">{item.sprint}</span>
                          <Badge variant="outline" className="text-xs">
                            {item.committed}/{item.capacity} SP
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">原因: {item.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-primary/50 bg-primary/10 p-3">
                  <p className="text-sm text-foreground">建議保持 10-15% 的容量緩衝，以應對突發狀況與評估誤差</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>治理流程效能熱力圖</CardTitle>
            <CardDescription>週度流程表現指標 (顏色深淺代表效能分數)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" dataKey="x" name="週次" domain={[0, 7]} stroke="hsl(var(--muted-foreground))" />
                <YAxis type="number" dataKey="y" domain={[0, 2]} tick={false} stroke="hsl(var(--muted-foreground))" />
                <ZAxis type="number" dataKey="value" range={[400, 1000]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="rounded-lg border border-border bg-background p-3 shadow-lg">
                          <p className="font-semibold text-foreground">{data.week}</p>
                          <p className="text-sm text-muted-foreground">評估時間: {data.evaluationTime} 天</p>
                          <p className="text-sm text-muted-foreground">退回率: {data.rejectionRate}%</p>
                          <p className="text-sm text-muted-foreground">SP調整: {data.spAdjustment}%</p>
                          <p className="text-sm font-medium text-primary">效能分數: {data.value}</p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Scatter name="週度效能" data={heatmapData} fill="hsl(var(--chart-1))" />
              </ScatterChart>
            </ResponsiveContainer>
            <div className="mt-4 flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-chart-1 opacity-40" />
                <span>低效能</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-chart-1 opacity-70" />
                <span>中等效能</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-chart-1" />
                <span>高效能</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Governance Process Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>治理流程指標</CardTitle>
            <CardDescription>需求評估與決策流程效能</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">平均評估時間</span>
                    <span className="font-semibold text-foreground">3.8 天</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-chart-4" style={{ width: "76%" }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">目標: 3 天內</p>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">需求退回率</span>
                    <span className="font-semibold text-foreground">8%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-chart-3" style={{ width: "8%" }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">業界標準: 10%</p>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">SP 調整比例</span>
                    <span className="font-semibold text-foreground">22%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-chart-1" style={{ width: "22%" }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">需求 SP 在評估後調整的比例</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="mb-1 text-sm font-medium text-foreground">評估品質良好</p>
                  <p className="text-xs text-muted-foreground">退回率低於業界標準，顯示前期溝通有效</p>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="mb-1 text-sm font-medium text-foreground">評估時間可優化</p>
                  <p className="text-xs text-muted-foreground">建議簡化評估流程或增加評估人力</p>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="mb-1 text-sm font-medium text-foreground">SP 調整屬正常範圍</p>
                  <p className="text-xs text-muted-foreground">22% 的調整比例顯示初步估算合理</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quality Metrics */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>品質指標摘要</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-chart-3" />
                  <h4 className="text-sm font-semibold text-foreground">優秀表現</h4>
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Sprint 完成率 91%</li>
                  <li>• 首次驗收通過率 92%</li>
                  <li>• 需求退回率僅 8%</li>
                </ul>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-chart-4" />
                  <h4 className="text-sm font-semibold text-foreground">持續改善</h4>
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• 準時驗收率 88%</li>
                  <li>• 評估時間 3.8 天</li>
                  <li>• 超量承諾 15%</li>
                </ul>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold text-foreground">改善趨勢</h4>
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• 健康度分數 +5</li>
                  <li>• 穩定度持續提升</li>
                  <li>• 流程效率優化</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

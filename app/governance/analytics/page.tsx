"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  FileText,
  Coins,
  XCircle,
} from "lucide-react"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  ScatterChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

// ===== Chart Data =====
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

const monthlyData = [
  { month: "2023-02", submitted: 20, completed: 17 },
  { month: "2023-03", submitted: 24, completed: 19 },
  { month: "2023-04", submitted: 21, completed: 18 },
  { month: "2023-05", submitted: 25, completed: 21 },
  { month: "2023-06", submitted: 23, completed: 20 },
  { month: "2023-07", submitted: 27, completed: 22 },
  { month: "2023-08", submitted: 24, completed: 20 },
  { month: "2023-09", submitted: 26, completed: 21 },
  { month: "2023-10", submitted: 30, completed: 24 },
  { month: "2023-11", submitted: 22, completed: 19 },
  { month: "2023-12", submitted: 25, completed: 22 },
  { month: "2024-01", submitted: 28, completed: 23 },
]

const complexityData = [
  { name: "1-5 SP (簡單)", value: 42, percentage: 28 },
  { name: "8-13 SP (中等)", value: 68, percentage: 45 },
  { name: "21-34 SP (複雜)", value: 32, percentage: 21 },
  { name: "55+ SP (極複雜)", value: 9, percentage: 6 },
]

const burnRateData = [
  { month: "2023-08", burned: 128, committed: 85, target: 140 },
  { month: "2023-09", burned: 134, committed: 76, target: 140 },
  { month: "2023-10", burned: 156, committed: 88, target: 140 },
  { month: "2023-11", burned: 125, committed: 82, target: 140 },
  { month: "2023-12", burned: 142, committed: 95, target: 140 },
  { month: "2024-01", burned: 158, committed: 89, target: 140 },
]

const subsidiaryEfficiency = [
  { subsidiary: "子公司 A", efficiency: 92, onTime: 94, quality: 90, capacity: 85 },
  { subsidiary: "子公司 B", efficiency: 88, onTime: 89, quality: 86, capacity: 80 },
  { subsidiary: "子公司 C", efficiency: 95, onTime: 96, quality: 93, capacity: 90 },
]

const highSPDemands = [
  { id: "REQ-2024-005", title: "跨平台電商系統", subsidiary: "子公司 A", sp: 55, status: "進行中", risk: "高", spChange: "+8 SP" },
  { id: "REQ-2024-012", title: "ERP 供應鏈模組", subsidiary: "子公司 B", sp: 42, status: "評估中", risk: "中", spChange: "無" },
  { id: "REQ-2023-089", title: "多語系CMS平台", subsidiary: "子公司 C", sp: 38, status: "已完成", risk: "低", spChange: "-5 SP" },
  { id: "REQ-2024-018", title: "數據分析平台整合", subsidiary: "子公司 A", sp: 55, status: "進行中", risk: "高", spChange: "+13 SP" },
  { id: "REQ-2024-021", title: "行動支付系統", subsidiary: "子公司 B", sp: 44, status: "進行中", risk: "中", spChange: "無" },
]

const CHART_COLORS = {
  primary: "rgb(59, 130, 246)",
  success: "rgb(34, 197, 94)",
  warning: "rgb(251, 146, 60)",
  danger: "rgb(239, 68, 68)",
  purple: "rgb(168, 85, 247)",
}

const PIE_COLORS = [CHART_COLORS.success, CHART_COLORS.primary, CHART_COLORS.warning, CHART_COLORS.danger]

const tooltipStyle = {
  backgroundColor: "hsl(var(--background))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
}

// ===== Tab: 總覽 =====
function OverviewTab() {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">活躍需求</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">47</div>
            <p className="text-xs text-chart-3">
              <TrendingUp className="mr-1 inline h-3 w-3" />
              較上月 +12%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">本月交付</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">23</div>
            <p className="text-xs text-muted-foreground">完成驗收需求數</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">SP 投入</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">544</div>
            <p className="text-xs text-muted-foreground">YTD 累計使用</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">交付效率</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">91%</div>
            <p className="text-xs text-chart-3">
              <TrendingUp className="mr-1 inline h-3 w-3" />
              提升 3%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trend + Resource */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>需求量趨勢</CardTitle>
            <CardDescription>過去 6 個月需求提交與完成情況</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { month: "2024-01", submitted: 28, completed: 23 },
                { month: "2023-12", submitted: 25, completed: 22 },
                { month: "2023-11", submitted: 22, completed: 19 },
                { month: "2023-10", submitted: 30, completed: 24 },
                { month: "2023-09", submitted: 26, completed: 21 },
                { month: "2023-08", submitted: 24, completed: 20 },
              ].map((data, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{data.month}</span>
                    <span className="text-foreground">
                      提交 {data.submitted} / 完成 {data.completed}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-chart-1" style={{ width: `${(data.submitted / 30) * 100}%` }} />
                    </div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-chart-3" style={{ width: `${(data.completed / 30) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-chart-1" />
                <span className="text-muted-foreground">提交</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-chart-3" />
                <span className="text-muted-foreground">完成</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>子公司資源分配</CardTitle>
            <CardDescription>2024 年度 Story Points 配額與使用率</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: "子公司 A", allocation: 500, used: 244, rate: 48.8 },
                { name: "子公司 B", allocation: 350, used: 180, rate: 51.4 },
                { name: "子公司 C", allocation: 250, used: 120, rate: 48.0 },
              ].map((sub, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{sub.name}</span>
                    <div className="text-right text-sm">
                      <span className="font-semibold text-foreground">{sub.used}</span>
                      <span className="text-muted-foreground"> / {sub.allocation} SP</span>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary" style={{ width: `${sub.rate}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>使用率</span>
                    <span>{sub.rate}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">治理健康度</CardTitle>
            <CardDescription>關鍵流程指標</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { metric: "需求評估及時率", value: "94%", status: "good" },
              { metric: "Sprint 完成率", value: "91%", status: "good" },
              { metric: "驗收及時率", value: "82%", status: "warning" },
              { metric: "變更請求率", value: "12%", status: "good" },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{item.metric}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{item.value}</span>
                  {item.status === "good" ? (
                    <CheckCircle className="h-4 w-4 text-chart-3" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-chart-4" />
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">SP 投資效率</CardTitle>
            <CardDescription>資源投入產出比</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">1.82</div>
              <p className="text-sm text-muted-foreground">投資報酬指數</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">平均需求價值</span>
                <span className="font-medium text-foreground">8.2/10</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">SP 使用效率</span>
                <span className="font-medium text-foreground">91%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">重工率</span>
                <span className="font-medium text-foreground">8%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">風險概況</CardTitle>
            <CardDescription>需關注項目</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">2 個高風險需求</p>
                <p className="text-xs text-muted-foreground">需技術委員會審查</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-chart-4/50 bg-chart-4/10 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-chart-4" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">驗收流程偏慢</p>
                <p className="text-xs text-muted-foreground">平均 5.8 天，目標 3 天</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-chart-3" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">整體治理良好</p>
                <p className="text-xs text-muted-foreground">多數指標達標</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quarter Summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle>本季度摘要</CardTitle>
          <CardDescription>2024 Q1 重點成果與洞察</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">關鍵成果</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• 完成 68 個需求交付，總計 487 Story Points</li>
                <li>• Sprint 完成率維持 91%，超越業界平均</li>
                <li>• 需求評估流程優化，平均時間縮短 15%</li>
                <li>• 子公司 A、C 資源使用效率提升顯著</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">改善重點</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• 加速驗收流程，目標縮短至 3 天內</li>
                <li>• 強化高風險需求的前期技術評估</li>
                <li>• 持續優化 SP 配額分配機制</li>
                <li>• 加強跨子公司協調與資源共享</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===== Tab: 指標分析 =====
function MetricsTab() {
  return (
    <div className="space-y-6">
      {/* Health Score */}
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
              { metric: "準時驗收率", value: 88, target: 90, unit: "%", trend: "up", status: "warning", description: "需求在預期時間內完成驗收的比例" },
              { metric: "Sprint 完成率", value: 91, target: 85, unit: "%", trend: "up", status: "good", description: "Sprint 承諾的 SP 實際完成比例" },
              { metric: "首次驗收通過率", value: 92, target: 85, unit: "%", trend: "up", status: "good", description: "需求首次提交驗收即通過的比例" },
              { metric: "需求變更率", value: 12, target: 15, unit: "%", trend: "down", status: "good", description: "需求在開發過程中發生變更的比例" },
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
                      <span className="text-2xl font-bold text-foreground">{item.value}{item.unit}</span>
                      <TrendingUp className={`h-4 w-4 ${item.trend === "down" ? "rotate-180 text-chart-3" : "text-chart-3"}`} />
                    </div>
                    <p className="text-xs text-muted-foreground">目標: {item.target}{item.unit}</p>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div className={`h-full ${item.status === "good" ? "bg-chart-3" : "bg-chart-4"}`} style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Delivery Metrics Trend Chart */}
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
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Line type="monotone" dataKey="Q1" name="Q1" stroke="hsl(var(--chart-1))" strokeWidth={2} />
              <Line type="monotone" dataKey="Q2" name="Q2" stroke="hsl(var(--chart-3))" strokeWidth={2} />
              <Line type="monotone" dataKey="Q3" name="Q3" stroke="hsl(var(--chart-4))" strokeWidth={2} />
              <Line type="monotone" dataKey="Q4" name="Q4" stroke="hsl(var(--primary))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Sprint Stability + Over-commitment */}
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
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="score" name="穩定度分數" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>超量承諾頻率</CardTitle>
            <CardDescription>Sprint 容量規劃與實際的差異</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 text-center">
              <div className="text-4xl font-bold text-foreground">15%</div>
              <p className="text-sm text-muted-foreground">超量承諾比例</p>
              <Badge variant="outline" className="mt-2 border-chart-3 text-chart-3">在可接受範圍內</Badge>
            </div>
            <div className="space-y-2">
              {[
                { sprint: "Sprint 24-01", capacity: 100, committed: 112, reason: "緊急需求插入" },
                { sprint: "Sprint 23-11", capacity: 100, committed: 108, reason: "評估偏樂觀" },
              ].map((item, i) => (
                <div key={i} className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium text-foreground">{item.sprint}</span>
                    <Badge variant="outline" className="text-xs">{item.committed}/{item.capacity} SP</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">原因: {item.reason}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>治理流程效能熱力圖</CardTitle>
          <CardDescription>週度流程表現指標</CardDescription>
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
        </CardContent>
      </Card>
    </div>
  )
}

// ===== Tab: 趨勢分析 =====
function TrendsTab() {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">需求成長率</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">+15%</div>
            <p className="text-xs text-chart-3"><TrendingUp className="mr-1 inline h-3 w-3" />較去年同期</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">平均 SP</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">18.5</div>
            <p className="text-xs text-chart-4"><TrendingUp className="mr-1 inline h-3 w-3" />複雜度上升</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">重複需求率</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">12%</div>
            <p className="text-xs text-chart-3"><TrendingDown className="mr-1 inline h-3 w-3" />較上季改善</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend Chart */}
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
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Area type="monotone" dataKey="submitted" name="提交" stroke={CHART_COLORS.primary} strokeWidth={2} fillOpacity={1} fill="url(#colorSubmitted)" />
              <Area type="monotone" dataKey="completed" name="完成" stroke={CHART_COLORS.success} strokeWidth={2} fillOpacity={1} fill="url(#colorCompleted)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Complexity + High SP */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>需求複雜度分布</CardTitle>
            <CardDescription>依 Story Points 範圍劃分</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={complexityData} cx="50%" cy="50%" labelLine={false} label={({ percentage }) => `${percentage}%`} outerRadius={100} dataKey="value">
                  {complexityData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>高 SP 需求分析</CardTitle>
            <CardDescription>超過 34 Story Points 的需求</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                  <Badge variant="outline" className="border-primary text-primary">平均 55 SP</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>系統整合</span>
                  <Badge variant="outline" className="border-primary text-primary">平均 42 SP</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>多語系實作</span>
                  <Badge variant="outline" className="border-primary text-primary">平均 38 SP</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* High SP Table */}
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
                {highSPDemands.map((demand) => (
                  <tr key={demand.id} className="border-b border-border last:border-0">
                    <td className="py-3 font-mono text-xs text-muted-foreground">{demand.id}</td>
                    <td className="py-3 font-medium text-foreground">{demand.title}</td>
                    <td className="py-3 text-muted-foreground">{demand.subsidiary}</td>
                    <td className="py-3 text-center"><Badge variant="outline" className="border-primary text-primary">{demand.sp} SP</Badge></td>
                    <td className="py-3 text-center">
                      <Badge variant={demand.status === "已完成" ? "default" : "secondary"} className={demand.status === "已完成" ? "bg-chart-3 hover:bg-chart-3" : demand.status === "進行中" ? "bg-chart-1 hover:bg-chart-1" : ""}>
                        {demand.status}
                      </Badge>
                    </td>
                    <td className="py-3 text-center">
                      <Badge variant={demand.risk === "高" ? "destructive" : demand.risk === "中" ? "secondary" : "outline"}>{demand.risk}</Badge>
                    </td>
                    <td className="py-3 text-center">
                      <span className={demand.spChange.includes("+") ? "text-destructive" : demand.spChange.includes("-") ? "text-chart-3" : "text-muted-foreground"}>{demand.spChange}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
        </CardContent>
      </Card>
    </div>
  )
}

// ===== Tab: 風險管理 =====
function RisksTab() {
  return (
    <div className="space-y-6">
      {/* Risk KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-destructive/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">高風險項目</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">3</div>
            <p className="text-xs text-muted-foreground">需立即處理</p>
          </CardContent>
        </Card>
        <Card className="border-chart-4/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">中風險項目</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-4">7</div>
            <p className="text-xs text-muted-foreground">需持續關注</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">超支風險</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">1</div>
            <p className="text-xs text-muted-foreground">子公司</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">技術債累積</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">42 SP</div>
            <p className="text-xs text-muted-foreground">待償還</p>
          </CardContent>
        </Card>
      </div>

      {/* High Risk Demands */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            高風險需求
          </CardTitle>
          <CardDescription>需要立即關注的需求</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { id: "REQ-2024-007", title: "多語系支援", subsidiary: "子公司 A", sp: 55, risk: "技術複雜度高，跨團隊協調困難", impact: "可能延誤 2-3 個 Sprint", action: "建議技術委員會介入評估" },
              { id: "REQ-2024-006", title: "行動端 APP 開發", subsidiary: "子公司 C", sp: 89, risk: "SP 預估可能不足，缺乏跨平台經驗", impact: "可能需追加 30-40 SP", action: "建議引入外部技術顧問" },
              { id: "REQ-2023-042", title: "ERP 系統整合", subsidiary: "子公司 B", sp: 55, risk: "進行中 78 天未結案，阻塞其他需求", impact: "影響 Q1 交付目標", action: "建議進行專案健檢與資源調整" },
            ].map((item) => (
              <div key={item.id} className="rounded-lg border-2 border-destructive/50 bg-destructive/5 p-4">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-mono text-sm text-muted-foreground">{item.id}</span>
                      <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.subsidiary} • {item.sp} Story Points</p>
                  </div>
                  <Badge variant="destructive">高風險</Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium text-foreground">風險描述: </span><span className="text-muted-foreground">{item.risk}</span></div>
                  <div><span className="font-medium text-foreground">潛在影響: </span><span className="text-muted-foreground">{item.impact}</span></div>
                  <div className="rounded-lg border border-destructive/30 bg-background p-2">
                    <span className="font-medium text-destructive">建議行動: </span>
                    <span className="text-foreground">{item.action}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Overspending + Tech Debt */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-chart-4" />
              超支風險子公司
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-chart-4/50 bg-chart-4/10 p-4">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">子公司 B</h3>
                  <p className="text-sm text-muted-foreground">年度配額: 350 SP</p>
                </div>
                <Badge className="bg-chart-4 text-white">預警</Badge>
              </div>
              <div className="mb-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">已使用</span>
                  <span className="font-semibold text-foreground">180 SP (51.4%)</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-chart-1" style={{ width: "51.4%" }} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">已承諾</span>
                  <span className="font-semibold text-foreground">85 SP (24.3%)</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-chart-4" style={{ width: "24.3%" }} />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                預計 Q3 中旬將耗盡配額，建議檢討需求優先度
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              技術債累積
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">技術債總量</span>
                <span className="text-2xl font-bold text-destructive">42 SP</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-destructive" style={{ width: "35%" }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">建議每季償還 10-15 SP</p>
            </div>
            <div className="space-y-2">
              {[
                { title: "重構使用者認證模組", sp: 21, impact: "high" },
                { title: "資料庫索引優化", sp: 8, impact: "medium" },
                { title: "前端依賴套件更新", sp: 13, impact: "medium" },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">影響程度: {item.impact === "high" ? "高" : "中"}</p>
                  </div>
                  <Badge variant="outline">{item.sp} SP</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle>風險管理建議</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h4 className="text-sm font-semibold text-foreground">立即行動</h4>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• 3 個高風險需求需技術委員會審查</li>
                <li>• ERP 整合專案需進行健檢</li>
                <li>• 子公司 B 需檢討資源配置</li>
              </ul>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-chart-4" />
                <h4 className="text-sm font-semibold text-foreground">持續監控</h4>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• 7 個中風險需求的進度追蹤</li>
                <li>• 單點風險需求的緩解措施</li>
                <li>• 各子公司的 SP 消耗速度</li>
              </ul>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-semibold text-foreground">預防措施</h4>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• 建立技術債償還計畫</li>
                <li>• 強化需求前期評估機制</li>
                <li>• 定期風險檢討會議</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===== Tab: SP 使用分析 =====
function SPUsageTab() {
  return (
    <div className="space-y-6">
      {/* SP KPIs */}
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
            <p className="text-xs text-chart-3"><TrendingUp className="mr-1 inline h-3 w-3" />符合預期進度</p>
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
            <p className="text-xs text-chart-3"><TrendingUp className="mr-1 inline h-3 w-3" />ROI 指數</p>
          </CardContent>
        </Card>
      </div>

      {/* Burn Rate Chart */}
      <Card>
        <CardHeader>
          <CardTitle>SP 消耗趨勢</CardTitle>
          <CardDescription>月度 Story Points 使用與承諾情況</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={burnRateData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="burned" name="消耗 SP" fill={CHART_COLORS.primary} />
              <Bar dataKey="committed" name="已承諾 SP" fill={CHART_COLORS.success} />
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
              { name: "子公司 A", allocation: 500, used: 244, committed: 100, efficiency: 92, avgCycle: 28, onTime: 94 },
              { name: "子公司 B", allocation: 350, used: 180, committed: 85, efficiency: 88, avgCycle: 31, onTime: 89 },
              { name: "子公司 C", allocation: 250, used: 120, committed: 50, efficiency: 95, avgCycle: 26, onTime: 96 },
            ].map((sub) => (
              <div key={sub.name} className="rounded-lg border border-border p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">{sub.name}</h3>
                  <Badge variant="outline" className="border-primary text-primary">效率: {sub.efficiency}%</Badge>
                </div>
                <div className="mb-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">配額使用</span>
                    <span className="font-medium text-foreground">{sub.used} / {sub.allocation} SP ({Math.round((sub.used / sub.allocation) * 100)}%)</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-chart-1" style={{ width: `${(sub.used / sub.allocation) * 100}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">已承諾</p>
                    <p className="font-semibold text-foreground">{sub.committed} SP</p>
                  </div>
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

      {/* Radar Chart */}
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
              <Radar name="效率" dataKey="efficiency" stroke={CHART_COLORS.primary} fill={CHART_COLORS.primary} fillOpacity={0.6} />
              <Radar name="準時率" dataKey="onTime" stroke={CHART_COLORS.success} fill={CHART_COLORS.success} fillOpacity={0.6} />
              <Radar name="品質" dataKey="quality" stroke={CHART_COLORS.warning} fill={CHART_COLORS.warning} fillOpacity={0.6} />
              <Legend />
              <Tooltip contentStyle={tooltipStyle} />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Long Running + ROI */}
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
                    <p className="text-xs text-muted-foreground">{item.subsidiary} • {item.sp} SP • 已 {item.days} 天</p>
                  </div>
                  <Badge variant="destructive" className="text-xs">超時</Badge>
                </div>
              ))}
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                <p className="text-sm text-foreground"><span className="font-semibold">144 SP</span> 處於長期未結案狀態</p>
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
              <p className="text-xs text-muted-foreground">ROI 指數超過業界平均 1.5</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ===== Tab: 需求流動 (原 governance analytics 內容) =====
function FlowTab() {
  return (
    <div className="space-y-6">
      {/* Original Analytics KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">本月新增需求</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">18</div>
            <p className="text-xs text-chart-3"><TrendingUp className="mr-1 inline h-3 w-3" />較上月 +15%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">平均評估時間</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">3.8 天</div>
            <p className="text-xs text-muted-foreground">目標: 3 天內</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">SP 效率</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">91%</div>
            <p className="text-xs text-chart-3">完成率良好</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">驗收拒絕率</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">8%</div>
            <p className="text-xs text-muted-foreground">業界標準: 10%</p>
          </CardContent>
        </Card>
      </div>

      {/* Demand Flow */}
      <Card>
        <CardHeader>
          <CardTitle>需求流動分析</CardTitle>
          <CardDescription>需求從提交到結案的平均時間</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {[
              { from: "提交", to: "評估", time: "1.2 天", status: "良好", statusClass: "border-chart-3 text-chart-3" },
              { from: "評估", to: "核准", time: "3.8 天", status: "一般", statusClass: "border-chart-4 text-chart-4" },
              { from: "核准", to: "Sprint", time: "6.5 天", status: "良好", statusClass: "border-chart-3 text-chart-3" },
              { from: "Sprint", to: "驗收", time: "14.2 天", status: "良好", statusClass: "border-chart-3 text-chart-3" },
              { from: "驗收", to: "結案", time: "5.8 天", status: "需改善", statusClass: "border-destructive text-destructive" },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{item.from} → {item.to}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-bold text-foreground">{item.time}</p>
                  <Badge variant="outline" className={item.statusClass}>{item.status}</Badge>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium text-foreground">平均總週期時間: 31.5 天</p>
            <p className="text-xs text-muted-foreground">從提交到結案的平均時間</p>
          </div>
        </CardContent>
      </Card>

      {/* High Risk + Monthly Performance */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>高風險需求清單</CardTitle>
            <CardDescription>需要特別關注的需求</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { id: "REQ-2024-007", title: "多語系支援", reason: "技術複雜度高，SP 估算可能不足", severity: "high" },
                { id: "REQ-2024-006", title: "行動端 APP 開發", reason: "跨平台開發，需額外資源協調", severity: "high" },
                { id: "REQ-2024-003", title: "行動版介面開發", reason: "Backlog 停留超過 30 天", severity: "medium" },
              ].map((item) => (
                <div key={item.id} className="flex items-start gap-3 rounded-lg border border-border p-4">
                  <AlertTriangle className={`mt-0.5 h-5 w-5 flex-shrink-0 ${item.severity === "high" ? "text-destructive" : "text-chart-4"}`} />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-muted-foreground">{item.id}</span>
                      <h4 className="font-medium text-foreground">{item.title}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.reason}</p>
                  </div>
                  <Badge variant={item.severity === "high" ? "destructive" : "outline"}>{item.severity === "high" ? "高風險" : "中風險"}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>本月治理成效</CardTitle>
            <CardDescription>關鍵指標達成情況</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { metric: "需求評估時效", target: "3 天", actual: "3.8 天", status: "warning" },
              { metric: "Sprint 完成率", target: "85%", actual: "91%", status: "success" },
              { metric: "驗收及時率", target: "90%", actual: "82%", status: "warning" },
              { metric: "SP 使用效率", target: "85%", actual: "91%", status: "success" },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {item.status === "success" ? (
                    <CheckCircle className="h-4 w-4 text-chart-3" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-chart-4" />
                  )}
                  <span className="text-sm text-foreground">{item.metric}</span>
                </div>
                <div className="text-right text-sm">
                  <span className="font-medium text-foreground">{item.actual}</span>
                  <span className="text-muted-foreground"> / {item.target}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ===== Main Page =====
export default function GovernanceAnalyticsPage() {
  return (
    <AppLayout userRole="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">分析報表</h1>
          <p className="text-muted-foreground">治理數據分析與決策支援報表，可供向需求者董事長彙報</p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">總覽</TabsTrigger>
            <TabsTrigger value="flow">需求流動</TabsTrigger>
            <TabsTrigger value="metrics">指標分析</TabsTrigger>
            <TabsTrigger value="trends">趨勢分析</TabsTrigger>
            <TabsTrigger value="risks">風險管理</TabsTrigger>
            <TabsTrigger value="sp-usage">SP 分析</TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><OverviewTab /></TabsContent>
          <TabsContent value="flow"><FlowTab /></TabsContent>
          <TabsContent value="metrics"><MetricsTab /></TabsContent>
          <TabsContent value="trends"><TrendsTab /></TabsContent>
          <TabsContent value="risks"><RisksTab /></TabsContent>
          <TabsContent value="sp-usage"><SPUsageTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}

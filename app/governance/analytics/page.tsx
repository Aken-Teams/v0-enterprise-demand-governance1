import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react"

export default function GovernanceAnalyticsPage() {
  return (
    <AppLayout userRole="governance">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">治理分析</h1>
          <p className="text-muted-foreground">需求流程與 Story Points 效率分析</p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">本月新增需求</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">18</div>
              <p className="text-xs text-chart-3">
                <TrendingUp className="mr-1 inline h-3 w-3" />
                較上月 +15%
              </p>
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
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">提交 → 評估</p>
                  <p className="text-xs text-muted-foreground">收件到開始評估</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">1.2 天</p>
                  <Badge variant="outline" className="border-chart-3 text-chart-3">
                    良好
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">評估 → 核准</p>
                  <p className="text-xs text-muted-foreground">評估到決策完成</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">3.8 天</p>
                  <Badge variant="outline" className="border-chart-4 text-chart-4">
                    一般
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">核准 → Sprint</p>
                  <p className="text-xs text-muted-foreground">等待進入 Sprint</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">6.5 天</p>
                  <Badge variant="outline" className="border-chart-3 text-chart-3">
                    良好
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Sprint → 驗收</p>
                  <p className="text-xs text-muted-foreground">開發到完成</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">14.2 天</p>
                  <Badge variant="outline" className="border-chart-3 text-chart-3">
                    良好
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">驗收 → 結案</p>
                  <p className="text-xs text-muted-foreground">等待驗收</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">5.8 天</p>
                  <Badge variant="outline" className="border-destructive text-destructive">
                    需改善
                  </Badge>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">平均總週期時間: 31.5 天</p>
              <p className="text-xs text-muted-foreground">從提交到結案的平均時間</p>
            </div>
          </CardContent>
        </Card>

        {/* High Risk Demands */}
        <Card>
          <CardHeader>
            <CardTitle>高風險需求清單</CardTitle>
            <CardDescription>需要特別關注的需求</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { id: "REQ-2024-007", title: "多語系支援", reason: "技術複雜度高，SP 估算可能不足", severity: "high" },
                {
                  id: "REQ-2024-006",
                  title: "行動端 APP 開發",
                  reason: "跨平台開發，需額外資源協調",
                  severity: "high",
                },
                {
                  id: "REQ-2024-003",
                  title: "行動版介面開發",
                  reason: "Backlog 停留超過 30 天",
                  severity: "medium",
                },
              ].map((item) => (
                <div key={item.id} className="flex items-start gap-3 rounded-lg border border-border p-4">
                  <AlertTriangle
                    className={`mt-0.5 h-5 w-5 flex-shrink-0 ${item.severity === "high" ? "text-destructive" : "text-chart-4"}`}
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-muted-foreground">{item.id}</span>
                      <h4 className="font-medium text-foreground">{item.title}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.reason}</p>
                  </div>
                  <Badge variant={item.severity === "high" ? "destructive" : "outline"}>
                    {item.severity === "high" ? "高風險" : "中風險"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Success Metrics */}
        <div className="grid gap-4 lg:grid-cols-2">
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

          <Card>
            <CardHeader>
              <CardTitle>改善建議</CardTitle>
              <CardDescription>基於數據分析的行動建議</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="font-medium text-foreground">加速驗收流程</p>
                  <p className="text-muted-foreground">平均驗收時間 5.8 天偏長，建議與子公司協調縮短至 3 天內</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="font-medium text-foreground">優化評估流程</p>
                  <p className="text-muted-foreground">評估時間略超目標，考慮增加評估人力或簡化流程</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="font-medium text-foreground">關注高風險需求</p>
                  <p className="text-muted-foreground">2 個高風險需求需要技術委員會審查與資源協調</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}

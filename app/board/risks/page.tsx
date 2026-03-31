import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, TrendingUp, AlertCircle, XCircle } from "lucide-react"

export default function RisksPage() {
  return (
    <AppLayout userRole="board">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">風險雷達</h1>
          <p className="text-muted-foreground">識別並監控企業治理風險</p>
        </div>

        {/* Risk Overview */}
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
            <CardDescription>需要董事會層級關注的需求</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  id: "REQ-2024-007",
                  title: "多語系支援",
                  subsidiary: "子公司 A",
                  sp: 55,
                  risk: "技術複雜度高，跨團隊協調困難",
                  impact: "可能延誤 2-3 個 Sprint",
                  action: "建議技術委員會介入評估",
                },
                {
                  id: "REQ-2024-006",
                  title: "行動端 APP 開發",
                  subsidiary: "子公司 C",
                  sp: 89,
                  risk: "SP 預估可能不足，缺乏跨平台經驗",
                  impact: "可能需追加 30-40 SP",
                  action: "建議引入外部技術顧問",
                },
                {
                  id: "REQ-2023-042",
                  title: "ERP 系統整合",
                  subsidiary: "子公司 B",
                  sp: 55,
                  risk: "進行中 78 天未結案，阻塞其他需求",
                  impact: "影響 Q1 交付目標",
                  action: "建議進行專案健檢與資源調整",
                },
              ].map((item) => (
                <div key={item.id} className="rounded-lg border-2 border-destructive/50 bg-destructive/5 p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="font-mono text-sm text-muted-foreground">{item.id}</span>
                        <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {item.subsidiary} • {item.sp} Story Points
                      </p>
                    </div>
                    <Badge variant="destructive">高風險</Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-foreground">風險描述: </span>
                      <span className="text-muted-foreground">{item.risk}</span>
                    </div>
                    <div>
                      <span className="font-medium text-foreground">潛在影響: </span>
                      <span className="text-muted-foreground">{item.impact}</span>
                    </div>
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

        {/* Overspending Risk */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-chart-4" />
              超支風險子公司
            </CardTitle>
            <CardDescription>SP 使用率超過預警線的子公司</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
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
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-foreground">風險分析: </span>
                    <span className="text-muted-foreground">
                      目前漸進式使用率 51.4%。若維持目前消耗速度，預計 Q3 中旬將耗盡配額。
                    </span>
                  </div>
                  <div className="rounded-lg border border-chart-4/50 bg-background p-2">
                    <span className="font-medium text-chart-4">建議: </span>
                    <span className="text-foreground">
                      1) 檢討需求優先度 2) 考慮申請專案配額 3) 延後部分低優先度需求
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Single Point Risks */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-chart-4" />
                單點風險需求
              </CardTitle>
              <CardDescription>依賴特定人員或技術的需求</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  {
                    id: "REQ-2024-008",
                    title: "即時通訊整合",
                    dependency: "依賴外部廠商 API",
                    mitigation: "建立備援方案",
                  },
                  {
                    id: "REQ-2024-010",
                    title: "區塊鏈整合",
                    dependency: "僅 1 位工程師具備專業知識",
                    mitigation: "安排知識轉移訓練",
                  },
                  {
                    id: "REQ-2024-012",
                    title: "AI 推薦系統",
                    dependency: "依賴特定雲端服務",
                    mitigation: "評估替代方案",
                  },
                ].map((item) => (
                  <div key={item.id} className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{item.id}</span>
                        <h4 className="text-sm font-medium text-foreground">{item.title}</h4>
                      </div>
                      <AlertCircle className="h-4 w-4 text-chart-4" />
                    </div>
                    <p className="mb-1 text-xs text-muted-foreground">
                      <span className="font-medium">依賴: </span>
                      {item.dependency}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">緩解措施: </span>
                      {item.mitigation}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                技術債累積
              </CardTitle>
              <CardDescription>需要償還的技術債項目</CardDescription>
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
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">影響程度: {item.impact === "high" ? "高" : "中"}</p>
                    </div>
                    <Badge variant="outline">{item.sp} SP</Badge>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                <p className="text-sm text-foreground">技術債已達警戒線，建議下季度優先償還高影響項目</p>
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
    </AppLayout>
  )
}

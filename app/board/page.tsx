import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, AlertTriangle, CheckCircle, FileText, Coins } from "lucide-react"

export default function BoardDashboardPage() {
  return (
    <AppLayout userRole="board">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">董事會總覽</h1>
          <p className="text-muted-foreground">GOVORA 治理與資源投入概況</p>
        </div>

        {/* Executive Summary */}
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

        {/* Trend Overview */}
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
    </AppLayout>
  )
}

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, CheckCircle2, Clock, Package, TrendingUp, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function DeliveryDashboardPage() {
  return (
    <AppLayout userRole="delivery">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">交付總覽</h1>
          <p className="text-muted-foreground">當前 Sprint 執行狀態與交付進度</p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">本 Sprint 承諾 SP</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">42</div>
              <p className="text-xs text-muted-foreground">Sprint #12 (2024-01-15 - 2024-01-29)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">已完成 SP</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">28</div>
              <p className="text-xs text-green-600">▲ 完成率 67%</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">剩餘 SP</CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">14</div>
              <p className="text-xs text-muted-foreground">剩餘 5 天</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">待驗收項目</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">3</div>
              <p className="text-xs text-muted-foreground">需子公司驗收</p>
            </CardContent>
          </Card>
        </div>

        {/* Current Sprint Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>當前 Sprint - Sprint #12</CardTitle>
                <CardDescription>2024-01-15 至 2024-01-29 (剩餘 5 天)</CardDescription>
              </div>
              <Badge variant="default">進行中</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">Sprint 目標達成進度</span>
                <span className="text-muted-foreground">67% (28/42 SP)</span>
              </div>
              <Progress value={67} className="h-2" />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <div className="h-3 w-3 rounded-full bg-gray-400" />
                  待處理
                </div>
                <div className="mt-2 text-2xl font-bold">4</div>
                <p className="text-xs text-muted-foreground">14 SP</p>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
                  <div className="h-3 w-3 rounded-full bg-blue-600" />
                  進行中
                </div>
                <div className="mt-2 text-2xl font-bold">5</div>
                <p className="text-xs text-muted-foreground">17 SP</p>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                  <div className="h-3 w-3 rounded-full bg-green-600" />
                  已完成
                </div>
                <div className="mt-2 text-2xl font-bold">7</div>
                <p className="text-xs text-muted-foreground">28 SP</p>
              </div>
            </div>

            <div className="pt-4">
              <h4 className="mb-2 text-sm font-semibold">Sprint 目標</h4>
              <p className="text-sm text-muted-foreground">
                完成客戶管理系統優化、報表匯出功能、系統整合三項核心需求的開發與測試
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Risk and Blocker Indicators */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <CardTitle className="text-orange-900">風險提示</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg bg-white p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">Story #DEV-245 進度落後</p>
                    <p className="text-xs text-muted-foreground mt-1">系統整合 API 對接遇到技術困難</p>
                  </div>
                  <Badge variant="destructive" className="text-xs">
                    高風險
                  </Badge>
                </div>
              </div>

              <div className="rounded-lg bg-white p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">Story #DEV-238 等待資源</p>
                    <p className="text-xs text-muted-foreground mt-1">等待第三方服務帳號開通</p>
                  </div>
                  <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">
                    阻礙中
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>待驗收 Stories</CardTitle>
              <CardDescription>已完成開發，等待子公司驗收</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium text-sm">Story #DEV-232</p>
                  <p className="text-xs text-muted-foreground">客戶列表頁面優化</p>
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className="text-xs">
                    待驗收
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">8 SP</p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium text-sm">Story #DEV-235</p>
                  <p className="text-xs text-muted-foreground">報表匯出功能</p>
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className="text-xs">
                    待驗收
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">5 SP</p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium text-sm">Story #DEV-228</p>
                  <p className="text-xs text-muted-foreground">權限控制優化</p>
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className="text-xs">
                    待驗收
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">3 SP</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>快速操作</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link href="/delivery/stories">
              <Button className="gap-2">
                更新 Story 狀態
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/delivery/sprints">
              <Button variant="outline" className="gap-2 bg-transparent">
                查看 Sprint 詳情
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/delivery/history">
              <Button variant="outline" className="gap-2 bg-transparent">
                檢視交付歷史
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

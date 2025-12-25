import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Coins, TrendingUp, Building2, Plus } from "lucide-react"

const subsidiaries = [
  { name: "子公司 A", annual: 500, used: 244, committed: 100, remaining: 156, efficiency: 92 },
  { name: "子公司 B", annual: 350, used: 180, committed: 85, remaining: 85, efficiency: 88 },
  { name: "子公司 C", annual: 250, used: 120, committed: 50, remaining: 80, efficiency: 95 },
]

const allocations = [
  { date: "2024-01-15", subsidiary: "子公司 A", type: "專案配額", amount: 50, reason: "重大系統升級" },
  { date: "2024-01-10", subsidiary: "子公司 B", type: "特別核准", amount: 30, reason: "緊急需求支援" },
  { date: "2024-01-01", subsidiary: "全體", type: "年度配額", amount: 1100, reason: "2024 年度配額" },
]

export default function SPManagementPage() {
  return (
    <AppLayout userRole="governance">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">SP 資產管理</h1>
            <p className="text-muted-foreground">管理 Story Points 發放與分配</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            發放 SP
          </Button>
        </div>

        {/* Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">總配額</CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">1,100</div>
              <p className="text-xs text-muted-foreground">2024 年度</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">已使用</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">544</div>
              <p className="text-xs text-muted-foreground">49.5% 使用率</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">已承諾</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">235</div>
              <p className="text-xs text-muted-foreground">進行中</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">剩餘可用</CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">321</div>
              <p className="text-xs text-muted-foreground">29.2% 剩餘</p>
            </CardContent>
          </Card>
        </div>

        {/* Subsidiary Allocation */}
        <Card>
          <CardHeader>
            <CardTitle>子公司配額概況</CardTitle>
            <CardDescription>各子公司 Story Points 使用情況</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>子公司</TableHead>
                    <TableHead className="text-right">年度配額</TableHead>
                    <TableHead className="text-right">已使用</TableHead>
                    <TableHead className="text-right">已承諾</TableHead>
                    <TableHead className="text-right">剩餘</TableHead>
                    <TableHead className="text-right">效率</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subsidiaries.map((sub) => (
                    <TableRow key={sub.name}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {sub.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{sub.annual}</TableCell>
                      <TableCell className="text-right">{sub.used}</TableCell>
                      <TableCell className="text-right">{sub.committed}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">{sub.remaining}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="border-chart-3 text-chart-3">
                          {sub.efficiency}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          調整
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Usage Visualization */}
        <div className="grid gap-4 lg:grid-cols-3">
          {subsidiaries.map((sub) => (
            <Card key={sub.name}>
              <CardHeader>
                <CardTitle className="text-base">{sub.name}</CardTitle>
                <CardDescription>配額使用分布</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">已使用</span>
                    <span className="font-medium text-foreground">
                      {sub.used} SP ({Math.round((sub.used / sub.annual) * 100)}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-chart-1" style={{ width: `${(sub.used / sub.annual) * 100}%` }} />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">已承諾</span>
                    <span className="font-medium text-foreground">
                      {sub.committed} SP ({Math.round((sub.committed / sub.annual) * 100)}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-chart-4" style={{ width: `${(sub.committed / sub.annual) * 100}%` }} />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">剩餘可用</span>
                    <span className="font-medium text-primary">
                      {sub.remaining} SP ({Math.round((sub.remaining / sub.annual) * 100)}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary" style={{ width: `${(sub.remaining / sub.annual) * 100}%` }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Allocation History */}
        <Card>
          <CardHeader>
            <CardTitle>配額發放記錄</CardTitle>
            <CardDescription>最近的 Story Points 配額異動</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日期</TableHead>
                    <TableHead>子公司</TableHead>
                    <TableHead>類型</TableHead>
                    <TableHead>原因</TableHead>
                    <TableHead className="text-right">配額</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.map((allocation, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm text-muted-foreground">{allocation.date}</TableCell>
                      <TableCell className="font-medium">{allocation.subsidiary}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{allocation.type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{allocation.reason}</TableCell>
                      <TableCell className="text-right font-semibold text-chart-3">+{allocation.amount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Guidelines */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">SP 配額管理原則</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• 年度配額依各子公司規模與歷史需求量制定</p>
            <p>• 專案配額需經董事會核准，用於重大系統建置</p>
            <p>• 特別核准用於緊急需求，單次上限 50 SP</p>
            <p>• 季末進行 SP 效率檢討，調整下季配額</p>
            <p>• 鼓勵子公司間協調，避免資源閒置</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

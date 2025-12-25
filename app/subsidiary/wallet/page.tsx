import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Coins, TrendingUp, TrendingDown, Calendar } from "lucide-react"

const transactions = [
  { date: "2024-01-22", type: "使用", description: "REQ-2024-002 報表匯出功能驗收", amount: -13, balance: 156 },
  { date: "2024-01-20", type: "承諾", description: "REQ-2024-005 進入 Sprint 24-03", amount: -8, balance: 169 },
  { date: "2024-01-15", type: "使用", description: "REQ-2023-045 使用者權限細分驗收", amount: -8, balance: 177 },
  { date: "2024-01-10", type: "調整", description: "REQ-2024-003 SP 調整 (34→29)", amount: 5, balance: 185 },
  { date: "2024-01-01", type: "配額", description: "2024 Q1 配額發放", amount: 125, balance: 180 },
]

export default function WalletPage() {
  return (
    <AppLayout userRole="subsidiary">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">SP 錢包</h1>
          <p className="text-muted-foreground">管理您的 Story Points 配額與使用記錄</p>
        </div>

        {/* Balance Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">剩餘 SP</CardTitle>
              <Coins className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">156</div>
              <p className="text-xs text-muted-foreground">可立即使用</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">年度配額</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">500</div>
              <p className="text-xs text-muted-foreground">2024 年度總額</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">已使用</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">244</div>
              <p className="text-xs text-muted-foreground">48.8% 使用率</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">已承諾</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">100</div>
              <p className="text-xs text-muted-foreground">進行中的 Sprint</p>
            </CardContent>
          </Card>
        </div>

        {/* Usage Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>使用率分析</CardTitle>
            <CardDescription>Story Points 配額使用情況</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">已使用 (驗收完成)</span>
                <span className="text-sm font-semibold text-foreground">244 SP</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-chart-1" style={{ width: "48.8%" }} />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">已承諾 (Sprint 中)</span>
                <span className="text-sm font-semibold text-foreground">100 SP</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-chart-4" style={{ width: "20%" }} />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-primary">剩餘可用</span>
                <span className="text-sm font-semibold text-primary">156 SP</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-primary" style={{ width: "31.2%" }} />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">
                預估可提交 <span className="font-semibold text-foreground">6-8</span> 個中等規模需求 (每個約 20 SP)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle>使用記錄</CardTitle>
            <CardDescription>最近的 Story Points 異動</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日期</TableHead>
                    <TableHead>類型</TableHead>
                    <TableHead>說明</TableHead>
                    <TableHead className="text-right">變動</TableHead>
                    <TableHead className="text-right">餘額</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm text-muted-foreground">{tx.date}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            tx.type === "配額"
                              ? "border-chart-3 text-chart-3"
                              : tx.type === "使用"
                                ? "border-chart-1 text-chart-1"
                                : "border-muted-foreground text-muted-foreground"
                          }
                        >
                          {tx.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{tx.description}</TableCell>
                      <TableCell
                        className={`text-right font-semibold ${tx.amount > 0 ? "text-chart-3" : "text-foreground"}`}
                      >
                        {tx.amount > 0 ? "+" : ""}
                        {tx.amount}
                      </TableCell>
                      <TableCell className="text-right font-medium">{tx.balance}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Story Points 說明</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Story Points (SP) 是企業資源配額，代表可投入的開發容量</p>
            <p>• 每年初會根據子公司規模與業務需求分配年度配額</p>
            <p>• SP 會在需求進入 Sprint 時「承諾」，驗收完成後「使用」</p>
            <p>• 如需額外 SP 配額，請聯繫治理團隊申請專案配額</p>
            <p>• 未使用的 SP 可保留至次季，但不可跨年度使用</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

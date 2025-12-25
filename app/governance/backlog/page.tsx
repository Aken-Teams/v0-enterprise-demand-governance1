"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Plus, GitMerge } from "lucide-react"

const backlogItems = [
  {
    id: "REQ-2024-005",
    title: "資料備份自動化",
    subsidiary: "子公司 A",
    businessValue: 8,
    complexity: 5,
    sp: 8,
    priority: "high",
  },
  {
    id: "REQ-2024-003",
    title: "行動版介面開發",
    subsidiary: "子公司 A",
    businessValue: 9,
    complexity: 9,
    sp: 34,
    priority: "high",
  },
  {
    id: "REQ-2024-010",
    title: "批次匯入功能",
    subsidiary: "子公司 B",
    businessValue: 6,
    complexity: 4,
    sp: 13,
    priority: "medium",
  },
  {
    id: "REQ-2024-011",
    title: "報表篩選優化",
    subsidiary: "子公司 C",
    businessValue: 5,
    complexity: 3,
    sp: 5,
    priority: "low",
  },
]

const technicalDebt = [
  { id: "DEBT-001", title: "重構使用者認證模組", estimatedSP: 21, impact: "high" },
  { id: "DEBT-002", title: "資料庫索引優化", estimatedSP: 8, impact: "medium" },
  { id: "DEBT-003", title: "前端依賴套件更新", estimatedSP: 13, impact: "medium" },
]

const priorityColors = {
  high: "bg-destructive text-destructive-foreground",
  medium: "bg-chart-4 text-white",
  low: "bg-chart-2 text-white",
}

const priorityLabels = {
  high: "高優先",
  medium: "中優先",
  low: "低優先",
}

export default function BacklogPage() {
  return (
    <AppLayout userRole="governance">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Backlog 與 Story 管理</h1>
            <p className="text-muted-foreground">管理已核准的需求與技術債</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            新增 Story
          </Button>
        </div>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Backlog 總數</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{backlogItems.length}</div>
              <p className="text-xs text-muted-foreground">待規劃進 Sprint</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">總 Story Points</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {backlogItems.reduce((sum, item) => sum + item.sp, 0)}
              </div>
              <p className="text-xs text-muted-foreground">預估工作量</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">高優先需求</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {backlogItems.filter((item) => item.priority === "high").length}
              </div>
              <p className="text-xs text-muted-foreground">需優先處理</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">技術債</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{technicalDebt.length}</div>
              <p className="text-xs text-muted-foreground">需規劃償還</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="搜尋需求..." className="pl-9" />
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部優先度</SelectItem>
                <SelectItem value="high">高優先</SelectItem>
                <SelectItem value="medium">中優先</SelectItem>
                <SelectItem value="low">低優先</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <GitMerge className="mr-2 h-4 w-4" />
              合併需求
            </Button>
          </CardContent>
        </Card>

        {/* Backlog Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Backlog 列表</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>需求編號</TableHead>
                    <TableHead>標題</TableHead>
                    <TableHead>子公司</TableHead>
                    <TableHead className="text-center">商業價值</TableHead>
                    <TableHead className="text-center">複雜度</TableHead>
                    <TableHead className="text-right">SP</TableHead>
                    <TableHead>優先度</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backlogItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">{item.id}</TableCell>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.subsidiary}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{item.businessValue}/10</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{item.complexity}/10</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{item.sp}</TableCell>
                      <TableCell>
                        <Badge className={priorityColors[item.priority as keyof typeof priorityColors]}>
                          {priorityLabels[item.priority as keyof typeof priorityLabels]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          編輯
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Technical Debt */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">技術債清單</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {technicalDebt.map((debt) => (
                <div
                  key={debt.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-muted-foreground">{debt.id}</span>
                      <h4 className="font-medium text-foreground">{debt.title}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      預估: {debt.estimatedSP} SP • 影響程度: {debt.impact === "high" ? "高" : "中"}
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    加入 Sprint
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

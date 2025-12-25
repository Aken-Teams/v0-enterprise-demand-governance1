"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { AlertCircle, Clock, FileText, Search } from "lucide-react"
import Link from "next/link"

const demands = {
  new: [
    {
      id: "REQ-2024-008",
      title: "即時通訊功能整合",
      subsidiary: "子公司 A",
      sp: 34,
      submittedDate: "2024-01-25",
      risk: "medium",
    },
    {
      id: "REQ-2024-009",
      title: "帳務自動對帳系統",
      subsidiary: "子公司 B",
      sp: 21,
      submittedDate: "2024-01-24",
      risk: "low",
    },
  ],
  evaluating: [
    {
      id: "REQ-2024-007",
      title: "多語系支援",
      subsidiary: "子公司 A",
      sp: 55,
      submittedDate: "2024-01-22",
      risk: "high",
    },
    {
      id: "REQ-2024-006",
      title: "行動端 APP 開發",
      subsidiary: "子公司 C",
      sp: 89,
      submittedDate: "2024-01-20",
      risk: "high",
    },
  ],
  pending: [
    {
      id: "REQ-2024-005",
      title: "資料備份自動化",
      subsidiary: "子公司 A",
      sp: 8,
      submittedDate: "2024-01-18",
      risk: "low",
    },
  ],
  rejected: [
    {
      id: "REQ-2024-004",
      title: "自訂主題顏色",
      subsidiary: "子公司 B",
      sp: 13,
      submittedDate: "2024-01-15",
      risk: "low",
    },
  ],
}

const riskColors = {
  high: "bg-destructive text-destructive-foreground",
  medium: "bg-chart-4 text-white",
  low: "bg-chart-3 text-white",
}

const riskLabels = {
  high: "高風險",
  medium: "中風險",
  low: "低風險",
}

export default function InboxPage() {
  return (
    <AppLayout userRole="governance">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">需求收件匣</h1>
          <p className="text-muted-foreground">管理並評估來自各子公司的需求</p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">新進需求</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{demands.new.length}</div>
              <p className="text-xs text-muted-foreground">等待初步審查</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">評估中</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{demands.evaluating.length}</div>
              <p className="text-xs text-muted-foreground">進行詳細評估</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">補件中</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{demands.pending.length}</div>
              <p className="text-xs text-muted-foreground">等待補充資訊</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">已退回</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{demands.rejected.length}</div>
              <p className="text-xs text-muted-foreground">本週退回</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="搜尋需求標題、編號或子公司..." className="pl-9" />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="new" className="space-y-4">
          <TabsList>
            <TabsTrigger value="new">新進需求 ({demands.new.length})</TabsTrigger>
            <TabsTrigger value="evaluating">評估中 ({demands.evaluating.length})</TabsTrigger>
            <TabsTrigger value="pending">補件中 ({demands.pending.length})</TabsTrigger>
            <TabsTrigger value="rejected">已退回 ({demands.rejected.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4">
            {demands.new.map((demand) => (
              <Card key={demand.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-foreground">{demand.title}</h3>
                        <Badge className={riskColors[demand.risk as keyof typeof riskColors]}>
                          {riskLabels[demand.risk as keyof typeof riskLabels]}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="font-mono">{demand.id}</span>
                        <span>來自: {demand.subsidiary}</span>
                        <span>預估: {demand.sp} SP</span>
                        <span>提交: {demand.submittedDate}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/governance/evaluation/${demand.id}`}>查看詳情</Link>
                      </Button>
                      <Button size="sm" asChild>
                        <Link href={`/governance/evaluation/${demand.id}`}>開始評估</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="evaluating" className="space-y-4">
            {demands.evaluating.map((demand) => (
              <Card key={demand.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-foreground">{demand.title}</h3>
                        <Badge className={riskColors[demand.risk as keyof typeof riskColors]}>
                          {riskLabels[demand.risk as keyof typeof riskLabels]}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="font-mono">{demand.id}</span>
                        <span>來自: {demand.subsidiary}</span>
                        <span>預估: {demand.sp} SP</span>
                        <span>提交: {demand.submittedDate}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" asChild>
                        <Link href={`/governance/evaluation/${demand.id}`}>繼續評估</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="pending" className="space-y-4">
            {demands.pending.map((demand) => (
              <Card key={demand.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-foreground">{demand.title}</h3>
                        <Badge variant="outline">等待回覆</Badge>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="font-mono">{demand.id}</span>
                        <span>來自: {demand.subsidiary}</span>
                        <span>預估: {demand.sp} SP</span>
                        <span>提交: {demand.submittedDate}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/governance/evaluation/${demand.id}`}>查看詳情</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-4">
            {demands.rejected.map((demand) => (
              <Card key={demand.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-foreground">{demand.title}</h3>
                        <Badge variant="destructive">已拒絕</Badge>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="font-mono">{demand.id}</span>
                        <span>來自: {demand.subsidiary}</span>
                        <span>預估: {demand.sp} SP</span>
                        <span>提交: {demand.submittedDate}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/governance/evaluation/${demand.id}`}>查看原因</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}

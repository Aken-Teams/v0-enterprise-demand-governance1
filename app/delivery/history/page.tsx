"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, XCircle, Calendar, TrendingUp, AlertTriangle, Search, FileText } from "lucide-react"

const deliveryHistory = [
  {
    sprint: "Sprint #11",
    period: "2024-01-01 - 2024-01-14",
    stories: [
      {
        id: "DEV-215",
        title: "使用者介面重構",
        sp: 13,
        acceptance: "passed",
        completedDate: "2024-01-12",
        acceptedDate: "2024-01-14",
        subsidiary: "子公司 A",
        rework: false,
      },
      {
        id: "DEV-218",
        title: "性能優化",
        sp: 8,
        acceptance: "passed",
        completedDate: "2024-01-10",
        acceptedDate: "2024-01-13",
        subsidiary: "子公司 B",
        rework: false,
      },
      {
        id: "DEV-222",
        title: "資料匯入功能",
        sp: 5,
        acceptance: "rejected",
        completedDate: "2024-01-11",
        rejectedDate: "2024-01-13",
        subsidiary: "子公司 A",
        rework: true,
        rejectionReason: "匯入格式驗證不完整，需補充錯誤提示",
      },
    ],
  },
  {
    sprint: "Sprint #10",
    period: "2023-12-18 - 2023-12-31",
    stories: [
      {
        id: "DEV-198",
        title: "系統安全性加強",
        sp: 13,
        acceptance: "passed",
        completedDate: "2023-12-28",
        acceptedDate: "2023-12-30",
        subsidiary: "子公司 C",
        rework: false,
      },
      {
        id: "DEV-202",
        title: "日誌系統優化",
        sp: 5,
        acceptance: "passed",
        completedDate: "2023-12-26",
        acceptedDate: "2023-12-29",
        subsidiary: "子公司 A",
        rework: false,
      },
      {
        id: "DEV-205",
        title: "備份機制改善",
        sp: 8,
        acceptance: "passed",
        completedDate: "2023-12-27",
        acceptedDate: "2023-12-30",
        subsidiary: "子公司 B",
        rework: false,
      },
    ],
  },
]

const stats = {
  totalDelivered: 52,
  totalSP: 252,
  passedRate: 92,
  reworkCount: 4,
}

export default function DeliveryHistoryPage() {
  return (
    <AppLayout userRole="delivery">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">交付歷史</h1>
          <p className="text-muted-foreground">查看已完成的 Sprint 與 Story 驗收記錄</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">總交付數量</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalDelivered}</div>
              <p className="text-xs text-muted-foreground">已完成 Stories</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">總交付 SP</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSP}</div>
              <p className="text-xs text-muted-foreground">Story Points</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">驗收通過率</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.passedRate}%</div>
              <p className="text-xs text-green-600">▲ 高品質交付</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">重工次數</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.reworkCount}</div>
              <p className="text-xs text-muted-foreground">需改進項目</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>篩選條件</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="搜尋 Story ID 或標題..." className="pl-9" />
                </div>
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="驗收狀態" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部狀態</SelectItem>
                  <SelectItem value="passed">已通過</SelectItem>
                  <SelectItem value="rejected">已退回</SelectItem>
                </SelectContent>
              </Select>
              <Select defaultValue="all">
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="子公司" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部子公司</SelectItem>
                  <SelectItem value="a">子公司 A</SelectItem>
                  <SelectItem value="b">子公司 B</SelectItem>
                  <SelectItem value="c">子公司 C</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* History by Sprint */}
        <div className="space-y-4">
          {deliveryHistory.map((sprint) => (
            <Card key={sprint.sprint}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      {sprint.sprint}
                    </CardTitle>
                    <CardDescription className="mt-1">{sprint.period}</CardDescription>
                  </div>
                  <Badge variant="outline">
                    {sprint.stories.length} Stories • {sprint.stories.reduce((sum, s) => sum + s.sp, 0)} SP
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sprint.stories.map((story) => (
                    <div
                      key={story.id}
                      className="flex items-center justify-between rounded-lg border border-border p-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{story.id}</p>
                          {story.acceptance === "passed" ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          {story.rework && (
                            <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">
                              重工
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{story.title}</p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span>需求方：{story.subsidiary}</span>
                          <span>完成：{story.completedDate}</span>
                          {story.acceptance === "passed" && <span>驗收：{story.acceptedDate}</span>}
                          {story.acceptance === "rejected" && (
                            <span className="text-red-600">退回：{story.rejectedDate}</span>
                          )}
                        </div>
                        {story.acceptance === "rejected" && story.rejectionReason && (
                          <div className="mt-2 rounded-lg bg-red-50 p-2">
                            <p className="text-xs text-red-900">
                              <span className="font-semibold">退回原因：</span>
                              {story.rejectionReason}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="ml-4 text-right">
                        <Badge
                          className={
                            story.acceptance === "passed" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          }
                        >
                          {story.acceptance === "passed" ? "驗收通過" : "已退回"}
                        </Badge>
                        <p className="mt-1 text-sm font-medium">{story.sp} SP</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}

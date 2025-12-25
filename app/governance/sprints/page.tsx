"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Calendar, Plus, AlertTriangle } from "lucide-react"

const sprints = [
  {
    id: "sprint-24-03",
    name: "Sprint 24-03",
    status: "active",
    startDate: "2024-01-22",
    endDate: "2024-02-04",
    capacity: 100,
    committed: 89,
    completed: 42,
    stories: 8,
    risks: 2,
  },
  {
    id: "sprint-24-02",
    name: "Sprint 24-02",
    status: "completed",
    startDate: "2024-01-08",
    endDate: "2024-01-21",
    capacity: 100,
    committed: 95,
    completed: 91,
    stories: 9,
    risks: 0,
  },
  {
    id: "sprint-24-04",
    name: "Sprint 24-04",
    status: "planned",
    startDate: "2024-02-05",
    endDate: "2024-02-18",
    capacity: 100,
    committed: 0,
    completed: 0,
    stories: 0,
    risks: 0,
  },
]

const statusColors = {
  active: "bg-chart-1 text-white",
  completed: "bg-chart-3 text-white",
  planned: "bg-muted text-muted-foreground",
}

const statusLabels = {
  active: "進行中",
  completed: "已完成",
  planned: "已規劃",
}

export default function SprintsPage() {
  return (
    <AppLayout userRole="governance">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Sprint 規劃</h1>
            <p className="text-muted-foreground">管理開發週期與 Story Points 配置</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            新增 Sprint
          </Button>
        </div>

        {/* Current Sprint Highlight */}
        {sprints
          .filter((s) => s.status === "active")
          .map((sprint) => (
            <Card key={sprint.id} className="border-primary/30 bg-primary/5">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xl">{sprint.name}</CardTitle>
                      <Badge className={statusColors[sprint.status as keyof typeof statusColors]}>
                        {statusLabels[sprint.status as keyof typeof statusLabels]}
                      </Badge>
                    </div>
                    <CardDescription>
                      {sprint.startDate} - {sprint.endDate}
                    </CardDescription>
                  </div>
                  <Button>查看詳情</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="mb-1 text-sm text-muted-foreground">容量</p>
                    <p className="text-2xl font-bold text-foreground">{sprint.capacity} SP</p>
                  </div>
                  <div>
                    <p className="mb-1 text-sm text-muted-foreground">已承諾</p>
                    <p className="text-2xl font-bold text-primary">{sprint.committed} SP</p>
                  </div>
                  <div>
                    <p className="mb-1 text-sm text-muted-foreground">已完成</p>
                    <p className="text-2xl font-bold text-chart-3">{sprint.completed} SP</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">進度</span>
                    <span className="font-medium text-foreground">
                      {Math.round((sprint.completed / sprint.committed) * 100)}%
                    </span>
                  </div>
                  <Progress value={(sprint.completed / sprint.committed) * 100} className="h-2" />
                </div>

                {sprint.risks > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="text-sm text-foreground">{sprint.risks} 項風險需要關注</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{sprint.stories} 個 Stories</span>
                  <span>使用率: {Math.round((sprint.committed / sprint.capacity) * 100)}%</span>
                </div>
              </CardContent>
            </Card>
          ))}

        {/* All Sprints */}
        <div className="grid gap-4 lg:grid-cols-2">
          {sprints
            .filter((s) => s.status !== "active")
            .map((sprint) => (
              <Card key={sprint.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{sprint.name}</CardTitle>
                        <Badge className={statusColors[sprint.status as keyof typeof statusColors]}>
                          {statusLabels[sprint.status as keyof typeof statusLabels]}
                        </Badge>
                      </div>
                      <CardDescription className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {sprint.startDate} - {sprint.endDate}
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm">
                      {sprint.status === "completed" ? "查看" : "規劃"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">容量</span>
                    <span className="font-medium text-foreground">{sprint.capacity} SP</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">已承諾</span>
                    <span className="font-medium text-foreground">{sprint.committed} SP</span>
                  </div>
                  {sprint.status === "completed" && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">已完成</span>
                        <span className="font-medium text-chart-3">{sprint.completed} SP</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">完成率</span>
                          <span className="font-medium text-foreground">
                            {Math.round((sprint.completed / sprint.committed) * 100)}%
                          </span>
                        </div>
                        <Progress value={(sprint.completed / sprint.committed) * 100} className="h-2" />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
        </div>

        {/* Planning Tips */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Sprint 規劃建議</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Sprint 容量應考慮團隊實際可用工時與歷史完成率</p>
            <p>• 建議保留 10-15% 緩衝空間處理突發狀況</p>
            <p>• 高風險需求應搭配較低風險需求平衡</p>
            <p>• 技術債償還建議佔每個 Sprint 的 15-20%</p>
            <p>• 追蹤連續多個 Sprint 未完成的需求，評估是否需拆分</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

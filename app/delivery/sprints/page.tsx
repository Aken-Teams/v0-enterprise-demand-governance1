import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Calendar, Clock, Package, ChevronRight, AlertCircle } from "lucide-react"
import Link from "next/link"

const sprints = [
  {
    id: "sprint-12",
    name: "Sprint #12",
    status: "active",
    startDate: "2024-01-15",
    endDate: "2024-01-29",
    goal: "完成客戶管理系統優化、報表匯出功能、系統整合三項核心需求的開發與測試",
    capacity: 42,
    committed: 42,
    completed: 28,
    stories: [
      { id: "DEV-232", title: "客戶列表頁面優化", status: "ready", sp: 8 },
      { id: "DEV-235", title: "報表匯出功能", status: "ready", sp: 5 },
      { id: "DEV-228", title: "權限控制優化", status: "ready", sp: 3 },
      { id: "DEV-241", title: "數據統計儀表板", status: "done", sp: 8 },
      { id: "DEV-238", title: "第三方服務整合", status: "blocked", sp: 5 },
      { id: "DEV-245", title: "API 對接開發", status: "in_progress", sp: 13 },
    ],
    daysLeft: 5,
  },
  {
    id: "sprint-11",
    name: "Sprint #11",
    status: "completed",
    startDate: "2024-01-01",
    endDate: "2024-01-14",
    goal: "使用者介面重構與性能優化",
    capacity: 38,
    committed: 38,
    completed: 35,
    stories: [],
    daysLeft: 0,
  },
  {
    id: "sprint-10",
    name: "Sprint #10",
    status: "completed",
    startDate: "2023-12-18",
    endDate: "2023-12-31",
    goal: "年末系統穩定性提升與安全性加強",
    capacity: 40,
    committed: 40,
    completed: 40,
    stories: [],
    daysLeft: 0,
  },
]

const getStatusColor = (status: string) => {
  switch (status) {
    case "todo":
      return "bg-gray-100 text-gray-700"
    case "in_progress":
      return "bg-blue-100 text-blue-700"
    case "done":
      return "bg-green-100 text-green-700"
    case "ready":
      return "bg-purple-100 text-purple-700"
    case "blocked":
      return "bg-red-100 text-red-700"
    default:
      return "bg-gray-100 text-gray-700"
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case "todo":
      return "待處理"
    case "in_progress":
      return "進行中"
    case "done":
      return "已完成"
    case "ready":
      return "待驗收"
    case "blocked":
      return "阻礙中"
    default:
      return status
  }
}

export default function DeliverySprintsPage() {
  const activeSprint = sprints.find((s) => s.status === "active")

  return (
    <AppLayout userRole="delivery">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">我的 Sprint</h1>
          <p className="text-muted-foreground">查看分配的 Sprint 與 Story 執行狀態</p>
        </div>

        {/* Active Sprint Detail */}
        {activeSprint && (
          <Card className="border-primary">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-2xl">{activeSprint.name}</CardTitle>
                    <Badge className="bg-green-600">進行中</Badge>
                  </div>
                  <CardDescription className="mt-2 flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {activeSprint.startDate} 至 {activeSprint.endDate}
                    </span>
                    <span className="flex items-center gap-1 text-orange-600">
                      <Clock className="h-4 w-4" />
                      剩餘 {activeSprint.daysLeft} 天
                    </span>
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{activeSprint.completed}</div>
                  <p className="text-sm text-muted-foreground">/ {activeSprint.committed} SP</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Progress */}
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">Sprint 進度</span>
                  <span className="text-muted-foreground">
                    {Math.round((activeSprint.completed / activeSprint.committed) * 100)}%
                  </span>
                </div>
                <Progress value={(activeSprint.completed / activeSprint.committed) * 100} className="h-2" />
              </div>

              {/* Sprint Goal */}
              <div className="rounded-lg bg-blue-50 p-4">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-900">
                  <Package className="h-4 w-4" />
                  Sprint 目標
                </h4>
                <p className="text-sm text-blue-800">{activeSprint.goal}</p>
              </div>

              {/* Story List */}
              <div>
                <h4 className="mb-3 text-sm font-semibold">分配的 Stories ({activeSprint.stories.length})</h4>
                <div className="space-y-2">
                  {activeSprint.stories.map((story) => (
                    <Link
                      key={story.id}
                      href={`/delivery/stories?id=${story.id}`}
                      className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent"
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium text-sm">{story.id}</p>
                          <p className="text-sm text-muted-foreground">{story.title}</p>
                        </div>
                        {story.status === "blocked" && <AlertCircle className="h-4 w-4 text-red-600" />}
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className={getStatusColor(story.status)}>
                          {getStatusLabel(story.status)}
                        </Badge>
                        <span className="text-sm font-medium text-muted-foreground">{story.sp} SP</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sprint History */}
        <Card>
          <CardHeader>
            <CardTitle>Sprint 歷史記錄</CardTitle>
            <CardDescription>過去參與的 Sprint 列表</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sprints
                .filter((s) => s.status === "completed")
                .map((sprint) => (
                  <div
                    key={sprint.id}
                    className="flex items-center justify-between rounded-lg border border-border p-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{sprint.name}</p>
                        <Badge variant="outline" className="text-xs">
                          已完成
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {sprint.startDate} 至 {sprint.endDate}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">{sprint.goal}</p>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="text-lg font-bold text-green-600">{sprint.completed} SP</p>
                      <p className="text-xs text-muted-foreground">
                        完成率 {Math.round((sprint.completed / sprint.committed) * 100)}%
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

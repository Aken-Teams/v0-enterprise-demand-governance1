"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bell, CheckCircle, AlertTriangle, FileText, Check } from "lucide-react"

const notifications = {
  unread: [
    {
      id: "1",
      type: "approval",
      title: "需求已核准",
      message: "您的需求 REQ-2024-005「資料備份自動化」已通過評估並核准",
      time: "2 小時前",
      icon: CheckCircle,
      color: "text-chart-3",
    },
    {
      id: "2",
      type: "warning",
      title: "驗收即將逾期",
      message: "REQ-2023-045 已等待驗收 9 天，請盡快完成驗收流程",
      time: "5 小時前",
      icon: AlertTriangle,
      color: "text-chart-4",
    },
    {
      id: "3",
      type: "info",
      title: "新需求提醒",
      message: "子公司 B 提交了新需求「帳務自動對帳系統」",
      time: "1 天前",
      icon: FileText,
      color: "text-chart-1",
    },
  ],
  read: [
    {
      id: "4",
      type: "info",
      title: "Sprint 24-03 已開始",
      message: "新的 Sprint 已啟動，包含 8 個需求，總計 89 Story Points",
      time: "3 天前",
      icon: Bell,
      color: "text-muted-foreground",
    },
    {
      id: "5",
      type: "approval",
      title: "需求已驗收",
      message: "REQ-2024-001「客戶管理系統優化」驗收完成",
      time: "5 天前",
      icon: CheckCircle,
      color: "text-muted-foreground",
    },
  ],
  system: [
    {
      id: "6",
      type: "system",
      title: "系統維護通知",
      message: "系統將於 2024-02-01 凌晨 2:00-4:00 進行例行維護",
      time: "1 週前",
      icon: AlertTriangle,
      color: "text-chart-4",
    },
  ],
}

export default function NotificationsPage() {
  return (
    <AppLayout userRole="subsidiary">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">通知中心</h1>
            <p className="text-muted-foreground">查看所有系統通知與提醒</p>
          </div>
          <Button variant="outline">
            <Check className="mr-2 h-4 w-4" />
            全部標為已讀
          </Button>
        </div>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">未讀通知</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{notifications.unread.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">今日通知</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">5</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">本週通知</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">18</div>
            </CardContent>
          </Card>
        </div>

        {/* Notifications */}
        <Tabs defaultValue="unread" className="space-y-4">
          <TabsList>
            <TabsTrigger value="unread">未讀 ({notifications.unread.length})</TabsTrigger>
            <TabsTrigger value="read">已讀 ({notifications.read.length})</TabsTrigger>
            <TabsTrigger value="system">系統通知 ({notifications.system.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="unread" className="space-y-3">
            {notifications.unread.map((notification) => {
              const Icon = notification.icon
              return (
                <Card key={notification.id} className="border-l-4 border-l-primary">
                  <CardContent className="flex items-start gap-4 pt-6">
                    <div className={`rounded-full bg-muted p-2 ${notification.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-start justify-between">
                        <h3 className="font-semibold text-foreground">{notification.title}</h3>
                        <span className="text-xs text-muted-foreground">{notification.time}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{notification.message}</p>
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="outline">
                          標為已讀
                        </Button>
                        <Button size="sm">查看詳情</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>

          <TabsContent value="read" className="space-y-3">
            {notifications.read.map((notification) => {
              const Icon = notification.icon
              return (
                <Card key={notification.id}>
                  <CardContent className="flex items-start gap-4 pt-6">
                    <div className="rounded-full bg-muted p-2 text-muted-foreground">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-start justify-between">
                        <h3 className="font-medium text-muted-foreground">{notification.title}</h3>
                        <span className="text-xs text-muted-foreground">{notification.time}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{notification.message}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>

          <TabsContent value="system" className="space-y-3">
            {notifications.system.map((notification) => {
              const Icon = notification.icon
              return (
                <Card key={notification.id}>
                  <CardContent className="flex items-start gap-4 pt-6">
                    <div className={`rounded-full bg-muted p-2 ${notification.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-start justify-between">
                        <h3 className="font-semibold text-foreground">{notification.title}</h3>
                        <span className="text-xs text-muted-foreground">{notification.time}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{notification.message}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}

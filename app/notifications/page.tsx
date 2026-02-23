"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  FileText,
  Check,
  Paperclip,
  MessageCircle,
  UserPlus,
  BarChart3,
  Loader2,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface Notification {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  linkUrl: string | null
  createdAt: string
}

const TYPE_ICON_MAP: Record<string, { icon: LucideIcon; color: string }> = {
  DEMAND_STATUS: { icon: FileText, color: "text-blue-500" },
  SIGNOFF: { icon: CheckCircle, color: "text-emerald-500" },
  ACCEPTANCE: { icon: CheckCircle, color: "text-purple-500" },
  SP_CHANGE: { icon: BarChart3, color: "text-orange-500" },
  DOCUMENT: { icon: Paperclip, color: "text-cyan-500" },
  COMMENT: { icon: MessageCircle, color: "text-indigo-500" },
  ASSIGNMENT: { icon: UserPlus, color: "text-violet-500" },
  SYSTEM: { icon: AlertTriangle, color: "text-amber-500" },
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const d = new Date(dateStr).getTime()
  const diff = now - d
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "剛剛"
  if (mins < 60) return `${mins} 分鐘前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小時前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`
  return new Date(dateStr).toLocaleDateString("zh-TW")
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [total, setTotal] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("unread")
  const [page, setPage] = useState(1)
  const limit = 20

  const fetchNotifications = useCallback(
    async (filter: string, p: number) => {
      const token = localStorage.getItem("auth_token")
      if (!token) return
      setLoading(true)
      try {
        const filterParam = filter === "all" ? "" : `&filter=${filter}`
        const res = await fetch(`/api/notifications?page=${p}&limit=${limit}${filterParam}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (data.notifications) {
          setNotifications(data.notifications)
          setTotal(data.total)
        }
        if (typeof data.unreadCount === "number") setUnreadCount(data.unreadCount)
      } catch { /* ignore */ }
      finally { setLoading(false) }
    },
    []
  )

  useEffect(() => {
    fetchNotifications(tab === "all" ? "all" : tab, page)
  }, [tab, page, fetchNotifications])

  const markAsRead = async (ids: string[]) => {
    const token = localStorage.getItem("auth_token")
    if (!token) return
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
    fetchNotifications(tab, page)
  }

  const markAllRead = async () => {
    const token = localStorage.getItem("auth_token")
    if (!token) return
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    })
    fetchNotifications(tab, page)
  }

  const deleteNotifications = async (ids: string[]) => {
    const token = localStorage.getItem("auth_token")
    if (!token) return
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
    fetchNotifications(tab, page)
  }

  const totalPages = Math.ceil(total / limit)

  const renderNotification = (n: Notification, showActions: boolean) => {
    const typeInfo = TYPE_ICON_MAP[n.type] || TYPE_ICON_MAP.SYSTEM
    const Icon = typeInfo.icon
    return (
      <Card key={n.id} className={cn(!n.isRead && "border-l-4 border-l-primary")}>
        <CardContent className="flex items-start gap-4 pt-6">
          <div className={cn("rounded-full bg-muted p-2", typeInfo.color)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className={cn("text-sm", !n.isRead ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}>
                {n.title}
              </h3>
              <span className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(n.createdAt)}</span>
            </div>
            <p className="text-sm text-muted-foreground">{n.message}</p>
            {showActions && (
              <div className="flex gap-2 pt-2">
                {!n.isRead && (
                  <Button size="sm" variant="outline" onClick={() => markAsRead([n.id])}>
                    標為已讀
                  </Button>
                )}
                {n.linkUrl && (
                  <Button size="sm" onClick={() => router.push(n.linkUrl!)}>
                    查看詳情
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteNotifications([n.id])}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">通知中心</h1>
            <p className="text-muted-foreground">查看所有系統通知與提醒</p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAllRead}>
              <Check className="mr-2 h-4 w-4" />
              全部標為已讀
            </Button>
          )}
        </div>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">未讀通知</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{unreadCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">本頁顯示</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{notifications.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">通知總數</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{total}</div>
            </CardContent>
          </Card>
        </div>

        {/* Notifications */}
        <Tabs value={tab} onValueChange={(v) => { setTab(v); setPage(1) }} className="space-y-4">
          <TabsList>
            <TabsTrigger value="unread">
              <Bell className="h-3.5 w-3.5 mr-1.5" />
              未讀{unreadCount > 0 ? ` (${unreadCount})` : ""}
            </TabsTrigger>
            <TabsTrigger value="read">已讀</TabsTrigger>
            <TabsTrigger value="all">全部</TabsTrigger>
          </TabsList>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <TabsContent value="unread" className="space-y-3">
                {notifications.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">沒有未讀通知</p>
                ) : (
                  notifications.map((n) => renderNotification(n, true))
                )}
              </TabsContent>

              <TabsContent value="read" className="space-y-3">
                {notifications.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">沒有已讀通知</p>
                ) : (
                  notifications.map((n) => renderNotification(n, false))
                )}
              </TabsContent>

              <TabsContent value="all" className="space-y-3">
                {notifications.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">沒有通知</p>
                ) : (
                  notifications.map((n) => renderNotification(n, true))
                )}
              </TabsContent>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    上一頁
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    第 {page} / {totalPages} 頁
                  </span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                    下一頁
                  </Button>
                </div>
              )}
            </>
          )}
        </Tabs>
      </div>
    </AppLayout>
  )
}

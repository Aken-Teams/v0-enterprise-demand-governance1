"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  CheckCircle, AlertTriangle, FileText, Check,
  Paperclip, MessageCircle, UserPlus, BarChart3,
  Loader2, Trash2,
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

const TYPE_ICON_MAP: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  DEMAND_STATUS: { icon: FileText, color: "text-blue-500", bg: "bg-blue-50" },
  SIGNOFF: { icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-50" },
  ACCEPTANCE: { icon: CheckCircle, color: "text-purple-500", bg: "bg-purple-50" },
  SP_CHANGE: { icon: BarChart3, color: "text-orange-500", bg: "bg-orange-50" },
  DOCUMENT: { icon: Paperclip, color: "text-cyan-500", bg: "bg-cyan-50" },
  COMMENT: { icon: MessageCircle, color: "text-indigo-500", bg: "bg-indigo-50" },
  ASSIGNMENT: { icon: UserPlus, color: "text-violet-500", bg: "bg-violet-50" },
  SYSTEM: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-50" },
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

interface NotificationCenterProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefresh?: () => void
}

export function NotificationCenter({ open, onOpenChange, onRefresh }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [total, setTotal] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"unread" | "all">("unread")
  const [page, setPage] = useState(1)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const limit = 15

  const fetchNotifications = useCallback(async (filter: string, p: number) => {
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
  }, [])

  // Reset & fetch when dialog opens
  useEffect(() => {
    if (open) {
      setTab("unread")
      setPage(1)
      fetchNotifications("unread", 1)
    }
  }, [open, fetchNotifications])

  // Fetch when tab/page changes
  useEffect(() => {
    if (open) fetchNotifications(tab, page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page])

  const markAsRead = async (ids: string[]) => {
    const token = localStorage.getItem("auth_token")
    if (!token) return
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
    fetchNotifications(tab, page)
    onRefresh?.()
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
    onRefresh?.()
  }

  const deleteNotification = async (id: string) => {
    const token = localStorage.getItem("auth_token")
    if (!token) return
    setConfirmDeleteId(null)
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    })
    fetchNotifications(tab, page)
    onRefresh?.()
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-lg max-h-[85vh] sm:max-h-[80vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-3 sm:px-5 pt-3 sm:pt-5 pb-2.5 sm:pb-3 border-b shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-sm sm:text-base">通知中心</DialogTitle>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-6 sm:h-7 text-[10px] sm:text-xs text-muted-foreground px-1.5 sm:px-2" onClick={markAllRead}>
                  <Check className="h-3 w-3 mr-1" />
                  全部已讀
                </Button>
              )}
            </div>
            <div className="flex gap-1 mt-1.5 sm:mt-2">
              <button
                className={cn(
                  "text-[10px] sm:text-xs px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full border transition-colors",
                  tab === "unread"
                    ? "bg-foreground text-background border-foreground"
                    : "text-muted-foreground border-border hover:border-foreground/30"
                )}
                onClick={() => { setTab("unread"); setPage(1) }}
              >
                未讀{unreadCount > 0 ? ` (${unreadCount})` : ""}
              </button>
              <button
                className={cn(
                  "text-[10px] sm:text-xs px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full border transition-colors",
                  tab === "all"
                    ? "bg-foreground text-background border-foreground"
                    : "text-muted-foreground border-border hover:border-foreground/30"
                )}
                onClick={() => { setTab("all"); setPage(1) }}
              >
                全部
              </button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-2 sm:px-3 py-1.5 sm:py-2 space-y-1 sm:space-y-1.5">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : notifications.length === 0 ? (
              <p className="py-12 text-center text-xs sm:text-sm text-muted-foreground">
                {tab === "unread" ? "沒有未讀通知" : "沒有通知"}
              </p>
            ) : (
              notifications.map((n) => {
                const typeInfo = TYPE_ICON_MAP[n.type] || TYPE_ICON_MAP.SYSTEM
                const Icon = typeInfo.icon
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "group flex items-center gap-2 sm:gap-3 rounded-lg border px-2 sm:px-3 py-2 sm:py-2.5 transition-colors",
                      !n.isRead ? "border-l-4 border-l-primary bg-primary/[0.02]" : "border-border/60",
                    )}
                  >
                    <div className={cn("rounded-full p-1 sm:p-1.5 shrink-0", typeInfo.bg)}>
                      <Icon className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", typeInfo.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5 sm:gap-2">
                        <span className={cn("text-xs sm:text-sm truncate", !n.isRead ? "font-semibold" : "text-muted-foreground")}>
                          {n.title}
                        </span>
                        <span className="text-[10px] sm:text-[11px] text-muted-foreground/60 shrink-0">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground/80 mt-0.5 line-clamp-2">{n.message}</p>
                    </div>
                    <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      {!n.isRead && (
                        <button
                          className="rounded p-0.5 sm:p-1 text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
                          title="標為已讀"
                          onClick={(e) => { e.stopPropagation(); markAsRead([n.id]) }}
                        >
                          <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        </button>
                      )}
                      <button
                        className="rounded p-0.5 sm:p-1 text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="刪除"
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(n.id) }}
                      >
                        <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-3 border-t shrink-0">
              <span className="text-[10px] sm:text-xs text-muted-foreground">
                共 {total} 筆，第 {page}/{totalPages} 頁
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-6 sm:h-7 text-[10px] sm:text-xs px-2" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  上一頁
                </Button>
                <Button variant="outline" size="sm" className="h-6 sm:h-7 text-[10px] sm:text-xs px-2" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  下一頁
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => { if (!o) setConfirmDeleteId(null) }}>
        <AlertDialogContent className="max-w-[calc(100%-1rem)] sm:max-w-lg p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">確認刪除通知</AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">確定要刪除這則通知嗎？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => confirmDeleteId && deleteNotification(confirmDeleteId)}
            >
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

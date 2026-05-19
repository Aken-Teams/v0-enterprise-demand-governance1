"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Building2,
  LayoutDashboard,
  Inbox,
  FolderKanban,
  BarChart3,
  FileLineChart,
  Bell,
  BookOpen,
  User,
  UserCog,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ScrollText,
  Mail,
  Network,
  ClipboardCheck,
  FileText,
  KeyRound,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAuth } from "@/hooks/use-auth"
import { NotificationCenter } from "@/components/notification-center"

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed"

type UserRole = "subsidiary" | "admin" | "delivery" | "viewer"

interface AppLayoutProps {
  children: React.ReactNode
  userRole?: UserRole
}

interface NavSection {
  title: string
  roles: UserRole[]
  items: NavItem[]
}

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
  roles: UserRole[]
}

const navSections: NavSection[] = [
  {
    title: "需求者",
    roles: ["subsidiary"],
    items: [
      { title: "需求總覽", href: "/subsidiary", icon: LayoutDashboard, roles: ["subsidiary"] },
      { title: "需求列表", href: "/subsidiary/demands", icon: FileLineChart, roles: ["subsidiary"] },
      { title: "SP 錢包", href: "/subsidiary/wallet", icon: BarChart3, roles: ["subsidiary"] },
    ],
  },
  {
    title: "需求管理",
    roles: ["admin"],
    items: [
      { title: "需求看板", href: "/governance/inbox", icon: Inbox, roles: ["admin"] },
      { title: "報表分析", href: "/governance/analytics", icon: BarChart3, roles: ["admin"] },
    ],
  },
  {
    title: "系統管理",
    roles: ["admin"],
    items: [
      { title: "帳號管理", href: "/admin/users", icon: UserCog, roles: ["admin"] },
      { title: "AD 組織架構", href: "/admin/ldap", icon: Network, roles: ["admin"] },
      { title: "SP 管理", href: "/admin/organizations", icon: Building2, roles: ["admin"] },
      { title: "郵件管理", href: "/admin/mail-logs", icon: Mail, roles: ["admin"] },
      { title: "API 金鑰", href: "/admin/api-keys", icon: KeyRound, roles: ["admin"] },
      { title: "操作紀錄", href: "/admin/audit-log", icon: ScrollText, roles: ["admin"] },
    ],
  },
  {
    title: "交付團隊",
    roles: ["delivery"],
    items: [
      { title: "我的專案", href: "/delivery", icon: FolderKanban, roles: ["delivery"] },
      { title: "需求列表", href: "/governance/inbox", icon: Inbox, roles: ["delivery"] },
    ],
  },
  {
    title: "董事會",
    roles: ["viewer"],
    items: [
      { title: "需求列表", href: "/governance/inbox", icon: Inbox, roles: ["viewer"] },
      { title: "開案審核", href: "/board/sp-review", icon: ClipboardCheck, roles: ["viewer"] },
      { title: "報表分析", href: "/governance/analytics", icon: BarChart3, roles: ["viewer"] },
    ],
  },
  {
    title: "共用",
    roles: ["subsidiary", "admin", "delivery", "viewer"],
    items: [
      { title: "使用指南", href: "/documents", icon: BookOpen, roles: ["subsidiary", "admin", "delivery", "viewer"] },
      { title: "文件範本", href: "/documents/templates", icon: FileText, roles: ["admin", "delivery"] },
    ],
  },
]

interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  linkUrl: string | null
  createdAt: string
}

export function AppLayout({ children, userRole = "subsidiary" }: AppLayoutProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = React.useState(0)
  const [showNotifCenter, setShowNotifCenter] = React.useState(false)

  const [pendingSignoffCount, setPendingSignoffCount] = React.useState(0)

  // Fetch notifications from API
  const fetchNotifications = React.useCallback(() => {
    const token = localStorage.getItem("auth_token")
    if (!token) return
    fetch("/api/notifications?filter=unread&limit=5", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.notifications) setNotifications(data.notifications)
        if (typeof data.unreadCount === "number") setUnreadCount(data.unreadCount)
      })
      .catch(() => {})
  }, [])

  // Poll notifications every 60 seconds
  React.useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const markAllRead = React.useCallback(() => {
    const token = localStorage.getItem("auth_token")
    if (!token) return
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    })
      .then((r) => r.json())
      .then((data) => {
        setNotifications([])
        if (typeof data.unreadCount === "number") setUnreadCount(data.unreadCount)
      })
      .catch(() => {})
  }, [])

  React.useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (saved === "true") setSidebarCollapsed(true)
  }, [])

  // Fetch pending signoff count for subsidiary / board users
  React.useEffect(() => {
    if (!user?.role) return
    const token = localStorage.getItem("auth_token")
    if (!token) return

    if (user.role === "subsidiary") {
      fetch("/api/signoffs/pending", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (typeof data.count === "number") setPendingSignoffCount(data.count)
        })
        .catch(() => {})
    } else if (user.role === "viewer" && !user.boardExemptFromSignoff) {
      fetch("/api/board/sp-review?countOnly=true", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (typeof data.count === "number") setPendingSignoffCount(data.count)
        })
        .catch(() => {})
    }
  }, [user?.role, user?.boardExemptFromSignoff])

  const toggleCollapsed = React.useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      return next
    })
  }, [])

  // Mobile detection — sidebar always shows expanded on mobile
  const [isMobile, setIsMobile] = React.useState(false)
  React.useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)")
    setIsMobile(mql.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [])
  const effectiveCollapsed = sidebarCollapsed && !isMobile

  const detectedRole = React.useMemo((): UserRole => {
    // Use actual user role when available (handles shared pages like /governance/inbox for delivery users)
    if (user?.role && ["admin", "delivery", "subsidiary", "viewer"].includes(user.role)) {
      return user.role as UserRole
    }
    // Fallback: detect from URL path before auth loads
    if (pathname.startsWith("/admin") || pathname.startsWith("/governance")) return "admin"
    if (pathname.startsWith("/delivery")) return "delivery"
    if (pathname.startsWith("/subsidiary")) return "subsidiary"
    return userRole || "subsidiary"
  }, [pathname, userRole, user?.role])

  const isRestricted = user?.role === "subsidiary" && user?.restrictedView === true
  const isLimitedAdmin = user?.role === "admin" && user?.adminScopeType && user.adminScopeType !== "all"

  const visibleSections = React.useMemo(() => {
    let sections = navSections.filter((section) => section.roles.includes(detectedRole))

    // Non-"all" admins: hide 系統管理 section
    if (isLimitedAdmin) {
      sections = sections.filter((section) => section.title !== "系統管理")
    }

    if (!isRestricted) return sections
    // Restricted subsidiary: only show 需求列表, hide 需求總覽 and SP 錢包
    return sections.map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        item.href !== "/subsidiary" && item.href !== "/subsidiary/wallet"
      ),
    })).filter((section) => section.items.length > 0)
  }, [detectedRole, isRestricted, isLimitedAdmin])

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 border-r border-sidebar-border bg-sidebar transition-all duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          effectiveCollapsed ? "w-16" : "w-56",
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className={cn("flex h-16 items-center justify-between border-b border-sidebar-border", effectiveCollapsed ? "px-3" : "px-4")}>
            <Link href="/" className={cn("flex items-center gap-2", effectiveCollapsed && "justify-center w-full")}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shrink-0">
                <Building2 className="h-5 w-5 text-primary-foreground" />
              </div>
              {!effectiveCollapsed && <span className="text-sm font-semibold text-sidebar-foreground">JV 需求管理平台</span>}
            </Link>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-4 overflow-y-auto p-3">
            <TooltipProvider delayDuration={0}>
              {visibleSections.map((section) => {
                const visibleItems = section.items.filter((item) => {
                  if (!item.roles.includes(detectedRole)) return false
                  // Hide 開案審核 for board members exempt from signoff
                  if (item.href === "/board/sp-review" && user?.boardExemptFromSignoff) return false
                  return true
                })
                if (visibleItems.length === 0) return null

                return (
                  <div key={section.title}>
                    {!effectiveCollapsed && (
                      <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {section.title}
                      </h3>
                    )}
                    {effectiveCollapsed && <div className="my-2 mx-2 border-t border-sidebar-border/50" />}
                    <div className="space-y-0.5">
                      {visibleItems.map((item) => {
                        const Icon = item.icon
                        const matches = pathname === item.href || pathname.startsWith(item.href + "/")
                        const hasMoreSpecific = matches && navSections.some((s) =>
                          s.items.some((o: NavItem) => o.href !== item.href && o.href.startsWith(item.href + "/") && (pathname === o.href || pathname.startsWith(o.href + "/")))
                        )
                        const isActive = matches && !hasMoreSpecific
                        const showSignoffBadge = (item.href === "/subsidiary/demands" || item.href === "/board/sp-review") && pendingSignoffCount > 0
                        const linkEl = (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                              isActive
                                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                              effectiveCollapsed && "justify-center px-2",
                            )}
                            onClick={() => setSidebarOpen(false)}
                          >
                            <span className="relative">
                              <Icon className={cn(effectiveCollapsed ? "h-5 w-5" : "h-4 w-4")} />
                              {effectiveCollapsed && showSignoffBadge && (
                                <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[8px] font-bold text-white">
                                  {pendingSignoffCount}
                                </span>
                              )}
                            </span>
                            {!effectiveCollapsed && item.title}
                            {!effectiveCollapsed && showSignoffBadge && (
                              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-medium text-white">
                                {pendingSignoffCount}
                              </span>
                            )}
                          </Link>
                        )

                        if (effectiveCollapsed) {
                          return (
                            <Tooltip key={item.href}>
                              <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                              <TooltipContent side="right" sideOffset={8}>
                                {item.title}
                              </TooltipContent>
                            </Tooltip>
                          )
                        }
                        return linkEl
                      })}
                    </div>
                  </div>
                )
              })}
            </TooltipProvider>
          </nav>

          <div className="border-t border-sidebar-border p-3 hidden lg:block">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center"
                    onClick={toggleCollapsed}
                  >
                    {sidebarCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <>
                        <ChevronLeft className="h-4 w-4" />
                        <span className="ml-2">收合</span>
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                {sidebarCollapsed && (
                  <TooltipContent side="right" sideOffset={8}>展開選單</TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div
        className={cn("flex flex-1 flex-col transition-all duration-300 min-w-0", sidebarCollapsed ? "lg:pl-16" : "lg:pl-56")}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative overflow-visible">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 sm:w-80 p-0">
                <div className="flex items-center justify-between border-b px-3 sm:px-4 py-2.5 sm:py-3">
                  <span className="text-xs sm:text-sm font-semibold">通知</span>
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" className="h-auto px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs text-muted-foreground" onClick={markAllRead}>
                      全部已讀
                    </Button>
                  )}
                </div>
                <div className="max-h-64 sm:max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="py-8 text-center text-xs sm:text-sm text-muted-foreground">沒有通知</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={cn(
                          "flex gap-2.5 sm:gap-3 border-b px-3 sm:px-4 py-2.5 sm:py-3 last:border-b-0 hover:bg-muted/30 transition-colors",
                          !n.isRead && "bg-muted/50",
                        )}
                      >
                        <div className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.isRead ? "bg-transparent" : "bg-primary")} />
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-xs sm:text-sm", !n.isRead && "font-medium")}>{n.title}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">{n.message}</p>
                          <p className="mt-0.5 text-[10px] sm:text-xs text-muted-foreground/70">
                            {new Date(n.createdAt).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="border-t px-3 sm:px-4 py-1.5 sm:py-2">
                  <button
                    className="block w-full text-center text-[10px] sm:text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setShowNotifCenter(true)}
                  >
                    查看全部通知
                  </button>
                </div>
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <User className="h-4 w-4" />
                  </div>
                  <span className="hidden sm:inline">{user?.name || "使用者"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{user?.name || "使用者"}</span>
                    <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">個人設定</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                  登出
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 min-w-0">{children}</main>
      </div>

      <NotificationCenter
        open={showNotifCenter}
        onOpenChange={setShowNotifCenter}
        onRefresh={fetchNotifications}
      />
    </div>
  )
}

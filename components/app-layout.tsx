"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Building2,
  LayoutDashboard,
  FileText,
  CheckCircle,
  Wallet,
  Inbox,
  ClipboardCheck,
  FolderKanban,
  Calendar,
  TrendingUp,
  BarChart3,
  FileLineChart,
  AlertTriangle,
  Bell,
  Settings,
  Users,
  Shield,
  BookOpen,
  User,
  ChevronDown,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/hooks/use-auth"

type UserRole = "subsidiary" | "admin" | "board" | "delivery" | "governance"

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
    title: "子公司入口",
    roles: ["subsidiary"],
    items: [
      { title: "子公司總覽", href: "/subsidiary", icon: LayoutDashboard, roles: ["subsidiary"] },
      { title: "我的需求", href: "/subsidiary/demands", icon: FolderKanban, roles: ["subsidiary"] },
      { title: "驗收中心", href: "/subsidiary/acceptance", icon: CheckCircle, roles: ["subsidiary"] },
      { title: "SP 錢包", href: "/subsidiary/wallet", icon: Wallet, roles: ["subsidiary"] },
    ],
  },
  {
    title: "共用模組",
    roles: ["subsidiary", "admin"],
    items: [
      {
        title: "通知中心",
        href: "/notifications",
        icon: Bell,
        roles: ["subsidiary", "admin"],
      },
      {
        title: "文件與規範",
        href: "/documents",
        icon: BookOpen,
        roles: ["subsidiary", "admin"],
      },
      {
        title: "個人設定",
        href: "/profile",
        icon: User,
        roles: ["subsidiary", "admin"],
      },
    ],
  },
  {
    title: "系統管理",
    roles: ["admin"],
    items: [
      { title: "組織管理", href: "/admin/organizations", icon: Building2, roles: ["admin"] },
      { title: "使用者與角色", href: "/admin/users", icon: Users, roles: ["admin"] },
      { title: "權限設定", href: "/admin/permissions", icon: Shield, roles: ["admin"] },
      { title: "系統參數", href: "/admin/settings", icon: Settings, roles: ["admin"] },
    ],
  },
]

export function AppLayout({ children, userRole = "subsidiary" }: AppLayoutProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)

  const detectedRole = React.useMemo((): UserRole => {
    if (pathname.startsWith("/admin")) return "admin"
    if (pathname.startsWith("/subsidiary")) return "subsidiary"
    return userRole || "subsidiary"
  }, [pathname, userRole])

  const visibleSections = React.useMemo(() => 
    navSections.filter((section) => section.roles.includes(detectedRole)),
    [detectedRole]
  )

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
          sidebarCollapsed ? "w-20" : "w-64", // increased from w-16 to w-20 for better icon spacing
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Building2 className="h-5 w-5 text-primary-foreground" />
              </div>
              {!sidebarCollapsed && <span className="text-sm font-semibold text-sidebar-foreground">GOVORA</span>}
            </Link>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-6 overflow-y-auto p-4">
            {visibleSections.map((section) => {
              const visibleItems = React.useMemo(
                () => section.items.filter((item) => item.roles.includes(detectedRole)),
                [section.items, detectedRole]
              )

              if (visibleItems.length === 0) return null

              return (
                <div key={section.title}>
                  {!sidebarCollapsed && (
                    <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {section.title}
                    </h3>
                  )}
                  <div className="space-y-1">
                    {visibleItems.map((item) => {
                      const Icon = item.icon
                      const isActive = React.useMemo(
                        () => pathname === item.href || pathname.startsWith(item.href + "/"),
                        [pathname, item.href]
                      )
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                            sidebarCollapsed && "justify-center px-2", // reduced horizontal padding when collapsed for better fit
                          )}
                          onClick={() => setSidebarOpen(false)}
                          title={sidebarCollapsed ? item.title : undefined}
                        >
                          <Icon className={cn(sidebarCollapsed ? "h-5 w-5" : "h-4 w-4")} />{" "}
                          {/* increased icon size from h-4 w-4 to h-5 w-5 when collapsed */}
                          {!sidebarCollapsed && item.title}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </nav>

          <div className="border-t border-sidebar-border p-4">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
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
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div
        className={cn("flex flex-1 flex-col transition-all duration-300", sidebarCollapsed ? "lg:pl-20" : "lg:pl-64")} // updated from lg:pl-16 to lg:pl-20 to match new sidebar width
      >
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
            </Button>

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
                <DropdownMenuItem>個人設定</DropdownMenuItem>
                <DropdownMenuItem>偏好設定</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                  登出
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}

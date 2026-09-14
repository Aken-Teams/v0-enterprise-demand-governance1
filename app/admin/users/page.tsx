"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, Shield, UserCheck, Edit, Loader2, Search, ChevronLeft, ChevronRight, Plus, Trash2, Eye } from "lucide-react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"
import { UserFormDialog } from "@/components/admin/user-form-dialog"

interface UserRow {
  id: string
  name: string
  email: string
  role: string
  roleLabel: string
  isActive: boolean
  organizationId: string | null
  organizationName: string | null
  ldapUsername: string | null
  ldapDomain: string | null
  isOrgAccount: boolean
  restrictBoardToOrg: boolean
  restrictBoardViewToOrg: boolean
  boardExemptFromSignoff: boolean
  adminScopeType?: string
  accessCount: number
  createdAt: string
}

interface Summary {
  totalUsers: number
  activeUsers: number
  roleCounts: Record<string, number>
}

interface OrgOption {
  id: string
  name: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: "管理員",
  delivery: "交付團隊",
  subsidiary: "需求單位",
  viewer: "Scrum Master",
}

const ROLE_BADGE_COLORS: Record<string, string> = {
  admin: "border-amber-300 text-amber-600",
  delivery: "border-emerald-300 text-emerald-600",
  subsidiary: "border-blue-300 text-blue-600",
  viewer: "border-purple-300 text-purple-600",
}

const PAGE_SIZE = 10

export default function UsersPage() {
  const { token, user } = useAuth()
  const router = useRouter()

  // Only "all" admins can access system management pages
  useEffect(() => {
    if (user && user.role === "admin" && user.adminScopeType && user.adminScopeType !== "all") {
      router.replace("/governance/inbox")
    }
  }, [user, router])

  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [organizations, setOrganizations] = useState<OrgOption[]>([])

  // UserFormDialog state
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogUser, setDialogUser] = useState<UserRow | null>(null)
  const [dialogStep, setDialogStep] = useState<1 | 2>(1)

  // Delete dialog
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Filter & pagination
  const [searchQuery, setSearchQuery] = useState("")
  const [filterRole, setFilterRole] = useState("all")
  const [filterOrg, setFilterOrg] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    if (!token) return
    try {
      const [usersRes, orgsRes] = await Promise.all([
        fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/organizations", { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const usersData = await usersRes.json()
      const orgsData = await orgsRes.json()
      if (usersRes.ok) {
        setUsers(usersData.users)
        setSummary(usersData.summary)
      }
      if (orgsRes.ok) {
        setOrganizations(orgsData.organizations)
      }
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchData() }, [fetchData])

  // Filtered & sorted users
  const filtered = useMemo(() => {
    let list = users
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.organizationName || "").toLowerCase().includes(q))
    }
    if (filterRole !== "all") {
      list = list.filter((u) => u.role === filterRole)
    }
    if (filterOrg !== "all") {
      list = list.filter((u) => (filterOrg === "none" ? !u.organizationId : u.organizationId === filterOrg))
    }
    if (filterStatus !== "all") {
      list = list.filter((u) => (filterStatus === "active" ? u.isActive : !u.isActive))
    }
    return [...list].sort((a, b) => {
      const orgA = a.organizationName || "\uffff"
      const orgB = b.organizationName || "\uffff"
      if (orgA !== orgB) return orgA.localeCompare(orgB, "zh-TW")
      return a.accessCount - b.accessCount
    })
  }, [users, searchQuery, filterRole, filterOrg, filterStatus])

  useEffect(() => { setPage(1) }, [searchQuery, filterRole, filterOrg, filterStatus])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // --- Dialog openers ---
  const openCreate = () => {
    setDialogMode("create")
    setDialogUser(null)
    setDialogStep(1)
    setDialogOpen(true)
  }

  const openEdit = (user: UserRow) => {
    setDialogMode("edit")
    setDialogUser(user)
    setDialogStep(1)
    setDialogOpen(true)
  }

  const openPermission = (user: UserRow) => {
    setDialogMode("edit")
    setDialogUser(user)
    setDialogStep(2)
    setDialogOpen(true)
  }

  // --- Delete ---
  const handleDelete = async () => {
    if (!token || !deleteUser) return
    setDeleting(true)
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteUser.id }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("帳號已刪除")
        setDeleteUser(null)
        fetchData()
      } else {
        toast.error(data.error || "刪除失敗")
      }
    } catch {
      toast.error("網路錯誤")
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <AppLayout userRole="admin">
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  const roleCount = summary?.roleCounts ?? {}
  const hasFilters = searchQuery || filterRole !== "all" || filterOrg !== "all" || filterStatus !== "all"

  return (
    <AppLayout userRole="admin">
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">帳號管理</h1>
            <p className="hidden sm:block text-muted-foreground">管理系統使用者帳號與角色分配</p>
          </div>
          <Button onClick={openCreate} size="sm" className="shrink-0 sm:size-default">
            <Plus className="mr-1 sm:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">新增帳號</span>
            <span className="sm:hidden">新增</span>
          </Button>
        </div>

        {/* Summary */}
        {summary && (
          <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4">
            {[
              { label: "總使用者", sub: `啟用 ${summary.activeUsers}`, value: summary.totalUsers, color: "border-blue-500", icon: Users },
              { label: "管理員", sub: "系統管理角色", value: roleCount.admin || 0, color: "border-amber-500", icon: Shield },
              { label: "交付團隊", sub: "開發與交付", value: roleCount.delivery || 0, color: "border-emerald-500", icon: UserCheck },
              { label: "需求單位", sub: "子公司使用者", value: roleCount.subsidiary || 0, color: "border-violet-500", icon: Users },
            ].map((item) => (
              <div key={item.label} className={`flex items-center gap-2 sm:gap-4 rounded-lg border-l-4 ${item.color} border bg-card p-2 sm:p-4`}>
                <span className="text-xl sm:text-3xl font-bold">{item.value}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <item.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                    <p className="font-medium text-xs sm:text-sm">{item.label}</p>
                  </div>
                  <p className="hidden sm:block text-xs text-muted-foreground">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-muted/50 p-2 sm:p-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜尋姓名、信箱或組織..."
              className="pl-9 h-9 sm:h-10 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[100px] sm:w-[130px] h-8 sm:h-10 text-xs sm:text-sm">
                <SelectValue placeholder="角色" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部角色</SelectItem>
                <SelectItem value="admin">管理員</SelectItem>
                <SelectItem value="delivery">交付團隊</SelectItem>
                <SelectItem value="subsidiary">需求單位</SelectItem>
                <SelectItem value="viewer">Scrum Master</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterOrg} onValueChange={setFilterOrg}>
              <SelectTrigger className="w-[100px] sm:w-[140px] h-8 sm:h-10 text-xs sm:text-sm">
                <SelectValue placeholder="組織" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部組織</SelectItem>
                <SelectItem value="none">無組織</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[90px] sm:w-[120px] h-8 sm:h-10 text-xs sm:text-sm">
                <SelectValue placeholder="狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部狀態</SelectItem>
                <SelectItem value="active">啟用</SelectItem>
                <SelectItem value="inactive">停用</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="text-muted-foreground text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-3" onClick={() => { setSearchQuery(""); setFilterRole("all"); setFilterOrg("all"); setFilterStatus("all") }}>
                清除
              </Button>
            )}
          </div>
        </div>

        {/* Users Table */}
        <Card>
          <CardContent className="pt-4 sm:pt-6 px-2 sm:px-6">
            <Table>
              <TableHeader>
                <TableRow className="text-xs sm:text-sm">
                  <TableHead>使用者</TableHead>
                  <TableHead className="text-center">角色</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">組織</TableHead>
                  <TableHead className="text-center hidden md:table-cell">狀態</TableHead>
                  <TableHead className="text-center hidden lg:table-cell">可見需求</TableHead>
                  <TableHead className="text-center hidden md:table-cell">建立時間</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      無符合條件的使用者
                    </TableCell>
                  </TableRow>
                ) : paged.map((user, idx) => {
                  const prevUser = idx > 0 ? paged[idx - 1] : null
                  const isSubAccount = user.accessCount > 0 && user.organizationId != null &&
                    paged.slice(0, idx).some((u) => u.organizationId === user.organizationId && u.accessCount === 0)
                  const isNewOrgGroup = !prevUser || prevUser.organizationId !== user.organizationId

                  return (
                  <TableRow key={user.id} className={isNewOrgGroup && idx > 0 ? "border-t-2" : ""}>
                    <TableCell className="py-2 sm:py-4 px-1 sm:px-4">
                      <div className="flex items-center">
                        {isSubAccount && (
                          <span className="text-muted-foreground/50 mr-1 ml-2 sm:ml-4 shrink-0 font-mono text-xs sm:text-sm">└</span>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-xs sm:text-sm truncate">{user.name}</div>
                          <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{user.email}</div>
                          <div className="sm:hidden text-[10px] text-muted-foreground">{user.organizationName || ""}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-2 sm:py-4 px-1 sm:px-4">
                      <Badge variant="outline" className={`${ROLE_BADGE_COLORS[user.role] || ""} text-[10px] sm:text-xs`}>
                        {ROLE_LABELS[user.role] || user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center hidden sm:table-cell">{user.organizationName || "-"}</TableCell>
                    <TableCell className="text-center hidden md:table-cell">
                      <Badge
                        variant={user.isActive ? "outline" : "secondary"}
                        className={user.isActive ? "border-emerald-300 text-emerald-600" : ""}
                      >
                        {user.isActive ? "啟用" : "停用"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center hidden lg:table-cell">
                      {user.role === "admin" ? (
                        !user.adminScopeType || user.adminScopeType === "all" ? (
                          <span className="text-xs text-muted-foreground">全部</span>
                        ) : (
                          <Badge variant="outline" className="border-orange-300 text-orange-600 text-xs">
                            {user.adminScopeType === "organization" ? "限組織" : "限專案"}
                          </Badge>
                        )
                      ) : user.role === "viewer" ? (
                        <div className="flex flex-col items-center gap-0.5">
                          {user.restrictBoardViewToOrg ? (
                            <Badge variant="outline" className="border-orange-300 text-orange-600 text-xs">
                              觀看限組織
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">觀看全部</span>
                          )}
                          {user.boardExemptFromSignoff ? (
                            <Badge variant="outline" className="border-gray-300 text-gray-500 text-xs">
                              不需審核
                            </Badge>
                          ) : user.restrictBoardToOrg ? (
                            <Badge variant="outline" className="border-orange-300 text-orange-600 text-xs">
                              審核限組織
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">審核全部</span>
                          )}
                        </div>
                      ) : user.accessCount > 0 ? (
                        <Badge variant="outline" className="border-orange-300 text-orange-600 text-xs">
                          限 {user.accessCount} 筆
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">全部</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground hidden md:table-cell">
                      {new Date(user.createdAt).toLocaleDateString("zh-TW")}
                    </TableCell>
                    <TableCell className="text-right py-2 sm:py-4 px-1 sm:px-4">
                      <div className="flex items-center justify-end gap-0.5 sm:gap-1">
                        {(user.role === "subsidiary" || user.role === "viewer" || user.role === "admin") ? (
                          <Button variant="ghost" size="sm" className="h-7 w-7 sm:h-8 sm:w-8 p-0" onClick={() => openPermission(user)} title={user.role === "admin" ? "管理權限" : "專案與審核角色"}>
                            <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Button>
                        ) : (
                          <div className="w-7 sm:w-8" />
                        )}
                        <Button variant="ghost" size="sm" className="h-7 w-7 sm:h-8 sm:w-8 p-0" onClick={() => openEdit(user)}>
                          <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteUser(user)}>
                          <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            {filtered.length > PAGE_SIZE && (
              <div className="flex items-center justify-between border-t pt-3 mt-3 sm:pt-4 sm:mt-4">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  <span className="hidden sm:inline">共 {filtered.length} 筆，</span>第 {page}/{totalPages} 頁
                </p>
                <div className="flex items-center gap-0.5 sm:gap-1">
                  <Button variant="outline" size="sm" className="h-7 w-7 sm:h-8 sm:w-8 p-0" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <Button
                      key={p}
                      variant={p === page ? "default" : "outline"}
                      size="sm"
                      className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-xs sm:text-sm hidden sm:inline-flex first:inline-flex last:inline-flex data-[active=true]:inline-flex"
                      data-active={p === page}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  ))}
                  <span className="sm:hidden text-xs text-muted-foreground px-1">{page}/{totalPages}</span>
                  <Button variant="outline" size="sm" className="h-7 w-7 sm:h-8 sm:w-8 p-0" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                    <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ===== User Form Dialog (Create / Edit / Permission) ===== */}
        <UserFormDialog
          mode={dialogMode}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          initialUser={dialogUser}
          initialStep={dialogStep}
          organizations={organizations}
          token={token}
          onSaved={fetchData}
        />

        {/* ===== Delete Confirm Dialog ===== */}
        <AlertDialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>確定要刪除此帳號？</AlertDialogTitle>
              <AlertDialogDescription>
                即將刪除使用者「<span className="font-medium text-foreground">{deleteUser?.name}</span>」（{deleteUser?.email}）。此操作無法復原。
                <br />
                <span className="text-xs">如果此使用者為需求的提交者或建立者，將無法刪除，建議改為停用帳號。</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                確認刪除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  )
}

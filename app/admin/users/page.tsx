"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Users, Shield, UserCheck, Edit, Loader2, Search, ChevronLeft, ChevronRight, Plus, Trash2, Eye } from "lucide-react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"

interface UserRow {
  id: string
  name: string
  email: string
  role: string
  roleLabel: string
  isActive: boolean
  organizationId: string | null
  organizationName: string | null
  accessCount: number
  createdAt: string
}

interface DemandOption {
  id: string
  demandNumber: string
  title: string
  status: string
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
  viewer: "董事會",
}

const ROLE_BADGE_COLORS: Record<string, string> = {
  admin: "border-amber-300 text-amber-600",
  delivery: "border-emerald-300 text-emerald-600",
  subsidiary: "border-blue-300 text-blue-600",
  viewer: "border-purple-300 text-purple-600",
}

const PAGE_SIZE = 10

const EMPTY_CREATE_FORM = { name: "", email: "", password: "", role: "", organizationId: "" }

export default function UsersPage() {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [organizations, setOrganizations] = useState<OrgOption[]>([])
  const [saving, setSaving] = useState(false)

  // Edit dialog
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "", isActive: true, organizationId: "", password: "", adminPassword: "" })

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM)

  // Delete dialog
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Permission dialog
  const [permUser, setPermUser] = useState<UserRow | null>(null)
  const [permDemandIds, setPermDemandIds] = useState<Set<string>>(new Set())
  const [permAllDemands, setPermAllDemands] = useState<DemandOption[]>([])
  const [permLoading, setPermLoading] = useState(false)
  const [permSaving, setPermSaving] = useState(false)
  const [permSearch, setPermSearch] = useState("")

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

  // Filtered & grouped users
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
    // Sort: group by organization, then main accounts (accessCount=0) before sub-accounts
    return [...list].sort((a, b) => {
      const orgA = a.organizationName || "\uffff"
      const orgB = b.organizationName || "\uffff"
      if (orgA !== orgB) return orgA.localeCompare(orgB, "zh-TW")
      return a.accessCount - b.accessCount
    })
  }, [users, searchQuery, filterRole, filterOrg, filterStatus])

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [searchQuery, filterRole, filterOrg, filterStatus])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // --- Create ---
  const openCreate = () => {
    setCreateForm(EMPTY_CREATE_FORM)
    setCreateOpen(true)
  }

  const handleCreate = async () => {
    if (!token) return
    if (!createForm.name || !createForm.email || !createForm.password || !createForm.role) {
      toast.error("請填寫所有必填欄位")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name,
          email: createForm.email,
          password: createForm.password,
          role: createForm.role,
          organizationId: createForm.organizationId || null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("帳號建立成功")
        setCreateOpen(false)
        fetchData()
      } else {
        toast.error(data.error || "建立失敗")
      }
    } catch {
      toast.error("網路錯誤")
    } finally {
      setSaving(false)
    }
  }

  // --- Edit ---
  const openEdit = (user: UserRow) => {
    setEditUser(user)
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      organizationId: user.organizationId || "",
      password: "",
      adminPassword: "",
    })
  }

  const handleSave = async () => {
    if (!token || !editUser) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        id: editUser.id,
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
        isActive: editForm.isActive,
        organizationId: editForm.organizationId || null,
      }
      if (editForm.password) {
        if (!editForm.adminPassword) {
          toast.error("修改密碼需要輸入您的管理員密碼確認")
          setSaving(false)
          return
        }
        payload.password = editForm.password
        payload.adminPassword = editForm.adminPassword
      }
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("帳號更新成功")
        setEditUser(null)
        fetchData()
      } else {
        toast.error(data.error || "更新失敗")
      }
    } catch {
      toast.error("網路錯誤")
    } finally {
      setSaving(false)
    }
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

  // --- Permission ---
  const openPermission = async (user: UserRow) => {
    setPermUser(user)
    setPermLoading(true)
    setPermSearch("")
    try {
      // Fetch current whitelist and available demands in parallel
      const params = new URLSearchParams()
      if (user.role === "subsidiary" && user.organizationId) {
        params.set("organizationId", user.organizationId)
      } else if (user.role === "delivery") {
        params.set("developerId", user.id)
      }

      const [accessRes, demandsRes] = await Promise.all([
        fetch(`/api/admin/users/${user.id}/access`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/demands?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      const accessData = await accessRes.json()
      const demandsData = await demandsRes.json()

      if (accessRes.ok) {
        setPermDemandIds(new Set(accessData.demandIds as string[]))
      }
      if (demandsRes.ok) {
        setPermAllDemands(
          demandsData.demands.map((d: { id: string; demandNumber: string; title: string; status: string }) => ({
            id: d.id,
            demandNumber: d.demandNumber,
            title: d.title,
            status: d.status,
          }))
        )
      }
    } catch {
      toast.error("載入權限資料失敗")
    } finally {
      setPermLoading(false)
    }
  }

  const handlePermSave = async () => {
    if (!token || !permUser) return
    setPermSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${permUser.id}/access`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ demandIds: Array.from(permDemandIds) }),
      })
      if (res.ok) {
        toast.success(permDemandIds.size > 0 ? `已限制為 ${permDemandIds.size} 筆可見需求` : "已解除限制，可看全部需求")
        setPermUser(null)
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || "儲存失敗")
      }
    } catch {
      toast.error("網路錯誤")
    } finally {
      setPermSaving(false)
    }
  }

  const togglePermDemand = (demandId: string) => {
    setPermDemandIds((prev) => {
      const next = new Set(prev)
      if (next.has(demandId)) next.delete(demandId)
      else next.add(demandId)
      return next
    })
  }

  const filteredPermDemands = permAllDemands.filter((d) => {
    if (!permSearch) return true
    const q = permSearch.toLowerCase()
    return d.demandNumber.toLowerCase().includes(q) || d.title.toLowerCase().includes(q)
  })

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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">帳號管理</h1>
            <p className="text-muted-foreground">管理系統使用者帳號與角色分配</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新增帳號
          </Button>
        </div>

        {/* Summary */}
        {summary && (
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: "總使用者", sub: `啟用 ${summary.activeUsers}`, value: summary.totalUsers, color: "border-blue-500", icon: Users },
              { label: "管理員", sub: "系統管理角色", value: roleCount.admin || 0, color: "border-amber-500", icon: Shield },
              { label: "交付團隊", sub: "開發與交付", value: roleCount.delivery || 0, color: "border-emerald-500", icon: UserCheck },
              { label: "需求單位", sub: "子公司使用者", value: roleCount.subsidiary || 0, color: "border-violet-500", icon: Users },
            ].map((item) => (
              <div key={item.label} className={`flex items-center gap-4 rounded-lg border-l-4 ${item.color} border bg-card p-4`}>
                <span className="text-3xl font-bold">{item.value}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <p className="font-medium text-sm">{item.label}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-muted/50 p-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜尋姓名、信箱或組織..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="角色" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部角色</SelectItem>
                <SelectItem value="admin">管理員</SelectItem>
                <SelectItem value="delivery">交付團隊</SelectItem>
                <SelectItem value="subsidiary">需求單位</SelectItem>
                <SelectItem value="viewer">董事會</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterOrg} onValueChange={setFilterOrg}>
              <SelectTrigger className="w-[140px]">
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
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部狀態</SelectItem>
                <SelectItem value="active">啟用</SelectItem>
                <SelectItem value="inactive">停用</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setSearchQuery(""); setFilterRole("all"); setFilterOrg("all"); setFilterStatus("all") }}>
                清除篩選
              </Button>
            )}
          </div>
        </div>

        {/* Users Table */}
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>使用者</TableHead>
                  <TableHead className="text-center">角色</TableHead>
                  <TableHead className="text-center">組織</TableHead>
                  <TableHead className="text-center">狀態</TableHead>
                  <TableHead className="text-center">可見需求</TableHead>
                  <TableHead className="text-center">建立時間</TableHead>
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
                    <TableCell>
                      <div className="flex items-center">
                        {isSubAccount && (
                          <span className="text-muted-foreground/50 mr-1 ml-4 shrink-0 font-mono text-sm">└</span>
                        )}
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={ROLE_BADGE_COLORS[user.role] || ""}>
                        {ROLE_LABELS[user.role] || user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{user.organizationName || "-"}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={user.isActive ? "outline" : "secondary"}
                        className={user.isActive ? "border-emerald-300 text-emerald-600" : ""}
                      >
                        {user.isActive ? "啟用" : "停用"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {user.role === "admin" ? (
                        <span className="text-xs text-muted-foreground">-</span>
                      ) : user.accessCount > 0 ? (
                        <Badge variant="outline" className="border-orange-300 text-orange-600 text-xs">
                          限 {user.accessCount} 筆
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">全部</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString("zh-TW")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {user.role !== "admin" ? (
                          <Button variant="ghost" size="sm" onClick={() => openPermission(user)} title="權限設定">
                            <Eye className="h-4 w-4" />
                          </Button>
                        ) : (
                          <div className="w-8" />
                        )}
                        <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteUser(user)}>
                          <Trash2 className="h-4 w-4" />
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
              <div className="flex items-center justify-between border-t pt-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  共 {filtered.length} 筆，第 {page}/{totalPages} 頁
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <Button
                      key={p}
                      variant={p === page ? "default" : "outline"}
                      size="sm"
                      className="w-8"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  ))}
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ===== Create Dialog ===== */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>新增帳號</DialogTitle>
              <DialogDescription>建立新的系統使用者帳號</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>姓名 <span className="text-destructive">*</span></Label>
                <Input placeholder="使用者姓名" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>電子郵件 <span className="text-destructive">*</span></Label>
                <Input type="email" placeholder="user@example.com" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>密碼 <span className="text-destructive">*</span></Label>
                <Input type="password" placeholder="至少 6 個字元" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>角色 <span className="text-destructive">*</span></Label>
                <Select value={createForm.role} onValueChange={(v) => setCreateForm({ ...createForm, role: v })}>
                  <SelectTrigger><SelectValue placeholder="選擇角色" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">管理員</SelectItem>
                    <SelectItem value="delivery">交付團隊</SelectItem>
                    <SelectItem value="subsidiary">需求單位</SelectItem>
                    <SelectItem value="viewer">董事會</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>組織</Label>
                <Select value={createForm.organizationId || "none"} onValueChange={(v) => setCreateForm({ ...createForm, organizationId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="選擇組織（選填）" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">無</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
                <Button onClick={handleCreate} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  建立
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ===== Edit Dialog ===== */}
        <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>編輯使用者</DialogTitle>
              <DialogDescription>修改「{editUser?.name}」的帳號資訊</DialogDescription>
            </DialogHeader>
            {editUser && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>姓名</Label>
                  <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>電子郵件</Label>
                  <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>新密碼</Label>
                  <Input type="password" placeholder="留空表示不修改" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value, adminPassword: "" })} />
                </div>
                {editForm.password && (
                  <div className="space-y-2">
                    <Label>管理員密碼確認 <span className="text-destructive">*</span></Label>
                    <Input type="password" placeholder="請輸入您自己的密碼以確認身份" value={editForm.adminPassword} onChange={(e) => setEditForm({ ...editForm, adminPassword: e.target.value })} />
                    <p className="text-xs text-muted-foreground">修改密碼需要驗證管理員身份</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>角色</Label>
                  <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">管理員</SelectItem>
                      <SelectItem value="delivery">交付團隊</SelectItem>
                      <SelectItem value="subsidiary">需求單位</SelectItem>
                      <SelectItem value="viewer">董事會</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>組織</Label>
                  <Select value={editForm.organizationId || "none"} onValueChange={(v) => setEditForm({ ...editForm, organizationId: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="選擇組織" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">無</SelectItem>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>狀態</Label>
                  <Select value={editForm.isActive ? "active" : "inactive"} onValueChange={(v) => setEditForm({ ...editForm, isActive: v === "active" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">啟用</SelectItem>
                      <SelectItem value="inactive">停用</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditUser(null)}>取消</Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    儲存
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

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

        {/* ===== Permission Dialog ===== */}
        <Dialog open={!!permUser} onOpenChange={(open) => !open && setPermUser(null)}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                設定「{permUser?.name}」的可見需求
              </DialogTitle>
              <DialogDescription>
                勾選此帳號可以查看的需求。未勾選任何需求表示可看到全部（角色預設權限）。
              </DialogDescription>
            </DialogHeader>
            {permLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex-1 overflow-hidden flex flex-col gap-3">
                {/* Status bar */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {permDemandIds.size > 0
                      ? <span>已選 <span className="font-medium text-foreground">{permDemandIds.size}</span> / {permAllDemands.length} 筆</span>
                      : <span className="text-emerald-600">未限制（可看全部）</span>
                    }
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setPermDemandIds(new Set(permAllDemands.map((d) => d.id)))}
                    >
                      全選
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setPermDemandIds(new Set())}
                    >
                      清除
                    </Button>
                  </div>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="搜尋需求編號或標題..."
                    className="pl-9 h-8 text-sm"
                    value={permSearch}
                    onChange={(e) => setPermSearch(e.target.value)}
                  />
                </div>

                {/* Demand list */}
                <div className="flex-1 overflow-y-auto border rounded-md divide-y max-h-[340px]">
                  {filteredPermDemands.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">無可選需求</p>
                  ) : (
                    filteredPermDemands.map((d) => (
                      <label
                        key={d.id}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={permDemandIds.has(d.id)}
                          onCheckedChange={() => togglePermDemand(d.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground shrink-0">{d.demandNumber}</span>
                            <span className="text-sm truncate">{d.title}</span>
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => setPermUser(null)}>取消</Button>
                  <Button onClick={handlePermSave} disabled={permSaving}>
                    {permSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    儲存
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}

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
import { Users, Shield, UserCheck, Edit, Loader2, Search, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react"
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
}

const ROLE_BADGE_COLORS: Record<string, string> = {
  admin: "border-amber-300 text-amber-600",
  delivery: "border-emerald-300 text-emerald-600",
  subsidiary: "border-blue-300 text-blue-600",
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
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "", isActive: true, organizationId: "", password: "" })

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM)

  // Delete dialog
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Filter & pagination
  const [searchQuery, setSearchQuery] = useState("")
  const [filterRole, setFilterRole] = useState("all")
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

  // Filtered users
  const filtered = useMemo(() => {
    let list = users
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.organizationName || "").toLowerCase().includes(q))
    }
    if (filterRole !== "all") {
      list = list.filter((u) => u.role === filterRole)
    }
    if (filterStatus !== "all") {
      list = list.filter((u) => (filterStatus === "active" ? u.isActive : !u.isActive))
    }
    return list
  }, [users, searchQuery, filterRole, filterStatus])

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [searchQuery, filterRole, filterStatus])

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
        payload.password = editForm.password
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
  const hasFilters = searchQuery || filterRole !== "all" || filterStatus !== "all"

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
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setSearchQuery(""); setFilterRole("all"); setFilterStatus("all") }}>
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
                  <TableHead className="text-center">建立時間</TableHead>
                  <TableHead className="text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      無符合條件的使用者
                    </TableCell>
                  </TableRow>
                ) : paged.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
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
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString("zh-TW")}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteUser(user)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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
                  <Input type="password" placeholder="留空表示不修改" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>角色</Label>
                  <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">管理員</SelectItem>
                      <SelectItem value="delivery">交付團隊</SelectItem>
                      <SelectItem value="subsidiary">需求單位</SelectItem>
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
      </div>
    </AppLayout>
  )
}

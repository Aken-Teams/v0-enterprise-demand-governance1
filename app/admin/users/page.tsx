"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Search, Users, Shield, UserCheck, Edit, Trash2, UserPlus, Settings } from "lucide-react"
import { useState } from "react"

interface User {
  id: string
  name: string
  email: string
  role: "subsidiary" | "admin"
  organization: string
  status: "active" | "inactive"
  lastLogin: string
  createdAt: string
}

interface Role {
  id: string
  name: string
  description: string
  permissions: string[]
  users: number
  type: "system" | "custom"
}

interface Organization {
  id: string
  name: string
}

const organizations: Organization[] = [
  { id: "panjit", name: "強茂" },
  { id: "panjit-tech", name: "璟茂科技" },
  { id: "ymoptics", name: "熒茂光學" },
  { id: "panjit-wuxi", name: "強茂電子（無錫）" },
  { id: "panjit-xuzhou", name: "強茂半導體（徐州）" },
  { id: "panjit-shandong", name: "山東強茂電子" },
  { id: "hge", name: "虹冠電子工業" },
  { id: "system", name: "系統" },
]

const initialUsers: User[] = [
  { id: "1", name: "王小明", email: "wang@panjit.com", role: "subsidiary", organization: "強茂", status: "active", lastLogin: "2024-12-24", createdAt: "2024-01-01" },
  { id: "2", name: "李小華", email: "lee@panjit-tech.com", role: "subsidiary", organization: "璟茂科技", status: "active", lastLogin: "2024-12-23", createdAt: "2024-01-15" },
  { id: "3", name: "張小美", email: "zhang@ymoptics.com", role: "subsidiary", organization: "熒茂光學", status: "active", lastLogin: "2024-12-24", createdAt: "2024-02-01" },
  { id: "4", name: "陳小強", email: "chen@panjit-wuxi.com", role: "subsidiary", organization: "強茂電子（無錫）", status: "active", lastLogin: "2024-12-22", createdAt: "2024-01-01" },
  { id: "5", name: "林管理", email: "admin@system.com", role: "admin", organization: "系統", status: "active", lastLogin: "2024-12-24", createdAt: "2024-01-01" },
]

const initialRoles: Role[] = [
  { id: "1", name: "子公司使用者", description: "子公司員工，可提交需求並查看進度", permissions: ["submit_demand", "view_own_demands", "view_sp_wallet"], users: 20, type: "system" },
  { id: "2", name: "系統管理員", description: "系統設定與使用者管理", permissions: ["manage_users", "manage_organizations", "manage_permissions", "system_settings", "evaluate_demands"], users: 1, type: "system" },
]

const roleLabels: Record<string, string> = {
  subsidiary: "子公司使用者",
  admin: "系統管理員"
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [roles, setRoles] = useState<Role[]>(initialRoles)
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false)
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false)
  const [isCreateRoleDialogOpen, setIsCreateRoleDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userFormData, setUserFormData] = useState({
    name: "",
    email: "",
    role: "subsidiary" as User["role"],
    organization: "",
    status: "active" as "active" | "inactive"
  })
  const [roleFormData, setRoleFormData] = useState({
    name: "",
    description: "",
    permissions: [] as string[]
  })

  const handleCreateUser = () => {
    const newUser: User = {
      id: Date.now().toString(),
      name: userFormData.name,
      email: userFormData.email,
      role: userFormData.role,
      organization: userFormData.organization,
      status: userFormData.status,
      lastLogin: "-",
      createdAt: new Date().toISOString().split('T')[0]
    }
    setUsers([...users, newUser])
    setUserFormData({ name: "", email: "", role: "subsidiary", organization: "", status: "active" })
    setIsCreateUserDialogOpen(false)
  }

  const handleEditUser = () => {
    if (!editingUser) return
    const updatedUsers = users.map(user => 
      user.id === editingUser.id 
        ? { ...user, ...userFormData }
        : user
    )
    setUsers(updatedUsers)
    setEditingUser(null)
    setUserFormData({ name: "", email: "", role: "subsidiary", organization: "", status: "active" })
    setIsEditUserDialogOpen(false)
  }

  const handleDeleteUser = (id: string) => {
    setUsers(users.filter(user => user.id !== id))
  }

  const openEditUserDialog = (user: User) => {
    setEditingUser(user)
    setUserFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      organization: user.organization,
      status: user.status
    })
    setIsEditUserDialogOpen(true)
  }

  return (
    <AppLayout userRole="admin">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">使用者與角色管理</h1>
            <p className="text-muted-foreground">管理系統使用者、角色權限與組織分配</p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">總使用者數</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{users.length}</div>
              <p className="text-xs text-muted-foreground">啟用: {users.filter(u => u.status === "active").length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">系統角色</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{roles.length}</div>
              <p className="text-xs text-muted-foreground">系統: {roles.filter(r => r.type === "system").length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">活躍使用者</CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {users.filter(u => u.lastLogin !== "-").length}
              </div>
              <p className="text-xs text-muted-foreground">本週登入</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">權限配置</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {roles.reduce((sum, role) => sum + role.permissions.length, 0)}
              </div>
              <p className="text-xs text-muted-foreground">總權限數</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users" className="w-full">
          <TabsList>
            <TabsTrigger value="users">使用者管理</TabsTrigger>
            <TabsTrigger value="roles">角色管理</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-between">
              <h3 className="text-lg font-semibold">使用者列表</h3>
              <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    新增使用者
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>新增使用者</DialogTitle>
                    <DialogDescription>建立新的系統使用者帳號</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="user-name">姓名</Label>
                      <Input
                        id="user-name"
                        value={userFormData.name}
                        onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                        placeholder="輸入使用者姓名"
                      />
                    </div>
                    <div>
                      <Label htmlFor="user-email">電子郵件</Label>
                      <Input
                        id="user-email"
                        type="email"
                        value={userFormData.email}
                        onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                        placeholder="輸入電子郵件"
                      />
                    </div>
                    <div>
                      <Label htmlFor="user-role">角色</Label>
                      <Select value={userFormData.role} onValueChange={(value: User["role"]) => setUserFormData({ ...userFormData, role: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="subsidiary">子公司使用者</SelectItem>
                          <SelectItem value="admin">系統管理員</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="user-org">組織</Label>
                      <Select value={userFormData.organization} onValueChange={(value) => setUserFormData({ ...userFormData, organization: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇組織" />
                        </SelectTrigger>
                        <SelectContent>
                          {organizations.map((org) => (
                            <SelectItem key={org.id} value={org.name}>
                              {org.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="user-status">狀態</Label>
                      <Select value={userFormData.status} onValueChange={(value: "active" | "inactive") => setUserFormData({ ...userFormData, status: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">啟用</SelectItem>
                          <SelectItem value="inactive">停用</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsCreateUserDialogOpen(false)}>
                        取消
                      </Button>
                      <Button onClick={handleCreateUser}>
                        建立使用者
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>使用者</TableHead>
                      <TableHead>角色</TableHead>
                      <TableHead>組織</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead>最後登入</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {roleLabels[user.role]}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.organization}</TableCell>
                        <TableCell>
                          <Badge variant={user.status === "active" ? "outline" : "secondary"} 
                                 className={user.status === "active" ? "border-chart-3 text-chart-3" : ""}>
                            {user.status === "active" ? "啟用" : "停用"}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.lastLogin}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button variant="ghost" size="sm" onClick={() => openEditUserDialog(user)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>確認刪除</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    您確定要刪除使用者「{user.name}」嗎？此操作無法復原。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>取消</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteUser(user.id)}>
                                    刪除
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roles" className="space-y-4">
            <div className="flex justify-between">
              <h3 className="text-lg font-semibold">角色列表</h3>
              <Dialog open={isCreateRoleDialogOpen} onOpenChange={setIsCreateRoleDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    新增角色
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>新增角色</DialogTitle>
                    <DialogDescription>建立新的系統角色</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="role-name">角色名稱</Label>
                      <Input
                        id="role-name"
                        value={roleFormData.name}
                        onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
                        placeholder="輸入角色名稱"
                      />
                    </div>
                    <div>
                      <Label htmlFor="role-description">描述</Label>
                      <Input
                        id="role-description"
                        value={roleFormData.description}
                        onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                        placeholder="角色描述"
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsCreateRoleDialogOpen(false)}>
                        取消
                      </Button>
                      <Button onClick={() => {
                        const newRole: Role = {
                          id: Date.now().toString(),
                          name: roleFormData.name,
                          description: roleFormData.description,
                          permissions: [],
                          users: 0,
                          type: "custom"
                        }
                        setRoles([...roles, newRole])
                        setRoleFormData({ name: "", description: "", permissions: [] })
                        setIsCreateRoleDialogOpen(false)
                      }}>
                        建立角色
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>角色名稱</TableHead>
                      <TableHead>描述</TableHead>
                      <TableHead>權限數量</TableHead>
                      <TableHead>使用者數</TableHead>
                      <TableHead>類型</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell className="font-medium">{role.name}</TableCell>
                        <TableCell className="text-muted-foreground">{role.description}</TableCell>
                        <TableCell>{role.permissions.length}</TableCell>
                        <TableCell>{role.users}</TableCell>
                        <TableCell>
                          <Badge variant={role.type === "system" ? "default" : "outline"}>
                            {role.type === "system" ? "系統" : "自訂"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            {role.type === "custom" && (
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit User Dialog */}
        <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>編輯使用者</DialogTitle>
              <DialogDescription>修改使用者資訊</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-user-name">姓名</Label>
                <Input
                  id="edit-user-name"
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                  placeholder="輸入使用者姓名"
                />
              </div>
              <div>
                <Label htmlFor="edit-user-email">電子郵件</Label>
                <Input
                  id="edit-user-email"
                  type="email"
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  placeholder="輸入電子郵件"
                />
              </div>
              <div>
                <Label htmlFor="edit-user-role">角色</Label>
                <Select value={userFormData.role} onValueChange={(value: User["role"]) => setUserFormData({ ...userFormData, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subsidiary">子公司使用者</SelectItem>
                    <SelectItem value="admin">系統管理員</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-user-org">組織</Label>
                <Select value={userFormData.organization} onValueChange={(value) => setUserFormData({ ...userFormData, organization: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇組織" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.name}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-user-status">狀態</Label>
                <Select value={userFormData.status} onValueChange={(value: "active" | "inactive") => setUserFormData({ ...userFormData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">啟用</SelectItem>
                    <SelectItem value="inactive">停用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditUserDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleEditUser}>
                  儲存變更
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}

"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Building2, Plus, Users, Coins, Edit, Trash2 } from "lucide-react"
import { useState } from "react"

interface Organization {
  id: string
  name: string
  description?: string
  users: number
  sp: number
  status: "active" | "inactive"
  createdAt: string
}

const initialOrganizations: Organization[] = [
  { id: "panjit", name: "強茂", description: "強茂股份有限公司", users: 45, sp: 800, status: "active", createdAt: "2024-01-01" },
  { id: "panjit-tech", name: "璟茂科技", description: "璟茂科技股份有限公司", users: 28, sp: 500, status: "active", createdAt: "2024-01-01" },
  { id: "ymoptics", name: "熒茂光學", description: "熒茂光學股份有限公司", users: 35, sp: 600, status: "active", createdAt: "2024-01-01" },
  { id: "panjit-wuxi", name: "強茂電子（無錫）", description: "強茂電子（無錫）有限公司", users: 52, sp: 700, status: "active", createdAt: "2024-01-15" },
  { id: "panjit-xuzhou", name: "強茂半導體（徐州）", description: "強茂半導體（徐州）有限公司", users: 38, sp: 550, status: "active", createdAt: "2024-01-15" },
  { id: "panjit-shandong", name: "山東強茂電子", description: "山東強茂電子有限公司", users: 40, sp: 450, status: "active", createdAt: "2024-02-01" },
  { id: "hge", name: "虹冠電子工業", description: "虹冠電子工業股份有限公司", users: 25, sp: 400, status: "active", createdAt: "2024-02-01" },
]

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>(initialOrganizations)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    sp: "",
    status: "active" as "active" | "inactive"
  })

  const handleCreateOrg = () => {
    const newOrg: Organization = {
      id: Date.now().toString(),
      name: formData.name,
      description: formData.description,
      users: 0,
      sp: parseInt(formData.sp) || 0,
      status: formData.status,
      createdAt: new Date().toISOString().split('T')[0]
    }
    setOrganizations([...organizations, newOrg])
    setFormData({ name: "", description: "", sp: "", status: "active" })
    setIsCreateDialogOpen(false)
  }

  const handleEditOrg = () => {
    if (!editingOrg) return
    const updatedOrgs = organizations.map(org => 
      org.id === editingOrg.id 
        ? { 
            ...org, 
            name: formData.name, 
            description: formData.description, 
            sp: parseInt(formData.sp) || 0, 
            status: formData.status 
          }
        : org
    )
    setOrganizations(updatedOrgs)
    setEditingOrg(null)
    setFormData({ name: "", description: "", sp: "", status: "active" })
    setIsEditDialogOpen(false)
  }

  const handleDeleteOrg = (id: string) => {
    setOrganizations(organizations.filter(org => org.id !== id))
  }

  const openEditDialog = (org: Organization) => {
    setEditingOrg(org)
    setFormData({
      name: org.name,
      description: org.description || "",
      sp: org.sp.toString(),
      status: org.status
    })
    setIsEditDialogOpen(true)
  }
  return (
    <AppLayout userRole="admin">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">組織管理</h1>
            <p className="text-muted-foreground">管理子公司與組織架構</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                新增組織
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新增組織</DialogTitle>
                <DialogDescription>建立新的子公司或組織單位</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">組織名稱</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="輸入組織名稱"
                  />
                </div>
                <div>
                  <Label htmlFor="description">描述</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="組織描述 (選填)"
                  />
                </div>
                <div>
                  <Label htmlFor="sp">SP 配額</Label>
                  <Input
                    id="sp"
                    type="number"
                    value={formData.sp}
                    onChange={(e) => setFormData({ ...formData, sp: e.target.value })}
                    placeholder="SP 配額"
                  />
                </div>
                <div>
                  <Label htmlFor="status">狀態</Label>
                  <Select value={formData.status} onValueChange={(value: "active" | "inactive") => setFormData({ ...formData, status: value })}>
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
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleCreateOrg}>
                    建立組織
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">組織總數</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{organizations.length}</div>
              <p className="text-xs text-muted-foreground">活躍組織</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">使用者總數</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {organizations.reduce((sum, org) => sum + org.users, 0)}
              </div>
              <p className="text-xs text-muted-foreground">跨所有組織</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">總 SP 配額</CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {organizations.reduce((sum, org) => sum + org.sp, 0)}
              </div>
              <p className="text-xs text-muted-foreground">2024 年度</p>
            </CardContent>
          </Card>
        </div>

        {/* Organizations Table */}
        <Card>
          <CardHeader>
            <CardTitle>組織列表</CardTitle>
            <CardDescription>所有註冊組織與配額資訊</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>組織名稱</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead className="text-center">使用者數</TableHead>
                  <TableHead className="text-right">SP 配額</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {org.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{org.description || "-"}</TableCell>
                    <TableCell className="text-center">{org.users}</TableCell>
                    <TableCell className="text-right font-semibold">{org.sp || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={org.status === "active" ? "outline" : "secondary"} 
                             className={org.status === "active" ? "border-chart-3 text-chart-3" : ""}>
                        {org.status === "active" ? "啟用" : "停用"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(org)}>
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
                                您確定要刪除「{org.name}」嗎？此操作無法復原。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteOrg(org.id)}>
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

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>編輯組織</DialogTitle>
              <DialogDescription>修改組織資訊</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">組織名稱</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="輸入組織名稱"
                />
              </div>
              <div>
                <Label htmlFor="edit-description">描述</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="組織描述 (選填)"
                />
              </div>
              <div>
                <Label htmlFor="edit-sp">SP 配額</Label>
                <Input
                  id="edit-sp"
                  type="number"
                  value={formData.sp}
                  onChange={(e) => setFormData({ ...formData, sp: e.target.value })}
                  placeholder="SP 配額"
                />
              </div>
              <div>
                <Label htmlFor="edit-status">狀態</Label>
                <Select value={formData.status} onValueChange={(value: "active" | "inactive") => setFormData({ ...formData, status: value })}>
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
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleEditOrg}>
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

"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Shield, Check, X, Save, RotateCcw, AlertTriangle, Lock } from "lucide-react"
import { useState } from "react"

interface Permission {
  module: string
  category: string
  description: string
  subsidiary: PermissionLevel
  admin: PermissionLevel
}

interface PermissionLevel {
  view: boolean
  create: boolean
  edit: boolean
  delete: boolean
}

const initialPermissions: Permission[] = [
  {
    module: "需求管理",
    category: "核心功能",
    description: "子公司需求提交與追蹤管理",
    subsidiary: { view: true, create: true, edit: true, delete: false },
    admin: { view: true, create: true, edit: true, delete: true },
  },
  {
    module: "需求評估",
    category: "核心功能",
    description: "需求審核與評估流程",
    subsidiary: { view: true, create: false, edit: false, delete: false },
    admin: { view: true, create: true, edit: true, delete: true },
  },
  {
    module: "SP 配額管理",
    category: "資源管理",
    description: "Story Point 預算分配與追蹤",
    subsidiary: { view: true, create: false, edit: false, delete: false },
    admin: { view: true, create: true, edit: true, delete: true },
  },
  {
    module: "使用者管理",
    category: "系統管理",
    description: "使用者帳號與角色權限管理",
    subsidiary: { view: false, create: false, edit: false, delete: false },
    admin: { view: true, create: true, edit: true, delete: true },
  },
  {
    module: "組織管理",
    category: "系統管理", 
    description: "子公司與組織架構設定",
    subsidiary: { view: false, create: false, edit: false, delete: false },
    admin: { view: true, create: true, edit: true, delete: true },
  },
  {
    module: "系統設定",
    category: "系統管理",
    description: "系統參數與配置管理",
    subsidiary: { view: false, create: false, edit: false, delete: false },
    admin: { view: true, create: true, edit: true, delete: true },
  }
]

const roleLabels = {
  subsidiary: "子公司使用者",
  admin: "系統管理員"
}

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>(() => JSON.parse(JSON.stringify(initialPermissions)))
  const [hasChanges, setHasChanges] = useState(false)

  const updatePermission = (moduleIndex: number, role: keyof Permission, action: keyof PermissionLevel, value: boolean) => {
    setPermissions(prevPermissions => {
      const newPermissions = prevPermissions.map((perm, index) => {
        if (index === moduleIndex) {
          return {
            ...perm,
            [role]: {
              ...(perm[role] as PermissionLevel),
              [action]: value
            }
          }
        }
        return perm
      })
      return newPermissions
    })
    setHasChanges(true)
  }

  const resetPermissions = () => {
    setPermissions(JSON.parse(JSON.stringify(initialPermissions)))
    setHasChanges(false)
  }

  const savePermissions = () => {
    setHasChanges(false)
  }

  return (
    <AppLayout userRole="admin">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">權限設定</h1>
            <p className="text-muted-foreground">管理角色權限與存取控制</p>
          </div>
          
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              onClick={resetPermissions}
              disabled={!hasChanges}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              重置
            </Button>
            <Button 
              onClick={savePermissions}
              disabled={!hasChanges}
            >
              <Save className="mr-2 h-4 w-4" />
              儲存變更
            </Button>
          </div>
        </div>

        {hasChanges && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="flex items-center gap-2 pt-4">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <p className="text-sm text-orange-700">您有未儲存的權限變更</p>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="matrix" className="w-full">
          <TabsList>
            <TabsTrigger value="matrix">權限矩陣</TabsTrigger>
            <TabsTrigger value="table">詳細表格</TabsTrigger>
            <TabsTrigger value="roles">角色總覽</TabsTrigger>
          </TabsList>

          <TabsContent value="matrix" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  <CardTitle>權限矩陣視圖</CardTitle>
                </div>
                <CardDescription>各角色對不同模組的操作權限</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {permissions.map((perm, index) => (
                    <div key={perm.module} className="space-y-3">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-foreground">{perm.module}</h3>
                        <Badge variant="outline">{perm.category}</Badge>
                        <p className="text-sm text-muted-foreground">{perm.description}</p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {Object.entries(roleLabels).map(([role, label]) => (
                          <Card key={`${perm.module}-${role}`} className="border-primary/30">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm">{label}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              {(['view', 'create', 'edit', 'delete'] as const).map((action) => (
                                <div key={`${perm.module}-${role}-${action}`} className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">
                                    {action === 'view' && '檢視'}
                                    {action === 'create' && '新增'}
                                    {action === 'edit' && '編輯'}
                                    {action === 'delete' && '刪除'}
                                  </span>
                                  <Switch
                                    checked={(perm[role as keyof Permission] as PermissionLevel)[action]}
                                    onCheckedChange={(checked) => updatePermission(index, role as keyof Permission, action, checked)}
                                    disabled={role === 'admin'}
                                  />
                                </div>
                              ))}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="table" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>權限詳細表格</CardTitle>
                <CardDescription>完整的權限設定對照表</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>模組</TableHead>
                      <TableHead>功能類別</TableHead>
                      <TableHead>子公司使用者</TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          系統管理員
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {permissions.map((perm) => (
                      <TableRow key={perm.module}>
                        <TableCell className="font-medium">{perm.module}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{perm.category}</Badge>
                        </TableCell>
                        {Object.entries(roleLabels).map(([role]) => (
                          <TableCell key={`${perm.module}-table-${role}`}>
                            <div className="flex space-x-1">
                              {(perm[role as keyof Permission] as PermissionLevel).view && <Badge className="text-xs">檢視</Badge>}
                              {(perm[role as keyof Permission] as PermissionLevel).create && <Badge className="text-xs">新增</Badge>}
                              {(perm[role as keyof Permission] as PermissionLevel).edit && <Badge className="text-xs">編輯</Badge>}
                              {(perm[role as keyof Permission] as PermissionLevel).delete && <Badge className="text-xs">刪除</Badge>}
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roles" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(roleLabels).map(([role, label]) => {
                const totalPermissions = permissions.reduce((total, perm) => {
                  const rolePerms = perm[role as keyof Permission] as PermissionLevel
                  return total + Object.values(rolePerms).filter(Boolean).length
                }, 0)

                return (
                  <Card key={role}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        {label}
                      </CardTitle>
                      <CardDescription>
                        總計 {totalPermissions} 項權限
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {permissions.map((perm) => {
                          const rolePerms = perm[role as keyof Permission] as PermissionLevel
                          const hasAnyPermission = Object.values(rolePerms).some(Boolean)
                          
                          if (!hasAnyPermission) return null
                          
                          return (
                            <div key={`${role}-overview-${perm.module}`} className="flex items-center justify-between">
                              <span className="text-sm font-medium">{perm.module}</span>
                              <div className="flex space-x-1">
                                {rolePerms.view && <Badge variant="outline" className="text-xs">檢視</Badge>}
                                {rolePerms.create && <Badge variant="outline" className="text-xs">新增</Badge>}
                                {rolePerms.edit && <Badge variant="outline" className="text-xs">編輯</Badge>}
                                {rolePerms.delete && <Badge variant="outline" className="text-xs">刪除</Badge>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>

        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-base">權限設計原則</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• <strong>子公司使用者：</strong>可提交與管理自己的需求，查看需求狀態與 SP 使用情況</p>
            <p>• <strong>系統管理員：</strong>完整系統管理權限，包含需求評估、使用者管理、組織管理與系統設定 (不可修改)</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

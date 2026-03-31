"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2, Users, Coins, Wallet, Edit, Loader2 } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Progress } from "@/components/ui/progress"

interface OrgRow {
  id: string
  code: string
  name: string
  fullName: string | null
  status: string
  userCount: number
  demandCount: number
  spQuota: number
  spUsed: number
}

interface Summary {
  orgCount: number
  totalUsers: number
  totalSpQuota: number
  totalSpUsed: number
  year: number
}

export default function SpManagementPage() {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [organizations, setOrganizations] = useState<OrgRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [editOrg, setEditOrg] = useState<OrgRow | null>(null)
  const [editQuota, setEditQuota] = useState("")
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch("/api/admin/organizations", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setOrganizations(data.organizations)
        setSummary(data.summary)
      }
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSaveQuota = async () => {
    if (!token || !editOrg) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: editOrg.id, spQuota: parseInt(editQuota) || 0 }),
      })
      if (res.ok) {
        setEditOrg(null)
        fetchData()
      }
    } catch { /* ignore */ } finally {
      setSaving(false)
    }
  }

  const openEdit = (org: OrgRow) => {
    setEditOrg(org)
    setEditQuota(String(org.spQuota))
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

  const totalAvailable = (summary?.totalSpQuota ?? 0) - (summary?.totalSpUsed ?? 0)

  return (
    <AppLayout userRole="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">SP 管理</h1>
          <p className="text-muted-foreground">管理各子公司 SP 配額與使用狀況</p>
        </div>

        {/* Summary */}
        {summary && (
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: "子公司數", sub: "活躍組織", value: summary.orgCount, color: "border-blue-500", icon: Building2 },
              { label: "使用者總數", sub: "跨所有組織", value: summary.totalUsers, color: "border-amber-500", icon: Users },
              { label: "SP 配額", sub: `${summary.year} 年度`, value: summary.totalSpQuota, color: "border-violet-500", icon: Coins },
              { label: "可用 SP", sub: `已用 ${summary.totalSpUsed}`, value: totalAvailable, color: "border-emerald-500", icon: Wallet },
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

        {/* Organizations Table */}
        <Card>
          <CardHeader>
            <CardTitle>各子公司 SP 配額</CardTitle>
            <CardDescription>{summary?.year} 年度 SP 配額與使用明細</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>子公司</TableHead>
                  <TableHead className="text-center">使用者</TableHead>
                  <TableHead className="text-center">需求數</TableHead>
                  <TableHead className="text-center">SP 配額</TableHead>
                  <TableHead className="text-center">已使用</TableHead>
                  <TableHead className="text-center w-[180px]">使用率</TableHead>
                  <TableHead className="text-center">狀態</TableHead>
                  <TableHead className="text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((org) => {
                  const pct = org.spQuota > 0 ? Math.round((org.spUsed / org.spQuota) * 100) : 0
                  const remaining = org.spQuota - org.spUsed
                  return (
                    <TableRow key={org.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <div className="font-medium">{org.name}</div>
                            {org.fullName && (
                              <div className="text-xs text-muted-foreground">{org.fullName}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{org.userCount}</TableCell>
                      <TableCell className="text-center">{org.demandCount}</TableCell>
                      <TableCell className="text-center font-semibold">{org.spQuota}</TableCell>
                      <TableCell className="text-center">{org.spUsed}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Progress value={pct} className="h-2" />
                          <div className="flex justify-between text-[11px] text-muted-foreground">
                            <span>{pct}%</span>
                            <span>剩餘 {remaining}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={org.status === "active" ? "outline" : "secondary"}
                          className={org.status === "active" ? "border-emerald-300 text-emerald-600" : ""}
                        >
                          {org.status === "active" ? "啟用" : "停用"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(org)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editOrg} onOpenChange={(open) => !open && setEditOrg(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>編輯 SP 配額</DialogTitle>
              <DialogDescription>
                調整「{editOrg?.name}」的 {summary?.year} 年度 SP 配額
              </DialogDescription>
            </DialogHeader>
            {editOrg && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <div className="text-muted-foreground text-xs">已使用</div>
                    <div className="font-bold text-lg">{editOrg.spUsed}</div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <div className="text-muted-foreground text-xs">剩餘</div>
                    <div className="font-bold text-lg">{(parseInt(editQuota) || 0) - editOrg.spUsed}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-quota">SP 配額</Label>
                  <Input
                    id="edit-quota"
                    type="number"
                    min={0}
                    value={editQuota}
                    onChange={(e) => setEditQuota(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditOrg(null)}>取消</Button>
                  <Button onClick={handleSaveQuota} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
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

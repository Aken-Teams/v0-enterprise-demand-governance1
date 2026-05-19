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
import { useRouter } from "next/navigation"
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
  const { token, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && user.role === "admin" && user.adminScopeType && user.adminScopeType !== "all") {
      router.replace("/governance/inbox")
    }
  }, [user, router])

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
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">SP 管理</h1>
          <p className="text-xs sm:text-base text-muted-foreground">管理各子公司 SP 配額與使用狀況</p>
        </div>

        {/* Summary */}
        {summary && (
          <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4">
            {[
              { label: "子公司數", sub: "活躍組織", value: summary.orgCount, color: "border-blue-500", icon: Building2 },
              { label: "使用者總數", sub: "跨所有組織", value: summary.totalUsers, color: "border-amber-500", icon: Users },
              { label: "SP 配額", sub: `${summary.year} 年度`, value: summary.totalSpQuota, color: "border-violet-500", icon: Coins },
              { label: "可用 SP", sub: `已用 ${summary.totalSpUsed}`, value: totalAvailable, color: "border-emerald-500", icon: Wallet },
            ].map((item) => (
              <div key={item.label} className={`flex items-center gap-2 sm:gap-4 rounded-lg border-l-4 ${item.color} border bg-card p-2.5 sm:p-4`}>
                <span className="text-xl sm:text-3xl font-bold">{item.value}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <item.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                    <p className="font-medium text-xs sm:text-sm">{item.label}</p>
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Organizations Table */}
        <Card>
          <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
            <CardTitle className="text-sm sm:text-base">各子公司 SP 配額</CardTitle>
            <CardDescription className="text-xs sm:text-sm">{summary?.year} 年度 SP 配額與使用明細</CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sm:text-sm">子公司</TableHead>
                  <TableHead className="text-center text-xs sm:text-sm hidden md:table-cell">使用者</TableHead>
                  <TableHead className="text-center text-xs sm:text-sm hidden md:table-cell">需求數</TableHead>
                  <TableHead className="text-center text-xs sm:text-sm">配額</TableHead>
                  <TableHead className="text-center text-xs sm:text-sm">已用</TableHead>
                  <TableHead className="text-center text-xs sm:text-sm w-[100px] sm:w-[180px] hidden sm:table-cell">使用率</TableHead>
                  <TableHead className="text-center text-xs sm:text-sm hidden sm:table-cell">狀態</TableHead>
                  <TableHead className="text-center text-xs sm:text-sm">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((org) => {
                  const pct = org.spQuota > 0 ? Math.round((org.spUsed / org.spQuota) * 100) : 0
                  const remaining = org.spQuota - org.spUsed
                  return (
                    <TableRow key={org.id}>
                      <TableCell className="px-2 sm:px-4">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium text-xs sm:text-sm truncate">{org.name}</div>
                            {org.fullName && (
                              <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{org.fullName}</div>
                            )}
                            {/* Mobile: show usage bar inline */}
                            <div className="sm:hidden mt-1">
                              <Progress value={pct} className="h-1.5" />
                              <span className="text-[10px] text-muted-foreground">{pct}% · 剩餘 {remaining}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs sm:text-sm hidden md:table-cell">{org.userCount}</TableCell>
                      <TableCell className="text-center text-xs sm:text-sm hidden md:table-cell">{org.demandCount}</TableCell>
                      <TableCell className="text-center text-xs sm:text-sm font-semibold px-1 sm:px-4">{org.spQuota}</TableCell>
                      <TableCell className="text-center text-xs sm:text-sm px-1 sm:px-4">{org.spUsed}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="space-y-1">
                          <Progress value={pct} className="h-2" />
                          <div className="flex justify-between text-[11px] text-muted-foreground">
                            <span>{pct}%</span>
                            <span>剩餘 {remaining}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center hidden sm:table-cell">
                        <Badge
                          variant={org.status === "active" ? "outline" : "secondary"}
                          className={org.status === "active" ? "border-emerald-300 text-emerald-600" : ""}
                        >
                          {org.status === "active" ? "啟用" : "停用"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center px-1 sm:px-4">
                        <Button variant="ghost" size="sm" className="h-7 w-7 sm:h-8 sm:w-8 p-0" onClick={() => openEdit(org)}>
                          <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
          <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">編輯 SP 配額</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                調整「{editOrg?.name}」的 {summary?.year} 年度 SP 配額
              </DialogDescription>
            </DialogHeader>
            {editOrg && (
              <div className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:gap-3 text-sm">
                  <div className="rounded-lg bg-muted/50 p-2.5 sm:p-3 text-center">
                    <div className="text-muted-foreground text-[10px] sm:text-xs">已使用</div>
                    <div className="font-bold text-base sm:text-lg">{editOrg.spUsed}</div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2.5 sm:p-3 text-center">
                    <div className="text-muted-foreground text-[10px] sm:text-xs">剩餘</div>
                    <div className="font-bold text-base sm:text-lg">{(parseInt(editQuota) || 0) - editOrg.spUsed}</div>
                  </div>
                </div>
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="edit-quota" className="text-xs sm:text-sm">SP 配額</Label>
                  <Input
                    id="edit-quota"
                    type="number"
                    min={0}
                    value={editQuota}
                    onChange={(e) => setEditQuota(e.target.value)}
                    className="h-8 sm:h-10 text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" className="h-8 sm:h-9 text-xs sm:text-sm" onClick={() => setEditOrg(null)}>取消</Button>
                  <Button size="sm" className="h-8 sm:h-9 text-xs sm:text-sm" onClick={handleSaveQuota} disabled={saving}>
                    {saving && <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin mr-1.5" />}
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

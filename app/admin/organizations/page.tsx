"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2, Users, Coins, Wallet, Edit, Loader2, Code2, Plus, Pencil } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface VendorWallet {
  vendor: string
  totalQuota: number
  usedSp: number
}

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
  vendorWallets: VendorWallet[]
}

interface VendorSummary {
  vendor: string
  totalQuota: number
  usedSp: number
  availableSp: number
}

interface Summary {
  orgCount: number
  totalUsers: number
  totalSpQuota: number
  totalSpUsed: number
  year: number
  byVendor?: VendorSummary[]
}

interface VendorInfo {
  name: string
  demandCount: number
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
  const [editQuotas, setEditQuotas] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Vendor management
  const [vendors, setVendors] = useState<VendorInfo[]>([])
  const [addVendorOpen, setAddVendorOpen] = useState(false)
  const [addVendorName, setAddVendorName] = useState("")
  const [addVendorSaving, setAddVendorSaving] = useState(false)
  const [addVendorError, setAddVendorError] = useState("")
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameOld, setRenameOld] = useState("")
  const [renameNew, setRenameNew] = useState("")
  const [renameSaving, setRenameSaving] = useState(false)
  const [renameError, setRenameError] = useState("")

  // Add org
  const [addOrgOpen, setAddOrgOpen] = useState(false)
  const [addOrgCode, setAddOrgCode] = useState("")
  const [addOrgName, setAddOrgName] = useState("")
  const [addOrgFullName, setAddOrgFullName] = useState("")
  const [addOrgSaving, setAddOrgSaving] = useState(false)
  const [addOrgError, setAddOrgError] = useState("")

  const vendorOptions = vendors.map((v) => v.name)

  const fetchData = useCallback(async () => {
    if (!token) return
    try {
      const [orgRes, vendorRes] = await Promise.all([
        fetch("/api/admin/organizations", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/vendors", { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const orgData = await orgRes.json()
      const vendorData = await vendorRes.json()
      if (orgRes.ok) {
        setOrganizations(orgData.organizations)
        setSummary(orgData.summary)
      }
      if (vendorRes.ok && vendorData.vendors) {
        setVendors(vendorData.vendors)
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
      const vList = Object.keys(editQuotas)
      for (const vendor of vList) {
        const spQuota = parseInt(editQuotas[vendor]) || 0
        await fetch("/api/admin/organizations", {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ id: editOrg.id, vendor, spQuota }),
        })
      }
      setEditOrg(null)
      fetchData()
    } catch { /* ignore */ } finally {
      setSaving(false)
    }
  }

  const openEdit = (org: OrgRow) => {
    setEditOrg(org)
    const quotas: Record<string, string> = {}
    for (const v of vendorOptions) {
      const w = org.vendorWallets.find((ww) => ww.vendor === v)
      quotas[v] = String(w?.totalQuota ?? 0)
    }
    setEditQuotas(quotas)
  }

  const handleAddOrg = async () => {
    if (!token || !addOrgCode.trim() || !addOrgName.trim()) return
    setAddOrgSaving(true)
    setAddOrgError("")
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ code: addOrgCode.trim(), name: addOrgName.trim(), fullName: addOrgFullName.trim() || undefined }),
      })
      const data = await res.json()
      if (res.ok) {
        setAddOrgOpen(false)
        setAddOrgCode("")
        setAddOrgName("")
        setAddOrgFullName("")
        fetchData()
      } else {
        setAddOrgError(data.error || "新增失敗")
      }
    } catch {
      setAddOrgError("網路錯誤")
    } finally {
      setAddOrgSaving(false)
    }
  }

  const handleAddVendor = async () => {
    if (!token || !addVendorName.trim()) return
    setAddVendorSaving(true)
    setAddVendorError("")
    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: addVendorName.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setAddVendorOpen(false)
        setAddVendorName("")
        fetchData()
      } else {
        setAddVendorError(data.error || "新增失敗")
      }
    } catch {
      setAddVendorError("網路錯誤")
    } finally {
      setAddVendorSaving(false)
    }
  }

  const handleRename = async () => {
    if (!token || !renameNew.trim()) return
    setRenameSaving(true)
    setRenameError("")
    try {
      const res = await fetch("/api/vendors", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ oldName: renameOld, newName: renameNew.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setRenameOpen(false)
        fetchData()
      } else {
        setRenameError(data.error || "重新命名失敗")
      }
    } catch {
      setRenameError("網路錯誤")
    } finally {
      setRenameSaving(false)
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

  const totalAvailable = (summary?.totalSpQuota ?? 0) - (summary?.totalSpUsed ?? 0)

  return (
    <AppLayout userRole="admin">
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">組織管理</h1>
          <p className="text-xs sm:text-base text-muted-foreground">管理各子公司 SP 配額、開發商與使用狀況</p>
        </div>

        {/* Summary */}
        {summary && (
          <TooltipProvider>
            <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4">
              {[
                { label: "子公司數", sub: "活躍組織", value: summary.orgCount, color: "border-blue-500", icon: Building2 },
                { label: "使用者總數", sub: "跨所有組織", value: summary.totalUsers, color: "border-amber-500", icon: Users },
                { label: "SP 配額", sub: `${summary.year} 年度`, value: summary.totalSpQuota, color: "border-violet-500", icon: Coins,
                  tooltip: summary.byVendor && summary.byVendor.length > 1 ? summary.byVendor.map(v => `${v.vendor}: ${v.totalQuota}`) : undefined },
                { label: "可用 SP", sub: `已用 ${summary.totalSpUsed}`, value: totalAvailable, color: "border-emerald-500", icon: Wallet,
                  tooltip: summary.byVendor && summary.byVendor.length > 1
                    ? summary.byVendor.map(v => `${v.vendor}: 可用 ${v.availableSp} / 已用 ${v.usedSp}`)
                    : undefined },
              ].map((item) => {
                const card = (
                  <div className={`flex items-center gap-2 sm:gap-4 rounded-lg border-l-4 ${item.color} border bg-card p-2.5 sm:p-4`}>
                    <span className="text-xl sm:text-3xl font-bold">{item.value}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 sm:gap-1.5">
                        <item.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                        <p className="font-medium text-xs sm:text-sm">{item.label}</p>
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{item.sub}</p>
                    </div>
                  </div>
                )
                if (item.tooltip) {
                  return (
                    <Tooltip key={item.label}>
                      <TooltipTrigger asChild>{card}</TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs space-y-0.5">
                        {item.tooltip.map((line, i) => <div key={i}>{line}</div>)}
                      </TooltipContent>
                    </Tooltip>
                  )
                }
                return <div key={item.label}>{card}</div>
              })}
            </div>
          </TooltipProvider>
        )}

        {/* Organizations Table */}
        <Card>
          <CardHeader className="px-4 py-3 sm:px-6 sm:py-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm sm:text-base">各子公司 SP 配額</CardTitle>
              <CardDescription className="text-xs sm:text-sm">{summary?.year} 年度 SP 配額與使用明細</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="h-7 sm:h-8 text-xs sm:text-sm" onClick={() => { setAddOrgCode(""); setAddOrgName(""); setAddOrgFullName(""); setAddOrgError(""); setAddOrgOpen(true) }}>
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
              新增
            </Button>
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
                      <TableCell className="text-center text-xs sm:text-sm px-1 sm:px-4">
                        <div className="font-semibold">{org.spQuota}</div>
                        {vendorOptions.length > 1 && org.vendorWallets.length > 0 && (
                          <div className="text-[10px] text-muted-foreground">
                            {org.vendorWallets.map(w => `${w.vendor}: ${w.totalQuota}`).join(" / ")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-xs sm:text-sm px-1 sm:px-4">
                        <div>{org.spUsed}</div>
                        {vendorOptions.length > 1 && org.vendorWallets.length > 0 && (
                          <div className="text-[10px] text-muted-foreground">
                            {org.vendorWallets.map(w => `${w.vendor}: ${w.usedSp}`).join(" / ")}
                          </div>
                        )}
                      </TableCell>
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

        {/* Vendor Management */}
        <Card>
          <CardHeader className="px-4 py-3 sm:px-6 sm:py-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm sm:text-base">開發商管理</CardTitle>
              <CardDescription className="text-xs sm:text-sm">新增、重新命名開發商</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="h-7 sm:h-8 text-xs sm:text-sm" onClick={() => { setAddVendorName(""); setAddVendorError(""); setAddVendorOpen(true) }}>
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
              新增
            </Button>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sm:text-sm">開發商名稱</TableHead>
                  <TableHead className="text-center text-xs sm:text-sm">需求數</TableHead>
                  <TableHead className="text-center text-xs sm:text-sm w-16">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">
                      尚無開發商
                    </TableCell>
                  </TableRow>
                ) : (
                  vendors.map((v) => (
                    <TableRow key={v.name}>
                      <TableCell className="px-2 sm:px-4">
                        <div className="flex items-center gap-2">
                          <Code2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium text-xs sm:text-sm">{v.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs sm:text-sm">{v.demandCount}</TableCell>
                      <TableCell className="text-center px-1 sm:px-4">
                        <Button variant="ghost" size="sm" className="h-7 w-7 sm:h-8 sm:w-8 p-0" onClick={() => { setRenameOld(v.name); setRenameNew(v.name); setRenameError(""); setRenameOpen(true) }}>
                          <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit SP Quota Dialog */}
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
                    <div className="font-bold text-base sm:text-lg">
                      {Object.values(editQuotas).reduce((s, v) => s + (parseInt(v) || 0), 0) - editOrg.spUsed}
                    </div>
                  </div>
                </div>
                {vendorOptions.length > 1 ? (
                  <div className="space-y-3">
                    {vendorOptions.map((vendor) => {
                      const w = editOrg.vendorWallets.find(ww => ww.vendor === vendor)
                      return (
                        <div key={vendor} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs sm:text-sm">{vendor} SP 配額</Label>
                            {w && <span className="text-[10px] text-muted-foreground">已用 {w.usedSp}</span>}
                          </div>
                          <Input
                            type="number"
                            min={0}
                            value={editQuotas[vendor] || "0"}
                            onChange={(e) => setEditQuotas(prev => ({ ...prev, [vendor]: e.target.value }))}
                            className="h-8 sm:h-10 text-sm"
                          />
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="edit-quota" className="text-xs sm:text-sm">SP 配額</Label>
                    <Input
                      id="edit-quota"
                      type="number"
                      min={0}
                      value={editQuotas[vendorOptions[0] || "JV"] || "0"}
                      onChange={(e) => setEditQuotas(prev => ({ ...prev, [vendorOptions[0] || "JV"]: e.target.value }))}
                      className="h-8 sm:h-10 text-sm"
                    />
                  </div>
                )}
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

        {/* Add Vendor Dialog */}
        <Dialog open={addVendorOpen} onOpenChange={setAddVendorOpen}>
          <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-sm p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">新增開發商</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                輸入新開發商的名稱
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="add-vendor-name" className="text-xs sm:text-sm">開發商名稱</Label>
                <Input
                  id="add-vendor-name"
                  value={addVendorName}
                  onChange={(e) => setAddVendorName(e.target.value)}
                  placeholder="例如：JV"
                  className="h-8 sm:h-10 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && handleAddVendor()}
                />
              </div>
              {addVendorError && <p className="text-xs text-destructive">{addVendorError}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" className="h-8 sm:h-9 text-xs sm:text-sm" onClick={() => setAddVendorOpen(false)}>取消</Button>
                <Button size="sm" className="h-8 sm:h-9 text-xs sm:text-sm" onClick={handleAddVendor} disabled={addVendorSaving || !addVendorName.trim()}>
                  {addVendorSaving && <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin mr-1.5" />}
                  新增
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Rename Vendor Dialog */}
        <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
          <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-sm p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">重新命名開發商</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                將「{renameOld}」重新命名，所有相關需求和 SP 配額將一併更新
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="rename-vendor" className="text-xs sm:text-sm">新名稱</Label>
                <Input
                  id="rename-vendor"
                  value={renameNew}
                  onChange={(e) => setRenameNew(e.target.value)}
                  className="h-8 sm:h-10 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && handleRename()}
                />
              </div>
              {renameError && <p className="text-xs text-destructive">{renameError}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" className="h-8 sm:h-9 text-xs sm:text-sm" onClick={() => setRenameOpen(false)}>取消</Button>
                <Button size="sm" className="h-8 sm:h-9 text-xs sm:text-sm" onClick={handleRename} disabled={renameSaving || !renameNew.trim() || renameNew.trim() === renameOld}>
                  {renameSaving && <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin mr-1.5" />}
                  儲存
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Organization Dialog */}
        <Dialog open={addOrgOpen} onOpenChange={setAddOrgOpen}>
          <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-sm p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">新增子公司</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                建立新的子公司組織
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="add-org-code" className="text-xs sm:text-sm">代碼</Label>
                <Input
                  id="add-org-code"
                  value={addOrgCode}
                  onChange={(e) => setAddOrgCode(e.target.value)}
                  placeholder="例如：panjit"
                  className="h-8 sm:h-10 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="add-org-name" className="text-xs sm:text-sm">簡稱</Label>
                <Input
                  id="add-org-name"
                  value={addOrgName}
                  onChange={(e) => setAddOrgName(e.target.value)}
                  placeholder="例如：強茂"
                  className="h-8 sm:h-10 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="add-org-fullname" className="text-xs sm:text-sm">全名（選填）</Label>
                <Input
                  id="add-org-fullname"
                  value={addOrgFullName}
                  onChange={(e) => setAddOrgFullName(e.target.value)}
                  placeholder="例如：強茂股份有限公司"
                  className="h-8 sm:h-10 text-sm"
                />
              </div>
              {addOrgError && <p className="text-xs text-destructive">{addOrgError}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" className="h-8 sm:h-9 text-xs sm:text-sm" onClick={() => setAddOrgOpen(false)}>取消</Button>
                <Button size="sm" className="h-8 sm:h-9 text-xs sm:text-sm" onClick={handleAddOrg} disabled={addOrgSaving || !addOrgCode.trim() || !addOrgName.trim()}>
                  {addOrgSaving && <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin mr-1.5" />}
                  新增
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}

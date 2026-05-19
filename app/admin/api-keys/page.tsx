"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/hooks/use-auth"
import { KeyRound, Copy, Trash2, Plus, Loader2, AlertTriangle, CheckCircle } from "lucide-react"
import { useState, useEffect, useCallback } from "react"

interface ApiKeyRow {
  id: string
  prefix: string
  name: string
  createdBy: { id: string; name: string; email: string }
  createdAt: string
  revokedAt: string | null
  lastUsedAt: string | null
  isActive: boolean
}

export default function ApiKeysPage() {
  const { token } = useAuth()
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [creatingKey, setCreatingKey] = useState(false)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [showKeyDialogOpen, setShowKeyDialogOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const fetchApiKeys = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch("/api/admin/api-keys", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setApiKeys(data.apiKeys)
      }
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchApiKeys() }, [fetchApiKeys])

  const handleCreateKey = async () => {
    if (!token || !newKeyName.trim()) return
    setCreatingKey(true)
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setCreatedKey(data.key)
        setCreateDialogOpen(false)
        setShowKeyDialogOpen(true)
        setNewKeyName("")
        fetchApiKeys()
      }
    } catch { /* ignore */ } finally {
      setCreatingKey(false)
    }
  }

  const handleRevokeKey = async (id: string) => {
    if (!token) return
    setRevokingId(id)
    try {
      const res = await fetch(`/api/admin/api-keys/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) fetchApiKeys()
    } catch { /* ignore */ } finally {
      setRevokingId(null)
    }
  }

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <AppLayout userRole="admin">
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">API 金鑰管理</h1>
            <p className="text-xs sm:text-base text-muted-foreground">管理外部系統存取用的 API 金鑰</p>
          </div>
          <Button size="sm" className="h-8 sm:h-9 text-xs sm:text-sm shrink-0" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            建立金鑰
          </Button>
        </div>

        <Card>
          <CardContent className="pt-4 sm:pt-6 px-2 sm:px-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="text-center py-8 sm:py-12 text-muted-foreground">
                <KeyRound className="mx-auto h-8 w-8 sm:h-12 sm:w-12 mb-2 sm:mb-3 opacity-30" />
                <p className="text-sm sm:text-lg">尚未建立任何 API 金鑰</p>
                <p className="text-xs sm:text-sm mt-1">建立金鑰後，外部系統可透過 API 存取需求文件</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm">名稱</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden sm:table-cell">前綴</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden md:table-cell">建立者</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden md:table-cell">建立時間</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden sm:table-cell">最後使用</TableHead>
                    <TableHead className="text-xs sm:text-sm">狀態</TableHead>
                    <TableHead className="text-xs sm:text-sm text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="px-2 sm:px-4">
                        <div className="font-medium text-xs sm:text-sm">{k.name}</div>
                        {/* Mobile: show prefix & creator inline */}
                        <div className="sm:hidden text-[10px] text-muted-foreground mt-0.5">
                          <code className="bg-muted px-1 py-0.5 rounded font-mono">{k.prefix}...</code>
                          <span className="ml-1.5">{k.createdBy.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <code className="text-xs sm:text-sm bg-muted px-1.5 py-0.5 rounded font-mono">{k.prefix}...</code>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm text-muted-foreground hidden md:table-cell">{k.createdBy.name}</TableCell>
                      <TableCell className="text-xs sm:text-sm text-muted-foreground hidden md:table-cell">
                        {new Date(k.createdAt).toLocaleDateString("zh-TW")}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm text-muted-foreground hidden sm:table-cell">
                        {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString("zh-TW") : "未使用"}
                      </TableCell>
                      <TableCell className="px-1 sm:px-4">
                        {k.isActive ? (
                          <Badge variant="outline" className="border-emerald-300 text-emerald-600 text-[10px] sm:text-xs">啟用</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] sm:text-xs">已撤銷</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right px-1 sm:px-4">
                        {k.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            disabled={revokingId === k.id}
                            onClick={() => handleRevokeKey(k.id)}
                          >
                            {revokingId === k.id ? (
                              <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6 text-xs sm:text-sm text-muted-foreground space-y-2 sm:space-y-3">
            <h4 className="font-semibold text-xs sm:text-sm text-foreground">API 使用方式</h4>
            <div className="grid gap-1.5 sm:gap-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-0">
                <span className="font-medium text-foreground shrink-0">查詢文件</span>
                <code className="sm:ml-2 bg-muted px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs break-all">GET /api/external/demands/REQ-2026-001/documents</code>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-0">
                <span className="font-medium text-foreground shrink-0">預覽文件</span>
                <code className="sm:ml-2 bg-muted px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs break-all">GET /api/external/documents/&#123;docId&#125;/preview</code>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-0">
                <span className="font-medium text-foreground shrink-0">下載文件</span>
                <code className="sm:ml-2 bg-muted px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs break-all">GET /api/external/documents/&#123;docId&#125;/download</code>
              </div>
              <div className="border-t pt-1.5 sm:pt-2 flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-0">
                <span className="font-medium text-foreground shrink-0">認證方式</span>
                <span className="sm:ml-2">在 HTTP Header 加上</span>
                <code className="sm:ml-1 bg-muted px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs">X-API-Key: gvk_xxxxx...</code>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Key Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">建立 API 金鑰</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">為外部系統建立一組 API 金鑰，金鑰建立後只會顯示一次。</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 sm:space-y-2">
            <Label htmlFor="keyName" className="text-xs sm:text-sm">金鑰名稱</Label>
            <Input
              id="keyName"
              placeholder="例如：ERP 系統、考核平台"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateKey()}
              className="h-8 sm:h-10 text-sm"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" className="h-8 sm:h-9 text-xs sm:text-sm" onClick={() => setCreateDialogOpen(false)}>取消</Button>
            <Button size="sm" className="h-8 sm:h-9 text-xs sm:text-sm" onClick={handleCreateKey} disabled={creatingKey || !newKeyName.trim()}>
              {creatingKey && <Loader2 className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4 animate-spin" />}
              建立
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show Created Key Dialog */}
      <Dialog open={showKeyDialogOpen} onOpenChange={(open) => { if (!open) { setShowKeyDialogOpen(false); setCreatedKey(null) } }}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">金鑰已建立</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 sm:space-y-3">
            <div className="rounded-md border border-orange-200 bg-orange-50 p-2.5 sm:p-3">
              <div className="flex items-center gap-1.5 sm:gap-2 text-orange-700">
                <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <p className="text-xs sm:text-sm font-medium">此金鑰只會顯示一次，請立即複製保存</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-muted p-2 sm:p-3 text-[10px] sm:text-sm font-mono">{createdKey}</code>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => createdKey && copyToClipboard(createdKey)}>
                {copied ? <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" /> : <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" className="h-8 sm:h-9 text-xs sm:text-sm" onClick={() => { setShowKeyDialogOpen(false); setCreatedKey(null) }}>關閉</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

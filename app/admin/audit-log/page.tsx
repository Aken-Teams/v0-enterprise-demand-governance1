"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Search, ChevronLeft, ChevronRight, FileText } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface AuditLog {
  id: string
  userId: string | null
  action: string
  entity: string
  entityId: string
  demandId: string | null
  details: string | null
  ipAddress: string | null
  createdAt: string
  user: { id: string; name: string; email: string } | null
  demand: { id: string; demandNumber: string; title: string } | null
}

const ENTITY_LABELS: Record<string, string> = {
  DEMAND: "需求",
  DOCUMENT: "文件",
  SIGNOFF: "簽核",
  SUB_TASK: "子任務",
  COMMENT: "留言",
  USER: "使用者",
  ORGANIZATION: "組織",
  SHARE: "分享連結",
  ACCESS: "權限",
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: "建立",
  UPDATE: "更新",
  DELETE: "刪除",
  STATUS_CHANGE: "狀態變更",
  SIGNOFF_REQUEST: "發起簽核",
  SIGNOFF_APPROVE: "簽核通過",
  SIGNOFF_REJECT: "簽核退回",
  SIGNOFF_SKIP: "略過簽核",
  UPLOAD: "上傳",
  ASSIGN: "指派",
  GRANT: "授權",
  REVOKE: "撤銷",
  LOGIN: "登入",
  LOGOUT: "登出",
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-emerald-100 text-emerald-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  STATUS_CHANGE: "bg-violet-100 text-violet-700",
  SIGNOFF_REQUEST: "bg-amber-100 text-amber-700",
  SIGNOFF_APPROVE: "bg-emerald-100 text-emerald-700",
  SIGNOFF_REJECT: "bg-red-100 text-red-700",
  SIGNOFF_SKIP: "bg-gray-100 text-gray-600",
  UPLOAD: "bg-cyan-100 text-cyan-700",
  ASSIGN: "bg-indigo-100 text-indigo-700",
  GRANT: "bg-purple-100 text-purple-700",
  REVOKE: "bg-orange-100 text-orange-700",
  LOGIN: "bg-sky-100 text-sky-700",
  LOGOUT: "bg-slate-100 text-slate-600",
}

function formatDetails(details: string | null): Record<string, unknown> | null {
  if (!details) return null
  try { return JSON.parse(details) }
  catch { return null }
}

const DETAIL_KEY_LABELS: Record<string, string> = {
  name: "名稱",
  email: "電子郵件",
  role: "角色",
  organizationId: "組織",
  organization: "組織",
  fields: "變更欄位",
  passwordChanged: "密碼變更",
  deletedUserId: "刪除的使用者 ID",
  demandNumber: "需求編號",
  title: "標題",
  managerId: "管理者",
  developerId: "開發者",
  fromStatus: "原狀態",
  toStatus: "新狀態",
  fileName: "檔案名稱",
  fileSize: "檔案大小",
  type: "文件類型",
  isInternal: "內部留言",
  phase: "簽核階段",
  action: "操作",
  token: "分享令牌",
  expiresAt: "到期時間",
  shareId: "分享連結 ID",
  demands: "授權需求",
  demandIds: "需求列表",
  count: "數量",
  spQuota: "SP 預算",
}

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "已提交",
  APPROVED: "已立案",
  IN_PROGRESS: "開發中",
  TESTING: "測試中",
  ACCEPTANCE: "驗收中",
  COMPLETED: "已完成",
  CLOSED: "已結案",
  REJECTED: "已退回",
}

const ROLE_LABELS_MAP: Record<string, string> = {
  admin: "管理員",
  delivery: "交付團隊",
  subsidiary: "需求單位",
}

const PHASE_LABELS: Record<string, string> = {
  CASE_OPEN: "開案確認",
  DEVELOPMENT_COMPLETE: "開發完成確認",
  TESTING_COMPLETE: "測試完成確認",
  ACCEPTANCE: "驗收確認",
}

const DOC_TYPE_LABELS: Record<string, string> = {
  REQUIREMENTS: "需求規格",
  DESIGN: "設計文件",
  DEVELOPMENT: "開發文件",
  TESTING: "測試文件",
  ACCEPTANCE: "驗收文件",
  OTHER: "其他",
}

const FIELD_LABELS: Record<string, string> = {
  title: "標題",
  description: "描述",
  priority: "優先順序",
  estimatedSP: "預估 SP",
  actualSP: "實際 SP",
  managerId: "管理者",
  developerId: "開發者",
  status: "狀態",
  expectedDate: "預期日期",
  name: "名稱",
  progress: "進度",
  assigneeId: "負責人",
}

function formatDetailValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "boolean") return value ? "是" : "否"
  if (key === "fromStatus" || key === "toStatus") return STATUS_LABELS[String(value)] || String(value)
  if (key === "role") return ROLE_LABELS_MAP[String(value)] || String(value)
  if (key === "phase") return PHASE_LABELS[String(value)] || String(value)
  if (key === "type") return DOC_TYPE_LABELS[String(value)] || String(value)
  if (key === "action") return ACTION_LABELS[String(value)] || String(value)
  if (key === "fileSize" && typeof value === "number") {
    if (value < 1024) return `${value} B`
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
    return `${(value / 1024 / 1024).toFixed(1)} MB`
  }
  if (key === "fields" && Array.isArray(value)) {
    return value.map((f) => FIELD_LABELS[String(f)] || String(f)).join("、")
  }
  if (key === "demandIds" && Array.isArray(value)) return `${value.length} 筆`
  if (key === "expiresAt") {
    try { return new Date(String(value)).toLocaleString("zh-TW") } catch { return String(value) }
  }
  return String(value)
}

export default function AuditLogPage() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && user.role === "admin" && user.adminScopeType && user.adminScopeType !== "all") {
      router.replace("/governance/inbox")
    }
  }, [user, router])

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const limit = 10

  // Filters
  const [filterEntity, setFilterEntity] = useState("")
  const [filterAction, setFilterAction] = useState("")
  const [filterDateFrom, setFilterDateFrom] = useState("")
  const [filterDateTo, setFilterDateTo] = useState("")

  // Detail dialog
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  const fetchLogs = useCallback(async () => {
    const token = localStorage.getItem("auth_token")
    if (!token) { setLoading(false); return }
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("limit", String(limit))
      if (filterEntity) params.set("entity", filterEntity)
      if (filterAction) params.set("action", filterAction)
      if (filterDateFrom) params.set("dateFrom", filterDateFrom)
      if (filterDateTo) params.set("dateTo", filterDateTo)

      const res = await fetch(`/api/admin/audit-log?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        if (data.logs) { setLogs(data.logs); setTotal(data.total) }
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [page, filterEntity, filterAction, filterDateFrom, filterDateTo])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const totalPages = Math.ceil(total / limit)

  const handleSearch = () => { setPage(1); fetchLogs() }

  const clearFilters = () => {
    setFilterEntity("")
    setFilterAction("")
    setFilterDateFrom("")
    setFilterDateTo("")
    setPage(1)
  }

  return (
    <AppLayout userRole="admin">
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">操作紀錄</h1>
          <p className="text-xs sm:text-base text-muted-foreground mt-1">查看系統所有操作的完整紀錄</p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-3 sm:pt-6 px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-x-2 gap-y-2 sm:gap-4">
              <div className="space-y-0.5 sm:space-y-1.5">
                <Label className="text-[10px] sm:text-xs text-muted-foreground">種類</Label>
                <Select value={filterEntity || "__all__"} onValueChange={(v) => setFilterEntity(v === "__all__" ? "" : v)}>
                  <SelectTrigger className="h-8 sm:h-9 w-full text-xs sm:text-sm px-2 sm:px-3">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">全部</SelectItem>
                    {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5 sm:space-y-1.5">
                <Label className="text-[10px] sm:text-xs text-muted-foreground">操作類型</Label>
                <Select value={filterAction || "__all__"} onValueChange={(v) => setFilterAction(v === "__all__" ? "" : v)}>
                  <SelectTrigger className="h-8 sm:h-9 w-full text-xs sm:text-sm px-2 sm:px-3">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">全部</SelectItem>
                    {Object.entries(ACTION_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5 sm:space-y-1.5">
                <Label className="text-[10px] sm:text-xs text-muted-foreground">起始日期</Label>
                <Input
                  type="date"
                  className="h-8 sm:h-9 w-full sm:w-40 text-xs sm:text-sm px-2 sm:px-3"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-0.5 sm:space-y-1.5">
                <Label className="text-[10px] sm:text-xs text-muted-foreground">結束日期</Label>
                <Input
                  type="date"
                  className="h-8 sm:h-9 w-full sm:w-40 text-xs sm:text-sm px-2 sm:px-3"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 col-span-2 sm:col-span-1">
                <Button size="sm" className="h-8 sm:h-9 text-xs sm:text-sm flex-1 sm:flex-none" onClick={handleSearch}>
                  <Search className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" />
                  搜尋
                </Button>
                <Button size="sm" variant="ghost" className="h-8 sm:h-9 text-xs sm:text-sm" onClick={clearFilters}>
                  清除
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardContent className="pt-4 sm:pt-6 px-2 sm:px-6">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <p className="py-8 sm:py-12 text-center text-xs sm:text-sm text-muted-foreground">沒有符合條件的操作紀錄</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 sm:pb-3 pr-2 sm:pr-4 font-medium text-muted-foreground">時間</th>
                      <th className="pb-2 sm:pb-3 pr-2 sm:pr-4 font-medium text-muted-foreground">操作者</th>
                      <th className="pb-2 sm:pb-3 pr-2 sm:pr-4 font-medium text-muted-foreground">操作</th>
                      <th className="pb-2 sm:pb-3 pr-2 sm:pr-4 font-medium text-muted-foreground hidden sm:table-cell">種類</th>
                      <th className="pb-2 sm:pb-3 pr-2 sm:pr-4 font-medium text-muted-foreground hidden md:table-cell">關聯需求</th>
                      <th className="pb-2 sm:pb-3 font-medium text-muted-foreground">詳情</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const details = formatDetails(log.details)
                      return (
                        <tr key={log.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                          <td className="py-2 sm:py-3 pr-2 sm:pr-4 whitespace-nowrap text-[10px] sm:text-xs text-muted-foreground">
                            {new Date(log.createdAt).toLocaleString("zh-TW", {
                              month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
                            })}
                          </td>
                          <td className="py-2 sm:py-3 pr-2 sm:pr-4 whitespace-nowrap text-xs sm:text-sm">
                            {log.user?.name || "—"}
                            {/* Mobile: show entity type inline */}
                            <div className="sm:hidden text-[10px] text-muted-foreground">
                              {ENTITY_LABELS[log.entity] || log.entity}
                              {log.demand && <span className="ml-1 text-primary">{log.demand.demandNumber}</span>}
                            </div>
                          </td>
                          <td className="py-2 sm:py-3 pr-2 sm:pr-4">
                            <span className={cn("inline-block rounded px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium", ACTION_COLORS[log.action] || "bg-gray-100 text-gray-600")}>
                              {ACTION_LABELS[log.action] || log.action}
                            </span>
                          </td>
                          <td className="py-2 sm:py-3 pr-2 sm:pr-4 whitespace-nowrap text-xs hidden sm:table-cell">
                            {ENTITY_LABELS[log.entity] || log.entity}
                          </td>
                          <td className="py-2 sm:py-3 pr-2 sm:pr-4 whitespace-nowrap text-xs hidden md:table-cell">
                            {log.demand ? (
                              <span className="text-primary">{log.demand.demandNumber}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2 sm:py-3">
                            {details ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 sm:h-6 sm:w-auto p-0 sm:px-2 text-xs"
                                onClick={() => setSelectedLog(log)}
                              >
                                <FileText className="h-3 w-3 sm:mr-1" />
                                <span className="hidden sm:inline">查看</span>
                              </Button>
                            ) : (
                              <span className="text-[10px] sm:text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 sm:pt-4 border-t mt-3 sm:mt-4">
                <span className="text-[10px] sm:text-xs text-muted-foreground">
                  共 {total} 筆，第 {page}/{totalPages} 頁
                </span>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Button variant="outline" size="sm" className="h-7 w-7 sm:h-8 sm:w-8 p-0" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 w-7 sm:h-8 sm:w-8 p-0" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                    <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={!!selectedLog} onOpenChange={(open) => { if (!open) setSelectedLog(null) }}>
          <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[80vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">操作詳情</DialogTitle>
            </DialogHeader>
            {selectedLog && (() => {
              const details = formatDetails(selectedLog.details)
              return (
                <div className="space-y-3 sm:space-y-4 mt-2">
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                    <div>
                      <span className="text-muted-foreground">時間</span>
                      <p className="font-medium">{new Date(selectedLog.createdAt).toLocaleString("zh-TW")}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">操作者</span>
                      <p className="font-medium">{selectedLog.user?.name || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">操作</span>
                      <p>
                        <span className={cn("inline-block rounded px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium", ACTION_COLORS[selectedLog.action] || "bg-gray-100 text-gray-600")}>
                          {ACTION_LABELS[selectedLog.action] || selectedLog.action}
                        </span>
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">種類</span>
                      <p className="font-medium">{ENTITY_LABELS[selectedLog.entity] || selectedLog.entity}</p>
                    </div>
                    {selectedLog.demand && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">關聯需求</span>
                        <p className="font-medium text-xs sm:text-sm">{selectedLog.demand.demandNumber} — {selectedLog.demand.title}</p>
                      </div>
                    )}
                  </div>
                  {details && (
                    <>
                      <div className="border-t pt-3 sm:pt-4">
                        <span className="text-xs sm:text-sm font-medium text-foreground">詳細資料</span>
                      </div>
                      <div className="space-y-2 sm:space-y-2.5">
                        {Object.entries(details)
                          .filter(([key]) => {
                            // Hide count when demands are present
                            if (key === "count" && ("demands" in details)) return false
                            return true
                          })
                          .map(([key, value]) => {
                          // demands list — handle both array (new) and string (old "、"-joined) format
                          if (key === "demands" && value) {
                            const items: string[] = Array.isArray(value)
                              ? value.map(String)
                              : String(value).split("、").filter(Boolean)
                            if (items.length > 0) {
                              return (
                                <div key={key} className="text-xs sm:text-sm">
                                  <span className="text-muted-foreground">{DETAIL_KEY_LABELS[key] || key}</span>
                                  <div className="mt-1 sm:mt-1.5 space-y-1">
                                    {items.map((item, i) => (
                                      <div key={i} className="flex items-center gap-1.5 sm:gap-2 rounded bg-muted/50 px-2 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium">
                                        <FileText className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0 text-muted-foreground" />
                                        {item}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )
                            }
                          }
                          return (
                            <div key={key} className="flex items-baseline justify-between gap-2 sm:gap-4 text-xs sm:text-sm">
                              <span className="text-muted-foreground shrink-0">{DETAIL_KEY_LABELS[key] || key}</span>
                              <span className="text-right font-medium break-all">{formatDetailValue(key, value)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}

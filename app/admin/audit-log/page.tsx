"use client"

import { useState, useEffect, useCallback } from "react"
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
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const limit = 30

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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">操作紀錄</h1>
          <p className="text-muted-foreground mt-1">查看系統所有操作的完整紀錄</p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">種類</Label>
                <select
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={filterEntity}
                  onChange={(e) => setFilterEntity(e.target.value)}
                >
                  <option value="">全部</option>
                  {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">操作類型</Label>
                <select
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                >
                  <option value="">全部</option>
                  {Object.entries(ACTION_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">起始日期</Label>
                <Input
                  type="date"
                  className="h-9 w-40"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">結束日期</Label>
                <Input
                  type="date"
                  className="h-9 w-40"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                />
              </div>
              <Button size="sm" onClick={handleSearch}>
                <Search className="h-3.5 w-3.5 mr-1.5" />
                搜尋
              </Button>
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                清除
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">沒有符合條件的操作紀錄</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 pr-4 font-medium text-muted-foreground">時間</th>
                      <th className="pb-3 pr-4 font-medium text-muted-foreground">操作者</th>
                      <th className="pb-3 pr-4 font-medium text-muted-foreground">操作</th>
                      <th className="pb-3 pr-4 font-medium text-muted-foreground">種類</th>
                      <th className="pb-3 pr-4 font-medium text-muted-foreground">關聯需求</th>
                      <th className="pb-3 font-medium text-muted-foreground">詳情</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const details = formatDetails(log.details)
                      return (
                        <tr key={log.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                          <td className="py-3 pr-4 whitespace-nowrap text-xs text-muted-foreground">
                            {new Date(log.createdAt).toLocaleString("zh-TW", {
                              month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
                            })}
                          </td>
                          <td className="py-3 pr-4 whitespace-nowrap">
                            {log.user?.name || "—"}
                          </td>
                          <td className="py-3 pr-4">
                            <span className={cn("inline-block rounded px-2 py-0.5 text-xs font-medium", ACTION_COLORS[log.action] || "bg-gray-100 text-gray-600")}>
                              {ACTION_LABELS[log.action] || log.action}
                            </span>
                          </td>
                          <td className="py-3 pr-4 whitespace-nowrap text-xs">
                            {ENTITY_LABELS[log.entity] || log.entity}
                          </td>
                          <td className="py-3 pr-4 whitespace-nowrap text-xs">
                            {log.demand ? (
                              <span className="text-primary">{log.demand.demandNumber}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3">
                            {details ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => setSelectedLog(log)}
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                查看
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
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
              <div className="flex items-center justify-between pt-4 border-t mt-4">
                <span className="text-xs text-muted-foreground">
                  共 {total} 筆，第 {page}/{totalPages} 頁
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={!!selectedLog} onOpenChange={(open) => { if (!open) setSelectedLog(null) }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>操作詳情</DialogTitle>
            </DialogHeader>
            {selectedLog && (() => {
              const details = formatDetails(selectedLog.details)
              return (
                <div className="space-y-4 mt-2">
                  <div className="grid grid-cols-2 gap-3 text-sm">
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
                        <span className={cn("inline-block rounded px-2 py-0.5 text-xs font-medium", ACTION_COLORS[selectedLog.action] || "bg-gray-100 text-gray-600")}>
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
                        <p className="font-medium">{selectedLog.demand.demandNumber} — {selectedLog.demand.title}</p>
                      </div>
                    )}
                  </div>
                  {details && (
                    <div>
                      <span className="text-sm text-muted-foreground">詳細資料</span>
                      <div className="mt-1.5 rounded-md bg-muted/50 p-3 overflow-x-auto">
                        <table className="text-xs w-full">
                          <tbody>
                            {Object.entries(details).map(([key, value]) => (
                              <tr key={key} className="border-b last:border-b-0">
                                <td className="py-1.5 pr-4 font-medium text-muted-foreground whitespace-nowrap align-top">
                                  {DETAIL_KEY_LABELS[key] || key}
                                </td>
                                <td className="py-1.5 break-all">
                                  {formatDetailValue(key, value)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
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

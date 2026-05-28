"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Loader2, ChevronLeft, ChevronRight, Mail, CheckCircle, XCircle,
  Settings, Network, X, Plus, Save, Pencil, Calendar,
} from "lucide-react"
import { toast } from "sonner"
import { LdapTreePicker, type LdapSelectedMember } from "@/components/admin/ldap-tree-picker"

/* ───────── Types ───────── */

interface MailLogItem {
  id: string
  type: string
  status: string
  toAddresses: string
  ccAddresses: string | null
  subject: string
  errorMessage: string | null
  demandId: string | null
  sentById: string | null
  createdAt: string
  sentBy: { id: string; name: string } | null
  demand: { id: string; demandNumber: string; title: string } | null
}

interface OrgEmailSetting {
  organizationId: string
  orgName: string
  orgCode: string
  signoffCcList: string[]
  accountingEmail: string
  reportSendDay: number
}

const TYPE_LABELS: Record<string, string> = {
  SIGNOFF_NOTIFY: "簽核通知",
  MONTHLY_REPORT: "月度報表",
}
const TYPE_COLORS: Record<string, string> = {
  SIGNOFF_NOTIFY: "bg-blue-100 text-blue-700",
  MONTHLY_REPORT: "bg-violet-100 text-violet-700",
}

function parseJsonArray(str: string | null): string[] {
  if (!str) return []
  try { return JSON.parse(str) } catch { return [] }
}

/* ───────── Main Page ───────── */

export default function MailLogsPage() {
  const { user, token } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("logs")

  useEffect(() => {
    if (user && user.role === "admin" && user.adminScopeType && user.adminScopeType !== "all") {
      router.replace("/governance/inbox")
    }
  }, [user, router])

  return (
    <AppLayout userRole="admin">
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">郵件管理</h1>
          <p className="text-xs sm:text-base text-muted-foreground mt-1">查看郵件發送紀錄及管理通知設定</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="logs" className="gap-1 sm:gap-1.5 text-xs sm:text-sm"><Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />發送紀錄</TabsTrigger>
            <TabsTrigger value="settings" className="gap-1 sm:gap-1.5 text-xs sm:text-sm"><Settings className="h-3 w-3 sm:h-3.5 sm:w-3.5" />郵件設定</TabsTrigger>
          </TabsList>

          <TabsContent value="logs" className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
            <MailLogsTab token={token} />
          </TabsContent>

          <TabsContent value="settings" className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
            <MailSettingsTab token={token} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}

/* ───────── Tab 1: 發送紀錄 (Calendar View) ───────── */

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"]

function MailLogsTab({ token }: { token: string | null }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-based
  const [logs, setLogs] = useState<MailLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedLog, setSelectedLog] = useState<MailLogItem | null>(null)
  const [filterType, setFilterType] = useState("")

  // Fetch all logs for the displayed month
  const fetchLogs = useCallback(async () => {
    if (!token) { setLoading(false); return }
    setLoading(true)
    try {
      const dateFrom = `${year}-${String(month + 1).padStart(2, "0")}-01`
      const lastDay = new Date(year, month + 1, 0).getDate()
      const dateTo = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
      const params = new URLSearchParams({
        page: "1", pageSize: "200", dateFrom, dateTo,
      })
      if (filterType) params.set("type", filterType)
      const res = await fetch(`/api/admin/mail-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [token, year, month, filterType])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  // Group logs by day
  const logsByDay = useMemo(() => {
    const map: Record<number, MailLogItem[]> = {}
    for (const log of logs) {
      const d = new Date(log.createdAt)
      const day = d.getDate()
      if (!map[day]) map[day] = []
      map[day].push(log)
    }
    return map
  }, [logs])

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDow = new Date(year, month, 1).getDay() // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: (number | null)[] = []
    // Leading empty cells
    for (let i = 0; i < firstDow; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    // Trailing to fill last row
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [year, month])

  const goMonth = (delta: number) => {
    let m = month + delta
    let y = year
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setYear(y)
    setMonth(m)
    setSelectedDay(null)
  }

  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
  const todayDay = today.getDate()

  // Logs for selected day
  const selectedDayLogs = selectedDay ? (logsByDay[selectedDay] || []) : []

  // Summary counts
  const totalSuccess = logs.filter((l) => l.status === "SUCCESS").length
  const totalFailed = logs.filter((l) => l.status === "FAILED").length

  return (
    <>
      <Card>
        <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
          {/* Calendar Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <Button variant="outline" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => goMonth(-1)}>
                <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
              <h3 className="text-sm sm:text-lg font-semibold min-w-[100px] sm:min-w-[120px] text-center">
                {year} 年 {month + 1} 月
              </h3>
              <Button variant="outline" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => goMonth(1)}>
                <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
              {!isCurrentMonth && (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDay(null) }}>
                  今天
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Filter */}
              <Select value={filterType || "_all"} onValueChange={(v) => { setFilterType(v === "_all" ? "" : v); setSelectedDay(null) }}>
                <SelectTrigger className="h-7 sm:h-8 w-[100px] sm:w-[120px] text-[10px] sm:text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">全部類型</SelectItem>
                  <SelectItem value="SIGNOFF_NOTIFY">簽核通知</SelectItem>
                  <SelectItem value="MONTHLY_REPORT">月度報表</SelectItem>
                </SelectContent>
              </Select>
              {/* Summary */}
              <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500" />{totalSuccess} 成功</span>
                {totalFailed > 0 && <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500" />{totalFailed} 失敗</span>}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAY_LABELS.map((label, i) => (
                  <div key={i} className={`text-center text-xs font-medium py-2 ${i === 0 || i === 6 ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
                    {label}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, idx) => {
                  const dayLogs = day ? (logsByDay[day] || []) : []
                  const hasSignoff = dayLogs.some((l) => l.type === "SIGNOFF_NOTIFY")
                  const hasReport = dayLogs.some((l) => l.type === "MONTHLY_REPORT")
                  const hasFailure = dayLogs.some((l) => l.status === "FAILED")
                  const allSuccess = dayLogs.length > 0 && dayLogs.every((l) => l.status === "SUCCESS")
                  const isToday = isCurrentMonth && day === todayDay
                  const isSelected = day === selectedDay

                  if (!day) {
                    return <div key={idx} className="min-h-[52px] sm:min-h-[80px]" />
                  }

                  return (
                    <div
                      key={idx}
                      className={[
                        "border border-border/40 rounded-md min-h-[52px] sm:min-h-[80px] p-1 sm:p-1.5 transition-colors relative",
                        "cursor-pointer hover:bg-muted/40",
                        isSelected ? "bg-blue-50 ring-2 ring-blue-400 ring-inset border-blue-300" : "",
                      ].join(" ")}
                      onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                    >
                      {/* Day Number */}
                      <div className={[
                        "text-[11px] sm:text-sm font-medium mb-0.5 sm:mb-1",
                        isToday ? "bg-blue-600 text-white rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-[10px] sm:text-sm" : "",
                        !isToday && idx % 7 === 0 ? "text-red-400" : "",
                        !isToday && idx % 7 === 6 ? "text-blue-400" : "",
                      ].join(" ")}>
                        {day}
                      </div>
                      {/* Event Indicators */}
                      {dayLogs.length > 0 && (
                        <div className="space-y-0.5">
                          {hasSignoff && (
                            <div className="flex items-center gap-0.5 sm:gap-1">
                              <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-blue-500 shrink-0" />
                              <span className="text-[8px] sm:text-[10px] text-blue-600 truncate">
                                <span className="hidden sm:inline">簽核 </span>{dayLogs.filter((l) => l.type === "SIGNOFF_NOTIFY").length}
                              </span>
                            </div>
                          )}
                          {hasReport && (
                            <div className="flex items-center gap-0.5 sm:gap-1">
                              <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-violet-500 shrink-0" />
                              <span className="text-[8px] sm:text-[10px] text-violet-600 truncate">
                                <span className="hidden sm:inline">月報 </span>{dayLogs.filter((l) => l.type === "MONTHLY_REPORT").length}
                              </span>
                            </div>
                          )}
                          {hasFailure && (
                            <div className="flex items-center gap-0.5 sm:gap-1">
                              <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-red-500 shrink-0" />
                              <span className="text-[8px] sm:text-[10px] text-red-600"><span className="hidden sm:inline">失敗 </span>{dayLogs.filter((l) => l.status === "FAILED").length}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {/* Success checkmark for all-success days */}
                      {allSuccess && !hasFailure && (
                        <div className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5">
                          <CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-emerald-400" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-2 sm:gap-4 mt-2 sm:mt-3 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500" />簽核通知</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-violet-500" />月度報表</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500" />失敗</span>
                <span className="flex items-center gap-1"><CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-emerald-400" />全部成功</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Selected Day Detail */}
      {selectedDay && (
        <Card>
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h4 className="font-semibold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                {year}/{month + 1}/{selectedDay} 發送紀錄
                <Badge variant="secondary" className="text-[10px] sm:text-xs">{selectedDayLogs.length} 封</Badge>
              </h4>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedDay(null)}>
                <X className="h-3 w-3 mr-1" />關閉
              </Button>
            </div>
            {selectedDayLogs.length === 0 ? (
              <p className="text-xs sm:text-sm text-muted-foreground py-4 text-center">當日無發送紀錄</p>
            ) : (
              <div className="space-y-1.5 sm:space-y-2">
                {selectedDayLogs.map((log) => {
                  const toList = parseJsonArray(log.toAddresses)
                  return (
                    <div
                      key={log.id}
                      className="flex items-center gap-1.5 sm:gap-3 p-2 sm:p-3 rounded-lg border hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setSelectedLog(log)}
                    >
                      {/* Type Badge */}
                      <span className={`shrink-0 inline-block rounded px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium ${TYPE_COLORS[log.type] || "bg-gray-100 text-gray-600"}`}>
                        {TYPE_LABELS[log.type] || log.type}
                      </span>
                      {/* Time */}
                      <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">
                        {new Date(log.createdAt).toLocaleString("zh-TW", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {/* Subject */}
                      <span className="text-xs sm:text-sm truncate flex-1 min-w-0">{log.subject}</span>
                      {/* To - hidden on mobile */}
                      <span className="hidden sm:inline text-xs text-muted-foreground shrink-0 max-w-[160px] truncate">
                        {toList[0] || "—"}{toList.length > 1 && ` +${toList.length - 1}`}
                      </span>
                      {/* Status */}
                      {log.status === "SUCCESS" ? (
                        <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500 shrink-0" />
                      )}
                      {/* Sender - hidden on mobile */}
                      <span className="hidden sm:inline text-xs text-muted-foreground shrink-0">{log.sentBy?.name || "系統"}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => { if (!open) setSelectedLog(null) }}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[80vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader><DialogTitle className="text-base sm:text-lg">郵件詳情</DialogTitle></DialogHeader>
          {selectedLog && (() => {
            const toList = parseJsonArray(selectedLog.toAddresses)
            const ccList = parseJsonArray(selectedLog.ccAddresses)
            return (
              <div className="space-y-3 sm:space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                  <div>
                    <span className="text-muted-foreground">時間</span>
                    <p className="font-medium">{new Date(selectedLog.createdAt).toLocaleString("zh-TW")}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">類型</span>
                    <p><span className={`inline-block rounded px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium ${TYPE_COLORS[selectedLog.type] || "bg-gray-100 text-gray-600"}`}>{TYPE_LABELS[selectedLog.type] || selectedLog.type}</span></p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">狀態</span>
                    <p>
                      {selectedLog.status === "SUCCESS"
                        ? <Badge variant="outline" className="text-[10px] sm:text-xs border-emerald-300 text-emerald-700 bg-emerald-50"><CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />成功</Badge>
                        : <Badge variant="outline" className="text-[10px] sm:text-xs border-red-300 text-red-700 bg-red-50"><XCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />失敗</Badge>}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">寄件者</span>
                    <p className="font-medium">{selectedLog.sentBy?.name || "系統排程"}</p>
                  </div>
                </div>
                <div className="border-t pt-3 sm:pt-4 space-y-2 sm:space-y-3 text-xs sm:text-sm">
                  <div>
                    <span className="text-muted-foreground">主旨</span>
                    <p className="font-medium">{selectedLog.subject}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">收件者</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {toList.map((email) => <Badge key={email} variant="secondary" className="text-xs">{email}</Badge>)}
                    </div>
                  </div>
                  {ccList.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">副本 (CC)</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {ccList.map((email) => <Badge key={email} variant="outline" className="text-xs">{email}</Badge>)}
                      </div>
                    </div>
                  )}
                  {selectedLog.demand && (
                    <div>
                      <span className="text-muted-foreground">關聯需求</span>
                      <p className="font-medium">{selectedLog.demand.demandNumber} — {selectedLog.demand.title}</p>
                    </div>
                  )}
                  {selectedLog.errorMessage && (
                    <div>
                      <span className="text-muted-foreground text-red-600">錯誤訊息</span>
                      <p className="text-red-700 bg-red-50 rounded px-3 py-2 text-xs mt-1 font-mono">{selectedLog.errorMessage}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ───────── Tab 2: 郵件設定 ───────── */

function MailSettingsTab({ token }: { token: string | null }) {
  const [settings, setSettings] = useState<OrgEmailSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  // Edit dialog
  const [editTarget, setEditTarget] = useState<OrgEmailSetting | null>(null)
  const [editCcList, setEditCcList] = useState<string[]>([])
  const [editAccEmail, setEditAccEmail] = useState("")
  const [editSendDay, setEditSendDay] = useState(5)

  // AD picker
  const [ldapPickerOpen, setLdapPickerOpen] = useState(false)
  const [ldapPickerField, setLdapPickerField] = useState<"cc" | "accounting">("cc")

  const loadSettings = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch("/api/admin/email-settings", { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const { settings: s, organizations } = data as {
        settings: { organizationId: string; signoffCcList: string | null; accountingEmail: string | null; reportSendDay: number }[]
        organizations: { id: string; code: string; name: string }[]
      }
      const merged: OrgEmailSetting[] = organizations.map((org) => {
        const found = s.find((x) => x.organizationId === org.id)
        let ccList: string[] = []
        if (found?.signoffCcList) { try { ccList = JSON.parse(found.signoffCcList) } catch { /* */ } }
        return {
          organizationId: org.id, orgName: org.name, orgCode: org.code,
          signoffCcList: ccList, accountingEmail: found?.accountingEmail || "", reportSendDay: found?.reportSendDay ?? 5,
        }
      })
      setSettings(merged)
    } catch { toast.error("載入郵件設定失敗") }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { loadSettings() }, [loadSettings])

  const openEdit = (s: OrgEmailSetting) => {
    setEditTarget(s)
    setEditCcList([...s.signoffCcList])
    setEditAccEmail(s.accountingEmail)
    setEditSendDay(s.reportSendDay)
  }

  const handleSave = async () => {
    if (!token || !editTarget) return
    setSaving(editTarget.organizationId)
    try {
      const res = await fetch("/api/admin/email-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          organizationId: editTarget.organizationId,
          signoffCcList: editCcList.filter(Boolean),
          accountingEmail: editAccEmail || null,
          reportSendDay: editSendDay,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "儲存失敗") }
      toast.success(`${editTarget.orgName} 郵件設定已儲存`)
      // Update local state
      setSettings((prev) =>
        prev.map((s) =>
          s.organizationId === editTarget.organizationId
            ? { ...s, signoffCcList: editCcList.filter(Boolean), accountingEmail: editAccEmail, reportSendDay: editSendDay }
            : s
        )
      )
      setEditTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "儲存失敗")
    } finally { setSaving(null) }
  }

  const openLdapPicker = (field: "cc" | "accounting") => {
    setLdapPickerField(field)
    setLdapPickerOpen(true)
  }

  const handleLdapSelect = async (member: LdapSelectedMember) => {
    setLdapPickerOpen(false)
    // Fetch email from LDAP user lookup
    let email = ""
    try {
      const res = await fetch(
        `/api/admin/ldap/user?username=${encodeURIComponent(member.username)}&domain=${encodeURIComponent(member.domain)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      )
      if (res.ok) {
        const data = await res.json()
        email = data?.user?.mail || ""
      }
    } catch { /* ignore */ }

    if (!email) {
      toast.error(`無法取得 ${member.displayName} 的 Email`)
      return
    }

    if (ldapPickerField === "cc") {
      if (!editCcList.includes(email)) {
        setEditCcList((prev) => [...prev, email])
        toast.success(`已新增 CC：${email}`)
      } else {
        toast.info("此 Email 已在 CC 名單中")
      }
    } else {
      setEditAccEmail(email)
      toast.success(`已設定會計 Email：${email}`)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /><span className="ml-2 text-muted-foreground">載入中...</span></div>
  }

  if (settings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Mail className="h-10 w-10 mx-auto mb-3 opacity-30 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">尚無組織資料，請先至組織管理新增組織</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 sm:pb-3 pr-2 sm:pr-4 font-medium text-muted-foreground">組織</th>
                  <th className="pb-2 sm:pb-3 pr-2 sm:pr-4 font-medium text-muted-foreground hidden sm:table-cell">簽核通知 CC</th>
                  <th className="pb-2 sm:pb-3 pr-2 sm:pr-4 font-medium text-muted-foreground hidden sm:table-cell">會計 Email</th>
                  <th className="pb-2 sm:pb-3 pr-2 sm:pr-4 font-medium text-muted-foreground">寄送日</th>
                  <th className="pb-2 sm:pb-3 font-medium text-muted-foreground">操作</th>
                </tr>
              </thead>
              <tbody>
                {settings.map((s) => (
                  <tr key={s.organizationId} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                    <td className="py-2 sm:py-3 pr-2 sm:pr-4">
                      <div>
                        <span className="font-medium text-xs sm:text-sm">{s.orgName}</span>
                        <Badge variant="outline" className="ml-1 sm:ml-2 text-[10px] sm:text-xs">{s.orgCode}</Badge>
                      </div>
                      {/* Mobile: show CC & email inline */}
                      <div className="sm:hidden mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                        <div>CC: {s.signoffCcList.filter(Boolean).length > 0 ? s.signoffCcList.filter(Boolean).join(", ") : "未設定"}</div>
                        <div>會計: {s.accountingEmail || "未設定"}</div>
                      </div>
                    </td>
                    <td className="py-2 sm:py-3 pr-2 sm:pr-4 hidden sm:table-cell">
                      {s.signoffCcList.filter(Boolean).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {s.signoffCcList.filter(Boolean).map((email) => (
                            <Badge key={email} variant="secondary" className="text-xs">{email}</Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">未設定</span>
                      )}
                    </td>
                    <td className="py-2 sm:py-3 pr-2 sm:pr-4 text-xs hidden sm:table-cell">
                      {s.accountingEmail || <span className="text-muted-foreground">未設定</span>}
                    </td>
                    <td className="py-2 sm:py-3 pr-2 sm:pr-4 text-[10px] sm:text-xs whitespace-nowrap">每月 {s.reportSendDay} 號</td>
                    <td className="py-2 sm:py-3">
                      <Button size="sm" variant="ghost" className="h-7 w-7 sm:h-7 sm:w-auto p-0 sm:px-2 text-xs" onClick={() => openEdit(s)}>
                        <Pencil className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">編輯</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null) }}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">
              編輯郵件設定 — {editTarget?.orgName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 sm:space-y-5 mt-2">
            {/* CC List */}
            <div className="space-y-1 sm:space-y-2">
              <Label className="text-xs sm:text-sm">簽核通知 CC 名單</Label>
              <div className="rounded-md border p-2 sm:p-3 space-y-2">
                {editCcList.filter(Boolean).length > 0 && (
                  <div className="flex flex-wrap gap-1 sm:gap-1.5">
                    {editCcList.filter(Boolean).map((email) => (
                      <Badge key={email} variant="secondary" className="text-[10px] sm:text-xs gap-0.5 sm:gap-1">
                        {email}
                        <button type="button" onClick={() => setEditCcList((prev) => prev.filter((e) => e !== email))} className="hover:text-destructive">
                          <X className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-1.5 sm:gap-2">
                  <Input
                    id="cc-manual-input"
                    placeholder="輸入 Email 並按 Enter"
                    className="flex-1 h-8 text-xs sm:text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        const input = e.currentTarget
                        const email = input.value.trim()
                        if (email && email.includes("@") && !editCcList.includes(email)) {
                          setEditCcList((prev) => [...prev, email])
                          input.value = ""
                        }
                      }
                    }}
                  />
                  <Button
                    type="button" size="sm" variant="outline" className="h-8 w-8 p-0 shrink-0"
                    onClick={() => {
                      const input = document.getElementById("cc-manual-input") as HTMLInputElement
                      if (!input) return
                      const email = input.value.trim()
                      if (email && email.includes("@") && !editCcList.includes(email)) {
                        setEditCcList((prev) => [...prev, email])
                        input.value = ""
                      }
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-8 text-[10px] sm:text-xs shrink-0 px-2 sm:px-3" onClick={() => openLdapPicker("cc")}>
                    <Network className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1" /><span className="hidden sm:inline">瀏覽 AD</span>
                  </Button>
                </div>
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">寄送簽核通知時會自動 CC 這些人</p>
            </div>

            {/* Accounting Email */}
            <div className="space-y-1 sm:space-y-2">
              <Label className="text-xs sm:text-sm">會計 Email</Label>
              <div className="flex gap-1.5 sm:gap-2">
                <Input
                  type="email"
                  placeholder="accounting@example.com"
                  value={editAccEmail}
                  onChange={(e) => setEditAccEmail(e.target.value)}
                  className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
                />
                <Button type="button" size="sm" variant="outline" className="h-8 sm:h-9 text-[10px] sm:text-xs shrink-0 px-2 sm:px-3" onClick={() => openLdapPicker("accounting")}>
                  <Network className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1" /><span className="hidden sm:inline">瀏覽 AD</span>
                </Button>
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">每月 SP 報表寄送至此信箱</p>
            </div>

            {/* Report Send Day */}
            <div className="space-y-1 sm:space-y-2">
              <Label className="text-xs sm:text-sm">月報寄送日</Label>
              <Select value={String(editSendDay)} onValueChange={(v) => setEditSendDay(Number(v))}>
                <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>每月 {d} 號</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] sm:text-xs text-muted-foreground">每月此日自動寄送 SP 月報給會計</p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-3 sm:mt-4">
            <Button variant="outline" size="sm" className="h-8 sm:h-9 text-xs sm:text-sm" onClick={() => setEditTarget(null)}>取消</Button>
            <Button size="sm" className="h-8 sm:h-9 text-xs sm:text-sm" onClick={handleSave} disabled={saving === editTarget?.organizationId}>
              {saving === editTarget?.organizationId
                ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4 animate-spin" />儲存中...</>
                : <><Save className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />儲存</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LDAP Tree Picker */}
      <Dialog open={ldapPickerOpen} onOpenChange={setLdapPickerOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">
              {ldapPickerField === "cc" ? "新增 CC — 從 AD 選擇人員" : "選擇會計 — 從 AD 選擇人員"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0">
            <LdapTreePicker
              onSelectMember={handleLdapSelect}
              compact
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

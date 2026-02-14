"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Loader2, Code2, Search,
  Building2, Check, Circle, Play, Eye, CircleCheck,
  AlertTriangle, FileWarning, ChevronDown, Save, Upload,
} from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import {
  STATUS_MAP,
  PIPELINE_STEPS,
  PHASE_DOCUMENT_MAP,
  DOCUMENT_TYPE_LABELS,
} from "@/lib/constants/demand"

interface DemandDocument {
  id: string
  type: string
  phase: string | null
}

interface SubTask {
  id: string
  demandId: string
  name: string
  plannedStart: string | null
  plannedEnd: string | null
  actualStart: string | null
  actualEnd: string | null
  status: "pending" | "in_progress" | "completed"
  assignee: { id: string; name: string } | null
  order: number
}

interface DemandDetail {
  id: string
  demandNumber: string
  title: string
  status: string
  estimatedSp: number
  confirmedSp: number | null
  organization: { id: string; name: string }
  documents: DemandDocument[]
  subTasks: SubTask[]
}

type TaskEdit = {
  actualStart?: string | null
  actualEnd?: string | null
  status?: string
}

const TASK_STATUS_LABEL: Record<string, string> = {
  pending: "待處理",
  in_progress: "進行中",
  completed: "已完成",
}

const TASK_STATUS_ICON: Record<string, typeof Circle> = {
  pending: Circle,
  in_progress: Play,
  completed: Check,
}

const TASK_STATUS_COLOR: Record<string, string> = {
  pending: "text-muted-foreground",
  in_progress: "text-blue-600",
  completed: "text-emerald-600",
}

function getMissingDocs(demand: DemandDetail): string[] {
  const config = PHASE_DOCUMENT_MAP[demand.status]
  if (!config) return []
  return config.required.filter(
    (type) => !demand.documents.some((d) => d.phase === demand.status && d.type === type)
  )
}

function getTaskWarnings(tasks: SubTask[]): { noStart: number; noEnd: number } {
  let noStart = 0
  let noEnd = 0
  for (const t of tasks) {
    if (t.status !== "pending") {
      if (!t.actualStart) noStart++
    }
    if (t.status === "completed") {
      if (!t.actualEnd) noEnd++
    }
  }
  return { noStart, noEnd }
}

export default function DeliveryDashboardPage() {
  const { token, user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [allDemands, setAllDemands] = useState<DemandDetail[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [orgFilter, setOrgFilter] = useState("all")
  // { demandId: { taskId: { ...edits } } }
  const [pendingEdits, setPendingEdits] = useState<Record<string, Record<string, TaskEdit>>>({})
  const [savingDemand, setSavingDemand] = useState<string | null>(null)
  // Upload state
  const [uploadDemandId, setUploadDemandId] = useState<string | null>(null)
  const [uploadPhase, setUploadPhase] = useState("")
  const [uploadDocType, setUploadDocType] = useState("")
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    if (!token || !user?.id) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ developerId: user.id })
      const res = await fetch(`/api/demands?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()

      const allIds: string[] = data.demands
        .filter((d: { id: string; status: string }) => d.status !== "CLOSED")
        .map((d: { id: string }) => d.id)

      const details: DemandDetail[] = (
        await Promise.all(
          allIds.map(async (id) => {
            try {
              const r = await fetch(`/api/demands/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
              })
              if (r.ok) {
                const json = await r.json()
                return json.demand as DemandDetail
              }
            } catch { /* ignore */ }
            return null
          })
        )
      ).filter(Boolean) as DemandDetail[]

      setAllDemands(details)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [token, user?.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleExpand = (demandId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(demandId)) {
        next.delete(demandId)
        // Clear pending edits when collapsing
        setPendingEdits((p) => {
          const copy = { ...p }
          delete copy[demandId]
          return copy
        })
      } else {
        next.add(demandId)
      }
      return next
    })
  }

  const setTaskEdit = (demandId: string, taskId: string, field: keyof TaskEdit, value: string | null) => {
    setPendingEdits((prev) => ({
      ...prev,
      [demandId]: {
        ...(prev[demandId] || {}),
        [taskId]: {
          ...(prev[demandId]?.[taskId] || {}),
          [field]: value,
        },
      },
    }))
  }

  const getEditedValue = (demandId: string, task: SubTask, field: keyof TaskEdit) => {
    const edit = pendingEdits[demandId]?.[task.id]
    if (edit && field in edit) return edit[field]
    return task[field]
  }

  const hasPendingEdits = (demandId: string) => {
    const edits = pendingEdits[demandId]
    return edits && Object.keys(edits).length > 0
  }

  const handleSaveAll = async (demandId: string) => {
    if (!token) return
    const edits = pendingEdits[demandId]
    if (!edits || Object.keys(edits).length === 0) return

    setSavingDemand(demandId)
    try {
      const results = await Promise.all(
        Object.entries(edits).map(async ([taskId, updates]) => {
          const res = await fetch(`/api/demands/${demandId}/sub-tasks/${taskId}`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(updates),
          })
          return { taskId, updates, ok: res.ok }
        })
      )

      // Apply successful updates to local state
      setAllDemands((prev) =>
        prev.map((d) => {
          if (d.id !== demandId) return d
          return {
            ...d,
            subTasks: d.subTasks.map((t) => {
              const result = results.find((r) => r.taskId === t.id && r.ok)
              if (result) return { ...t, ...result.updates } as SubTask
              return t
            }),
          }
        })
      )

      // Clear pending edits for this demand
      setPendingEdits((prev) => {
        const copy = { ...prev }
        delete copy[demandId]
        return copy
      })
    } catch { /* ignore */ } finally {
      setSavingDemand(null)
    }
  }

  const openUploadDialog = (demandId: string) => {
    setUploadDemandId(demandId)
    setUploadError("")
    setSelectedFiles([])
    setUploadPhase("")
    setUploadDocType("")
  }

  const closeUploadDialog = () => {
    setUploadDemandId(null)
    setSelectedFiles([])
    setUploadError("")
    setUploadPhase("")
    setUploadDocType("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // When phase changes, reset doc type to first available for that phase
  const handlePhaseChange = (phase: string) => {
    setUploadPhase(phase)
    const config = PHASE_DOCUMENT_MAP[phase]
    const allTypes = [...(config?.required || []), ...(config?.optional || [])]
    if (!allTypes.includes("ATTACHMENT")) allTypes.push("ATTACHMENT")
    setUploadDocType(allTypes[0] || "ATTACHMENT")
  }

  const handleUpload = async () => {
    if (!token || !uploadDemandId || !uploadPhase || !uploadDocType || selectedFiles.length === 0) return
    setUploading(true)
    setUploadError("")
    try {
      const formData = new FormData()
      for (const file of selectedFiles) formData.append("files", file)
      formData.append("type", uploadDocType)
      formData.append("phase", uploadPhase)

      const res = await fetch(`/api/demands/${uploadDemandId}/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setUploadError(err.error || "上傳失敗")
        return
      }
      const json = await res.json()
      setAllDemands((prev) =>
        prev.map((d) => {
          if (d.id !== uploadDemandId) return d
          return { ...d, documents: [...d.documents, ...json.documents] }
        })
      )
      closeUploadDialog()
    } catch {
      setUploadError("上傳失敗")
    } finally {
      setUploading(false)
    }
  }

  // Client-side filtering
  const filteredDemands = allDemands.filter((d) => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false
    if (orgFilter !== "all" && d.organization.id !== orgFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!d.title.toLowerCase().includes(q) && !d.demandNumber.toLowerCase().includes(q) && !d.organization.name.toLowerCase().includes(q)) return false
    }
    return true
  })

  // Compute status counts for filter badges
  const statusCountMap: Record<string, number> = {}
  for (const d of allDemands) {
    statusCountMap[d.status] = (statusCountMap[d.status] || 0) + 1
  }

  // Unique organizations for filter
  const orgMap = new Map<string, string>()
  for (const d of allDemands) {
    if (!orgMap.has(d.organization.id)) orgMap.set(d.organization.id, d.organization.name)
  }
  const uniqueOrgs = Array.from(orgMap.entries()).sort((a, b) => a[1].localeCompare(b[1]))

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            我的專案
          </h1>
          <p className="text-muted-foreground">
            檢視指派給您的需求與開發進度
          </p>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-2 bg-muted/50 rounded-lg p-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜尋需求編號、名稱或子公司..."
              className="pl-9 h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部狀態 ({allDemands.length})</SelectItem>
              {PIPELINE_STEPS.map((s) => {
                const count = statusCountMap[s] || 0
                if (count === 0) return null
                return <SelectItem key={s} value={s}>{STATUS_MAP[s]?.label || s} ({count})</SelectItem>
              })}
            </SelectContent>
          </Select>
          <Select value={orgFilter} onValueChange={setOrgFilter}>
            <SelectTrigger className="h-9 w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部需求者</SelectItem>
              {uniqueOrgs.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Demand Cards */}
        <div>
          {loading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">載入中...</span>
              </CardContent>
            </Card>
          ) : filteredDemands.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Code2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">
                  {allDemands.length === 0 ? "目前沒有指派的需求" : "沒有符合條件的需求"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filteredDemands.map((demand) => {
                const totalTasks = demand.subTasks.length
                const completedTasks = demand.subTasks.filter(
                  (t) => t.status === "completed"
                ).length
                const missingDocs = getMissingDocs(demand)
                const taskWarnings = getTaskWarnings(demand.subTasks)
                const statusInfo = STATUS_MAP[demand.status]
                const isExpanded = expandedIds.has(demand.id)
                const hasEdits = hasPendingEdits(demand.id)
                const isSaving = savingDemand === demand.id

                return (
                  <Card key={demand.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      {/* Card header */}
                      <div className="px-3 pt-3 pb-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-mono text-muted-foreground">{demand.demandNumber}</span>
                            <Badge variant="secondary" className={cn("text-xs px-1.5 py-0", statusInfo?.color)}>
                              {statusInfo?.label || demand.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openUploadDialog(demand.id)}>
                              <Upload className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                              <Link href={`/governance/demands/${demand.id}`}><Eye className="h-3 w-3" /></Link>
                            </Button>
                          </div>
                        </div>

                        <p className="font-semibold text-sm leading-snug truncate">{demand.title}</p>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />{demand.organization.name}
                            </span>
                            {demand.confirmedSp != null && (
                              <span>{demand.confirmedSp} SP</span>
                            )}
                          </div>
                          {totalTasks > 0 && (
                            <span className="text-xs text-muted-foreground tabular-nums">{completedTasks}/{totalTasks}</span>
                          )}
                        </div>

                        {/* Progress bar */}
                        {totalTasks > 0 && (
                          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(completedTasks / totalTasks) * 100}%` }} />
                          </div>
                        )}

                        {/* Warnings */}
                        {(missingDocs.length > 0 || taskWarnings.noStart > 0 || taskWarnings.noEnd > 0) && (
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                            {missingDocs.length > 0 && (
                              <span className="text-xs text-amber-700 flex items-center gap-1">
                                <FileWarning className="h-3 w-3" />
                                缺少：{missingDocs.map((t) => DOCUMENT_TYPE_LABELS[t] || t).join("、")}
                              </span>
                            )}
                            {taskWarnings.noStart > 0 && (
                              <span className="text-xs text-orange-700 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {taskWarnings.noStart} 個未填開始日
                              </span>
                            )}
                            {taskWarnings.noEnd > 0 && (
                              <span className="text-xs text-orange-700 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {taskWarnings.noEnd} 個未填完成日
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Collapsible task section */}
                      {totalTasks > 0 && (
                        <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(demand.id)}>
                          <CollapsibleTrigger asChild>
                            <button className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 border-t text-xs text-muted-foreground hover:bg-muted/60 transition-colors">
                              <span className="font-medium">任務進度填寫</span>
                              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")} />
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border-t">
                              <div className="divide-y">
                                {demand.subTasks.map((task) => {
                                  const Icon = TASK_STATUS_ICON[task.status]
                                  const editedStatus = (getEditedValue(demand.id, task, "status") || task.status) as string
                                  const editedStart = getEditedValue(demand.id, task, "actualStart") as string | null
                                  const editedEnd = getEditedValue(demand.id, task, "actualEnd") as string | null
                                  const startVal = editedStart !== undefined ? editedStart : task.actualStart
                                  const endVal = editedEnd !== undefined ? editedEnd : task.actualEnd
                                  return (
                                    <div key={task.id} className="px-3 py-2.5 space-y-2">
                                      {/* Task name */}
                                      <div className="flex items-center gap-2">
                                        <Icon className={cn("h-3.5 w-3.5 shrink-0", TASK_STATUS_COLOR[editedStatus], editedStatus === "completed" && "fill-emerald-600")} />
                                        <span className={cn("text-xs font-medium flex-1 min-w-0 truncate", editedStatus === "completed" && "text-muted-foreground")}>{task.name}</span>
                                      </div>
                                      {/* Status + dates row */}
                                      <div className="grid grid-cols-[4fr_5fr_5fr] gap-2">
                                        <div className="space-y-0.5">
                                          <span className="text-[10px] text-muted-foreground">狀態</span>
                                          <Select
                                            value={editedStatus}
                                            onValueChange={(v) => setTaskEdit(demand.id, task.id, "status", v)}
                                          >
                                            <SelectTrigger className="!h-7 text-xs w-full px-2 py-0"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="pending">{TASK_STATUS_LABEL.pending}</SelectItem>
                                              <SelectItem value="in_progress">{TASK_STATUS_LABEL.in_progress}</SelectItem>
                                              <SelectItem value="completed">{TASK_STATUS_LABEL.completed}</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="space-y-0.5">
                                          <span className="text-[10px] text-muted-foreground">開始日期</span>
                                          <Input
                                            type="date"
                                            className="h-7 text-xs w-full px-2 py-0"
                                            value={startVal ? startVal.slice(0, 10) : ""}
                                            onChange={(e) => setTaskEdit(demand.id, task.id, "actualStart", e.target.value ? new Date(e.target.value).toISOString() : null)}
                                          />
                                        </div>
                                        <div className="space-y-0.5">
                                          <span className="text-[10px] text-muted-foreground">完成日期</span>
                                          <Input
                                            type="date"
                                            className="h-7 text-xs w-full px-2 py-0"
                                            value={endVal ? endVal.slice(0, 10) : ""}
                                            onChange={(e) => setTaskEdit(demand.id, task.id, "actualEnd", e.target.value ? new Date(e.target.value).toISOString() : null)}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                              {/* Save button */}
                              <div className="flex justify-end px-3 py-2 border-t bg-muted/30">
                                <Button
                                  size="sm"
                                  className="h-7 text-xs px-4"
                                  disabled={!hasEdits || isSaving}
                                  onClick={() => handleSaveAll(demand.id)}
                                >
                                  {isSaving ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                                  ) : (
                                    <Save className="h-3 w-3 mr-1.5" />
                                  )}
                                  儲存變更
                                </Button>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={!!uploadDemandId} onOpenChange={(open) => { if (!open) closeUploadDialog() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>上傳文件</DialogTitle>
          </DialogHeader>
          {(() => {
            const demand = allDemands.find((d) => d.id === uploadDemandId)
            if (!demand) return null
            return (
              <div className="space-y-4 py-2">
                {/* Phase document checklist */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">各階段文件狀態</Label>
                  <div className="border rounded-md divide-y max-h-56 overflow-y-auto">
                    {PIPELINE_STEPS.map((phase) => {
                      const config = PHASE_DOCUMENT_MAP[phase]
                      if (!config || (config.required.length === 0 && config.optional.length === 0)) return null
                      const phaseLabel = STATUS_MAP[phase]?.label || phase
                      const isCurrent = phase === demand.status
                      return (
                        <div key={phase} className={cn("px-3 py-2.5", isCurrent && "bg-primary/5")}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-sm font-medium">{phaseLabel}</span>
                            {isCurrent && <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">目前</Badge>}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {config.required.map((docType) => {
                              const hasDoc = demand.documents.some((d) => d.phase === phase && d.type === docType)
                              return (
                                <span key={docType} className={cn("text-sm flex items-center gap-1.5", hasDoc ? "text-emerald-600" : "text-muted-foreground")}>
                                  {hasDoc ? <CircleCheck className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                                  {DOCUMENT_TYPE_LABELS[docType] || docType}
                                </span>
                              )
                            })}
                            {config.optional.filter((t) => t !== "ATTACHMENT").map((docType) => {
                              const hasDoc = demand.documents.some((d) => d.phase === phase && d.type === docType)
                              return (
                                <span key={docType} className={cn("text-sm flex items-center gap-1.5", hasDoc ? "text-emerald-600" : "text-muted-foreground/50")}>
                                  {hasDoc ? <CircleCheck className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5 opacity-50" />}
                                  {DOCUMENT_TYPE_LABELS[docType] || docType}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Upload form */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">上傳至階段</Label>
                    <Select value={uploadPhase} onValueChange={handlePhaseChange}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="選擇階段" /></SelectTrigger>
                      <SelectContent>
                        {PIPELINE_STEPS.map((phase) => {
                          const config = PHASE_DOCUMENT_MAP[phase]
                          if (!config || (config.required.length === 0 && config.optional.length === 0)) return null
                          return <SelectItem key={phase} value={phase} className="text-sm">{STATUS_MAP[phase]?.label || phase}</SelectItem>
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">文件類型</Label>
                    <Select value={uploadDocType} onValueChange={setUploadDocType} disabled={!uploadPhase}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="選擇類型" /></SelectTrigger>
                      <SelectContent>
                        {(() => {
                          if (!uploadPhase) return null
                          const config = PHASE_DOCUMENT_MAP[uploadPhase]
                          const types = [...(config?.required || []), ...(config?.optional || [])]
                          if (!types.includes("ATTACHMENT")) types.push("ATTACHMENT")
                          return types.map((t) => (
                            <SelectItem key={t} value={t} className="text-sm">{DOCUMENT_TYPE_LABELS[t] || t}</SelectItem>
                          ))
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">選擇檔案</Label>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="cursor-pointer"
                    disabled={!uploadPhase || !uploadDocType}
                    onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                  />
                  {selectedFiles.length > 0 && (
                    <p className="text-sm text-muted-foreground">已選擇 {selectedFiles.length} 個檔案</p>
                  )}
                </div>
                {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
              </div>
            )
          })()}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={closeUploadDialog} disabled={uploading}>取消</Button>
            <Button size="sm" onClick={handleUpload} disabled={uploading || !uploadPhase || !uploadDocType || selectedFiles.length === 0}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
              上傳
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

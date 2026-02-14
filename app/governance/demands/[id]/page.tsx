"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft, Building2, User, Calendar, FileText,
  Loader2, Pencil, Trash2, Check, ChevronDown,
  BarChart3, GanttChart, FolderOpen,
  AlertCircle, CircleDot, Info, UserPlus,
} from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { STATUS_MAP, PIPELINE_STEPS, PHASE_DOCUMENT_MAP, PHASE_DESCRIPTIONS, PHASE_ACTIONS, DOCUMENT_TYPE_LABELS } from "@/lib/constants/demand"
import { Upload } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { SpAllocationChart } from "@/components/demand/sp-allocation-chart"
import { ProjectGantt } from "@/components/demand/project-gantt"
import { PhaseDocuments } from "@/components/demand/phase-documents"
import { StepNavigation } from "@/components/demand/step-navigation"
import { PhasePlanInlineEditor } from "@/components/demand/phase-plan-inline-editor"
import { SubTaskEditor } from "@/components/demand/sub-task-editor"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface DemandDetail {
  id: string
  demandNumber: string
  title: string
  description: string
  painPoint: string | null
  expectedBenefit: string | null
  status: string
  priority: string
  estimatedSp: number
  confirmedSp: number | null
  desiredDate: string | null
  expectedDate: string | null
  completedDate: string | null
  rejectReason: string | null
  adminNotes: string | null
  createdAt: string
  updatedAt: string
  organization: { id: string; name: string }
  submitter: { id: string; name: string; email: string }
  creator: { id: string; name: string }
  manager: { id: string; name: string } | null
  developer: { id: string; name: string } | null
  documents: {
    id: string
    type: string
    phase: string | null
    fileName: string
    fileUrl: string | null
    fileSize: number | null
    uploadedBy: string
    createdAt: string
  }[]
  comments: {
    id: string
    content: string
    isInternal: boolean
    createdAt: string
    user: { id: string; name: string }
  }[]
  statusHistory: {
    id: string
    fromStatus: string | null
    toStatus: string
    comment: string | null
    changedBy: string
    createdAt: string
  }[]
  phasePlans: {
    id: string
    phase: string
    plannedSp: number | null
    plannedStart: string | null
    plannedEnd: string | null
    actualStart: string | null
    actualEnd: string | null
    engineer: { id: string; name: string } | null
    pm: { id: string; name: string } | null
  }[]
  subTasks: {
    id: string
    name: string
    plannedStart: string | null
    plannedEnd: string | null
    actualStart: string | null
    actualEnd: string | null
    status: string
    assignee: { id: string; name: string } | null
    order: number
  }[]
}

const ROLE_META: Record<string, { label: string; color: string }> = {
  delivery: { label: "交付團隊", color: "text-emerald-600" },
  admin: { label: "管理員", color: "text-amber-600" },
  subsidiary: { label: "需求單位", color: "text-blue-600" },
}
const ROLE_ORDER = ["delivery", "admin", "subsidiary"]

function groupUsersByRole(users: { id: string; name: string; role?: string }[]) {
  const groups: Record<string, { id: string; name: string }[]> = {}
  for (const u of users) {
    const role = u.role || "subsidiary"
    if (!groups[role]) groups[role] = []
    groups[role].push(u)
  }
  return ROLE_ORDER
    .filter((r) => groups[r]?.length)
    .map((r) => ({ role: r, label: ROLE_META[r]?.label || r, color: ROLE_META[r]?.color || "", users: groups[r] }))
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit",
  })
}

export default function DemandDetailPage() {
  const { token, user } = useAuth()
  const params = useParams()
  const router = useRouter()
  const demandId = params.id as string

  const [demand, setDemand] = useState<DemandDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [staffUsers, setStaffUsers] = useState<{ id: string; name: string; role?: string }[]>([])
  const [activeTab, setActiveTab] = useState("overview")
  const [docPhaseKey, setDocPhaseKey] = useState(0)
  const [spPlanOpen, setSpPlanOpen] = useState<boolean | null>(null)
  const [subTasksOpen, setSubTasksOpen] = useState<boolean | null>(null)

  const canManage = user?.role === "admin" || user?.role === "delivery"

  // Auto-collapse SP plan if already has content
  useEffect(() => {
    if (spPlanOpen !== null || !demand) return
    const hasContent = demand.phasePlans.some(
      (p) => p.plannedSp || p.plannedStart || p.plannedEnd || p.engineer
    )
    setSpPlanOpen(!hasContent)
  }, [demand, spPlanOpen])

  // Auto-collapse sub-tasks if already have dates filled
  useEffect(() => {
    if (subTasksOpen !== null || !demand) return
    const hasContent = demand.subTasks.length > 0 && demand.subTasks.some(
      (t) => t.plannedStart || t.plannedEnd
    )
    setSubTasksOpen(!hasContent)
  }, [demand, subTasksOpen])

  const fetchDemand = useCallback(async () => {
    if (!token || !demandId) return
    try {
      const res = await fetch(`/api/demands/${demandId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) setDemand(data.demand)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [token, demandId])

  useEffect(() => {
    fetchDemand()
  }, [fetchDemand])

  // Fetch staff users for PM/Engineer assignment
  useEffect(() => {
    if (!token || !canManage) return
    fetch("/api/demands?_usersOnly=1", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.filters?.developers) setStaffUsers(data.filters.developers)
      })
      .catch(() => {})
  }, [token, canManage])

  const handleAssign = async (field: "managerId" | "developerId", userId: string) => {
    if (!token || !demand) return
    try {
      const res = await fetch(`/api/demands/${demand.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: userId || null }),
      })
      if (res.ok) fetchDemand()
    } catch { /* ignore */ }
  }

  const handleDelete = async () => {
    if (!token) return
    try {
      const res = await fetch(`/api/demands/${demandId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) router.push("/governance/inbox")
    } catch { /* ignore */ }
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

  if (!demand) {
    return (
      <AppLayout userRole="admin">
        <div className="flex flex-col items-center justify-center py-32">
          <p className="text-muted-foreground mb-4">需求不存在或已被刪除</p>
          <Button variant="outline" asChild>
            <Link href="/governance/inbox"><ArrowLeft className="mr-2 h-4 w-4" />返回列表</Link>
          </Button>
        </div>
      </AppLayout>
    )
  }

  const statusInfo = STATUS_MAP[demand.status] || { label: demand.status, color: "bg-gray-100 text-gray-700" }
  const currentStepIndex = PIPELINE_STEPS.indexOf(demand.status as typeof PIPELINE_STEPS[number])
  const isRejected = demand.status === "REJECTED"
  return (
    <AppLayout userRole="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <Link href="/governance/inbox"><ArrowLeft className="h-4 w-4" /></Link>
              </Button>
              <span className="text-sm font-mono text-muted-foreground">{demand.demandNumber}</span>
              <Badge variant="secondary" className={cn("text-xs px-2 py-0.5", statusInfo.color)}>
                {statusInfo.label}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground ml-11">{demand.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/governance/demands/${demand.id}/edit`}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                編輯
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  刪除
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>確定要刪除此需求？</AlertDialogTitle>
                  <AlertDialogDescription>
                    將永久刪除需求「{demand.title}」（{demand.demandNumber}）及其所有相關資料，包含文件、子任務、狀態紀錄等。此操作無法復原。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    確定刪除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Status Pipeline */}
        <Card>
          <CardContent className="py-4">
            <TooltipProvider delayDuration={200}>
              <div className="flex items-center">
                {PIPELINE_STEPS.map((step, i) => {
                  const info = STATUS_MAP[step]
                  const isPast = !isRejected && currentStepIndex >= 0 && i < currentStepIndex
                  const isCurrent = !isRejected && i === currentStepIndex
                  const isFuture = isRejected || currentStepIndex < 0 || i > currentStepIndex

                  // Phase completion info
                  const phaseConfig = PHASE_DOCUMENT_MAP[step]
                  const requiredDocs = phaseConfig?.required || []
                  const missingDocs = requiredDocs.filter(
                    (type) => !demand.documents.some((d) => d.phase === step && d.type === type)
                  )
                  const hasAssignment = step === "PRD_REVIEW" || step === "SP_REVIEW" || step === "DEVELOPING" || step === "ACCEPTANCE"
                  const needsAssignment = hasAssignment && !demand.manager && !demand.developer
                  const showWarning = (isPast || isCurrent) && (missingDocs.length > 0 || (isCurrent && needsAssignment))
                  const isComplete = (isPast || isCurrent) && missingDocs.length === 0 && requiredDocs.length > 0

                  return (
                    <div key={step} className="flex items-center flex-1 last:flex-none">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col items-center gap-2 cursor-default">
                            <div className="relative">
                              <div className={cn(
                                "h-9 w-9 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors",
                                isCurrent && "border-primary bg-primary text-primary-foreground",
                                isPast && "border-primary bg-primary/10 text-primary",
                                isFuture && "border-muted-foreground/30 bg-background text-muted-foreground/50",
                              )}>
                                {isPast ? <Check className="h-4 w-4" /> : i + 1}
                              </div>
                              {showWarning && (
                                <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-500 flex items-center justify-center">
                                  <AlertCircle className="h-3 w-3 text-white" />
                                </div>
                              )}
                            </div>
                            <span className={cn(
                              "text-sm whitespace-nowrap",
                              isCurrent && "font-semibold text-foreground",
                              isPast && "text-primary",
                              isFuture && "text-muted-foreground/50",
                            )}>
                              {info.label}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs p-3">
                          <p className="font-medium text-xs mb-1">{info.label}</p>
                          <p className="text-xs text-muted-foreground mb-2">{PHASE_DESCRIPTIONS[step]}</p>
                          {requiredDocs.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium">必要文件：</p>
                              {requiredDocs.map((type) => {
                                const uploaded = demand.documents.some((d) => d.phase === step && d.type === type)
                                return (
                                  <div key={type} className="flex items-center gap-1.5 text-xs">
                                    {uploaded
                                      ? <Check className="h-3 w-3 text-emerald-500" />
                                      : <CircleDot className="h-3 w-3 text-amber-500" />
                                    }
                                    <span className={uploaded ? "text-emerald-600" : "text-amber-600"}>
                                      {DOCUMENT_TYPE_LABELS[type] || type}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </TooltipContent>
                      </Tooltip>
                      {i < PIPELINE_STEPS.length - 1 && (
                        <div className={cn(
                          "flex-1 h-px mx-2 mt-[-1.5rem]",
                          isPast ? "bg-primary" : "bg-muted-foreground/20",
                        )} />
                      )}
                    </div>
                  )
                })}
              </div>
            </TooltipProvider>

            {/* Current phase status banner */}
            {!isRejected && (() => {
              const currentPhase = demand.status
              const phaseConfig = PHASE_DOCUMENT_MAP[currentPhase]
              const requiredDocs = phaseConfig?.required || []
              const missingDocs = requiredDocs.filter(
                (type) => !demand.documents.some((d) => d.phase === currentPhase && d.type === type)
              )
              const actions = PHASE_ACTIONS[currentPhase] || []
              const needsAssignment = (currentPhase === "PRD_REVIEW" || currentPhase === "SP_REVIEW" || currentPhase === "DEVELOPING") && !demand.manager && !demand.developer

              if (missingDocs.length === 0 && !needsAssignment && actions.length === 0) return null

              return (
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <p className="text-xs font-medium text-blue-700">
                        {PHASE_DESCRIPTIONS[currentPhase]}
                      </p>
                      {(missingDocs.length > 0 || needsAssignment) && (
                        <div className="flex flex-wrap gap-2">
                          {needsAssignment && (
                            <Badge variant="outline" className="text-[11px] bg-amber-50 text-amber-700 border-amber-200 cursor-pointer hover:bg-amber-100" onClick={() => setActiveTab("overview")}>
                              <UserPlus className="h-3 w-3 mr-1" />
                              待指派 PM / 工程師
                            </Badge>
                          )}
                          {missingDocs.map((type) => (
                            <Badge key={type} variant="outline" className="text-[11px] bg-amber-50 text-amber-700 border-amber-200 cursor-pointer hover:bg-amber-100" onClick={() => setActiveTab("documents")}>
                              <AlertCircle className="h-3 w-3 mr-1" />
                              缺 {DOCUMENT_TYPE_LABELS[type] || type}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}

            {isRejected && (
              <div className="mt-3 text-center">
                <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">已駁回</Badge>
                {demand.rejectReason && (
                  <p className="text-xs text-muted-foreground mt-1">原因：{demand.rejectReason}</p>
                )}
              </div>
            )}
            {/* Step Navigation */}
            {canManage && !isRejected && (
              <StepNavigation
                currentStatus={demand.status}
                demandId={demand.id}
                documents={demand.documents}
                token={token}
                onStatusChange={() => { setActiveTab("overview"); setDocPhaseKey((k) => k + 1); fetchDemand() }}
              />
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content - Left 2 cols */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="h-10 p-1 bg-muted/60">
                <TabsTrigger value="overview" className="gap-1.5 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <BarChart3 className="h-3.5 w-3.5" />
                  概覽
                </TabsTrigger>
                <TabsTrigger value="gantt" className="gap-1.5 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <GanttChart className="h-3.5 w-3.5" />
                  甘特圖
                </TabsTrigger>
                <TabsTrigger value="documents" className="gap-1.5 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <FolderOpen className="h-3.5 w-3.5" />
                  文件
                  {demand.documents.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4 min-w-4 px-1 rounded-full ml-0.5">
                      {demand.documents.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* 概覽 Tab */}
              <TabsContent value="overview" className="space-y-6 mt-4">
                {/* Phase-specific action cards */}
                {canManage && demand.status === "SP_REVIEW" && (
                  <Collapsible open={spPlanOpen ?? false} onOpenChange={setSpPlanOpen}>
                    <Card className="border-orange-200">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-orange-600" />
                            SP 與時程規劃
                          </CardTitle>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <ChevronDown className={cn("h-4 w-4 transition-transform", spPlanOpen && "rotate-180")} />
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                        <p className="text-xs text-muted-foreground">填寫各階段 SP 點數與計畫開始/結束時間</p>
                      </CardHeader>
                      <CollapsibleContent>
                        <CardContent>
                          <PhasePlanInlineEditor
                            phasePlans={demand.phasePlans}
                            totalSp={demand.estimatedSp}
                            demandId={demand.id}
                            token={token}
                            staffUsers={staffUsers}
                            onSaved={() => { setSpPlanOpen(false); fetchDemand() }}
                          />
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                )}

                {canManage && demand.status === "PRD_REVIEW" && (!demand.manager || !demand.developer) && (
                  <Card className="border-amber-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-amber-600" />
                        指派團隊成員
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">請在右側基本資訊區塊指派 PM 與工程師</p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <div className={cn("h-2 w-2 rounded-full", demand.manager ? "bg-emerald-500" : "bg-amber-400")} />
                          <span>PM：</span>
                          <span className={demand.manager ? "font-medium" : "text-muted-foreground"}>
                            {demand.manager?.name || "尚未指派"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <div className={cn("h-2 w-2 rounded-full", demand.developer ? "bg-emerald-500" : "bg-amber-400")} />
                          <span>工程師：</span>
                          <span className={demand.developer ? "font-medium" : "text-muted-foreground"}>
                            {demand.developer?.name || "尚未指派"}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {canManage && demand.status === "DEVELOPING" && (() => {
                  const devPlan = demand.phasePlans.find((p) => p.phase === "DEVELOPING")
                  return (
                    <Collapsible open={subTasksOpen ?? false} onOpenChange={setSubTasksOpen}>
                      <Card className="border-violet-200">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              <GanttChart className="h-4 w-4 text-violet-600" />
                              開發任務管理
                            </CardTitle>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <ChevronDown className={cn("h-4 w-4 transition-transform", subTasksOpen && "rotate-180")} />
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                          <p className="text-xs text-muted-foreground">設定子任務時程與負責人，日期須在開發階段範圍內</p>
                        </CardHeader>
                        <CollapsibleContent>
                          <CardContent>
                            <SubTaskEditor
                              subTasks={demand.subTasks}
                              demandId={demand.id}
                              token={token}
                              devStart={devPlan?.plannedStart ?? null}
                              devEnd={devPlan?.plannedEnd ?? null}
                              devEngineer={devPlan?.engineer ?? null}
                              onRefresh={fetchDemand}
                              onViewGantt={() => setActiveTab("gantt")}
                              onDatesSaved={() => setSubTasksOpen(false)}
                            />
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  )
                })()}


                {/* 需求說明 (always shown) */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      需求說明
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0">
                    <div className="pb-4">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{demand.description}</p>
                    </div>
                    {demand.painPoint && (
                      <>
                        <hr className="border-border/60" />
                        <div className="py-4">
                          <p className="text-xs font-semibold text-orange-600 mb-1.5">痛點說明</p>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{demand.painPoint}</p>
                        </div>
                      </>
                    )}
                    {demand.expectedBenefit && (
                      <>
                        <hr className="border-border/60" />
                        <div className="py-4">
                          <p className="text-xs font-semibold text-emerald-600 mb-1.5">預期效益</p>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{demand.expectedBenefit}</p>
                        </div>
                      </>
                    )}
                    {demand.adminNotes && (
                      <>
                        <hr className="border-border/60" />
                        <div className="pt-4">
                          <p className="text-xs font-semibold text-muted-foreground mb-1.5">管理者備註</p>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{demand.adminNotes}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

              </TabsContent>

              {/* 甘特圖 Tab */}
              <TabsContent value="gantt" className="mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <GanttChart className="h-4 w-4" />
                      甘特圖
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ProjectGantt
                      phasePlans={demand.phasePlans}
                      currentStatus={demand.status}
                      subTasks={demand.subTasks}
                      demandId={demand.id}
                      canEdit={canManage}
                      token={token}
                      onRefresh={fetchDemand}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 文件 Tab */}
              <TabsContent value="documents" className="mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">階段文件</CardTitle>
                      {canManage && (
                        <Button variant="outline" size="sm" id="doc-upload-trigger">
                          <Upload className="h-4 w-4 mr-1.5" />
                          上傳文件
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <PhaseDocuments
                      key={`${demand.status}-${docPhaseKey}`}
                      documents={demand.documents}
                      currentPhase={demand.status}
                      demandId={demand.id}
                      canUpload={canManage}
                      token={token}
                      onRefresh={fetchDemand}
                      uploadTriggerSelector="#doc-upload-trigger"
                    />
                  </CardContent>
                </Card>
              </TabsContent>

            </Tabs>
          </div>

          {/* Sidebar - Right 1 col */}
          <div className="space-y-6">
            {/* 基本資訊 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">基本資訊</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground w-16 shrink-0">子公司</span>
                  <span className="font-medium">{demand.organization.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground w-16 shrink-0">建立者</span>
                  <span className="font-medium">{demand.creator.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground w-16 shrink-0">PM</span>
                  {canManage && staffUsers.length > 0 ? (
                    <Select
                      value={demand.manager?.id || "none"}
                      onValueChange={(v) => handleAssign("managerId", v === "none" ? "" : v)}
                    >
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">尚未指派</SelectItem>
                        {groupUsersByRole(staffUsers).map((g) => (
                          <SelectGroup key={g.role}>
                            <SelectLabel className={cn("text-xs font-semibold", g.color)}>{g.label}</SelectLabel>
                            {g.users.map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className={cn("font-medium", !demand.manager && "text-muted-foreground")}>
                      {demand.manager?.name || "尚未指派"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground w-16 shrink-0">工程師</span>
                  {canManage && staffUsers.length > 0 ? (
                    <Select
                      value={demand.developer?.id || "none"}
                      onValueChange={(v) => handleAssign("developerId", v === "none" ? "" : v)}
                    >
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">尚未指派</SelectItem>
                        {groupUsersByRole(staffUsers).map((g) => (
                          <SelectGroup key={g.role}>
                            <SelectLabel className={cn("text-xs font-semibold", g.color)}>{g.label}</SelectLabel>
                            {g.users.map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className={cn("font-medium", !demand.developer && "text-muted-foreground")}>
                      {demand.developer?.name || "尚未指派"}
                    </span>
                  )}
                </div>
                <hr className="border-border/60" />
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground w-16 shrink-0">估計 SP</span>
                  <span className="font-medium">{demand.estimatedSp} SP</span>
                </div>
                {demand.confirmedSp !== null && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground w-16 shrink-0">確認 SP</span>
                    <span className="font-medium">{demand.confirmedSp} SP</span>
                  </div>
                )}
                <hr className="border-border/60" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground shrink-0">開案時間</span>
                    <span className="font-medium">{formatDate(demand.phasePlans.find(p => p.phase === "SUBMITTED")?.plannedStart ?? demand.createdAt)}</span>
                  </div>
                  {demand.desiredDate && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground shrink-0">希望完成</span>
                      <span className="font-medium">{formatDate(demand.desiredDate)}</span>
                    </div>
                  )}
                </div>
                {demand.completedDate && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground w-16 shrink-0">完成時間</span>
                    <span className="font-medium">{formatDate(demand.completedDate)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SP 分配 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">SP 分配</CardTitle>
              </CardHeader>
              <CardContent>
                <SpAllocationChart
                  phasePlans={demand.phasePlans}
                  totalSp={demand.estimatedSp}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

    </AppLayout>
  )
}

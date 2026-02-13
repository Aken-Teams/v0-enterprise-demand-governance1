"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft, Building2, User, Calendar, FileText,
  Loader2, Pencil, Trash2, Check,
  BarChart3, GanttChart, FolderOpen,
} from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { STATUS_MAP, PIPELINE_STEPS } from "@/lib/constants/demand"
import { Upload } from "lucide-react"
import { SpAllocationChart } from "@/components/demand/sp-allocation-chart"
import { ProjectGantt } from "@/components/demand/project-gantt"
import { PhaseDocuments } from "@/components/demand/phase-documents"
import { StepNavigation } from "@/components/demand/step-navigation"

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


  const canManage = user?.role === "admin" || user?.role === "delivery"

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
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete}>
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              刪除
            </Button>
          </div>
        </div>

        {/* Status Pipeline */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center">
              {PIPELINE_STEPS.map((step, i) => {
                const info = STATUS_MAP[step]
                const isPast = !isRejected && currentStepIndex >= 0 && i < currentStepIndex
                const isCurrent = !isRejected && i === currentStepIndex
                const isFuture = isRejected || currentStepIndex < 0 || i > currentStepIndex
                return (
                  <div key={step} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className={cn(
                        "h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors",
                        isCurrent && "border-primary bg-primary text-primary-foreground",
                        isPast && "border-primary bg-primary/10 text-primary",
                        isFuture && "border-muted-foreground/30 bg-background text-muted-foreground/50",
                      )}>
                        {isPast ? <Check className="h-3.5 w-3.5" /> : i + 1}
                      </div>
                      <span className={cn(
                        "text-xs whitespace-nowrap",
                        isCurrent && "font-semibold text-foreground",
                        isPast && "text-primary",
                        isFuture && "text-muted-foreground/50",
                      )}>
                        {info.label}
                      </span>
                    </div>
                    {i < PIPELINE_STEPS.length - 1 && (
                      <div className={cn(
                        "flex-1 h-px mx-2 mt-[-1.25rem]",
                        isPast ? "bg-primary" : "bg-muted-foreground/20",
                      )} />
                    )}
                  </div>
                )
              })}
            </div>
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
                onStatusChange={fetchDemand}
              />
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content - Left 2 cols */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="overview">
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
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      需求說明
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{demand.description}</p>
                    </div>
                    {demand.painPoint && (
                      <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-4 space-y-1">
                        <p className="text-xs font-semibold text-orange-600">痛點說明</p>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{demand.painPoint}</p>
                      </div>
                    )}
                    {demand.expectedBenefit && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 space-y-1">
                        <p className="text-xs font-semibold text-emerald-600">預期效益</p>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{demand.expectedBenefit}</p>
                      </div>
                    )}
                    {demand.adminNotes && (
                      <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground">管理者備註</p>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{demand.adminNotes}</p>
                      </div>
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
                  <span className="text-muted-foreground w-16 shrink-0">開發者</span>
                  <span className="font-medium">{demand.developer?.name || "尚未指派"}</span>
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
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground w-16 shrink-0">建立時間</span>
                  <span className="font-medium">{formatDate(demand.createdAt)}</span>
                </div>
                {demand.desiredDate && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground w-16 shrink-0">希望完成</span>
                    <span className="font-medium">{formatDate(demand.desiredDate)}</span>
                  </div>
                )}
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

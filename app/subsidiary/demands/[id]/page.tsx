"use client"

import { use, useState, useEffect, useCallback, useMemo } from "react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  User,
  FileText,
  CheckCircle,
  Paperclip,
  Loader2,
  AlertTriangle,
  CalendarDays,
  Circle,
  BarChart3,
  Hash,
  Layers,
} from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { STATUS_MAP, PIPELINE_STEPS } from "@/lib/constants/demand"
import { PhaseDocuments } from "@/components/demand/phase-documents"
import { ProjectGantt } from "@/components/demand/project-gantt"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"

// ── Pie chart colors (one per pipeline phase) ──
const PIE_COLORS: Record<string, string> = {
  SUBMITTED: "#3b82f6",
  PRD_REVIEW: "#f59e0b",
  SP_REVIEW: "#ef4444",
  DEVELOPING: "#8b5cf6",
  ACCEPTANCE: "#06b6d4",
  CLOSED: "#10b981",
}

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
    user: { id: string; name: string }
    createdAt: string
  }[]
  statusHistory: {
    id: string
    fromStatus: string
    toStatus: string
    comment: string | null
    createdAt: string
  }[]
  phasePlans: {
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

function fmtDate(dateStr: string | null) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
}

function fmtDateFull(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

export default function DemandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { token } = useAuth()
  const [demand, setDemand] = useState<DemandDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchDemand = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`/api/demands/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "載入失敗")
        return
      }
      const data = await res.json()
      setDemand(data.demand)
    } catch {
      setError("網路錯誤，無法載入需求資料")
    } finally {
      setLoading(false)
    }
  }, [token, id])

  useEffect(() => {
    fetchDemand()
  }, [fetchDemand])

  if (loading) {
    return (
      <AppLayout userRole="subsidiary">
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  if (error || !demand) {
    return (
      <AppLayout userRole="subsidiary">
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-muted-foreground mb-4">{error || "找不到此需求"}</p>
          <Button asChild>
            <Link href="/subsidiary/demands">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回需求列表
            </Link>
          </Button>
        </div>
      </AppLayout>
    )
  }

  const statusInfo = STATUS_MAP[demand.status] || { label: demand.status, color: "bg-gray-100 text-gray-700" }
  const sp = demand.confirmedSp ?? demand.estimatedSp
  const isRejected = demand.status === "REJECTED"
  const isClosed = demand.status === "CLOSED"
  const currentStepIdx = PIPELINE_STEPS.indexOf(demand.status as typeof PIPELINE_STEPS[number])
  const phasePlanMap = Object.fromEntries(demand.phasePlans.map((p) => [p.phase, p]))

  // Project start date: earliest plannedStart or actualStart from phase plans
  const projectStartDate = demand.phasePlans.reduce<string | null>((earliest, p) => {
    const d = p.plannedStart || p.actualStart
    if (!d) return earliest
    if (!earliest) return d
    return new Date(d) < new Date(earliest) ? d : earliest
  }, null)

  // Pie chart data
  const spPieData = demand.phasePlans
    .filter((p) => p.plannedSp && p.plannedSp > 0)
    .map((p) => ({
      name: STATUS_MAP[p.phase]?.label || p.phase,
      value: p.plannedSp!,
      phase: p.phase,
    }))

  return (
    <AppLayout userRole="subsidiary">
      <div className="space-y-5">
        {/* ── Header ── */}
        <div>
          <Button variant="ghost" size="sm" asChild className="h-8 px-2 mb-3 -ml-2">
            <Link href="/subsidiary/demands">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              返回需求列表
            </Link>
          </Button>

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-mono text-muted-foreground mb-1">{demand.demandNumber}</p>
              <h1 className="text-xl font-bold tracking-tight leading-snug">{demand.title}</h1>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Badge className={cn("text-xs whitespace-nowrap", statusInfo.color)}>
                {statusInfo.label}
              </Badge>
              <div className="text-right">
                <span className="text-2xl font-bold text-primary">{sp}</span>
                <span className="text-xs text-muted-foreground ml-1">SP</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Alert banners ── */}
        {isRejected && demand.rejectReason && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-800 text-sm mb-0.5">需求已駁回</p>
              <p className="text-sm text-red-700 whitespace-pre-line">{demand.rejectReason}</p>
            </div>
          </div>
        )}

        {isClosed && (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
            <p className="text-sm text-emerald-700">
              此需求已於 <span className="font-medium">{fmtDateFull(demand.completedDate || demand.updatedAt)}</span> 結案完成
            </p>
          </div>
        )}

        {/* ── Tabs ── */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full justify-start bg-muted/50 h-10">
            <TabsTrigger value="overview" className="gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              概覽
            </TabsTrigger>
            <TabsTrigger value="gantt" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              甘特圖
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5">
              <Paperclip className="h-3.5 w-3.5" />
              文件
              {demand.documents.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-0.5">
                  {demand.documents.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ══════ Tab: 概覽 ══════ */}
          <TabsContent value="overview" className="mt-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Left */}
              <div className="lg:col-span-2 space-y-5">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">需求內容</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0">
                    <div>
                      <p className="text-xs font-semibold text-blue-600 mb-1.5">需求說明</p>
                      <p className="text-sm leading-relaxed whitespace-pre-line">{demand.description}</p>
                    </div>

                    {demand.painPoint && (
                      <>
                        <Separator className="my-4" />
                        <div>
                          <p className="text-xs font-semibold text-amber-600 mb-1.5">痛點說明</p>
                          <p className="text-sm leading-relaxed whitespace-pre-line">{demand.painPoint}</p>
                        </div>
                      </>
                    )}

                    {demand.expectedBenefit && (
                      <>
                        <Separator className="my-4" />
                        <div>
                          <p className="text-xs font-semibold text-emerald-600 mb-1.5">預期效益</p>
                          <p className="text-sm leading-relaxed whitespace-pre-line">{demand.expectedBenefit}</p>
                        </div>
                      </>
                    )}

                    {demand.adminNotes && (
                      <>
                        <Separator className="my-4" />
                        <div>
                          <p className="text-xs font-semibold text-violet-600 mb-1.5">管理者備註</p>
                          <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{demand.adminNotes}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Comments */}
                {demand.comments.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        留言
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{demand.comments.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {demand.comments.map((c) => (
                        <div key={c.id} className="rounded-lg bg-muted/50 p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{c.user.name}</span>
                            <span className="text-[11px] text-muted-foreground">{fmtDate(c.createdAt)}</span>
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-pre-line">{c.content}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right */}
              <div className="space-y-5">
                {/* Basic info + Team (merged) */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">基本資訊</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Hash className="h-3.5 w-3.5" />
                        編號
                      </span>
                      <span className="font-mono font-medium">{demand.demandNumber}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        提交者
                      </span>
                      <span className="font-medium">{demand.submitter.name}</span>
                    </div>
                    <Separator />
                    {projectStartDate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" />
                          專案開始日期
                        </span>
                        <span className="font-medium">{fmtDate(projectStartDate)}</span>
                      </div>
                    )}
                    {demand.desiredDate && (
                      <>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            希望完成日期
                          </span>
                          <span className="font-medium">{fmtDate(demand.desiredDate)}</span>
                        </div>
                      </>
                    )}
                    {demand.expectedDate && (
                      <>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">預計完成</span>
                          <span className="font-medium">{fmtDate(demand.expectedDate)}</span>
                        </div>
                      </>
                    )}
                    {demand.completedDate && (
                      <>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">實際完成</span>
                          <span className="font-medium text-emerald-600">{fmtDate(demand.completedDate)}</span>
                        </div>
                      </>
                    )}

                    {/* Team section */}
                    <Separator />
                    <p className="text-xs font-medium text-muted-foreground pt-1">負責人</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-[11px] font-medium text-primary">
                            {demand.manager ? demand.manager.name[0] : "?"}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate leading-tight">
                            {demand.manager?.name || "未指派"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">PM</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                          <span className="text-[11px] font-medium text-violet-600">
                            {demand.developer ? demand.developer.name[0] : "?"}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate leading-tight">
                            {demand.developer?.name || "未指派"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">開發</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* SP Pie Chart */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      SP 分配
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {spPieData.length > 0 ? (
                      <div>
                        <div className="h-[160px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={spPieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={65}
                                paddingAngle={3}
                                dataKey="value"
                                stroke="none"
                              >
                                {spPieData.map((entry) => (
                                  <Cell key={entry.phase} fill={PIE_COLORS[entry.phase] || "#94a3b8"} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value: number) => [`${value} SP`, ""]}
                                contentStyle={{
                                  fontSize: "12px",
                                  borderRadius: "8px",
                                  border: "1px solid var(--border)",
                                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                                }}
                              />
                              {/* Center label */}
                              <text x="50%" y="48%" textAnchor="middle" dominantBaseline="central" className="fill-foreground text-lg font-bold">
                                {sp}
                              </text>
                              <text x="50%" y="62%" textAnchor="middle" dominantBaseline="central" className="fill-muted-foreground text-[10px]">
                                SP
                              </text>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        {/* Legend */}
                        <div className="space-y-1.5 mt-2">
                          {spPieData.map((entry) => (
                            <div key={entry.phase} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[entry.phase] || "#94a3b8" }} />
                                <span className="text-muted-foreground">{entry.name}</span>
                              </div>
                              <span className="font-medium">{entry.value} SP</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-3xl font-bold text-primary">{sp}</p>
                        <p className="text-xs text-muted-foreground mt-1">總 Story Points</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Phase progress */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      階段進度
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {PIPELINE_STEPS.map((phase, idx) => {
                        const plan = phasePlanMap[phase]
                        const phaseInfo = STATUS_MAP[phase]
                        const isPast = currentStepIdx >= 0 && idx < currentStepIdx
                        const isCurrent = idx === currentStepIdx && !isRejected
                        const isFuture = currentStepIdx >= 0 ? idx > currentStepIdx : true

                        const dateRange =
                          plan?.plannedStart && plan?.plannedEnd
                            ? `${fmtDate(plan.plannedStart)} — ${fmtDate(plan.plannedEnd)}`
                            : plan?.actualStart
                              ? `${fmtDate(plan.actualStart)} 起`
                              : null

                        return (
                          <div
                            key={phase}
                            className={cn(
                              "flex items-center gap-3 px-5 py-2.5",
                              isCurrent && "bg-primary/[0.04]",
                            )}
                          >
                            {isPast ? (
                              <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                            ) : isCurrent ? (
                              <div className="h-4 w-4 shrink-0 relative flex items-center justify-center">
                                <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                                <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-pulse" />
                              </div>
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                            )}

                            <span className={cn(
                              "text-sm flex-1 min-w-0",
                              isCurrent && "font-semibold text-foreground",
                              isPast && "text-muted-foreground",
                              isFuture && "text-muted-foreground/50",
                            )}>
                              {phaseInfo?.label}
                            </span>

                            {dateRange && (
                              <span className={cn(
                                "text-[11px] shrink-0 hidden xl:inline",
                                isCurrent ? "text-muted-foreground" : "text-muted-foreground/60",
                              )}>
                                {dateRange}
                              </span>
                            )}

                            <Badge variant="secondary" className={cn(
                              "text-[10px] h-5 px-1.5 rounded shrink-0",
                              isFuture && "opacity-50",
                            )}>
                              {plan?.plannedSp ?? 0}
                            </Badge>
                          </div>
                        )
                      })}

                      {isRejected && (
                        <div className="flex items-center gap-3 px-5 py-2.5 bg-red-50/50">
                          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                          <span className="text-sm font-medium text-red-700">已駁回</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ══════ Tab: 甘特圖 ══════ */}
          <TabsContent value="gantt" className="mt-5">
            <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  專案時程
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-hidden">
                <div className="overflow-x-auto">
                  <ProjectGantt
                    phasePlans={demand.phasePlans}
                    currentStatus={demand.status}
                    subTasks={demand.subTasks}
                    demandId={demand.id}
                    canEdit={false}
                    token={token}
                    onRefresh={fetchDemand}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════ Tab: 文件 ══════ */}
          <TabsContent value="documents" className="mt-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  專案文件
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PhaseDocuments
                  documents={demand.documents}
                  currentPhase={demand.status}
                  demandId={demand.id}
                  canUpload={false}
                  canDownload={false}
                  token={token}
                  onRefresh={fetchDemand}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}

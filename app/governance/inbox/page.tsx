"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import {
  Search, Inbox, Plus, Loader2, Building2,
  Paperclip, User, MoreHorizontal, Eye, Trash2, RefreshCw, Check,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

interface Demand {
  id: string
  demandNumber: string
  title: string
  status: string
  priority: string
  estimatedSp: number
  confirmedSp: number | null
  desiredDate: string | null
  createdAt: string
  organization: string
  submitter: string
  creator: string
  developer: string | null
  documentCount: number
  commentCount: number
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  SUBMITTED: { label: "需求確認", color: "bg-blue-100 text-blue-700" },
  PRD_REVIEW: { label: "MVP 架構確認", color: "bg-amber-100 text-amber-700" },
  SP_REVIEW: { label: "開案確認", color: "bg-orange-100 text-orange-700" },
  DEVELOPING: { label: "開發中", color: "bg-violet-100 text-violet-700" },
  ACCEPTANCE: { label: "驗收中", color: "bg-purple-100 text-purple-700" },
  CLOSED: { label: "已結案", color: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "已駁回", color: "bg-red-100 text-red-700" },
}


const TAB_STATUS_MAP: Record<string, string | null> = {
  all: null,
  submitted: "SUBMITTED",
  prd_review: "PRD_REVIEW",
  sp_review: "SP_REVIEW",
  developing: "DEVELOPING",
  acceptance: "ACCEPTANCE",
  closed: "CLOSED",
  rejected: "REJECTED",
}

export default function InboxPage() {
  const { token } = useAuth()
  const router = useRouter()
  const [demands, setDemands] = useState<Demand[]>([])
  const [total, setTotal] = useState(0)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchDemands = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      const status = TAB_STATUS_MAP[activeTab]
      if (status) params.set("status", status)
      if (debouncedSearch) params.set("search", debouncedSearch)

      const res = await fetch(`/api/demands?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setDemands(data.demands)
        setTotal(data.total)
        setStatusCounts(data.statusCounts)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [token, activeTab, debouncedSearch])

  useEffect(() => {
    fetchDemands()
  }, [fetchDemands])

  const handleStatusChange = async (demandId: string, newStatus: string) => {
    if (!token) return
    try {
      const res = await fetch(`/api/demands/${demandId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) fetchDemands()
    } catch { /* ignore */ }
  }

  const handleDelete = async (demandId: string) => {
    if (!token) return
    try {
      const res = await fetch(`/api/demands/${demandId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) fetchDemands()
    } catch { /* ignore */ }
  }

  const getCount = (status: string) => statusCounts[status] || 0
  const confirmStage = getCount("SUBMITTED") + getCount("PRD_REVIEW") + getCount("SP_REVIEW")
  const devStage = getCount("DEVELOPING") + getCount("ACCEPTANCE")

  return (
    <AppLayout userRole="admin">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">需求管理</h1>
            <p className="text-muted-foreground">建立與追蹤所有需求的開案流程</p>
          </div>
          <Button asChild>
            <Link href="/governance/create">
              <Plus className="mr-2 h-4 w-4" />
              建立需求
            </Link>
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-3 md:grid-cols-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="flex items-center gap-4 py-2.5">
              <div className="text-3xl font-bold text-foreground">{total}</div>
              <div>
                <div className="text-sm font-medium text-foreground leading-tight">全部需求</div>
                <div className="text-xs text-muted-foreground mt-0.5">累計建立</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="flex items-center gap-4 py-2.5">
              <div className="text-3xl font-bold text-foreground">{confirmStage}</div>
              <div>
                <div className="text-sm font-medium text-foreground leading-tight">確認階段</div>
                <div className="text-xs text-muted-foreground mt-0.5">需求 / MVP / 開案</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-violet-500">
            <CardContent className="flex items-center gap-4 py-2.5">
              <div className="text-3xl font-bold text-foreground">{devStage}</div>
              <div>
                <div className="text-sm font-medium text-foreground leading-tight">開發中</div>
                <div className="text-xs text-muted-foreground mt-0.5">開發 + 驗收</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="flex items-center gap-4 py-2.5">
              <div className="text-3xl font-bold text-foreground">{getCount("CLOSED")}</div>
              <div>
                <div className="text-sm font-medium text-foreground leading-tight">已結案</div>
                <div className="text-xs text-muted-foreground mt-0.5">驗收完成</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs + List */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList>
              <TabsTrigger value="all">全部 ({total})</TabsTrigger>
              <TabsTrigger value="submitted">需求確認 ({getCount("SUBMITTED")})</TabsTrigger>
              <TabsTrigger value="prd_review">MVP 架構確認 ({getCount("PRD_REVIEW")})</TabsTrigger>
              <TabsTrigger value="sp_review">開案確認 ({getCount("SP_REVIEW")})</TabsTrigger>
              <TabsTrigger value="developing">開發中 ({getCount("DEVELOPING")})</TabsTrigger>
              <TabsTrigger value="acceptance">驗收中 ({getCount("ACCEPTANCE")})</TabsTrigger>
              <TabsTrigger value="closed">已結案 ({getCount("CLOSED")})</TabsTrigger>
              <TabsTrigger value="rejected">已駁回 ({getCount("REJECTED")})</TabsTrigger>
            </TabsList>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜尋需求標題、編號或子公司..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {Object.keys(TAB_STATUS_MAP).map((tab) => (
            <TabsContent key={tab} value={tab}>
              {loading ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">載入中...</span>
                  </CardContent>
                </Card>
              ) : demands.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Inbox className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground">尚無資料</p>
                    {tab === "all" && !debouncedSearch && (
                      <Button variant="outline" className="mt-4" asChild>
                        <Link href="/governance/create">
                          <Plus className="mr-2 h-4 w-4" />
                          建立第一筆需求
                        </Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {demands.map((demand) => {
                    const statusInfo = STATUS_MAP[demand.status] || { label: demand.status, color: "bg-gray-100 text-gray-700" }
                    return (
                      <Card key={demand.id} className="hover:shadow-md hover:border-primary/30 transition-all h-full">
                        <CardContent className="px-4 py-3 space-y-2">
                          {/* Row 1: number + status */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono text-muted-foreground">{demand.demandNumber}</span>
                            <Badge variant="secondary" className={cn("text-xs px-2 py-0", statusInfo.color)}>
                              {statusInfo.label}
                            </Badge>
                          </div>

                          {/* Title */}
                          <p className="font-semibold leading-snug line-clamp-2">{demand.title}</p>

                          <hr className="border-border/60" />

                          {/* Meta row + actions */}
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3.5 w-3.5" />
                                {demand.organization}
                              </span>
                              <span>·</span>
                              <span>{demand.estimatedSp} SP</span>
                              {demand.documentCount > 0 && (
                                <>
                                  <span>·</span>
                                  <span className="flex items-center gap-1">
                                    <Paperclip className="h-3.5 w-3.5" />
                                    {demand.documentCount}
                                  </span>
                                </>
                              )}
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <User className="h-3.5 w-3.5" />
                                {demand.developer || "尚未指派"}
                              </span>
                            </div>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="max-h-none overflow-visible">
                                <DropdownMenuItem onClick={() => router.push(`/governance/demands/${demand.id}`)}>
                                  <Eye className="h-3.5 w-3.5 mr-2" />
                                  查看詳情
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger>
                                    <RefreshCw className="h-3.5 w-3.5 mr-2" />
                                    修改狀態
                                  </DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent className="max-h-none overflow-visible">
                                    {Object.entries(STATUS_MAP).map(([key, info]) => (
                                      <DropdownMenuItem
                                        key={key}
                                        disabled={key === demand.status}
                                        onClick={() => handleStatusChange(demand.id, key)}
                                        className="gap-2"
                                      >
                                        {key === demand.status
                                          ? <Check className="h-3.5 w-3.5 shrink-0" />
                                          : <span className="w-3.5 shrink-0" />}
                                        <Badge variant="secondary" className={cn("text-xs px-1.5 py-0", info.color)}>
                                          {info.label}
                                        </Badge>
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDelete(demand.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                                  刪除需求
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  )
}

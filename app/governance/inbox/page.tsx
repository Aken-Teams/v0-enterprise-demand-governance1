"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Search, Inbox, Plus, Loader2, Building2,
  Paperclip, User, MoreHorizontal, Eye, Trash2,
  ClipboardList, Code2, CircleCheckBig, ChevronLeft, ChevronRight,
  ChevronsUpDown, Check, PauseCircle, PlayCircle, AlertTriangle,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command"
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
  contactPerson: string | null
  documentCount: number
  commentCount: number
  hasPendingDesignChange: boolean
  hasCurrentPhaseReject: boolean
  hasCurrentPhaseApproved: boolean
  holdReason: string | null
}

interface FilterOption {
  id: string
  name: string
  organizationId?: string | null
  organizationName?: string | null
}

interface OrgOption {
  id: string
  name: string
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  SUBMITTED: { label: "需求確認", color: "bg-blue-100 text-blue-700" },
  PRD_REVIEW: { label: "MVP 架構確認", color: "bg-amber-100 text-amber-700" },
  SP_REVIEW: { label: "開案確認", color: "bg-orange-100 text-orange-700" },
  DEVELOPING: { label: "開發中", color: "bg-violet-100 text-violet-700" },
  ACCEPTANCE: { label: "驗收中", color: "bg-purple-100 text-purple-700" },
  CLOSED: { label: "已結案", color: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "已駁回", color: "bg-red-100 text-red-700" },
  ON_HOLD: { label: "暫緩", color: "bg-yellow-100 text-yellow-700" },
}

const STORAGE_KEY = "inbox-filters"

/** Read saved filters from sessionStorage */
function readSavedFilters(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export default function InboxPage() {
  const { token, user } = useAuth()
  const router = useRouter()
  const isAdmin = user?.role === "admin"
  const isViewer = user?.role === "viewer"
  const canSeeAll = isAdmin || isViewer
  const isFullAdmin = isAdmin && (!user?.adminScopeType || user.adminScopeType === "all")

  // Restore from sessionStorage on client mount
  const saved = useRef<Record<string, string> | null>(null)
  if (saved.current === null && typeof window !== "undefined") {
    saved.current = readSavedFilters()
  }
  const s = saved.current || {}

  const [demands, setDemands] = useState<Demand[]>([])
  const [total, setTotal] = useState(0)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState(s.q || "")
  const [debouncedSearch, setDebouncedSearch] = useState(s.q || "")
  const [filterStatus, setFilterStatus] = useState(s.status || "all")
  const [filterOrg, setFilterOrg] = useState(s.org || "all")
  const [filterSubmitter, setFilterSubmitter] = useState(s.submitter || "all")
  const [filterDeveloper, setFilterDeveloper] = useState(s.developer || "all")
  const [filterSignoff, setFilterSignoff] = useState(s.signoff || "all")
  const [submitterOptions, setSubmitterOptions] = useState<FilterOption[]>([])
  const [developerOptions, setDeveloperOptions] = useState<FilterOption[]>([])
  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([])
  const [submitterOpen, setSubmitterOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Demand | null>(null)
  const [holdTarget, setHoldTarget] = useState<Demand | null>(null)
  const [holdReason, setHoldReason] = useState("")
  const [holdLoading, setHoldLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(() => {
    const p = parseInt(s.page || "1", 10)
    return p > 0 ? p : 1
  })
  const ITEMS_PER_PAGE = 12

  // Persist filters to sessionStorage on change
  useEffect(() => {
    const data: Record<string, string> = {}
    if (filterStatus !== "all") data.status = filterStatus
    if (filterOrg !== "all") data.org = filterOrg
    if (filterSubmitter !== "all") data.submitter = filterSubmitter
    if (filterDeveloper !== "all") data.developer = filterDeveloper
    if (filterSignoff !== "all") data.signoff = filterSignoff
    if (debouncedSearch) data.q = debouncedSearch
    if (currentPage > 1) data.page = String(currentPage)
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch {}
  }, [filterStatus, filterOrg, filterSubmitter, filterDeveloper, filterSignoff, debouncedSearch, currentPage])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchDemands = useCallback(async (showLoading = false) => {
    if (!token) return
    if (showLoading) setLoading(true)
    try {
      const params = new URLSearchParams()
      if (!canSeeAll && user?.id) params.set("developerId", user.id)
      if (filterStatus !== "all") params.set("status", filterStatus)
      if (canSeeAll && filterOrg !== "all") params.set("organizationId", filterOrg)
      if (canSeeAll && filterSubmitter !== "all") params.set("submitterId", filterSubmitter)
      if (canSeeAll && filterDeveloper !== "all") params.set("developerId", filterDeveloper)
      if (debouncedSearch) params.set("search", debouncedSearch)

      const res = await fetch(`/api/demands?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setDemands(data.demands)
        setTotal(data.total)
        setStatusCounts(data.statusCounts)
        if (data.filters) {
          setSubmitterOptions(data.filters.submitters)
          setDeveloperOptions(data.filters.developers)
          if (data.filters.organizations) setOrgOptions(data.filters.organizations)
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [token, isAdmin, user?.id, filterStatus, filterOrg, filterSubmitter, filterDeveloper, debouncedSearch])

  useEffect(() => {
    fetchDemands(true)
  }, [fetchDemands])

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

  const handleHold = async () => {
    if (!token || !holdTarget) return
    setHoldLoading(true)
    try {
      const res = await fetch(`/api/demands/${holdTarget.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ON_HOLD", holdReason: holdReason.trim() || null }),
      })
      if (res.ok) {
        setHoldTarget(null)
        setHoldReason("")
        fetchDemands()
      }
    } catch { /* ignore */ } finally {
      setHoldLoading(false)
    }
  }

  const handleResume = async (demand: Demand) => {
    if (!token) return
    try {
      const res = await fetch(`/api/demands/${demand.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ resume: true }),
      })
      if (res.ok) fetchDemands()
    } catch { /* ignore */ }
  }

  // Reset page when filters change (skip first render — state already restored from storage)
  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return }
    setCurrentPage(1)
  }, [filterStatus, filterOrg, filterSubmitter, filterDeveloper, filterSignoff, debouncedSearch])

  // Client-side signoff status filter
  const filteredDemands = useMemo(() => {
    if (filterSignoff === "all") return demands
    if (filterSignoff === "approved") return demands.filter(d => d.hasCurrentPhaseApproved)
    if (filterSignoff === "rejected") return demands.filter(d => d.hasCurrentPhaseReject)
    return demands
  }, [demands, filterSignoff])

  const totalPages = Math.max(1, Math.ceil(filteredDemands.length / ITEMS_PER_PAGE))
  const paginatedDemands = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredDemands.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredDemands, currentPage, ITEMS_PER_PAGE])

  const getCount = (status: string) => statusCounts[status] || 0
  const confirmStage = getCount("SUBMITTED") + getCount("PRD_REVIEW") + getCount("SP_REVIEW")
  const devStage = getCount("DEVELOPING") + getCount("ACCEPTANCE")
  // Filtered submitter options based on selected org
  const filteredSubmitterOptions = useMemo(() => {
    const list = filterOrg === "all" ? submitterOptions : submitterOptions.filter((u) => u.organizationId === filterOrg)
    return [...list].sort((a, b) => {
      const orgCmp = (a.organizationName || "").localeCompare(b.organizationName || "", "zh-Hant")
      if (orgCmp !== 0) return orgCmp
      return a.name.localeCompare(b.name, "zh-Hant")
    })
  }, [submitterOptions, filterOrg])

  // Group submitters by organization for the combobox
  const submitterGroups = useMemo(() => {
    const map = new Map<string, FilterOption[]>()
    for (const u of filteredSubmitterOptions) {
      const org = u.organizationName || "其他"
      if (!map.has(org)) map.set(org, [])
      map.get(org)!.push(u)
    }
    return Array.from(map.entries())
  }, [filteredSubmitterOptions])

  const hasActiveFilters = filterStatus !== "all" || filterOrg !== "all" || filterSubmitter !== "all" || filterDeveloper !== "all" || filterSignoff !== "all"

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {canSeeAll ? "需求管理" : "需求列表"}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              {isViewer ? "查看所有需求與開發進度" : isAdmin ? "建立與追蹤所有需求的開案流程" : "查看指派給您的需求與開發進度"}
            </p>
          </div>
          {isFullAdmin && (
            <Button asChild size="sm" className="shrink-0 sm:size-default">
              <Link href="/governance/create">
                <Plus className="mr-1 sm:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">建立需求</span>
                <span className="sm:hidden">新增</span>
              </Link>
            </Button>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
          {[
            { label: "全部需求", sub: canSeeAll ? "累計建立" : "指派給我", value: total, color: "border-l-blue-500", icon: Inbox },
            { label: "確認階段", sub: "需求 / MVP / 開案", value: confirmStage, color: "border-l-amber-500", icon: ClipboardList },
            { label: "開發中", sub: "開發 + 驗收", value: devStage, color: "border-l-violet-500", icon: Code2 },
            { label: "已結案", sub: "驗收完成", value: getCount("CLOSED"), color: "border-l-emerald-500", icon: CircleCheckBig },
          ].map((item) => (
            <div key={item.label} className={`flex items-center gap-3 sm:gap-4 rounded-lg border-l-4 ${item.color} border bg-card p-3 sm:p-4`}>
              <span className="text-2xl sm:text-3xl font-bold">{item.value}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="font-medium text-xs sm:text-sm">{item.label}</p>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filter Bar: search left, filters right */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-muted/50 p-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜尋需求標題、編號或子公司..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canSeeAll && orgOptions.length > 0 && (
              <Select value={filterOrg} onValueChange={(v) => {
                setFilterOrg(v)
                // Reset submitter when org changes (selected submitter may not belong to new org)
                setFilterSubmitter("all")
              }}>
                <SelectTrigger className="w-auto min-w-[100px] sm:w-[140px]">
                  <SelectValue placeholder="組織" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部組織</SelectItem>
                  {orgOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {canSeeAll && (
              <Popover open={submitterOpen} onOpenChange={setSubmitterOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={submitterOpen} className="w-auto min-w-[100px] sm:w-[160px] justify-between font-normal">
                    <span className="truncate">
                      {filterSubmitter === "all"
                        ? "全部需求者"
                        : filteredSubmitterOptions.find((u) => u.id === filterSubmitter)?.name || "全部需求者"}
                    </span>
                    <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="搜尋需求者..." />
                    <CommandList>
                      <CommandEmpty>找不到需求者</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="全部需求者"
                          onSelect={() => { setFilterSubmitter("all"); setSubmitterOpen(false) }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", filterSubmitter === "all" ? "opacity-100" : "opacity-0")} />
                          全部需求者
                        </CommandItem>
                      </CommandGroup>
                      {submitterGroups.map(([orgName, users]) => (
                        <CommandGroup key={orgName} heading={orgName}>
                          {users.map((u) => (
                            <CommandItem
                              key={u.id}
                              value={`${u.name} ${u.organizationName || ""}`}
                              onSelect={() => { setFilterSubmitter(u.id); setSubmitterOpen(false) }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", filterSubmitter === u.id ? "opacity-100" : "opacity-0")} />
                              <span className="truncate">{u.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
            {canSeeAll && (
              <Select value={filterDeveloper} onValueChange={setFilterDeveloper}>
                <SelectTrigger className="w-auto min-w-[100px] sm:w-[140px]">
                  <SelectValue placeholder="開發者" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部開發者</SelectItem>
                  <SelectItem value="unassigned">尚未指派</SelectItem>
                  {developerOptions.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-auto min-w-[100px] sm:w-[140px]">
                <SelectValue placeholder="狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部狀態</SelectItem>
                {Object.entries(STATUS_MAP).map(([key, info]) => (
                  <SelectItem key={key} value={key}>
                    {info.label} ({getCount(key)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(isAdmin || user?.role === "delivery") && (
              <Select value={filterSignoff} onValueChange={setFilterSignoff}>
                <SelectTrigger className="w-auto min-w-[100px] sm:w-[140px]">
                  <SelectValue placeholder="審核狀態" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部審核</SelectItem>
                  <SelectItem value="approved">已通過</SelectItem>
                  <SelectItem value="rejected">已駁回</SelectItem>
                </SelectContent>
              </Select>
            )}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => {
                  setFilterStatus("all")
                  setFilterOrg("all")
                  setFilterSubmitter("all")
                  setFilterDeveloper("all")
                  setFilterSignoff("all")
                }}
              >
                清除篩選
              </Button>
            )}
          </div>
        </div>

        {/* Demand List */}
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
              <Inbox className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">
                {isAdmin ? "尚無資料" : "目前沒有指派給您的需求"}
              </p>
              {isFullAdmin && !debouncedSearch && !hasActiveFilters && (
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
          <>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {paginatedDemands.map((demand) => {
                const statusInfo = STATUS_MAP[demand.status] || { label: demand.status, color: "bg-gray-100 text-gray-700" }
                return (
                  <Card key={demand.id} className="hover:shadow-md hover:border-primary/30 transition-all h-full">
                    <CardContent className="px-4 py-3 space-y-2">
                      {/* Row 1: number + status */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-muted-foreground">{demand.demandNumber}</span>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          <Badge variant="secondary" className={cn("text-xs px-2 py-0", statusInfo.color)}>
                            {statusInfo.label}
                            {demand.hasPendingDesignChange && <span className="ml-1">- 設計變更</span>}
                          </Badge>
                          {demand.hasCurrentPhaseApproved && (isAdmin || user?.role === "delivery") && (
                            <Badge variant="secondary" className="text-xs px-2 py-0 bg-green-100 text-green-700">
                              已通過
                            </Badge>
                          )}
                          {demand.hasCurrentPhaseReject && (isAdmin || user?.role === "delivery") && (
                            <Badge variant="secondary" className="text-xs px-2 py-0 bg-red-100 text-red-700">
                              已駁回
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Title */}
                      <p className="font-semibold leading-snug line-clamp-2">{demand.title}</p>

                      {/* Hold reason */}
                      {demand.status === "ON_HOLD" && demand.holdReason && (
                        <div className="flex items-start gap-1.5 text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1">
                          <PauseCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span className="line-clamp-2">{demand.holdReason}</span>
                        </div>
                      )}

                      <hr className="border-border/60" />

                      {/* Meta row + actions */}
                      <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground gap-2">
                        <div className="flex items-center gap-x-1.5 sm:gap-x-2 gap-y-0.5 flex-wrap min-w-0">
                          <span className="flex items-center gap-1 shrink-0">
                            <Building2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            <span className="truncate max-w-[5rem] sm:max-w-none">{demand.organization}</span>
                          </span>
                          {demand.contactPerson && (
                            <>
                              <span>·</span>
                              <span className="truncate max-w-[4rem] sm:max-w-none">{demand.contactPerson}</span>
                            </>
                          )}
                          <span>·</span>
                          <span className="shrink-0">{demand.confirmedSp ?? demand.estimatedSp} SP</span>
                          <span className="hidden sm:inline">·</span>
                          <span className="hidden sm:flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            {demand.developer || "尚未指派"}
                          </span>
                        </div>

                        {isFullAdmin ? (
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
                              {demand.status === "ON_HOLD" ? (
                                <DropdownMenuItem onClick={() => handleResume(demand)}>
                                  <PlayCircle className="h-3.5 w-3.5 mr-2 text-emerald-600" />
                                  恢復進行
                                </DropdownMenuItem>
                              ) : demand.status !== "CLOSED" && demand.status !== "REJECTED" ? (
                                <DropdownMenuItem onClick={() => { setHoldTarget(demand); setHoldReason("") }}>
                                  <PauseCircle className="h-3.5 w-3.5 mr-2 text-yellow-600" />
                                  設為暫緩
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(demand)}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                刪除需求
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" asChild>
                            <Link href={`/governance/demands/${demand.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 sm:gap-3 pt-4">
                <Button
                  variant="outline" size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-10 sm:h-9 px-3"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  上一頁
                </Button>
                <span className="text-sm text-muted-foreground sm:hidden">{currentPage} / {totalPages}</span>
                <div className="hidden sm:flex items-center gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="h-9 w-9 p-0"
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-10 sm:h-9 px-3"
                >
                  下一頁
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

            <div className="text-center text-sm text-muted-foreground pt-2">
              顯示 {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredDemands.length)} 筆，共 {filteredDemands.length} 筆需求
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要刪除此需求？</AlertDialogTitle>
            <AlertDialogDescription>
              將永久刪除需求「{deleteTarget?.title}」（{deleteTarget?.demandNumber}）及其所有相關資料，包含文件、子任務、狀態紀錄等。此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteTarget) handleDelete(deleteTarget.id); setDeleteTarget(null) }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              確定刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hold reason dialog */}
      <Dialog open={!!holdTarget} onOpenChange={(open) => { if (!open) { setHoldTarget(null); setHoldReason("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>設為暫緩</DialogTitle>
            <DialogDescription>
              將需求「{holdTarget?.title}」（{holdTarget?.demandNumber}）設為暫緩狀態。此專案不會被取消，後續可隨時恢復進行。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="holdReason">暫緩原因</Label>
            <Textarea
              id="holdReason"
              placeholder="請輸入暫緩原因（例如：等待使用者提供完整 Mapping 表）"
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setHoldTarget(null); setHoldReason("") }}>
              取消
            </Button>
            <Button onClick={handleHold} disabled={holdLoading} className="bg-yellow-600 hover:bg-yellow-700 text-white">
              {holdLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PauseCircle className="h-4 w-4 mr-2" />}
              確定暫緩
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

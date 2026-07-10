"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, ChevronLeft, ChevronRight, Loader2, Inbox, ClipboardCheck } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

const ITEMS_PER_PAGE = 9

interface Demand {
  id: string
  demandNumber: string
  title: string
  description: string
  status: string
  estimatedSp: number
  confirmedSp: number | null
  desiredDate: string | null
  createdAt: string
  manager: string | null
  developer: string | null
  hasPendingDesignChange: boolean
}

const STATUS_MAP: Record<string, { label: string; color: string; badge: string }> = {
  SUBMITTED: { label: "需求確認", color: "bg-blue-500 text-white", badge: "bg-blue-50 text-blue-700 ring-blue-200" },
  PRD_REVIEW: { label: "MVP 確認", color: "bg-amber-500 text-white", badge: "bg-amber-50 text-amber-700 ring-amber-200" },
  SP_REVIEW: { label: "開案確認", color: "bg-orange-500 text-white", badge: "bg-orange-50 text-orange-700 ring-orange-200" },
  DEVELOPING: { label: "開發中", color: "bg-violet-500 text-white", badge: "bg-violet-50 text-violet-700 ring-violet-200" },
  ACCEPTANCE: { label: "驗收中", color: "bg-purple-500 text-white", badge: "bg-purple-50 text-purple-700 ring-purple-200" },
  CLOSED: { label: "已結案", color: "bg-gray-400 text-white", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  REJECTED: { label: "已駁回", color: "bg-red-500 text-white", badge: "bg-red-50 text-red-700 ring-red-200" },
  ON_HOLD: { label: "暫緩", color: "bg-yellow-500 text-white", badge: "bg-yellow-50 text-yellow-700 ring-yellow-200" },
  CANCELLED: { label: "已取消", color: "bg-slate-500 text-white", badge: "bg-slate-100 text-slate-600 ring-slate-200" },
  TERMINATED: { label: "已終止", color: "bg-zinc-500 text-white", badge: "bg-zinc-100 text-zinc-700 ring-zinc-200" },
}

const STATUS_KEYS = ["SUBMITTED", "PRD_REVIEW", "SP_REVIEW", "DEVELOPING", "ACCEPTANCE", "CLOSED", "TERMINATED", "REJECTED"]

function formatDateReadable(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

function DemandCard({ demand, hasPendingSignoff }: { demand: Demand; hasPendingSignoff?: boolean }) {
  const statusInfo = STATUS_MAP[(demand.status === "CLOSED" && (demand as unknown as { isTerminated?: boolean }).isTerminated) ? "TERMINATED" : demand.status] || { label: demand.status, color: "bg-gray-400 text-white", badge: "bg-gray-50 text-gray-600 ring-gray-200" }
  const sp = demand.confirmedSp ?? demand.estimatedSp

  const ownerInfo = (() => {
    if (demand.manager && demand.developer) return `PM ${demand.manager} / 開發 ${demand.developer}`
    if (demand.manager) return `PM ${demand.manager}`
    if (demand.developer) return `開發 ${demand.developer}`
    return null
  })()

  return (
    <Link
      href={`/subsidiary/demands/${demand.id}`}
      className="group block rounded-xl border bg-card p-3 sm:p-4 transition-all hover:shadow-md hover:border-primary/30"
    >
      {/* Row 1: status + signoff + demand number */}
      <div className="flex items-center justify-between mb-1.5 sm:mb-2">
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
          <span className={cn("inline-block px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold ring-1 ring-inset shrink-0", statusInfo.badge)}>
            {statusInfo.label}
            {demand.hasPendingDesignChange && <span className="ml-1">- 設計變更</span>}
          </span>
          {hasPendingSignoff && (
            <span className="inline-flex items-center gap-0.5 px-1 sm:px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 text-[9px] sm:text-[10px] font-semibold shrink-0">
              <ClipboardCheck className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              待簽核
            </span>
          )}
        </div>
        <span className="text-[10px] sm:text-[11px] font-mono text-muted-foreground shrink-0 ml-2">{demand.demandNumber}</span>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-foreground text-xs sm:text-sm leading-snug mb-1.5 sm:mb-2 group-hover:text-primary transition-colors line-clamp-2">
        {demand.title}
      </h3>

      {/* Bottom: owner + date + SP */}
      <div className="flex items-center justify-between pt-1.5 sm:pt-2 border-t border-border/60 text-[10px] sm:text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {ownerInfo && <span className="truncate">{ownerInfo}</span>}
          {ownerInfo && <span>·</span>}
          <span className="shrink-0">
            {demand.desiredDate
              ? `預計 ${formatDateReadable(demand.desiredDate)}`
              : `${formatDateReadable(demand.createdAt)} 提交`}
          </span>
        </div>
        <span className="text-sm sm:text-base font-bold text-foreground ml-2 sm:ml-3 shrink-0">
          {sp} <span className="text-[10px] sm:text-xs font-normal text-muted-foreground">SP</span>
        </span>
      </div>
    </Link>
  )
}

export default function MyDemandsPage() {
  const { token, user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [demands, setDemands] = useState<Demand[]>([])
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [spSummary, setSpSummary] = useState<{ totalQuota: number; usedSp: number; byVendor?: { vendor: string; totalQuota: number; usedSp: number; availableSp: number }[] }>({ totalQuota: 0, usedSp: 0 })

  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pendingSignoffIds, setPendingSignoffIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch pending signoffs
  useEffect(() => {
    if (!token) return
    fetch("/api/signoffs/pending", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.demands) {
          setPendingSignoffIds(new Set(data.demands.map((d: { id: string }) => d.id)))
        }
      })
      .catch(() => {})
  }, [token])

  const fetchDemands = useCallback(async () => {
    if (!token || !user?.organizationId) return
    try {
      const params = new URLSearchParams()
      params.set("organizationId", user.organizationId)
      if (debouncedSearch) params.set("search", debouncedSearch)

      const res = await fetch(`/api/demands?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setDemands(data.demands)
        setStatusCounts(data.statusCounts)
        if (data.spSummary) setSpSummary(data.spSummary)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [token, user?.organizationId, debouncedSearch])

  useEffect(() => { fetchDemands() }, [fetchDemands])

  // Client-side tab filtering
  const filteredDemands = useMemo(() => {
    if (activeTab === "all") return demands
    if (activeTab === "signoff") return demands.filter((d) => d.status !== "CLOSED" && d.status !== "REJECTED" && pendingSignoffIds.has(d.id))
    return demands.filter((d) => d.status === activeTab)
  }, [demands, activeTab, pendingSignoffIds])

  const totalPages = Math.max(1, Math.ceil(filteredDemands.length / ITEMS_PER_PAGE))
  const paginatedDemands = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredDemands.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredDemands, currentPage])

  useEffect(() => { setCurrentPage(1) }, [activeTab, debouncedSearch])

  const activeSignoffCount = useMemo(() =>
    demands.filter((d) => d.status !== "CLOSED" && d.status !== "REJECTED" && pendingSignoffIds.has(d.id)).length
  , [demands, pendingSignoffIds])

  const getCount = (key: string) => {
    if (key === "all") return demands.length
    if (key === "signoff") return activeSignoffCount
    return statusCounts[key] || 0
  }

  const remainingSp = spSummary.totalQuota - spSummary.usedSp

  if (loading) {
    return (
      <AppLayout userRole="subsidiary">
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout userRole="subsidiary">
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">我的需求</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">追蹤您提交的所有需求狀態</p>
          </div>
          {!user?.restrictedView && (
            <TooltipProvider>
              <div className="flex items-center gap-4 sm:gap-6">
                {[
                  { value: remainingSp, label: "可用 SP", color: "text-emerald-600",
                    tip: spSummary.byVendor?.map(v => `${v.vendor}: 可用 ${v.availableSp}`) },
                  { value: spSummary.usedSp, label: "已使用 SP", color: "text-primary",
                    tip: spSummary.byVendor?.map(v => `${v.vendor}: 已用 ${v.usedSp}`) },
                  { value: spSummary.totalQuota, label: "年度配額", color: "text-muted-foreground",
                    tip: spSummary.byVendor?.map(v => `${v.vendor}: ${v.totalQuota}`) },
                ].map((item) => {
                  const cell = (
                    <div className="text-center">
                      <div className={`text-lg sm:text-2xl font-bold ${item.color}`}>{item.value}</div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground">{item.label}</div>
                    </div>
                  )
                  if (item.tip && item.tip.length > 1) {
                    return (
                      <Tooltip key={item.label}>
                        <TooltipTrigger asChild>{cell}</TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs space-y-0.5">
                          {item.tip.map((line, i) => <div key={i}>{line}</div>)}
                        </TooltipContent>
                      </Tooltip>
                    )
                  }
                  return <div key={item.label}>{cell}</div>
                })}
              </div>
            </TooltipProvider>
          )}
        </div>

        {/* Search (mobile: full width above tabs) */}
        <div className="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-3 border-b border-border pb-3">
          <div className="relative w-full sm:w-64 sm:order-2 shrink-0">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜尋需求..."
              className="pl-8 sm:pl-9 h-8 sm:h-9 text-xs sm:text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 overflow-x-auto sm:order-1 no-scrollbar">
            {[
              { key: "all", label: "全部" },
              ...(activeSignoffCount > 0 ? [{ key: "signoff", label: "待簽核" }] : []),
              ...STATUS_KEYS.map((k) => ({ key: k, label: STATUS_MAP[k].label })),
            ].map((tab) => {
              const count = getCount(tab.key)
              const isActive = activeTab === tab.key
              const isSignoff = tab.key === "signoff"

              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "relative px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap shrink-0",
                    isActive && isSignoff
                      ? "bg-amber-500 text-white shadow-sm"
                      : isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : isSignoff
                          ? "text-amber-600 bg-amber-50 hover:bg-amber-100"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  {tab.label}
                  <span className={cn("ml-1 sm:ml-1.5", isActive ? "text-white/80" : isSignoff ? "text-amber-600/80" : "text-muted-foreground")}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Demand Grid */}
        {filteredDemands.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-muted-foreground">
            <Inbox className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/30 mb-3 sm:mb-4" />
            <p className="text-xs sm:text-sm">沒有符合條件的需求</p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {paginatedDemands.map((demand) => (
                <DemandCard key={demand.id} demand={demand} hasPendingSignoff={demand.status !== "CLOSED" && demand.status !== "REJECTED" && pendingSignoffIds.has(demand.id)} />
              ))}
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
                <div className="hidden sm:flex items-center gap-1">
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

            <div className="text-center text-xs sm:text-sm text-muted-foreground">
              顯示 {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredDemands.length)} 筆，共 {filteredDemands.length} 筆需求
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}

"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, ChevronLeft, ChevronRight, Loader2, Inbox } from "lucide-react"
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
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  SUBMITTED: { label: "需求確認", color: "bg-blue-500 text-white" },
  PRD_REVIEW: { label: "MVP 確認", color: "bg-amber-500 text-white" },
  SP_REVIEW: { label: "開案確認", color: "bg-orange-500 text-white" },
  DEVELOPING: { label: "開發中", color: "bg-violet-500 text-white" },
  ACCEPTANCE: { label: "驗收中", color: "bg-purple-500 text-white" },
  CLOSED: { label: "已結案", color: "bg-gray-400 text-white" },
  REJECTED: { label: "已駁回", color: "bg-red-500 text-white" },
}

const STATUS_KEYS = ["SUBMITTED", "PRD_REVIEW", "SP_REVIEW", "DEVELOPING", "ACCEPTANCE", "CLOSED", "REJECTED"]

function formatDateReadable(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

function DemandCard({ demand }: { demand: Demand }) {
  const statusInfo = STATUS_MAP[demand.status] || { label: demand.status, color: "bg-gray-400 text-white" }
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
      className="group block rounded-xl border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30"
    >
      {/* Row 1: status + demand number */}
      <div className="flex items-center justify-between mb-1.5">
        <div className={cn("inline-block px-2 py-0.5 rounded text-[11px] font-medium", statusInfo.color)}>
          {statusInfo.label}
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">{demand.demandNumber}</span>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-foreground text-sm leading-snug mb-1 group-hover:text-primary transition-colors">
        {demand.title}
      </h3>

      {/* Bottom: owner + date + SP */}
      <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2 min-w-0">
          {ownerInfo && <span className="truncate">{ownerInfo}</span>}
          {ownerInfo && <span>·</span>}
          <span className="shrink-0">
            {demand.desiredDate
              ? `預計 ${formatDateReadable(demand.desiredDate)}`
              : `${formatDateReadable(demand.createdAt)} 提交`}
          </span>
        </div>
        <span className="text-base font-bold text-foreground ml-3 shrink-0">
          {sp} <span className="text-xs font-normal text-muted-foreground">SP</span>
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
  const [spSummary, setSpSummary] = useState({ totalQuota: 0, committedSp: 0, usedSp: 0 })

  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

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
    return demands.filter((d) => d.status === activeTab)
  }, [demands, activeTab])

  const totalPages = Math.max(1, Math.ceil(filteredDemands.length / ITEMS_PER_PAGE))
  const paginatedDemands = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredDemands.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredDemands, currentPage])

  useEffect(() => { setCurrentPage(1) }, [activeTab, debouncedSearch])

  const getCount = (key: string) => {
    if (key === "all") return demands.length
    return statusCounts[key] || 0
  }

  const remainingSp = spSummary.totalQuota - spSummary.committedSp - spSummary.usedSp

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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">我的需求</h1>
            <p className="text-sm text-muted-foreground mt-0.5">追蹤您提交的所有需求狀態</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">{remainingSp}</div>
              <div className="text-xs text-muted-foreground">可用 SP</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{spSummary.committedSp}</div>
              <div className="text-xs text-muted-foreground">已承諾 SP</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{spSummary.usedSp}</div>
              <div className="text-xs text-muted-foreground">已使用 SP</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-muted-foreground">{spSummary.totalQuota}</div>
              <div className="text-xs text-muted-foreground">年度配額</div>
            </div>
          </div>
        </div>

        {/* Tabs + Search (same row) */}
        <div className="flex items-center gap-3 border-b border-border pb-3 overflow-x-auto">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {[{ key: "all", label: "全部" }, ...STATUS_KEYS.map((k) => ({ key: k, label: STATUS_MAP[k].label }))].map((tab) => {
              const count = getCount(tab.key)
              const isActive = activeTab === tab.key

              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "relative px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap shrink-0",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  {tab.label}
                  <span className={cn("ml-1.5", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="relative w-64 shrink-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜尋需求..."
              className="pl-9 h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Demand Grid */}
        {filteredDemands.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Inbox className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p>沒有符合條件的需求</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedDemands.map((demand) => (
                <DemandCard key={demand.id} demand={demand} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  variant="outline" size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-9 px-3"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  上一頁
                </Button>
                <div className="flex items-center gap-1">
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
                  className="h-9 px-3"
                >
                  下一頁
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

            <div className="text-center text-sm text-muted-foreground">
              顯示 {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredDemands.length)} 筆，共 {filteredDemands.length} 筆需求
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}

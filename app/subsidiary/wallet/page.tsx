"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Inbox } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { STATUS_MAP, formatSp, demandStatusKey } from "@/lib/constants/demand"

/** Vendor color palette */
const VENDOR_COLORS = ["#3b82f6", "#f59e0b", "#8b5cf6", "#10b981", "#ef4444", "#06b6d4"]

/**
 * 直接沿用全站的狀態對照表，避免這裡漏掉暫緩／已取消／已駁回等狀態時，
 * 畫面上會冒出 ON_HOLD 這種原始鍵值。
 */
const STATUS_LABEL = STATUS_MAP

/**
 * 實際認列比例由「已認列 SP ÷ 需求 SP」反推，不看階段硬表。
 * 開發中若已完成首次 APP 交付確認即認列 75%，用階段對照表會誤標成 50%。
 */
function usedPctOf(spUsed: number, sp: number): number {
  return sp > 0 ? Math.round((spUsed / sp) * 100) : 0
}

interface WalletData {
  year: number
  totalQuota: number
  usedSp: number
  availableSp: number
  /** 已開案、尚未認列的部分（必然會發生） */
  committedSp?: number
  /** 已提出但尚未開案（含暫緩）的預估 SP */
  plannedSp?: number
  /** 扣掉已認列與已承諾後，真正還能規劃的額度 */
  plannableSp?: number
  byVendor?: { vendor: string; totalQuota: number; usedSp: number; committedSp?: number; plannedSp?: number; availableSp: number; plannableSp?: number; demands: { id: string; demandNumber: string; title: string; status: string; sp: number; estimatedSp?: number; spUsed: number; spCommitted?: number; spPlanned?: number; settlementType?: string | null; isTerminated?: boolean; vendor: string; updatedAt: string }[] }[]
  demands: {
    id: string
    demandNumber: string
    title: string
    status: string
    sp: number
    estimatedSp?: number
    spUsed: number
    spCommitted?: number
    spPlanned?: number
    settlementType?: string | null
    /** 經終止開發結案者，狀態仍為 CLOSED，但客戶認知是「已終止」 */
    isTerminated?: boolean
    vendor?: string
    updatedAt: string
  }[]
}

export default function WalletPage() {
  const { token, user } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<WalletData | null>(null)
  const [loading, setLoading] = useState(true)
  /** 右上角的廠商篩選：all = 全部合計 */
  const [vendorFilter, setVendorFilter] = useState<string>("all")

  useEffect(() => {
    if (user?.restrictedView) router.replace("/subsidiary/demands")
  }, [user?.restrictedView, router])

  useEffect(() => {
    if (!token) return
    fetch("/api/sp-wallet", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <AppLayout userRole="subsidiary">
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  const year = data?.year ?? new Date().getFullYear()
  const allDemands = data?.demands ?? []
  const vendors = data?.byVendor?.map((v) => v.vendor) ?? []

  /**
   * 額度只呈現「已認列」與「未認列」兩層。
   *
   * 已承諾／規劃中雖然算得出來（API 仍有回傳），但那兩層會隨開案與估點浮動、
   * 不保證走到結案；這個平台是開發方的帳，帳面只認確定發生的數字，
   * 故不對需求方呈現，避免看起來額度將盡而不敢提需求。
   */
  const scope = vendorFilter === "all"
    ? { totalQuota: data?.totalQuota ?? 0, usedSp: data?.usedSp ?? 0 }
    : (() => {
        const v = data?.byVendor?.find((x) => x.vendor === vendorFilter)
        return { totalQuota: v?.totalQuota ?? 0, usedSp: v?.usedSp ?? 0 }
      })()

  const totalQuota = scope.totalQuota
  const usedSp = scope.usedSp
  const unusedSp = totalQuota - usedSp
  const demands = vendorFilter === "all" ? allDemands : allDemands.filter((d) => d.vendor === vendorFilter)

  const pct = (n: number) => (totalQuota > 0 ? (n / totalQuota) * 100 : 0)

  return (
    <AppLayout userRole="subsidiary">
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">SP 錢包</h1>
          <p className="text-xs sm:text-base text-muted-foreground">管理您的 Story Points 配額與使用記錄</p>
        </div>

        {/* SP summary：只呈現已認列與未認列兩層 */}
        <Card>
          <CardContent className="pt-3 sm:pt-4 space-y-3 px-4 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold tabular-nums">{formatSp(totalQuota)}</span>
                <span className="text-xs sm:text-sm text-muted-foreground">SP 配額</span>
                {vendorFilter !== "all" && (
                  <Badge variant="outline" className="ml-1 text-[10px] font-normal">{vendorFilter}</Badge>
                )}
              </div>

              {vendors.length > 1 && (
                <div className="flex items-center rounded-md border p-0.5 shrink-0">
                  {["all", ...vendors].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVendorFilter(v)}
                      className={cn(
                        "rounded px-2 py-1 text-[11px] transition-colors sm:text-xs",
                        vendorFilter === v
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {v === "all" ? "全部" : v}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {totalQuota > 0 ? (
              <>
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-secondary sm:h-3">
                  {usedSp > 0 && (
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${pct(usedSp)}%` }}
                      title={`已認列 ${formatSp(usedSp)} SP`}
                    />
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 sm:gap-x-6">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-sm bg-blue-500" />
                    <span className="text-[11px] text-muted-foreground sm:text-xs">已認列</span>
                    <span className="text-sm font-semibold tabular-nums sm:text-base">{formatSp(usedSp)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-sm bg-slate-200" />
                    <span className="text-[11px] text-muted-foreground sm:text-xs">未認列</span>
                    <span className="text-sm font-semibold tabular-nums sm:text-base">{formatSp(unusedSp)}</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs sm:text-sm text-muted-foreground">尚未分配年度配額</p>
            )}
          </CardContent>
        </Card>

        {/* Demand SP Breakdown */}
        <Card className="overflow-hidden">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-base">
              需求 SP 明細
              <span className="ml-2 text-xs font-normal text-muted-foreground">{demands.length} 筆</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            {demands.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 sm:py-8 text-muted-foreground px-4">
                <Inbox className="h-8 w-8 sm:h-10 sm:w-10" />
                <p className="text-xs sm:text-sm">尚無需求資料</p>
              </div>
            ) : (
              <>
                {/* Mobile: card layout */}
                <div className="sm:hidden divide-y">
                  {demands.map((d) => {
                    // 終止開發結案的狀態仍是 CLOSED，顯示上要區分成「已終止」
                    const si = STATUS_LABEL[demandStatusKey(d.status, d.isTerminated)]
                    return (
                      <Link
                        key={d.id}
                        href={`/subsidiary/demands/${d.id}`}
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium truncate">{d.title}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-mono text-muted-foreground">{d.demandNumber}</span>
                            <Badge variant="secondary" className={cn("text-[9px] px-1 py-0 h-4", si?.color)}>
                              {si?.label ?? d.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <div className="text-xs font-semibold tabular-nums">
                            {d.estimatedSp != null && d.estimatedSp !== d.sp
                              ? <>{d.estimatedSp} <span className="text-muted-foreground">→</span> {d.sp} SP</>
                              : <>{d.sp} SP</>}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {d.settlementType === "override"
                              ? <>提前結算 {Math.round((d.sp / d.estimatedSp!) * 100)}%</>
                              : d.settlementType === "adjustment"
                              ? <>SP 調整</>
                              : d.spUsed === 0 ? <>尚未認列</> : <>認列 {d.spUsed} ({usedPctOf(d.spUsed, d.sp)}%)</>}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
                {/* Desktop: table layout */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-center w-32">編號</TableHead>
                        <TableHead className="text-center">需求名稱</TableHead>
                        <TableHead className="text-center">狀態</TableHead>
                        <TableHead className="text-center">SP</TableHead>
                        <TableHead className="text-center">結算</TableHead>
                        <TableHead className="text-center">已消耗</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {demands.map((d) => {
                        // 終止開發結案的狀態仍是 CLOSED，顯示上要區分成「已終止」
                    const si = STATUS_LABEL[demandStatusKey(d.status, d.isTerminated)]
                        return (
                          <TableRow key={d.id}>
                            <TableCell className="text-center">
                              <Link
                                href={`/subsidiary/demands/${d.id}`}
                                className="text-sm font-mono text-primary hover:underline"
                              >
                                {d.demandNumber}
                              </Link>
                            </TableCell>
                            <TableCell className="text-center text-sm max-w-[200px] truncate">{d.title}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className={cn("text-[11px]", si?.color)}>
                                {si?.label ?? d.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center tabular-nums">
                              {d.estimatedSp != null && d.estimatedSp !== d.sp ? (
                                <><span className="text-muted-foreground line-through text-xs">{d.estimatedSp}</span> <span className="font-semibold">{d.sp}</span></>
                              ) : (
                                <span className="font-semibold">{d.sp}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center text-xs">
                              {d.settlementType === "override" ? (
                                <span className="text-orange-600">提前結算 {Math.round((d.sp / d.estimatedSp!) * 100)}%</span>
                              ) : d.settlementType === "adjustment" ? (
                                <span className="text-blue-600">SP 調整</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-sm font-medium tabular-nums">{d.spUsed}</span>
                              <span className="text-xs text-muted-foreground ml-1">
                                {d.spUsed === 0 ? "（尚未認列）" : `(${usedPctOf(d.spUsed, d.sp)}%)`}
                              </span>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

      </div>
    </AppLayout>
  )
}

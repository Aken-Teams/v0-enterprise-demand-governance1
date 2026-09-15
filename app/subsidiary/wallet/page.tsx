"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Inbox, Info, AlertTriangle } from "lucide-react"
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
  /** 點四層額度可以只看該層的需求 */
  const [tierFilter, setTierFilter] = useState<string>("all")

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
   * 四層額度都可以只看單一開發商。選了廠商就取該廠商的錢包，
   * 否則取全部合計——兩者的欄位結構一致，下面的呈現不用分岔。
   */
  const scope = vendorFilter === "all"
    ? {
        totalQuota: data?.totalQuota ?? 0,
        usedSp: data?.usedSp ?? 0,
        committedSp: data?.committedSp ?? 0,
        plannedSp: data?.plannedSp ?? 0,
        plannableSp: data?.plannableSp ?? 0,
      }
    : (() => {
        const v = data?.byVendor?.find((x) => x.vendor === vendorFilter)
        return {
          totalQuota: v?.totalQuota ?? 0,
          usedSp: v?.usedSp ?? 0,
          committedSp: v?.committedSp ?? 0,
          plannedSp: v?.plannedSp ?? 0,
          plannableSp: v?.plannableSp ?? 0,
        }
      })()

  const totalQuota = scope.totalQuota
  const usedSp = scope.usedSp
  const committedSp = scope.committedSp
  const plannedSp = scope.plannedSp
  const plannableSp = scope.plannableSp
  const vendorDemands = vendorFilter === "all" ? allDemands : allDemands.filter((d) => d.vendor === vendorFilter)
  /**
   * 點某一層額度就只列出撐起那個數字的需求——四層加起來是多少一目了然，
   * 不必反過來自己對帳。「尚可規劃」沒有對應的需求，故不可點。
   */
  const demands = tierFilter === "all"
    ? vendorDemands
    : vendorDemands.filter((d) =>
        tierFilter === "used" ? d.spUsed > 0
        : tierFilter === "committed" ? (d.spCommitted ?? 0) > 0
        : (d.spPlanned ?? 0) > 0
      )

  const pct = (n: number) => (totalQuota > 0 ? (n / totalQuota) * 100 : 0)
  /** 提出量逼近配額時要主動示警，否則使用者只看「可用」會一路提到爆 */
  const overCommitted = totalQuota > 0 && plannableSp < totalQuota * 0.1

  const TIERS = [
    { key: "used", label: "已認列", value: usedSp, color: "bg-blue-500", dot: "bg-blue-500",
      desc: "已實際扣除的 SP，不會再變動。" },
    { key: "committed", label: "已承諾", value: committedSp, color: "bg-amber-400", dot: "bg-amber-400",
      desc: "已通過開案確認、尚未走到認列節點的部分，後續必然扣除。" },
    { key: "planned", label: "規劃中", value: plannedSp, color: "bg-sky-300", dot: "bg-sky-300",
      desc: "已提出但尚未開案（含暫緩）的預估 SP，可能調整估點，也可能以「取消」結束並全額釋放。" },
    { key: "plannable", label: "尚可規劃", value: Math.max(0, plannableSp), color: "bg-slate-200", dot: "bg-slate-300",
      desc: "配額扣掉上述三層後，還能安心提出新需求的額度。" },
  ]

  return (
    <AppLayout userRole="subsidiary">
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">SP 錢包</h1>
          <p className="text-xs sm:text-base text-muted-foreground">管理您的 Story Points 配額與使用記錄</p>
        </div>

        {/* SP summary — 四層額度：已認列／已承諾／規劃中／尚可規劃 */}
        <Card>
          <CardContent className="pt-3 sm:pt-4 space-y-3 px-4 sm:px-6">
            {/* 標題列：配額 + 右上角廠商篩選與說明 */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold tabular-nums">{formatSp(totalQuota)}</span>
                <span className="text-xs sm:text-sm text-muted-foreground">SP 配額</span>
                {vendorFilter !== "all" && (
                  <Badge variant="outline" className="ml-1 text-[10px] font-normal">{vendorFilter}</Badge>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {vendors.length > 1 && (
                  <div className="flex items-center rounded-md border p-0.5">
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
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" title="欄位說明">
                      <Info className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-[19rem] text-xs">
                    <p className="mb-2 font-medium text-foreground">四層額度怎麼看</p>
                    <div className="space-y-2">
                      {TIERS.map((t) => (
                        <div key={t.key} className="flex gap-2">
                          <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-sm", t.dot)} />
                          <div>
                            <p className="font-medium text-foreground">{t.label}</p>
                            <p className="text-muted-foreground leading-relaxed">{t.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 border-t pt-2 text-muted-foreground leading-relaxed">
                      流程文件定義的「可用餘額」＝ 配額 − 已認列 ＝ {formatSp(totalQuota - usedSp)} SP；
                      但其中已有部分被開案中與規劃中的需求佔住，故以「尚可規劃」作為提新需求的依據。
                    </p>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {totalQuota > 0 ? (
              <>
                {/* 四段式進度條 */}
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-secondary sm:h-3">
                  {TIERS.filter((t) => t.key !== "plannable").map((t) => (
                    t.value > 0 ? (
                      <div
                        key={t.key}
                        className={cn("h-full transition-all", t.color)}
                        style={{ width: `${pct(t.value)}%` }}
                        title={`${t.label} ${formatSp(t.value)} SP`}
                      />
                    ) : null
                  ))}
                </div>

                {/* 數字列：標籤與數字相鄰，四組靠左排在一起才讀得出對應關係 */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 sm:gap-x-6">
                  {TIERS.map((t) => {
                    const clickable = t.key !== "plannable"
                    return (
                      <button
                        key={t.key}
                        type="button"
                        disabled={!clickable}
                        onClick={() => setTierFilter(tierFilter === t.key ? "all" : t.key)}
                        className={cn(
                          "flex items-center gap-1.5 rounded px-1.5 py-0.5 -mx-1.5 transition-colors",
                          clickable && "hover:bg-muted",
                          tierFilter === t.key && "bg-muted ring-1 ring-border",
                        )}
                        title={clickable ? `只看${t.label}的需求` : undefined}
                      >
                        <span className={cn("h-2 w-2 shrink-0 rounded-sm", t.dot)} />
                        <span className="text-[11px] text-muted-foreground sm:text-xs">{t.label}</span>
                        <span className={cn(
                          "text-sm font-semibold tabular-nums sm:text-base",
                          t.key === "plannable" && overCommitted && "text-red-600",
                        )}>
                          {formatSp(t.value)}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {overCommitted && (
                  <p className="flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900 sm:text-xs">
                    <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                    <span>
                      本年度已認列／承諾／規劃中的 SP 合計已達配額的 {Math.round(((totalQuota - plannableSp) / totalQuota) * 100)}%，
                      尚可規劃僅剩 <span className="font-semibold">{formatSp(Math.max(0, plannableSp))}</span> SP。
                      再提出新需求可能無法於今年度開案，建議先與管理者確認額度。
                    </span>
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs sm:text-sm text-muted-foreground">尚未分配年度配額</p>
            )}
          </CardContent>
        </Card>

        {/* Demand SP Breakdown */}
        <Card className="overflow-hidden">
          <CardHeader className="px-4 sm:px-6">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm sm:text-base">
                需求 SP 明細
                <span className="ml-2 text-xs font-normal text-muted-foreground">{demands.length} 筆</span>
              </CardTitle>
              {tierFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setTierFilter("all")}
                  className="flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted sm:text-xs"
                >
                  只看「{TIERS.find((t) => t.key === tierFilter)?.label}」· 清除
                </button>
              )}
            </div>
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

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

const STATUS_LABEL: Record<string, { label: string; color: string; rate: string }> = {
  SUBMITTED: { label: "需求確認", color: "bg-blue-100 text-blue-700", rate: "不扣除" },
  PRD_REVIEW: { label: "MVP 確認", color: "bg-amber-100 text-amber-700", rate: "不扣除" },
  SP_REVIEW: { label: "開案確認", color: "bg-orange-100 text-orange-700", rate: "不扣除" },
  DEVELOPING: { label: "開發中", color: "bg-violet-100 text-violet-700", rate: "50%" },
  ACCEPTANCE: { label: "驗收中", color: "bg-purple-100 text-purple-700", rate: "75%" },
  CLOSED: { label: "已結案", color: "bg-emerald-100 text-emerald-700", rate: "100%" },
}

interface WalletData {
  year: number
  totalQuota: number
  usedSp: number
  availableSp: number
  demands: {
    id: string
    demandNumber: string
    title: string
    status: string
    sp: number
    spUsed: number
    updatedAt: string
  }[]
}

export default function WalletPage() {
  const { token, user } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<WalletData | null>(null)
  const [loading, setLoading] = useState(true)

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

  const totalQuota = data?.totalQuota ?? 0
  const year = data?.year ?? new Date().getFullYear()
  const demands = data?.demands ?? []

  const usedSp = data?.usedSp ?? 0
  const availableSp = data?.availableSp ?? (totalQuota - usedSp)

  const pctUsed = totalQuota > 0 ? (usedSp / totalQuota) * 100 : 0
  const pctAvailable = totalQuota > 0 ? (availableSp / totalQuota) * 100 : 0

  return (
    <AppLayout userRole="subsidiary">
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">SP 錢包</h1>
          <p className="text-xs sm:text-base text-muted-foreground">管理您的 Story Points 配額與使用記錄</p>
        </div>

        {/* Compact summary */}
        <Card>
          <CardContent className="pt-3 sm:pt-4 space-y-3 px-4 sm:px-6">
            {/* Numbers row */}
            <div className="flex items-baseline gap-3 sm:gap-6 flex-wrap">
              <div>
                <span className="text-2xl sm:text-3xl font-bold text-primary tabular-nums">{availableSp}</span>
                <span className="text-xs sm:text-sm text-muted-foreground ml-1 sm:ml-1.5">可用</span>
              </div>
              <span className="text-muted-foreground/30">/</span>
              <div>
                <span className="text-lg sm:text-xl font-semibold tabular-nums">{totalQuota}</span>
                <span className="text-xs sm:text-sm text-muted-foreground ml-1 sm:ml-1.5">配額</span>
              </div>
              <span className="text-muted-foreground/30">/</span>
              <div>
                <span className="text-lg sm:text-xl font-semibold tabular-nums">{usedSp}</span>
                <span className="text-xs sm:text-sm text-muted-foreground ml-1 sm:ml-1.5">已使用</span>
              </div>
            </div>

            {/* Stacked bar */}
            {totalQuota > 0 ? (
              <div>
                <div className="h-2.5 sm:h-3 w-full overflow-hidden rounded-full bg-secondary flex">
                  {pctUsed > 0 && (
                    <div className="h-full bg-chart-1 transition-all" style={{ width: `${pctUsed}%` }} />
                  )}
                </div>
                <div className="flex items-center gap-4 sm:gap-5 mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 sm:gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-sm bg-chart-1" />已使用 {pctUsed.toFixed(0)}%
                  </span>
                  <span className="flex items-center gap-1 sm:gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-sm bg-secondary" />剩餘 {pctAvailable.toFixed(0)}%
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-muted-foreground">尚未分配年度配額</p>
            )}
          </CardContent>
        </Card>

        {/* Demand SP Breakdown */}
        <Card className="overflow-hidden">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-base">需求 SP 明細</CardTitle>
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
                    const si = STATUS_LABEL[d.status]
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
                          <div className="text-xs font-semibold tabular-nums">{d.sp} SP</div>
                          <div className="text-[10px] text-muted-foreground">消耗 {d.spUsed} ({si?.rate})</div>
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
                        <TableHead className="text-center">已消耗</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {demands.map((d) => {
                        const si = STATUS_LABEL[d.status]
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
                            <TableCell className="text-center font-semibold tabular-nums">{d.sp}</TableCell>
                            <TableCell className="text-center">
                              <span className="text-sm font-medium tabular-nums">{d.spUsed}</span>
                              <span className="text-xs text-muted-foreground ml-1">({si?.rate})</span>
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

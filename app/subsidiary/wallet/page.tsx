"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Inbox } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import Link from "next/link"
import { cn } from "@/lib/utils"

const STATUS_LABEL: Record<string, { label: string; color: string; spCategory: string }> = {
  SUBMITTED: { label: "需求確認", color: "bg-blue-100 text-blue-700", spCategory: "pending" },
  PRD_REVIEW: { label: "MVP 確認", color: "bg-amber-100 text-amber-700", spCategory: "pending" },
  SP_REVIEW: { label: "開案確認", color: "bg-orange-100 text-orange-700", spCategory: "pending" },
  DEVELOPING: { label: "開發中", color: "bg-violet-100 text-violet-700", spCategory: "committed" },
  ACCEPTANCE: { label: "驗收中", color: "bg-purple-100 text-purple-700", spCategory: "committed" },
  CLOSED: { label: "已結案", color: "bg-emerald-100 text-emerald-700", spCategory: "used" },
}

interface WalletData {
  year: number
  totalQuota: number
  usedSp: number
  committedSp: number
  availableSp: number
  demands: {
    id: string
    demandNumber: string
    title: string
    status: string
    sp: number
    updatedAt: string
  }[]
}

export default function WalletPage() {
  const { token } = useAuth()
  const [data, setData] = useState<WalletData | null>(null)
  const [loading, setLoading] = useState(true)

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

  // Group demands by SP category
  const committedDemands = demands.filter((d) => STATUS_LABEL[d.status]?.spCategory === "committed")
  const usedDemands = demands.filter((d) => STATUS_LABEL[d.status]?.spCategory === "used")
  const pendingDemands = demands.filter((d) => STATUS_LABEL[d.status]?.spCategory === "pending")

  // Calculate from demands for guaranteed accuracy
  const usedSp = usedDemands.reduce((sum, d) => sum + d.sp, 0)
  const committedSp = committedDemands.reduce((sum, d) => sum + d.sp, 0)
  const availableSp = totalQuota - usedSp - committedSp

  const pctUsed = totalQuota > 0 ? (usedSp / totalQuota) * 100 : 0
  const pctCommitted = totalQuota > 0 ? (committedSp / totalQuota) * 100 : 0
  const pctAvailable = totalQuota > 0 ? (availableSp / totalQuota) * 100 : 0

  return (
    <AppLayout userRole="subsidiary">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">SP 錢包</h1>
          <p className="text-muted-foreground">管理您的 Story Points 配額與使用記錄</p>
        </div>

        {/* Compact summary */}
        <Card>
          <CardContent className="pt-4 space-y-3">
            {/* Numbers row */}
            <div className="flex items-baseline gap-6 flex-wrap">
              <div>
                <span className="text-3xl font-bold text-primary tabular-nums">{availableSp}</span>
                <span className="text-sm text-muted-foreground ml-1.5">可用</span>
              </div>
              <span className="text-muted-foreground/30">/</span>
              <div>
                <span className="text-xl font-semibold tabular-nums">{totalQuota}</span>
                <span className="text-sm text-muted-foreground ml-1.5">配額</span>
              </div>
              <span className="text-muted-foreground/30">/</span>
              <div>
                <span className="text-xl font-semibold tabular-nums">{usedSp}</span>
                <span className="text-sm text-muted-foreground ml-1.5">已使用</span>
              </div>
              <span className="text-muted-foreground/30">/</span>
              <div>
                <span className="text-xl font-semibold tabular-nums">{committedSp}</span>
                <span className="text-sm text-muted-foreground ml-1.5">已承諾</span>
              </div>
            </div>

            {/* Stacked bar */}
            {totalQuota > 0 ? (
              <div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-secondary flex">
                  {pctUsed > 0 && (
                    <div className="h-full bg-chart-1 transition-all" style={{ width: `${pctUsed}%` }} />
                  )}
                  {pctCommitted > 0 && (
                    <div className="h-full bg-chart-4 transition-all" style={{ width: `${pctCommitted}%` }} />
                  )}
                </div>
                <div className="flex items-center gap-5 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-sm bg-chart-1" />已使用 {pctUsed.toFixed(0)}%
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-sm bg-chart-4" />已承諾 {pctCommitted.toFixed(0)}%
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-sm bg-secondary" />剩餘 {pctAvailable.toFixed(0)}%
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">尚未分配年度配額</p>
            )}
          </CardContent>
        </Card>

        {/* Demand SP Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>需求 SP 明細</CardTitle>
          </CardHeader>
          <CardContent>
            {demands.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Inbox className="h-10 w-10" />
                <p className="text-sm">尚無需求資料</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center w-32">編號</TableHead>
                      <TableHead className="text-center">需求名稱</TableHead>
                      <TableHead className="text-center">狀態</TableHead>
                      <TableHead className="text-center">SP</TableHead>
                      <TableHead className="text-center">SP 狀態</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...committedDemands, ...usedDemands, ...pendingDemands].map((d) => {
                      const si = STATUS_LABEL[d.status]
                      const spCat = si?.spCategory
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
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[11px]",
                                spCat === "used" && "border-emerald-300 text-emerald-700 bg-emerald-50",
                                spCat === "committed" && "border-violet-300 text-violet-700 bg-violet-50",
                                spCat === "pending" && "border-muted-foreground/30 text-muted-foreground",
                              )}
                            >
                              {spCat === "used" ? "已扣除" : spCat === "committed" ? "已承諾" : "未鎖定"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </AppLayout>
  )
}

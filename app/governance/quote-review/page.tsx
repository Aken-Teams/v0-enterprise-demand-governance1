"use client"

import { useState, useEffect, useCallback, type ReactNode } from "react"
import Link from "next/link"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useAuth } from "@/hooks/use-auth"
import { STATUS_MAP, demandStatusKey } from "@/lib/constants/demand"
import { cn, saveBlobAsFile } from "@/lib/utils"
import { toast } from "sonner"
import {
  ReceiptText, Lock, Download, Eye, CheckCircle2, Clock, Loader2, Inbox,
  ChevronLeft, ChevronRight, Building2,
} from "lucide-react"

const PER_PAGE = 9

interface QuoteItem {
  id: string
  demandNumber: string
  title: string
  status: string
  isTerminated: boolean
  vendor: string | null
  organization: string | null
  reviewed: boolean
  reviewedAt: string | null
  reviewedBy: string | null
  docId: string
  fileName: string
  fileSize: number | null
  uploadedAt: string
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fmtDate(d: string | null): string {
  if (!d) return "—"
  return new Date(d).toLocaleString("zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  })
}

export default function QuoteReviewPage() {
  const { token } = useAuth()
  const [pending, setPending] = useState<QuoteItem[]>([])
  const [approved, setApproved] = useState<QuoteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [approveTarget, setApproveTarget] = useState<QuoteItem | null>(null)
  const [approving, setApproving] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [tab, setTab] = useState<"pending" | "approved">("pending")
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch("/api/quote-review", { headers: { Authorization: `Bearer ${token}` } })
      if (res.status === 403) { setForbidden(true); return }
      const data = await res.json()
      if (res.ok) {
        setPending(data.pending ?? [])
        setApproved(data.approved ?? [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const doApprove = async () => {
    if (!approveTarget || !token) return
    setApproving(true)
    try {
      const res = await fetch(`/api/demands/${approveTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "approveQuote" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error || "審核失敗"); return }
      toast.success(`已審核通過：${approveTarget.demandNumber}`)
      setApproveTarget(null)
      await load()
    } finally {
      setApproving(false)
    }
  }

  const doDownload = async (item: QuoteItem) => {
    if (!token) return
    setDownloadingId(item.docId)
    try {
      const res = await fetch(`/api/demands/${item.id}/documents/${item.docId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || "下載失敗"); return }
      const blob = await res.blob()
      if (blob.size === 0) { toast.error("下載失敗：檔案是空的，請稍後再試"); return }
      saveBlobAsFile(blob, item.fileName.replace(/\.[^.]+$/, ".pdf"))
    } catch {
      toast.error("下載失敗，請檢查連線後再試一次")
    } finally {
      setDownloadingId(null)
    }
  }

  const renderCard = (item: QuoteItem) => {
    const sk = demandStatusKey(item.status, item.isTerminated)
    const si = STATUS_MAP[sk] ?? STATUS_MAP[item.status]
    return (
      <Card key={item.id} className="h-full transition-all hover:border-primary/30 hover:shadow-md">
        <CardContent className="space-y-1.5 px-3 py-2 sm:space-y-2 sm:px-4 sm:py-3">
          {/* Row 1: 編號 + 開發商 + 狀態 */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="font-mono text-xs text-muted-foreground">{item.demandNumber}</span>
              {item.vendor && (
                <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">{item.vendor}</Badge>
              )}
            </div>
            {si && (
              <Badge variant="secondary" className={cn("shrink-0 px-2 py-0 text-xs", si.color)}>{si.label}</Badge>
            )}
          </div>

          {/* 標題 */}
          <p className="font-semibold leading-snug line-clamp-2">{item.title}</p>

          {/* 報價單檔名 */}
          <div className="flex items-center gap-1.5 rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground" title={item.fileName}>
            <ReceiptText className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 truncate">{item.fileName}</span>
          </div>

          {/* 審核狀態 */}
          {item.reviewed ? (
            <div className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{item.reviewedBy || "強合管理者"} 審核通過 · {fmtDate(item.reviewedAt)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-amber-600">
              <Clock className="h-3.5 w-3.5 shrink-0" />等待您審核放行
            </div>
          )}

          <hr className="border-border/60" />

          {/* Meta row + 操作 */}
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span className="flex shrink-0 items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                <span className="max-w-[6rem] truncate sm:max-w-none">{item.organization}</span>
              </span>
              <span>·</span>
              <span className="shrink-0">{fmtSize(item.fileSize)}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" asChild title="檢視需求">
                <Link href={`/governance/demands/${item.id}`}><Eye className="h-4 w-4" /></Link>
              </Button>
              {item.reviewed ? (
                <Button size="sm" variant="outline" className="h-7 px-2.5" onClick={() => doDownload(item)} disabled={downloadingId === item.docId}>
                  {downloadingId === item.docId
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Download className="h-3.5 w-3.5" />}
                  <span className="ml-1">下載</span>
                </Button>
              ) : (
                <Button size="sm" className="h-7 bg-amber-600 px-2.5 hover:bg-amber-700" onClick={() => setApproveTarget(item)}>
                  <CheckCircle2 className="h-3.5 w-3.5" /><span className="ml-1">審核</span>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderGrid = (list: QuoteItem[], emptyIcon: ReactNode, emptyText: string) => {
    if (list.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-sm text-muted-foreground">
          {emptyIcon}
          {emptyText}
        </div>
      )
    }
    const totalPages = Math.ceil(list.length / PER_PAGE)
    const safePage = Math.min(page, totalPages)
    const paged = list.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {paged.map(renderCard)}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Button
                key={p}
                variant={p === safePage ? "default" : "outline"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage(p)}
              >
                {p}
              </Button>
            ))}
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <AppLayout userRole="admin">
      <div className="space-y-3 sm:space-y-6">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground sm:text-3xl">
            報價單審核
            <Lock className="h-4 w-4 text-muted-foreground/40 sm:h-5 sm:w-5" aria-label="機密" />
          </h1>
          <p className="hidden text-sm text-muted-foreground sm:block sm:text-base">
            智合上傳的報價單需經您審核通過後方可下載，審核通過即代表放行下載。
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : forbidden ? (
          <Card>
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              此頁面僅供強合管理者使用。
            </CardContent>
          </Card>
        ) : (
          <Tabs value={tab} onValueChange={(v) => { setTab(v as "pending" | "approved"); setPage(1) }}>
            <TabsList className="h-auto p-1">
              <TabsTrigger value="pending" className="gap-1.5 px-4 py-1.5">
                <Clock className="h-4 w-4" />待審核
                <Badge variant="secondary" className={cn("px-1.5 py-0 text-[10px]", pending.length > 0 ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground")}>
                  {pending.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="approved" className="gap-1.5 px-4 py-1.5">
                <CheckCircle2 className="h-4 w-4" />已審核 · 可下載
                <Badge variant="secondary" className="bg-emerald-100 px-1.5 py-0 text-[10px] text-emerald-700">
                  {approved.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4">
              {renderGrid(pending, <CheckCircle2 className="h-8 w-8 text-emerald-500/50" />, "目前沒有待審核的報價單")}
            </TabsContent>
            <TabsContent value="approved" className="mt-4">
              {renderGrid(approved, <Inbox className="h-8 w-8 text-muted-foreground/30" />, "尚無已審核通過的報價單")}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <AlertDialog open={!!approveTarget} onOpenChange={(o) => { if (!o) setApproveTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>審核通過報價單？</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div>
                  需求：<span className="font-mono">{approveTarget?.demandNumber}</span> {approveTarget?.title}
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <ReceiptText className="h-3.5 w-3.5" />{approveTarget?.fileName}
                </div>
                <div className="text-muted-foreground">審核通過後，此報價單即開放由您下載。</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approving}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); doApprove() }} disabled={approving}>
              {approving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
              確認審核通過
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  )
}

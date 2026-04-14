"use client"

import { useState, useEffect, useCallback } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PhaseSignoffBanner } from "@/components/demand/phase-signoff-banner"
import { useAuth } from "@/hooks/use-auth"
import Link from "next/link"
import {
  Building2, Coins, Loader2, Eye,
  FileIcon, Download, MessageSquare, CheckCircle2, Inbox,
} from "lucide-react"

interface SignoffDoc {
  id: string
  fileName: string
  fileUrl: string | null
  fileSize: number | null
}

interface SpReviewItem {
  signoff: {
    id: string
    phase: string
    status: string
    requestComment: string | null
    requestedAt: string
    requestedBy: { id: string; name: string }
    documents: SignoffDoc[]
  }
  demand: {
    id: string
    demandNumber: string
    title: string
    status: string
    estimatedSp: number
    confirmedSp: number | null
    organization: { id: string; name: string }
    submitter: { id: string; name: string }
    developer: { id: string; name: string } | null
  }
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function SpReviewCard({ item, token, onComplete }: {
  item: SpReviewItem
  token: string | null
  onComplete: () => void
}) {
  const sp = item.demand.confirmedSp ?? item.demand.estimatedSp
  const docs = item.signoff.documents?.filter((d) => d.fileUrl) || []

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        {/* Header: demand number + org + SP */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">{item.demand.demandNumber}</span>
            <Badge variant="outline" className="text-xs gap-1">
              <Building2 className="h-3 w-3" />
              {item.demand.organization.name}
            </Badge>
          </div>
          <Badge className="bg-orange-100 text-orange-700 gap-1">
            <Coins className="h-3 w-3" />
            {sp} SP
          </Badge>
        </div>

        {/* Title */}
        <p className="font-semibold leading-snug">{item.demand.title}</p>

        {/* Request comment */}
        {item.signoff.requestComment && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-medium text-blue-600">提出說明</span>
            </div>
            <p className="text-sm text-blue-700/80 whitespace-pre-line">{item.signoff.requestComment}</p>
          </div>
        )}

        {/* Attached documents */}
        {docs.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">附件文件</span>
            {docs.map((doc) => (
              <a
                key={doc.id}
                href={doc.fileUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md bg-muted/30 border border-border/40 px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
              >
                <FileIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{doc.fileName}</span>
                {doc.fileSize && (
                  <span className="text-[10px] text-muted-foreground shrink-0">{formatFileSize(doc.fileSize)}</span>
                )}
                <Download className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              </a>
            ))}
          </div>
        )}

        {/* Meta info */}
        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
          <span>發起：{item.signoff.requestedBy.name}</span>
          <span>·</span>
          <span>{new Date(item.signoff.requestedAt).toLocaleDateString("zh-TW")}</span>
          {item.demand.submitter && (
            <>
              <span>·</span>
              <span>需求者：{item.demand.submitter.name}</span>
            </>
          )}
          {item.demand.developer && (
            <>
              <span>·</span>
              <span>開發：{item.demand.developer.name}</span>
            </>
          )}
        </div>

        <hr className="border-border/60" />

        {/* Action row: view detail + inline approve/reject */}
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
            <Link href={`/governance/demands/${item.demand.id}`}>
              <Eye className="h-3.5 w-3.5 mr-1" />
              查看詳情
            </Link>
          </Button>
          <PhaseSignoffBanner
            signoff={item.signoff}
            demandId={item.demand.id}
            token={token}
            onComplete={onComplete}
            inline
          />
        </div>
      </CardContent>
    </Card>
  )
}

export default function SpReviewPage() {
  const { token } = useAuth()
  const [items, setItems] = useState<SpReviewItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchItems = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch("/api/board/sp-review", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) setItems(data.items || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const handleComplete = (signoffId: string) => {
    setItems((prev) => prev.filter((item) => item.signoff.id !== signoffId))
  }

  return (
    <AppLayout userRole="viewer">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">開案審核</h1>
            {!loading && items.length > 0 && (
              <Badge className="bg-amber-100 text-amber-700 text-sm">{items.length} 件待審</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">審核待開案需求的 SP 規劃與資源分配</p>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20">
              <CheckCircle2 className="h-12 w-12 text-emerald-300 mb-4" />
              <p className="text-muted-foreground font-medium">目前沒有待審核的開案需求</p>
              <p className="text-xs text-muted-foreground mt-1">所有開案申請已處理完畢</p>
              <Button variant="outline" size="sm" className="mt-4" asChild>
                <Link href="/governance/inbox">
                  <Inbox className="h-3.5 w-3.5 mr-1.5" />
                  前往需求列表
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {items.map((item) => (
              <SpReviewCard
                key={item.signoff.id}
                item={item}
                token={token}
                onComplete={() => handleComplete(item.signoff.id)}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

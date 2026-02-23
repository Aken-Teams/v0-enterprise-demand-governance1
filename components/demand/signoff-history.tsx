"use client"

import { Badge } from "@/components/ui/badge"
import { STATUS_MAP, SIGNOFF_STATUS_MAP } from "@/lib/constants/demand"
import { cn } from "@/lib/utils"
import { Check, Clock, X, SkipForward, FileIcon, Download } from "lucide-react"

interface SignoffDocument {
  id: string
  fileName: string
  fileUrl: string | null
  fileSize: number | null
}

interface SignoffRecord {
  id: string
  phase: string
  status: string
  comment: string | null
  requestedAt: string
  respondedAt: string | null
  requestedBy: { id: string; name: string }
  respondedBy: { id: string; name: string } | null
  documents?: SignoffDocument[]
}

interface SignoffHistoryProps {
  signoffs: SignoffRecord[]
}

const STATUS_ICONS: Record<string, typeof Check> = {
  PENDING: Clock,
  APPROVED: Check,
  REJECTED: X,
  SKIPPED: SkipForward,
}

const STATUS_ICON_COLORS: Record<string, string> = {
  PENDING: "text-amber-500",
  APPROVED: "text-emerald-500",
  REJECTED: "text-red-500",
  SKIPPED: "text-gray-400",
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function SignoffHistory({ signoffs }: SignoffHistoryProps) {
  if (signoffs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground/40 text-center py-4">尚無簽核紀錄</p>
    )
  }

  return (
    <div className="space-y-3">
      {signoffs.map((s) => {
        const Icon = STATUS_ICONS[s.status] || Clock
        const iconColor = STATUS_ICON_COLORS[s.status] || "text-gray-400"
        const statusInfo = SIGNOFF_STATUS_MAP[s.status]
        const phaseLabel = STATUS_MAP[s.phase]?.label || s.phase
        const docs = s.documents?.filter((d) => d.fileUrl) || []

        return (
          <div key={s.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={cn("h-6 w-6 rounded-full flex items-center justify-center shrink-0",
                s.status === "PENDING" ? "bg-amber-50" :
                s.status === "APPROVED" ? "bg-emerald-50" :
                s.status === "REJECTED" ? "bg-red-50" : "bg-gray-50"
              )}>
                <Icon className={cn("h-3.5 w-3.5", iconColor)} />
              </div>
              <div className="w-px flex-1 bg-border/60 mt-1" />
            </div>
            <div className="flex-1 min-w-0 pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{phaseLabel}</span>
                {statusInfo && (
                  <Badge className={cn("text-[10px]", statusInfo.color)}>
                    {statusInfo.label}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {s.requestedBy.name} 發起 · {fmtDate(s.requestedAt)}
                {s.respondedBy && s.respondedAt && (
                  <> · {s.respondedBy.name} 回應 · {fmtDate(s.respondedAt)}</>
                )}
              </p>
              {s.comment && (
                <p className="text-xs text-muted-foreground/80 mt-1 whitespace-pre-line bg-muted/30 rounded px-2 py-1.5">
                  {s.comment}
                </p>
              )}
              {docs.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {docs.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.fileUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded bg-muted/30 px-2 py-1 text-xs hover:bg-muted/50 transition-colors group"
                    >
                      <FileIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1 text-muted-foreground group-hover:text-foreground">
                        {doc.fileName}
                      </span>
                      {doc.fileSize != null && (
                        <span className="text-muted-foreground/60 shrink-0">
                          {formatFileSize(doc.fileSize)}
                        </span>
                      )}
                      <Download className="h-3 w-3 text-muted-foreground/40 group-hover:text-foreground shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

"use client"

import { useState, useRef } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Coins, Lock, Upload, FileText, Download, Eye, Check, Loader2, Pencil, ShieldCheck } from "lucide-react"

interface QuoteDoc { id: string; fileName: string; fileUrl: string | null; fileSize: number | null }

interface Props {
  demandId: string
  token: string | null
  totalSp: number
  zhiheSpTaken: number | null
  zhiheSpNote: string | null
  quote: QuoteDoc | null
  quoteReviewedBy: { name: string } | null
  quoteReviewedAt: string | null
  canManage: boolean          // 管理者可編輯抽成、上傳報價單
  canApproveQuote: boolean     // 強合管理者可審核
  onPreviewDoc?: (doc: { id: string; type: string; fileName: string; fileUrl: string | null; fileSize: number | null }) => void
  onRefresh: () => void
}

function fmt(d: string | null) {
  if (!d) return ""
  const x = new Date(d)
  return `${x.getFullYear()}/${String(x.getMonth() + 1).padStart(2, "0")}/${String(x.getDate()).padStart(2, "0")} ${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`
}

export function ZhiheSpSection({
  demandId, token, totalSp, zhiheSpTaken, zhiheSpNote, quote,
  quoteReviewedBy, quoteReviewedAt, canManage, canApproveQuote, onPreviewDoc, onRefresh,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [spInput, setSpInput] = useState(zhiheSpTaken != null ? String(zhiheSpTaken) : "")
  const [noteInput, setNoteInput] = useState(zhiheSpNote ?? "")
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [approving, setApproving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [showApprove, setShowApprove] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const isReviewed = !!quoteReviewedAt

  const saveSp = async () => {
    if (!token) return
    const val = spInput.trim() === "" ? null : Number(spInput)
    if (val !== null && (!Number.isFinite(val) || val < 0)) { toast.error("移轉授權 SP 需為非負數字"); return }
    if (val !== null && val > totalSp) { toast.error(`移轉授權 SP 不可超過總 SP（${totalSp}）`); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/demands/${demandId}`, {
        method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setZhiheSp", zhiheSpTaken: val, zhiheSpNote: noteInput.trim() || null }),
      })
      if (res.ok) { setEditing(false); onRefresh() }
      else { const e = await res.json().catch(() => ({})); toast.error(e.error || "儲存失敗") }
    } finally { setSaving(false) }
  }

  const uploadQuote = async (file: File) => {
    if (!token) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.set("type", "ZHIHE_QUOTE")
      fd.append("files", file)
      const res = await fetch(`/api/demands/${demandId}/documents`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd })
      if (res.ok) { toast.success("報價單已上傳，待強合管理者審核"); onRefresh() }
      else { const e = await res.json().catch(() => ({})); toast.error(e.error || "上傳失敗") }
    } finally { setUploading(false) }
  }

  const approve = async () => {
    if (!token) return
    setApproving(true)
    try {
      const res = await fetch(`/api/demands/${demandId}`, {
        method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approveQuote" }),
      })
      if (res.ok) { setShowApprove(false); toast.success("報價單已審核通過，可下載"); onRefresh() }
      else { const e = await res.json().catch(() => ({})); toast.error(e.error || "審核失敗") }
    } finally { setApproving(false) }
  }

  const download = async () => {
    if (!token || !quote) return
    setDownloading(true)
    try {
      const res = await fetch(`/api/demands/${demandId}/documents/${quote.id}/download`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || "下載失敗"); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = quote.fileName.replace(/\.[^.]+$/, ".pdf")
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    } finally { setDownloading(false) }
  }

  return (
    <Card>
      <CardHeader className="px-4 sm:px-6 pb-3">
        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
          <Coins className="h-4 w-4 text-amber-600" />
          智合移轉強合授權 SP
          <Lock className="h-3.5 w-3.5 text-muted-foreground/40 ml-auto" aria-label="受限存取" />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 space-y-3">
        {/* 抽 SP 數字 */}
        {!editing ? (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">移轉授權 SP</p>
              <p className="text-lg font-bold">
                {zhiheSpTaken != null ? zhiheSpTaken : <span className="text-muted-foreground/50 text-sm font-normal">尚未記錄</span>}
                {zhiheSpTaken != null && <span className="text-xs font-normal text-muted-foreground ml-1">/ 總 {totalSp} SP</span>}
              </p>
              {zhiheSpNote && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line break-words">{zhiheSpNote}</p>}
            </div>
            {canManage && (
              <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => { setSpInput(zhiheSpTaken != null ? String(zhiheSpTaken) : ""); setNoteInput(zhiheSpNote ?? ""); setEditing(true) }}>
                <Pencil className="h-3 w-3 mr-1" />編輯
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input type="number" min={0} step="0.5" value={spInput} onChange={(e) => setSpInput(e.target.value)} placeholder="移轉 SP" className="h-8 w-28 text-sm" />
              <span className="text-xs text-muted-foreground">/ 總 {totalSp} SP</span>
            </div>
            <Textarea value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder="移轉說明（選填）…" rows={2} className="text-xs" />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(false)} disabled={saving}>取消</Button>
              <Button size="sm" className="h-7 text-xs" onClick={saveSp} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}儲存
              </Button>
            </div>
          </div>
        )}

        {/* 報價單 */}
        <div className="border-t pt-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-muted-foreground">報價單</p>
            {canManage && (
              <>
                <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadQuote(f) }} />
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                  {quote ? "重新上傳" : "上傳報價單"}
                </Button>
              </>
            )}
          </div>

          {!quote ? (
            <p className="text-xs text-muted-foreground/50">尚未上傳報價單</p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-md border px-2.5 py-2">
                <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="text-sm truncate flex-1">{quote.fileName}</span>
                {onPreviewDoc && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="預覽" onClick={() => onPreviewDoc({ id: quote.id, type: "ZHIHE_QUOTE", fileName: quote.fileName, fileUrl: quote.fileUrl, fileSize: quote.fileSize })}>
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                {isReviewed ? (
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="下載" onClick={download} disabled={downloading}>
                    {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  </Button>
                ) : (
                  <span title="審核通過後才可下載"><Download className="h-4 w-4 text-muted-foreground/30" /></span>
                )}
              </div>

              {/* 審核狀態 */}
              {isReviewed ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  已由 <span className="font-medium">{quoteReviewedBy?.name ?? "強合管理者"}</span> 審核通過 · {fmt(quoteReviewedAt)}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5">
                  <span>待強合管理者審核，通過後才可下載</span>
                  {canApproveQuote && (
                    <Button size="sm" className="h-6 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white shrink-0" onClick={() => setShowApprove(true)} disabled={approving}>
                      <Check className="h-3 w-3 mr-0.5" />審核通過
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>

      <AlertDialog open={showApprove} onOpenChange={setShowApprove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認審核報價單？</AlertDialogTitle>
            <AlertDialogDescription>
              審核通過後，此報價單即可由管理者／董事會下載，且系統會記錄由您審核通過。請確認已檢視內容無誤。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approving}>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={approve} disabled={approving}>
              {approving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}確認通過
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

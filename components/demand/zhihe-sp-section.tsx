"use client"

import { useState, useRef } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Coins, Lock, Upload, FileText, Download, Eye, Check, Loader2, Pencil, ShieldCheck, Trash2 } from "lucide-react"
import { cn, saveBlobAsFile } from "@/lib/utils"

interface QuoteDoc { id: string; fileName: string; fileUrl: string | null; fileSize: number | null; createdAt?: string | null }

function fmt(d: string | null) {
  if (!d) return ""
  const x = new Date(d)
  return `${x.getFullYear()}/${String(x.getMonth() + 1).padStart(2, "0")}/${String(x.getDate()).padStart(2, "0")} ${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`
}
function fmtDate(d: string | null | undefined) {
  if (!d) return ""
  const x = new Date(d)
  return `${x.getFullYear()}/${String(x.getMonth() + 1).padStart(2, "0")}/${String(x.getDate()).padStart(2, "0")}`
}
function formatFileSize(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

/* ─────────────────────────────────────────────
 * 基本資訊用：移轉授權 SP 欄位（含編輯對話框）
 * ───────────────────────────────────────────── */
export function ZhiheSpField({
  demandId, token, totalSp, zhiheSpTaken, zhiheSpNote, canManage, onRefresh,
}: {
  demandId: string; token: string | null; totalSp: number
  zhiheSpTaken: number | null; zhiheSpNote: string | null
  canManage: boolean; onRefresh: () => void
}) {
  const [open, setOpen] = useState(false)
  const [spInput, setSpInput] = useState("")
  const [noteInput, setNoteInput] = useState("")
  const [saving, setSaving] = useState(false)

  const openEdit = () => {
    setSpInput(zhiheSpTaken != null ? String(zhiheSpTaken) : "")
    setNoteInput(zhiheSpNote ?? "")
    setOpen(true)
  }

  const save = async () => {
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
      if (res.ok) { setOpen(false); onRefresh() }
      else { const e = await res.json().catch(() => ({})); toast.error(e.error || "儲存失敗") }
    } finally { setSaving(false) }
  }

  return (
    <>
      <div className="flex items-center gap-2 text-xs sm:text-sm">
        <Coins className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 shrink-0" />
        <span className="text-muted-foreground w-14 sm:w-16 shrink-0">移轉 SP</span>
        {zhiheSpTaken != null ? (
          <span className="font-medium">{zhiheSpTaken}<span className="text-muted-foreground font-normal ml-1">/ {totalSp} SP</span></span>
        ) : (
          <span className="text-muted-foreground/50">尚未記錄</span>
        )}
        <Lock className="h-3 w-3 text-muted-foreground/30 shrink-0" aria-label="僅內部可見" />
        {canManage && (
          <Button size="icon" variant="ghost" className="h-6 w-6 ml-auto shrink-0 text-muted-foreground hover:text-foreground" onClick={openEdit} title="編輯移轉授權 SP">
            <Pencil className="h-3 w-3" />
          </Button>
        )}
      </div>
      {zhiheSpNote && (
        <p className="ml-6 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 whitespace-pre-line break-words">{zhiheSpNote}</p>
      )}

      <Dialog open={open} onOpenChange={(o) => { if (!saving) setOpen(o) }}>
        <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base"><Coins className="h-4 w-4 text-amber-600" />智合移轉強合授權 SP</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input type="number" min={0} step="0.5" value={spInput} onChange={(e) => setSpInput(e.target.value)} placeholder="移轉 SP" className="h-9 w-32" autoFocus />
              <span className="text-sm text-muted-foreground">/ {totalSp} SP</span>
            </div>
            <Textarea value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder="移轉說明（選填）…" rows={2} className="text-sm" />
            <p className="text-[11px] text-muted-foreground">留空即清除紀錄。填寫後可於「文件」分頁上傳報價單。</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>取消</Button>
            <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}儲存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ─────────────────────────────────────────────
 * 文件分頁用：智合報價單卡（上傳／預覽／審核／下載）
 * ───────────────────────────────────────────── */
export function ZhiheQuoteCard({
  demandId, token, quote, quoteReviewedBy, quoteReviewedAt, canManage, canApproveQuote, canDownload, onPreview, onRefresh,
}: {
  demandId: string; token: string | null
  quote: QuoteDoc | null
  quoteReviewedBy: { name: string } | null
  quoteReviewedAt: string | null
  canManage: boolean       // 智合管理者：上傳／刪除
  canApproveQuote: boolean  // 強合管理者：審核
  canDownload: boolean      // 可下載（智合隨時／強合審核後）
  onPreview?: () => void
  onRefresh: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const [approving, setApproving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showApprove, setShowApprove] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const isReviewed = !!quoteReviewedAt

  const doDelete = async () => {
    if (!token || !quote) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/demands/${demandId}/documents/${quote.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) { setShowDelete(false); toast.success("報價單已刪除"); onRefresh() }
      else { const e = await res.json().catch(() => ({})); toast.error(e.error || "刪除失敗") }
    } finally { setDeleting(false) }
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
      // 伺服器出錯時可能回 JSON 而不是 PDF，這裡擋掉，免得存出一個打不開的空檔
      if (blob.size === 0) { toast.error("下載失敗：檔案是空的，請稍後再試"); return }
      saveBlobAsFile(blob, quote.fileName.replace(/\.[^.]+$/, ".pdf"))
    } catch {
      // 沒有 catch 的話網路中斷會靜靜地什麼都不做，看起來就像轉圈圈轉完沒反應
      toast.error("下載失敗，請檢查連線後再試一次")
    } finally { setDownloading(false) }
  }

  return (
    <Card className="border-amber-200/70">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
          <Coins className="h-4 w-4 text-amber-600" />
          智合報價單
          <Lock className="h-3.5 w-3.5 text-muted-foreground/40" aria-label="機密" />
          {canManage && (
            <>
              <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadQuote(f) }} />
              <Button size="sm" variant="outline" className="h-7 text-xs ml-auto" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                {quote ? "重新上傳" : "上傳報價單"}
              </Button>
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {!quote ? (
          <p className="text-xs text-muted-foreground/60 py-2 text-center">尚未上傳報價單</p>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-md border px-2.5 sm:px-3 py-1.5 sm:py-2.5 overflow-hidden">
              <div className={cn("flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1", onPreview && "cursor-pointer")} onClick={onPreview}>
                <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-blue-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium truncate">{quote.fileName}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                    報價單{quote.fileSize ? ` · ${formatFileSize(quote.fileSize)}` : ""}{quote.createdAt ? ` · ${fmtDate(quote.createdAt)}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-0 sm:gap-0.5 shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
                {onPreview && (
                  <Button size="icon" variant="ghost" className="h-6 w-6 sm:h-8 sm:w-8" title="預覽" onClick={onPreview}><Eye className="h-3 w-3 sm:h-4 sm:w-4" /></Button>
                )}
                {/* 下載：智合隨時、強合審核後；強合未審核顯示灰色提示，其他人不顯示 */}
                {canDownload ? (
                  <Button size="icon" variant="ghost" className="h-6 w-6 sm:h-8 sm:w-8" title="下載" onClick={download} disabled={downloading}>
                    {downloading ? <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : <Download className="h-3 w-3 sm:h-4 sm:w-4" />}
                  </Button>
                ) : canApproveQuote ? (
                  <span title="審核通過後可下載" className="inline-flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center"><Download className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground/30" /></span>
                ) : null}
                {canManage && (
                  <Button size="icon" variant="ghost" className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/40 hover:text-destructive" title="刪除" onClick={() => setShowDelete(true)} disabled={deleting}>
                    {deleting ? <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin" /> : <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                  </Button>
                )}
              </div>
            </div>

            {isReviewed ? (
              <div className="flex items-center gap-1.5 text-sm text-emerald-700 bg-emerald-50 rounded-md px-2.5 py-2">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                已由 <span className="font-medium">{quoteReviewedBy?.name ?? "強合管理者"}</span> 審核通過 · {fmt(quoteReviewedAt)}
              </div>
            ) : canApproveQuote ? (
              <div className="flex items-center justify-between gap-2 text-sm text-amber-700 bg-amber-50 rounded-md px-2.5 py-2">
                <span className="font-medium">請審核此報價單，通過後即可由您下載</span>
                <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shrink-0" onClick={() => setShowApprove(true)} disabled={approving}>
                  <Check className="h-3.5 w-3.5 mr-1" />審核通過
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>

      <AlertDialog open={showApprove} onOpenChange={setShowApprove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認審核報價單？</AlertDialogTitle>
            <AlertDialogDescription>
              審核通過後，此報價單即可由<strong>強合管理者</strong>下載（其他人僅能檢視），且系統會記錄由您審核通過。請確認已檢視內容無誤。
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

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除報價單？</AlertDialogTitle>
            <AlertDialogDescription>
              將刪除報價單「{quote?.fileName}」，無法復原。若已審核通過，刪除後審核狀態也會一併清除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={doDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}確定刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

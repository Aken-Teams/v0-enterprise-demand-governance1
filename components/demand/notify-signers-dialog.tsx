"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Loader2, Send, Eye, Code, X, Plus, Network } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"
import { signoffNotificationTemplate } from "@/lib/mail-templates"
import { SP_PROGRESS_RATE } from "@/lib/constants/demand"
import { LdapTreePicker, type LdapSelectedMember } from "@/components/admin/ldap-tree-picker"

interface PendingSignoff {
  targetUserId: string | null
  targetUser: { id: string; name: string; email?: string } | null
  targetRole: string | null
  overrideTargetStatus?: string | null
}

interface NotifySignersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  demandId: string
  demandNumber: string
  demandTitle: string
  phaseLabel: string
  pendingSignoffs: PendingSignoff[]
  organizationId: string
  shareUrl?: string
  /** 需求有效 SP（confirmedSp ?? estimatedSp）— 用於終止結算金額 */
  effectiveSp?: number | null
}

export function NotifySignersDialog({
  open,
  onOpenChange,
  demandId,
  demandNumber,
  demandTitle,
  phaseLabel,
  pendingSignoffs,
  organizationId,
  shareUrl,
  effectiveSp,
}: NotifySignersDialogProps) {
  const { token } = useAuth()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Unique target user emails
  const toEmails = Array.from(
    new Set(
      pendingSignoffs
        .map((s) => s.targetUser?.email)
        .filter((e): e is string => !!e && e.includes("@"))
    )
  )
  const toNames = Array.from(
    new Set(
      pendingSignoffs
        .map((s) => s.targetUser?.name)
        .filter((n): n is string => !!n)
    )
  )

  const [ccList, setCcList] = useState<string[]>([])
  const [ccInput, setCcInput] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [editMode, setEditMode] = useState(false) // default: preview (not edit)
  const [sending, setSending] = useState(false)
  const [ccLoaded, setCcLoaded] = useState(false)
  const [ldapPickerOpen, setLdapPickerOpen] = useState(false)

  // Auto-resize iframe to fit content
  const resizeIframe = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (doc?.body) {
        iframe.style.height = Math.max(280, doc.body.scrollHeight + 20) + "px"
      }
    } catch { /* cross-origin ignore */ }
  }, [])

  // Load CC list from email settings when dialog opens
  const loadCc = useCallback(async () => {
    if (!token || !organizationId || ccLoaded) return
    try {
      const res = await fetch(`/api/admin/email-settings?orgId=${organizationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        const setting = data.settings?.[0]
        if (setting?.signoffCcList) {
          try {
            const list = JSON.parse(setting.signoffCcList) as string[]
            setCcList(list.filter(Boolean))
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
    setCcLoaded(true)
  }, [token, organizationId, ccLoaded])

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      // 終止結算代簽：改用終止相關主旨與內文
      const settleSignoff = pendingSignoffs.find((s) => s.targetRole === "BOARD_OVERRIDE" && !!s.overrideTargetStatus)
      const isTermination = !!settleSignoff
      const settlementPct = settleSignoff?.overrideTargetStatus
        ? Math.round((SP_PROGRESS_RATE[settleSignoff.overrideTargetStatus] ?? 0) * 100)
        : undefined
      const settledSp = settleSignoff?.overrideTargetStatus && effectiveSp != null
        ? Math.round(effectiveSp * (SP_PROGRESS_RATE[settleSignoff.overrideTargetStatus] ?? 0))
        : null

      const defaultSubject = isTermination
        ? `[${demandNumber}] 請確認是否終止專案 - ${demandTitle}`
        : `[${demandNumber}] 請確認簽核 - ${demandTitle}`
      setSubject(defaultSubject)

      const link = shareUrl || `${typeof window !== "undefined" ? window.location.origin : ""}/governance/demands/${demandId}`
      const html = signoffNotificationTemplate({
        demandNumber,
        demandTitle,
        phaseLabel,
        shareUrl: link,
        signerNames: toNames,
        isTermination,
        settlementPct,
        settledSp,
        effectiveSp,
      })
      setBody(html)
      setEditMode(false) // default to preview
      setSending(false)
      setCcLoaded(false)
      setCcList([])
      setCcInput("")
      loadCc()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, demandNumber, demandTitle, phaseLabel, shareUrl, demandId])

  const addCc = () => {
    const email = ccInput.trim()
    if (email && email.includes("@") && !ccList.includes(email)) {
      setCcList((prev) => [...prev, email])
      setCcInput("")
    }
  }

  const removeCc = (email: string) => {
    setCcList((prev) => prev.filter((e) => e !== email))
  }

  const handleLdapSelectCc = async (member: LdapSelectedMember) => {
    setLdapPickerOpen(false)
    let email = ""
    try {
      const res = await fetch(
        `/api/admin/ldap/user?username=${encodeURIComponent(member.username)}&domain=${encodeURIComponent(member.domain)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      )
      if (res.ok) {
        const data = await res.json()
        email = data?.user?.mail || ""
      }
    } catch { /* ignore */ }
    if (!email) { toast.error(`無法取得 ${member.displayName} 的 Email`); return }
    if (!ccList.includes(email)) {
      setCcList((prev) => [...prev, email])
      toast.success(`已新增 CC：${email}`)
    } else {
      toast.info("此 Email 已在 CC 名單中")
    }
  }

  const handleSend = async () => {
    if (!token) return
    if (toEmails.length === 0) {
      toast.error("沒有可寄送的收件者 Email")
      return
    }

    setSending(true)
    try {
      const res = await fetch(`/api/demands/${demandId}/notify-signers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          to: toEmails,
          cc: ccList.filter(Boolean),
          subject: subject.trim(),
          body,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "寄送失敗")
      }
      toast.success("簽核通知已寄出")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "寄送失敗")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-4xl max-h-[90vh] flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">通知簽核人</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            發送郵件通知尚未簽核的人員，提醒他們進行簽核確認
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 overflow-y-auto flex-1 pr-1">
          {/* To */}
          <div className="space-y-1.5">
            <Label className="text-[10px] sm:text-xs text-muted-foreground">收件者</Label>
            <div className="flex flex-wrap gap-1.5">
              {toEmails.length > 0 ? (
                toEmails.map((email) => {
                  const name = pendingSignoffs.find((s) => s.targetUser?.email === email)?.targetUser?.name
                  return (
                    <Badge key={email} variant="secondary" className="text-[10px] sm:text-xs">
                      <span className="hidden sm:inline">{name ? `${name} <${email}>` : email}</span>
                      <span className="sm:hidden">{name || email}</span>
                    </Badge>
                  )
                })
              ) : (
                <p className="text-xs sm:text-sm text-muted-foreground">簽核人尚無 Email 資料</p>
              )}
            </div>
          </div>

          {/* CC */}
          <div className="space-y-1.5">
            <Label className="text-[10px] sm:text-xs text-muted-foreground">副本 (CC)</Label>
            <div className="rounded-md border p-2 sm:p-3 space-y-2">
              {ccList.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {ccList.map((email) => (
                    <Badge key={email} variant="secondary" className="text-xs gap-1">
                      {email}
                      <button type="button" onClick={() => removeCc(email)} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-1.5 sm:gap-2">
                <Input
                  placeholder="輸入 Email 按 Enter 新增"
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCc() } }}
                  className="flex-1 h-7 sm:h-8 text-xs sm:text-sm"
                />
                <Button type="button" size="sm" variant="outline" onClick={addCc} disabled={!ccInput.trim() || !ccInput.includes("@")} className="h-7 w-7 p-0 sm:h-8 sm:w-8">
                  <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setLdapPickerOpen(true)} className="h-7 sm:h-8 text-[10px] sm:text-xs px-2">
                  <Network className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1" /><span className="hidden sm:inline">瀏覽 AD</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label className="text-[10px] sm:text-xs text-muted-foreground">主旨</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-7 sm:h-8 text-xs sm:text-sm" />
          </div>

          {/* Body — Preview / Edit */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] sm:text-xs text-muted-foreground">信件內容</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 text-xs px-2"
                onClick={() => setEditMode(!editMode)}
              >
                {editMode ? (
                  <><Eye className="h-3 w-3 mr-1" />預覽</>
                ) : (
                  <><Code className="h-3 w-3 mr-1" />編輯原始碼</>
                )}
              </Button>
            </div>

            {editMode ? (
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                className="font-mono text-[10px] sm:text-xs leading-relaxed"
              />
            ) : (
              <div className="rounded-lg border bg-white overflow-hidden">
                <iframe
                  ref={iframeRef}
                  srcDoc={body}
                  className="w-full border-0"
                  style={{ minHeight: 200, height: 280 }}
                  sandbox="allow-same-origin"
                  title="Email preview"
                  onLoad={resizeIframe}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-3 sm:pt-4 border-t">
          <Button variant="outline" size="sm" className="h-8 text-xs sm:text-sm" onClick={() => onOpenChange(false)} disabled={sending}>
            取消
          </Button>
          <Button size="sm" className="h-8 text-xs sm:text-sm" onClick={handleSend} disabled={sending || toEmails.length === 0}>
            {sending ? (
              <><Loader2 className="mr-1 h-3 w-3 sm:mr-1.5 sm:h-3.5 sm:w-3.5 animate-spin" />寄送中...</>
            ) : (
              <><Send className="mr-1 h-3 w-3 sm:mr-1.5 sm:h-3.5 sm:w-3.5" />確認寄出</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* LDAP Picker for CC */}
      <Dialog open={ldapPickerOpen} onOpenChange={setLdapPickerOpen}>
        <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">從 AD 新增 CC 人員</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0">
            <LdapTreePicker onSelectMember={handleLdapSelectCc} compact />
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

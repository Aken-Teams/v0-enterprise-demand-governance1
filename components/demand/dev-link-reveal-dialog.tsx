"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Check, Copy, ExternalLink, Loader2, Smartphone } from "lucide-react"
import { toast } from "sonner"

interface DevLinkRevealDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 剛開放的 APP 交付連結；資料重新載入前可能為空，屆時顯示載入中 */
  links: { id: string; fileUrl: string | null }[]
}

/**
 * 首次 APP 交付確認完成後，把連結直接攤在使用者面前。
 *
 * 交付分頁雖然有 iframe 預覽，但不少使用者會誤以為「APP 就是要在這裡操作」。
 * 這個視窗的用意是講清楚：這是一個網址，請複製到瀏覽器使用。
 */
export function DevLinkRevealDialog({ open, onOpenChange, links }: DevLinkRevealDialogProps) {
  const [copied, setCopied] = useState<string | null>(null)

  // 每次重新開啟都回到未複製狀態，避免沿用上一次的打勾
  useEffect(() => {
    if (open) setCopied(null)
  }, [open])

  const urls = links.map((l) => l.fileUrl).filter((u): u is string => !!u)

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(url)
      toast.success("已複製連結")
    } catch {
      toast.error("複製失敗，請手動選取網址")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-sky-600" />
            APP 連結已開放
          </DialogTitle>
          <DialogDescription>
            請<strong>複製下方網址，貼到瀏覽器</strong>開啟使用。
            本頁的預覽僅供快速確認，實際操作請於瀏覽器進行。
          </DialogDescription>
        </DialogHeader>

        {urls.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin inline mr-1.5" />連結載入中…
          </p>
        ) : (
          <div className="space-y-2">
            {urls.map((url) => (
              <div key={url} className="rounded-lg border border-sky-200 bg-sky-50/50 p-2.5 space-y-2">
                <code className="block text-xs sm:text-sm break-all bg-white rounded border px-2 py-1.5">
                  {url}
                </code>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="flex-1 bg-white h-9" onClick={() => copy(url)}>
                    {copied === url
                      ? <><Check className="h-4 w-4 mr-1 text-emerald-600" />已複製</>
                      : <><Copy className="h-4 w-4 mr-1" />複製網址</>}
                  </Button>
                  <Button size="sm" className="flex-1 h-9" asChild>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-1" />在瀏覽器開啟
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          連結已永久開放，日後可於「交付成果」分頁隨時取得；開發端更新版本不需再確認。
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>我知道了</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

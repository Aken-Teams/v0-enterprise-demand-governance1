import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 複製文字到剪貼簿。
 * navigator.clipboard 只在 HTTPS / localhost 下存在，內網用 http 開會是 undefined，
 * 直接呼叫會丟 TypeError、按鈕看起來像沒反應；故保留 execCommand 後備。
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* 掉到下面的後備做法 */ }
  try {
    const ta = document.createElement("textarea")
    ta.value = text
    ta.setAttribute("readonly", "")
    ta.style.position = "fixed"
    ta.style.top = "-1000px"
    ta.style.opacity = "0"
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/**
 * 把 Blob 存成檔案。
 * 重點是不要在 a.click() 之後馬上 revokeObjectURL —— 瀏覽器還在讀那個 URL，
 * 大檔（例如加了浮水印的 PDF）常常會因此中途被取消，使用者看到的就是
 * 「轉圈圈轉完卻沒有檔案」。延後回收才安全。
 */
export function saveBlobAsFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

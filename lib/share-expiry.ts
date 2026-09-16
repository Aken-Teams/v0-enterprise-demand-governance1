/**
 * 分享連結的有效期限。
 *
 * 一般使用者（需求方、交付團隊）沿用預設 7 天——他們拿到的就是一條可以直接轉給
 * 同事看的連結，不需要也不該自行延長外流時間。管理者則可指定到期日，因為實務上
 * 常遇到對方單位七天內看不完（跨部門會簽、放長假），總不能為此一直重發連結。
 *
 * 上限刻意不做成無限：分享連結一旦外流就無法回收，有到期日才有最後一道防線。
 */

/** 未指定時的預設天數 */
export const DEFAULT_SHARE_DAYS = 7

/** 管理者可指定的最長天數（約半年） */
export const MAX_SHARE_DAYS = 180

/** 管理者在介面上可一鍵選擇的天數 */
export const SHARE_DAY_PRESETS = [7, 14, 30, 60, 90] as const

function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

/**
 * 依角色與請求內容決定到期時間。
 *
 * @param role      呼叫者角色；只有 admin 能自訂
 * @param input     `{ days }` 或 `{ expiresAt }`（ISO 日期字串），皆為選填
 * @returns 到期時間；非管理者或未指定時一律為現在 +7 天
 */
export function resolveShareExpiry(
  role: string,
  input?: { days?: unknown; expiresAt?: unknown }
): Date {
  const fallback = new Date(Date.now() + DEFAULT_SHARE_DAYS * 24 * 60 * 60 * 1000)
  if (role !== "admin" || !input) return fallback

  // 指定天數
  if (input.days != null) {
    const n = Number(input.days)
    if (!Number.isFinite(n)) return fallback
    const days = Math.min(MAX_SHARE_DAYS, Math.max(1, Math.round(n)))
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  }

  // 指定到期日：以當天結束為準，避免使用者選了今天卻立刻過期
  if (typeof input.expiresAt === "string" && input.expiresAt) {
    const picked = endOfDay(new Date(input.expiresAt))
    if (isNaN(picked.getTime())) return fallback
    const max = endOfDay(new Date(Date.now() + MAX_SHARE_DAYS * 24 * 60 * 60 * 1000))
    if (picked.getTime() <= Date.now()) return fallback
    return picked > max ? max : picked
  }

  return fallback
}

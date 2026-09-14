/**
 * 簽核附件的來源判定。
 *
 * 簽核往返的檔案與階段文件存在同一張表（DemandDocument），只靠檔名分不出
 * 「我方提出時附的」和「需求方回應時附的」——兩者混在同一份清單裡，看的人
 * 會不知道某個檔案是誰給的。這裡依上傳者身分（發起人 / 回應人）判定，
 * 同一人既發起又回應時（例如代簽）改以回應時間為界。
 */

export type SignoffDocSource = "request" | "response"

interface SignoffLike {
  id: string
  phase: string
  status: string
  requestedById: string | null
  respondedById: string | null
  requestedAt: Date | string
  respondedAt: Date | string | null
}

/** 一次簽核往返（同階段、同時發起的一批簽核） */
export interface SignoffRound {
  /** 分組用的鍵，同一次往返的附件共用 */
  key: string
  /** 審核日期：該輪最後的回應時間；尚未回應則用發起時間 */
  date: string
  /** 該輪結果：任一人退回即為 REJECTED，全數同意為 APPROVED，否則 PENDING */
  status: "APPROVED" | "REJECTED" | "PENDING"
}

interface DocLike {
  signoffId: string | null
  uploadedBy: string
  createdAt: Date | string
}

/** 容差：回應與附件寫入有先後，抓 1 分鐘避免同一動作被切成兩邊 */
const TOLERANCE_MS = 60_000

export function signoffDocSource(
  doc: DocLike,
  signoffs: SignoffLike[]
): SignoffDocSource | null {
  if (!doc.signoffId) return null
  const s = signoffs.find((x) => x.id === doc.signoffId)
  if (!s) return null

  const sameUser = !!s.requestedById && s.requestedById === s.respondedById
  if (!sameUser) {
    if (s.respondedById && doc.uploadedBy === s.respondedById) return "response"
    if (s.requestedById && doc.uploadedBy === s.requestedById) return "request"
  }
  if (s.respondedAt) {
    const responded = new Date(s.respondedAt).getTime()
    return new Date(doc.createdAt).getTime() >= responded - TOLERANCE_MS ? "response" : "request"
  }
  // 尚未回應 → 只可能是提出時附的
  return "request"
}

/**
 * 把簽核歸成「一次往返」：同階段、同一時間發起的一批簽核算同一輪
 * （多簽核人時會有數筆，但屬同一次送簽）。
 */
function buildRounds(signoffs: SignoffLike[]): Map<string, SignoffRound> {
  const bySignoff = new Map<string, SignoffRound>()
  const rounds = new Map<string, { members: SignoffLike[] }>()

  for (const s of signoffs) {
    const key = `${s.phase}:${new Date(s.requestedAt).getTime()}`
    const r = rounds.get(key)
    if (r) r.members.push(s)
    else rounds.set(key, { members: [s] })
  }

  for (const [key, { members }] of rounds) {
    const responded = members
      .map((m) => (m.respondedAt ? new Date(m.respondedAt).getTime() : null))
      .filter((t): t is number => t != null)
    const date = responded.length > 0
      ? new Date(Math.max(...responded)).toISOString()
      : new Date(members[0].requestedAt).toISOString()
    const status: SignoffRound["status"] = members.some((m) => m.status === "REJECTED")
      ? "REJECTED"
      : members.every((m) => m.status === "APPROVED" || m.status === "SKIPPED")
        ? "APPROVED"
        : "PENDING"
    const round: SignoffRound = { key, date, status }
    for (const m of members) bySignoff.set(m.id, round)
  }
  return bySignoff
}

/** 替一批文件標上來源與所屬的簽核往返，供前端分組或加標籤 */
export function annotateSignoffDocs<T extends DocLike>(
  docs: T[],
  signoffs: SignoffLike[]
): (T & { signoffSource: SignoffDocSource | null; signoffRound: SignoffRound | null })[] {
  const rounds = buildRounds(signoffs)
  return docs.map((d) => ({
    ...d,
    signoffSource: signoffDocSource(d, signoffs),
    signoffRound: d.signoffId ? rounds.get(d.signoffId) ?? null : null,
  }))
}

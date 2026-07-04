import { prisma } from "@/lib/prisma"

/**
 * 依「一間公司一位」的優先序，決定某需求（組織）的董事簽核人：
 *  1) 該組織專屬董事（restrictBoardToOrg 且組織相符）優先，例如 無錫→曹杰、徐州→陳英聖。
 *  2) 否則 → 預設董事（未限定組織者），例如方士碩。
 *  3) 否則 → 全體有效董事（保底，避免無人把關）。
 * 用於開案確認(SP_REVIEW)與設計變更 SP 審核，確保兩邊一致、不會累加多人。
 */
export async function resolveBoardReviewers(organizationId: string): Promise<{ userId: string; role: "BOARD" }[]> {
  const board = await prisma.user.findMany({
    where: { isBoardMember: true, isActive: true, boardExemptFromSignoff: false },
    select: { id: true, restrictBoardToOrg: true, organizationId: true },
  })
  const orgSpecific = board.filter((u) => u.restrictBoardToOrg && u.organizationId === organizationId)
  const defaults = board.filter((u) => !u.restrictBoardToOrg)
  const chosen = orgSpecific.length > 0 ? orgSpecific : defaults.length > 0 ? defaults : board
  return chosen.map((u) => ({ userId: u.id, role: "BOARD" as const }))
}

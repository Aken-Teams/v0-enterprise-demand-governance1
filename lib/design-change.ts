import { resolveBoardReviewers } from "@/lib/board"

export interface ParsedChecklistItem {
  text: string
  checked: boolean
}

/**
 * 解析 Markdown GFM task list 成逐條項目。
 * 支援 `- [ ]` / `- [x]` / `* [ ]` / `+ [ ]` / `1. [ ]`（大小寫 x 皆可）。
 * 非 task-list 的行會被忽略。
 */
export function parseChecklistMarkdown(md: string | null | undefined): ParsedChecklistItem[] {
  if (!md) return []
  const items: ParsedChecklistItem[] = []
  for (const rawLine of md.split(/\r?\n/)) {
    const m = rawLine.trim().match(/^(?:[-*+]|\d+\.)\s+\[([ xX])\]\s+(.*)$/)
    if (m) {
      const text = m[2].trim()
      if (text) items.push({ text, checked: m[1].toLowerCase() === "x" })
    }
  }
  return items
}

export interface ReviewerTarget {
  userId: string
  role: "REQUESTER" | "MANAGER" | "BOARD"
}

/** 設計變更審核階段 */
export type DesignChangeStage = "GATE" | "CONTENT"

/**
 * 第一階段「設計變更確認」審核人：董事會 + 需求窗口。
 *
 * 不論該版本是否影響 SP 都必須經過此關——董事會要求所有設計變更都需其背書。
 * 兩方皆同意後才開放需求方進入逐條確認；任一方駁回，該設計變更即中止。
 *
 * 需求窗口預設沿用專案設定，可用 contactPersonOverride 手動指定。
 * 若窗口本身也是董事，只保留一筆 REQUESTER（避免 revisionId+reviewerId+stage 唯一鍵衝突）。
 */
export async function resolveGateReviewers(
  demand: { organizationId: string; contactPersonId: string | null },
  opts?: { contactPersonOverride?: string | null }
): Promise<ReviewerTarget[]> {
  const targets: ReviewerTarget[] = []
  const requesterId = opts?.contactPersonOverride || demand.contactPersonId
  if (requesterId) targets.push({ userId: requesterId, role: "REQUESTER" })
  const board = await resolveBoardReviewers(demand.organizationId)
  for (const b of board) {
    if (b.userId !== requesterId) targets.push({ userId: b.userId, role: "BOARD" })
  }
  return targets
}

/**
 * 第二階段「逐條確認」審核人：需求窗口(REQUESTER) + 需求主管(MANAGER，若有指派)。
 * 董事會不在此階段——已於第一階段的設計變更確認 (resolveGateReviewers) 完成背書。
 *
 * 需求窗口預設沿用專案設定 (demand.contactPersonId)，但可用 contactPersonOverride 手動指定。
 * 若窗口與需求主管為同一人，只留一筆（避免 revisionId+reviewerId 唯一鍵衝突）。
 */
export function resolveDesignChangeReviewers(
  demand: { contactPersonId: string | null; demandManagerId: string | null },
  opts?: { contactPersonOverride?: string | null }
): ReviewerTarget[] {
  const targets: ReviewerTarget[] = []
  const requesterId = opts?.contactPersonOverride || demand.contactPersonId
  if (requesterId) targets.push({ userId: requesterId, role: "REQUESTER" })
  if (demand.demandManagerId && demand.demandManagerId !== requesterId) {
    targets.push({ userId: demand.demandManagerId, role: "MANAGER" })
  }
  return targets
}

// resolveBoardReviewers 已移至 lib/board.ts（開案確認與設計變更共用同一套優先序）
export { resolveBoardReviewers }

/**
 * 依所有審核裁決計算版本整體狀態。
 * 任一 REJECTED → REJECTED；全部 APPROVED → APPROVED；否則 PENDING。
 */
export function computeRevisionStatus(
  reviews: { decision: string }[]
): "PENDING" | "APPROVED" | "REJECTED" {
  if (reviews.length === 0) return "PENDING"
  if (reviews.some((r) => r.decision === "REJECTED")) return "REJECTED"
  if (reviews.every((r) => r.decision === "APPROVED")) return "APPROVED"
  return "PENDING"
}

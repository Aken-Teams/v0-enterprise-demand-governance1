import { prisma } from "@/lib/prisma"

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

/**
 * 第一階段審核人：需求窗口(REQUESTER) + 需求主管(MANAGER，若有指派)。
 * 董事會不在此階段——採兩段式：需求方通過後、若該版影響 SP，才送董事會。
 */
export function resolveDesignChangeReviewers(
  demand: { contactPersonId: string | null; demandManagerId: string | null }
): ReviewerTarget[] {
  const targets: ReviewerTarget[] = []
  if (demand.contactPersonId) targets.push({ userId: demand.contactPersonId, role: "REQUESTER" })
  if (demand.demandManagerId) targets.push({ userId: demand.demandManagerId, role: "MANAGER" })
  return targets
}

/**
 * 董事會審核人（第二階段，僅在需求方通過且該版影響 SP 時加入）。
 */
export async function resolveBoardReviewers(organizationId: string): Promise<ReviewerTarget[]> {
  const boardMembers = await prisma.user.findMany({
    where: { isBoardMember: true, isActive: true, boardExemptFromSignoff: false },
    select: { id: true, restrictBoardToOrg: true, organizationId: true },
  })
  const targets: ReviewerTarget[] = []
  for (const u of boardMembers) {
    if (u.restrictBoardToOrg && u.organizationId !== organizationId) continue
    targets.push({ userId: u.id, role: "BOARD" })
  }
  return targets
}

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

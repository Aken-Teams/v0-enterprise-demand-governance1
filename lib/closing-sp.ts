/**
 * 結案 SP 調整（PhaseSignoff kind = "CLOSING_SP"）的暫存內容。
 *
 * 結案時若 SP 有變動，調整內容不會立即寫入，而是序列化存進 PhaseSignoff.payload，
 * 待 Scrum Master 全數同意後才由簽核端實際套用並結案。
 */
export interface ClosingSpPayload {
  /** 發起當下的有效 SP（confirmedSp ?? estimatedSp） */
  oldSp: number
  /** 調整後 SP */
  newSp: number
  /** 調整原因 */
  reason: string | null
  /** 各階段 SP 重新分配（不含 CLOSED） */
  phaseAllocations: Record<string, number> | null
  /** 結案日期（ISO 字串，選填） */
  completedDate: string | null
  /** 造成此次調整的設計變更 id（僅限已通過者） */
  designChangeIds: string[]
}

/** 安全地解析 PhaseSignoff.payload；格式不符時回傳 null 而非拋錯 */
export function parseClosingSpPayload(raw: string | null | undefined): ClosingSpPayload | null {
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as ClosingSpPayload
    if (typeof p?.newSp !== "number" || !Number.isFinite(p.newSp)) return null
    return p
  } catch {
    return null
  }
}

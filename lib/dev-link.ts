import { resolveDesignChangeReviewers, type ReviewerTarget } from "@/lib/design-change"

/** PhaseSignoff.kind：開發中「APP 交付連結」確認 */
export const DEV_LINK_KIND = "DEV_LINK"

/**
 * 交付連結的確認人：需求窗口（必要）＋ 需求主管（若有指派）。
 * 與設計變更的逐條確認同一組人——都是代表需求方對開發成果表態的角色，
 * 故直接沿用同一份解析邏輯，避免兩處各自演化。
 */
export function resolveDevLinkConfirmers(
  demand: { contactPersonId: string | null; demandManagerId: string | null }
): ReviewerTarget[] {
  return resolveDesignChangeReviewers(demand)
}

/** 判斷某份文件是否為「開發中的 APP 交付連結」——即觸發確認與計費的那一類。 */
export function isDevDeliveryLink(doc: { type: string; phase: string | null }): boolean {
  return doc.type === "APP_RESULT" && doc.phase === "DEVELOPING"
}

/**
 * 需求方在確認之前，是否應遮蔽開發中的交付連結。
 *
 * 只遮蔽 APP 交付成果，GitHub 連結另有機密性規範、一律不對需求方開放。
 * 確認之後即永久可見；需求已離開開發中者不再遮蔽（該收的已收）。
 */
export function shouldMaskDevLinks(demand: {
  status: string
  devLinkConfirmedAt: Date | string | null
}): boolean {
  return demand.status === "DEVELOPING" && !demand.devLinkConfirmedAt
}

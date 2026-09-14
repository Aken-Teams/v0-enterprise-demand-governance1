import { formatSp } from "@/lib/constants/demand"
/**
 * HTML email templates for the demand governance system.
 */

/** 簽核通知信 HTML 模板（含「終止結算」變體） */
export function signoffNotificationTemplate(params: {
  demandNumber: string
  demandTitle: string
  phaseLabel: string
  shareUrl: string
  signerNames?: string[]
  /** 終止結算代簽：改用終止相關文案與橘色主題 */
  isTermination?: boolean
  settlementPct?: number
  settledSp?: number | null
  effectiveSp?: number | null
}): string {
  const { demandNumber, demandTitle, phaseLabel, shareUrl, signerNames, isTermination, settlementPct, settledSp, effectiveSp } = params

  const greeting = signerNames?.length
    ? `${signerNames.join("、")} 您好，`
    : "您好，"

  const isTerm = !!isTermination
  const headerTitle = isTerm ? "JV 需求管理系統 — 專案終止確認" : "JV 需求管理系統 — 簽核通知"
  const themeColor = isTerm ? "#ea580c" : "#2563eb"
  const btnLabel = isTerm ? "查看並確認終止" : "查看需求並簽核"
  const ctaLine = isTerm ? "請點擊下方按鈕查看需求詳情並確認是否終止：" : "請點擊下方按鈕查看需求詳情並進行簽核："
  const phaseBadge = `<span style="display:inline-block;background:${isTerm ? "#ffedd5" : "#dbeafe"};color:${isTerm ? "#c2410c" : "#1d4ed8"};padding:2px 8px;border-radius:4px;font-size:13px;font-weight:600;">${phaseLabel}</span>`

  const settlementText = settledSp != null
    ? `結算 <strong>${formatSp(settledSp)} SP</strong>（原 ${effectiveSp != null ? formatSp(effectiveSp) : "-"} × ${settlementPct}%）`
    : `消耗 <strong>${settlementPct}%</strong> SP`

  const bodyPara = isTerm
    ? `需求 <strong>${demandNumber} — ${demandTitle}</strong>（目前 ${phaseBadge} 階段）由管理者申請<strong style="color:#c2410c;">終止此專案並直接結算</strong>，需要您（Scrum Master）確認。通過後將依目前進度${settlementText}並結案。`
    : `需求 <strong>${demandNumber} — ${demandTitle}</strong> 目前處於 ${phaseBadge} 階段，需要您進行簽核確認。`

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Microsoft JhengHei','PingFang TC',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background:${themeColor};padding:24px 32px;">
            <h2 style="margin:0;color:#ffffff;font-size:18px;">${headerTitle}</h2>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#1f2937;">${greeting}</p>
            <p style="margin:0 0 16px;font-size:15px;color:#1f2937;line-height:1.7;">
              ${bodyPara}
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#1f2937;">
              ${ctaLine}
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:${themeColor};border-radius:6px;">
                  <a href="${shareUrl}" target="_blank" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;">
                    ${btnLabel}
                  </a>
                </td>
              </tr>
            </table>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              此信件由JV 需求管理系統自動產生，請勿直接回覆。
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

/** 月度 SP 報表信件 HTML 模板 */
export function monthlyReportTemplate(params: {
  orgName: string
  monthLabel: string
}): string {
  const { orgName, monthLabel } = params

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Microsoft JhengHei','PingFang TC',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr>
          <td style="background:#2563eb;padding:24px 32px;">
            <h2 style="margin:0;color:#ffffff;font-size:18px;">JV 需求管理系統 — SP 月報</h2>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#1f2937;">您好，</p>
            <p style="margin:0 0 16px;font-size:15px;color:#1f2937;">
              附件為 <strong>${orgName}</strong> 的 <strong>${monthLabel}</strong> SP 消耗月報。
            </p>
            <p style="margin:0 0 16px;font-size:15px;color:#1f2937;">
              請查看附件中的 Excel 檔案以了解詳細的需求明細與金額資訊。
            </p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              此信件由JV 需求管理系統自動產生，請勿直接回覆。
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

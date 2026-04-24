/**
 * HTML email templates for the demand governance system.
 */

/** 簽核通知信 HTML 模板 */
export function signoffNotificationTemplate(params: {
  demandNumber: string
  demandTitle: string
  phaseLabel: string
  shareUrl: string
  signerNames?: string[]
}): string {
  const { demandNumber, demandTitle, phaseLabel, shareUrl, signerNames } = params

  const greeting = signerNames?.length
    ? `${signerNames.join("、")} 您好，`
    : "您好，"

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Microsoft JhengHei','PingFang TC',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background:#2563eb;padding:24px 32px;">
            <h2 style="margin:0;color:#ffffff;font-size:18px;">JV 需求管理系統 — 簽核通知</h2>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#1f2937;">${greeting}</p>
            <p style="margin:0 0 16px;font-size:15px;color:#1f2937;">
              需求 <strong>${demandNumber} — ${demandTitle}</strong> 目前處於
              <span style="display:inline-block;background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:4px;font-size:13px;font-weight:600;">
                ${phaseLabel}
              </span>
              階段，需要您進行簽核確認。
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#1f2937;">
              請點擊下方按鈕查看需求詳情並進行簽核：
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#2563eb;border-radius:6px;">
                  <a href="${shareUrl}" target="_blank" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;">
                    查看需求並簽核
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
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
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

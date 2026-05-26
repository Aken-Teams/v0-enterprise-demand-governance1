/**
 * Send a test email to a specific user by employee number (ldapUsername).
 *
 * Usage: npx tsx scripts/test-mail.ts <工號>
 * Example: npx tsx scripts/test-mail.ts 33333
 */
import "dotenv/config"
import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"

const MAIL_BASE_URL = process.env.AD_URL || "http://220.130.234.188:9998"
const MAIL_API_KEY = process.env.AD_API || ""

async function main() {
  const empNo = process.argv[2]
  if (!empNo) {
    console.error("Usage: npx tsx scripts/test-mail.ts <工號>")
    process.exit(1)
  }

  const adapter = new PrismaMariaDb(process.env.DATABASE_URL!)
  const prisma = new PrismaClient({ adapter })

  try {
    // Find user by ldapUsername (工號)
    const user = await prisma.user.findFirst({
      where: { ldapUsername: empNo },
      select: { id: true, name: true, email: true, ldapUsername: true, role: true },
    })

    if (!user) {
      console.error(`找不到工號 ${empNo} 的使用者`)
      process.exit(1)
    }

    console.log(`找到使用者: ${user.name} (${user.email}), 角色: ${user.role}`)
    console.log(`準備發送測試信到: ${user.email}`)

    const now = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })
    const subject = `[測試] 需求治理系統 - 郵件通知測試`
    const body = `
      <div style="font-family: 'Microsoft JhengHei', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">需求治理系統 - 測試通知</h2>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p>您好，<strong>${user.name}</strong>，</p>
          <p>這是一封來自需求治理系統的<strong>測試郵件</strong>，用於驗證郵件通知功能是否正常運作。</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; color: #6b7280;">收件人</td><td style="padding: 8px;">${user.name} (${user.email})</td></tr>
            <tr><td style="padding: 8px; color: #6b7280;">工號</td><td style="padding: 8px;">${user.ldapUsername}</td></tr>
            <tr><td style="padding: 8px; color: #6b7280;">發送時間</td><td style="padding: 8px;">${now}</td></tr>
          </table>
          <p style="color: #6b7280; font-size: 13px;">如果您收到此郵件，表示郵件通知功能運作正常。此為系統測試信，請忽略。</p>
        </div>
      </div>
    `

    const response = await fetch(`${MAIL_BASE_URL}/ldap/api/v1/mail/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": MAIL_API_KEY,
      },
      body: JSON.stringify({
        to: [user.email],
        subject,
        body,
        is_html: true,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`寄信失敗 (HTTP ${response.status}): ${text}`)
      process.exit(1)
    }

    const result = await response.json()
    console.log("寄信成功!", JSON.stringify(result, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error("錯誤:", err)
  process.exit(1)
})

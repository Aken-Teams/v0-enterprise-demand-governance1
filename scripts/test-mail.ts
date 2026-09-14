/**
 * Send a test email to a specific user by employee number (ldapUsername).
 *
 * Usage: npx tsx scripts/test-mail.ts <工號>
 * Example: npx tsx scripts/test-mail.ts 33333
 */
import "dotenv/config"
import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import { signoffNotificationTemplate } from "../lib/mail-templates"

const MAIL_BASE_URL = process.env.AD_URL || "http://220.130.234.188:9998"
const MAIL_API_KEY = process.env.AD_API || ""
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://jv-sp.jvision-ai.com"

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

    const subject = `[測試] TEST-001 請確認簽核 - 測試需求`
    const body = signoffNotificationTemplate({
      demandNumber: "TEST-001",
      demandTitle: "這是一封測試信件",
      phaseLabel: "PRD 文件確認",
      shareUrl: `${BASE_URL}/governance`,
      signerNames: [user.name],
    })

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
        body_type: "html",
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

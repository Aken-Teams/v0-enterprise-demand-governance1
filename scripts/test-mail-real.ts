/**
 * Send a real-style notification email for a specific demand.
 *
 * Usage: npx tsx scripts/test-mail-real.ts <需求編號> <工號>
 * Example: npx tsx scripts/test-mail-real.ts REQ-2026-033 33333
 */
import "dotenv/config"
import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import { signoffNotificationTemplate } from "../lib/mail-templates"
import { nanoid } from "nanoid"

const MAIL_BASE_URL = process.env.AD_URL || "http://220.130.234.188:9998"
const MAIL_API_KEY = process.env.AD_API || ""
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://jv-sp.jvision-ai.com"

const STATUS_MAP: Record<string, string> = {
  SUBMITTED: "需求確認",
  PRD_REVIEW: "MVP 架構確認",
  SP_REVIEW: "開案確認",
  DEVELOPING: "開發中",
  ACCEPTANCE: "驗收中",
  CLOSED: "已結案",
}

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!)
const prisma = new PrismaClient({ adapter })

async function main() {
  const demandNumber = process.argv[2]
  const empNo = process.argv[3]
  if (!demandNumber || !empNo) {
    console.error("Usage: npx tsx scripts/test-mail-real.ts <需求編號> <工號>")
    process.exit(1)
  }

  try {
    // Find demand
    const demand = await prisma.demand.findFirst({
      where: { demandNumber },
      select: { id: true, demandNumber: true, title: true, status: true },
    })
    if (!demand) {
      console.error(`找不到需求 ${demandNumber}`)
      process.exit(1)
    }
    console.log(`需求: ${demand.demandNumber} - ${demand.title} (${demand.status})`)

    // Find user
    const user = await prisma.user.findFirst({
      where: { ldapUsername: empNo },
      select: { id: true, name: true, email: true },
    })
    if (!user) {
      console.error(`找不到工號 ${empNo} 的使用者`)
      process.exit(1)
    }
    console.log(`收件人: ${user.name} (${user.email})`)

    // Find or create active share link
    const existing = await prisma.demandShare.findMany({
      where: { demandId: demand.id },
      select: { token: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
    })
    let shareToken = existing.find(s => new Date(s.expiresAt) > new Date())?.token

    if (!shareToken) {
      const token = nanoid(12)
      await prisma.demandShare.create({
        data: {
          demandId: demand.id,
          token,
          createdById: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      })
      shareToken = token
      console.log("已建立新的分享連結")
    } else {
      console.log("使用現有分享連結")
    }

    const shareUrl = `${BASE_URL}/share/${shareToken}`
    console.log(`分享連結: ${shareUrl}`)

    // Build email
    const phaseLabel = STATUS_MAP[demand.status] || demand.status
    const subject = `[${demand.demandNumber}] 請確認簽核 - ${demand.title}`
    const body = signoffNotificationTemplate({
      demandNumber: demand.demandNumber,
      demandTitle: demand.title,
      phaseLabel,
      shareUrl,
      signerNames: [user.name],
    })

    // Send
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
    console.log("寄信成功!", JSON.stringify(result))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error("錯誤:", err)
  process.exit(1)
})

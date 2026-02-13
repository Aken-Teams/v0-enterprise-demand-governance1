import "dotenv/config"
import { PrismaClient } from "../lib/generated/prisma/client.js"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import bcrypt from "bcryptjs"

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("🌱 開始種子數據...")

  // Clean existing data (in reverse dependency order)
  await prisma.notification.deleteMany()
  await prisma.acceptanceRecord.deleteMany()
  await prisma.demandComment.deleteMany()
  await prisma.demandDocument.deleteMany()
  await prisma.demandStatusHistory.deleteMany()
  await prisma.spTransaction.deleteMany()
  await prisma.demand.deleteMany()
  await prisma.spWallet.deleteMany()
  await prisma.user.deleteMany()
  await prisma.organization.deleteMany()

  console.log("✅ 清除舊數據完成")

  // ============================================================
  // 1. Organizations (7 子公司)
  // ============================================================
  const orgs = await Promise.all([
    prisma.organization.create({
      data: { code: "panjit", name: "強茂", fullName: "強茂股份有限公司" },
    }),
    prisma.organization.create({
      data: { code: "panjit-tech", name: "璟茂科技", fullName: "璟茂科技股份有限公司" },
    }),
    prisma.organization.create({
      data: { code: "ymoptics", name: "熒茂光學", fullName: "熒茂光學股份有限公司" },
    }),
    prisma.organization.create({
      data: { code: "panjit-wuxi", name: "強茂電子（無錫）", fullName: "強茂電子（無錫）有限公司" },
    }),
    prisma.organization.create({
      data: { code: "panjit-xuzhou", name: "強茂半導體（徐州）", fullName: "強茂半導體（徐州）有限公司" },
    }),
    prisma.organization.create({
      data: { code: "panjit-shandong", name: "山東強茂電子", fullName: "山東強茂電子有限公司" },
    }),
    prisma.organization.create({
      data: { code: "hge", name: "虹冠電子工業", fullName: "虹冠電子工業股份有限公司" },
    }),
  ])

  console.log(`✅ 建立 ${orgs.length} 個組織`)

  // ============================================================
  // 2. Users (7 subsidiary + 1 admin + 1 delivery)
  // ============================================================
  const [panjit, panjitTech, ymoptics, panjitWuxi, panjitXuzhou, panjitShandong, hge] = orgs

  // 每個使用者不同密碼
  const passwords = {
    panjit: await bcrypt.hash("panjit123", 10),
    panjitTech: await bcrypt.hash("panjittech123", 10),
    ymoptics: await bcrypt.hash("ymoptics123", 10),
    panjitWuxi: await bcrypt.hash("wuxi123", 10),
    panjitXuzhou: await bcrypt.hash("xuzhou123", 10),
    panjitShandong: await bcrypt.hash("shandong123", 10),
    hge: await bcrypt.hash("hge123", 10),
    admin: await bcrypt.hash("admin123", 10),
    jv: await bcrypt.hash("jvteam123", 10),
  }

  const users = await Promise.all([
    // Subsidiary users
    prisma.user.create({
      data: {
        email: "panjit@demo.com",
        name: "強茂",
        password: passwords.panjit,
        role: "subsidiary",
        organizationId: panjit.id,
      },
    }),
    prisma.user.create({
      data: {
        email: "panjit-tech@demo.com",
        name: "璟茂科技",
        password: passwords.panjitTech,
        role: "subsidiary",
        organizationId: panjitTech.id,
      },
    }),
    prisma.user.create({
      data: {
        email: "ymoptics@demo.com",
        name: "熒茂光學",
        password: passwords.ymoptics,
        role: "subsidiary",
        organizationId: ymoptics.id,
      },
    }),
    prisma.user.create({
      data: {
        email: "panjit-wuxi@demo.com",
        name: "強茂電子（無錫）",
        password: passwords.panjitWuxi,
        role: "subsidiary",
        organizationId: panjitWuxi.id,
      },
    }),
    prisma.user.create({
      data: {
        email: "panjit-xuzhou@demo.com",
        name: "強茂半導體（徐州）",
        password: passwords.panjitXuzhou,
        role: "subsidiary",
        organizationId: panjitXuzhou.id,
      },
    }),
    prisma.user.create({
      data: {
        email: "panjit-shandong@demo.com",
        name: "山東強茂電子",
        password: passwords.panjitShandong,
        role: "subsidiary",
        organizationId: panjitShandong.id,
      },
    }),
    prisma.user.create({
      data: {
        email: "hge@demo.com",
        name: "虹冠電子工業",
        password: passwords.hge,
        role: "subsidiary",
        organizationId: hge.id,
      },
    }),
    // Admin user
    prisma.user.create({
      data: {
        email: "admin@demo.com",
        name: "系統管理員",
        password: passwords.admin,
        role: "admin",
      },
    }),
    // Delivery (JV) user
    prisma.user.create({
      data: {
        email: "jv@demo.com",
        name: "JV 團隊成員",
        password: passwords.jv,
        role: "delivery",
      },
    }),
  ])

  console.log(`✅ 建立 ${users.length} 個使用者`)

  // ============================================================
  // 3. SP Wallets (2025 年度, 每個組織一個, 數據歸零)
  // ============================================================
  const wallets = await Promise.all(
    orgs.map((org) =>
      prisma.spWallet.create({
        data: {
          organizationId: org.id,
          year: 2025,
          totalQuota: 0,
          usedSp: 0,
          committedSp: 0,
        },
      })
    )
  )

  console.log(`✅ 建立 ${wallets.length} 個 SP 錢包（數據歸零）`)

  console.log("\n🎉 種子數據建立完成！")
  console.log("📊 統計:")
  console.log(`   - 組織: ${orgs.length}`)
  console.log(`   - 使用者: ${users.length}`)
  console.log(`   - SP 錢包: ${wallets.length}（配額歸零）`)
  console.log("   - 需求: 0")
  console.log("   - 其他數據: 0")
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

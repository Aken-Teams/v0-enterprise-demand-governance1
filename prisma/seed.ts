import "dotenv/config"
import { PrismaClient, DemandStatus, DemandPriority, DocumentType, SpTransactionType, NotificationType } from "../lib/generated/prisma/client.js"
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

  const [userPanjit, userPanjitTech, userYmoptics, , , , , userAdmin, userJV] = users

  console.log(`✅ 建立 ${users.length} 個使用者`)

  // ============================================================
  // 3. SP Wallets (2024 年度, 每個組織一個)
  // ============================================================
  const walletData = [
    { orgId: panjit.id, quota: 500, used: 244, committed: 100 },
    { orgId: panjitTech.id, quota: 350, used: 120, committed: 85 },
    { orgId: ymoptics.id, quota: 400, used: 95, committed: 60 },
    { orgId: panjitWuxi.id, quota: 600, used: 180, committed: 120 },
    { orgId: panjitXuzhou.id, quota: 450, used: 110, committed: 70 },
    { orgId: panjitShandong.id, quota: 300, used: 75, committed: 40 },
    { orgId: hge.id, quota: 250, used: 50, committed: 30 },
  ]

  const wallets = await Promise.all(
    walletData.map((w) =>
      prisma.spWallet.create({
        data: {
          organizationId: w.orgId,
          year: 2024,
          totalQuota: w.quota,
          usedSp: w.used,
          committedSp: w.committed,
        },
      })
    )
  )

  console.log(`✅ 建立 ${wallets.length} 個 SP 錢包`)

  // ============================================================
  // 4. Demands (15 筆覆蓋各狀態)
  // ============================================================
  const demands = await Promise.all([
    // SUBMITTED - 需求提出
    prisma.demand.create({
      data: {
        demandNumber: "REQ-2024-001",
        title: "客戶管理系統新增匯出功能",
        description: "需要在客戶管理系統中新增 Excel 和 PDF 的匯出功能，支援自訂欄位選擇和篩選條件匯出。",
        businessPurpose: "提升業務團隊的工作效率，減少手動整理資料的時間，預計可節省每月 40 小時人力。",
        status: DemandStatus.SUBMITTED,
        priority: DemandPriority.high,
        estimatedSp: 13,
        organizationId: panjit.id,
        submitterId: userPanjit.id,
        creatorId: userPanjit.id,
        desiredDate: new Date("2024-06-30"),
      },
    }),
    prisma.demand.create({
      data: {
        demandNumber: "REQ-2024-002",
        title: "報表匯出功能優化",
        description: "現有報表匯出功能需優化，增加排程自動匯出及信件通知功能。",
        businessPurpose: "讓管理層能定期自動收到關鍵報表，提升決策效率。",
        status: DemandStatus.SUBMITTED,
        priority: DemandPriority.medium,
        estimatedSp: 8,
        organizationId: panjitTech.id,
        submitterId: userPanjitTech.id,
        creatorId: userPanjitTech.id,
      },
    }),
    // PRD_REVIEW - PRD 確認中
    prisma.demand.create({
      data: {
        demandNumber: "REQ-2024-003",
        title: "行動版介面開發",
        description: "開發行動版（RWD）介面，讓使用者可透過手機瀏覽與操作主要功能。",
        businessPurpose: "提升外出業務人員的使用便利性，擴大系統使用率。",
        status: DemandStatus.PRD_REVIEW,
        priority: DemandPriority.high,
        estimatedSp: 34,
        organizationId: panjit.id,
        submitterId: userPanjit.id,
        creatorId: userPanjit.id,
        managerId: userAdmin.id,
      },
    }),
    prisma.demand.create({
      data: {
        demandNumber: "REQ-2024-004",
        title: "多語系支援",
        description: "系統需支援繁體中文、簡體中文、英文三種語系切換。",
        businessPurpose: "因應海外子公司使用需求，統一系統操作介面。",
        status: DemandStatus.PRD_REVIEW,
        priority: DemandPriority.medium,
        estimatedSp: 55,
        organizationId: ymoptics.id,
        submitterId: userYmoptics.id,
        creatorId: userYmoptics.id,
        managerId: userAdmin.id,
      },
    }),
    // SP_REVIEW - SP 確認中
    prisma.demand.create({
      data: {
        demandNumber: "REQ-2024-005",
        title: "即時通訊整合",
        description: "整合企業即時通訊功能，支援需求討論的即時溝通。",
        businessPurpose: "減少跨團隊溝通成本，加速需求確認流程。",
        status: DemandStatus.SP_REVIEW,
        priority: DemandPriority.medium,
        estimatedSp: 21,
        organizationId: panjit.id,
        submitterId: userPanjit.id,
        creatorId: userAdmin.id,
        managerId: userAdmin.id,
      },
    }),
    prisma.demand.create({
      data: {
        demandNumber: "REQ-2024-006",
        title: "行動端 APP 開發",
        description: "開發 iOS 和 Android 原生 APP，提供離線操作能力。",
        businessPurpose: "滿足工廠現場無網路環境的操作需求。",
        status: DemandStatus.SP_REVIEW,
        priority: DemandPriority.high,
        estimatedSp: 89,
        organizationId: panjitTech.id,
        submitterId: userPanjitTech.id,
        creatorId: userPanjitTech.id,
        managerId: userAdmin.id,
      },
    }),
    // DEVELOPING - 開發中
    prisma.demand.create({
      data: {
        demandNumber: "REQ-2024-007",
        title: "權限管理模組重構",
        description: "重構現有權限管理模組，支援更細粒度的權限控制和角色繼承。",
        businessPurpose: "解決現有權限控制不夠精細的問題，提升系統安全性。",
        status: DemandStatus.DEVELOPING,
        priority: DemandPriority.high,
        estimatedSp: 21,
        confirmedSp: 21,
        organizationId: panjit.id,
        submitterId: userPanjit.id,
        creatorId: userAdmin.id,
        managerId: userAdmin.id,
        developerId: userJV.id,
        expectedDate: new Date("2024-03-15"),
      },
    }),
    prisma.demand.create({
      data: {
        demandNumber: "REQ-2024-008",
        title: "資料分析儀表板",
        description: "建立資料分析儀表板，提供即時的業務數據視覺化呈現。",
        businessPurpose: "幫助管理層快速掌握營運狀況，支援數據驅動決策。",
        status: DemandStatus.DEVELOPING,
        priority: DemandPriority.medium,
        estimatedSp: 34,
        confirmedSp: 34,
        organizationId: panjitTech.id,
        submitterId: userPanjitTech.id,
        creatorId: userPanjitTech.id,
        managerId: userAdmin.id,
        developerId: userJV.id,
        expectedDate: new Date("2024-04-01"),
      },
    }),
    prisma.demand.create({
      data: {
        demandNumber: "REQ-2024-009",
        title: "ERP 系統整合",
        description: "與現有 ERP 系統進行數據整合，實現訂單、庫存等資料自動同步。",
        businessPurpose: "消除資料重複輸入，降低人為錯誤，提升作業效率。",
        status: DemandStatus.DEVELOPING,
        priority: DemandPriority.critical,
        estimatedSp: 55,
        confirmedSp: 55,
        organizationId: ymoptics.id,
        submitterId: userYmoptics.id,
        creatorId: userYmoptics.id,
        managerId: userAdmin.id,
        developerId: userJV.id,
        expectedDate: new Date("2024-05-01"),
      },
    }),
    // ACCEPTANCE - 驗收中
    prisma.demand.create({
      data: {
        demandNumber: "REQ-2024-010",
        title: "自動化測試框架建置",
        description: "建立前後端自動化測試框架，包含單元測試和整合測試。",
        businessPurpose: "提升軟體品質，降低回歸測試成本。",
        status: DemandStatus.ACCEPTANCE,
        priority: DemandPriority.medium,
        estimatedSp: 13,
        confirmedSp: 13,
        organizationId: panjit.id,
        submitterId: userPanjit.id,
        creatorId: userAdmin.id,
        managerId: userAdmin.id,
        developerId: userJV.id,
        expectedDate: new Date("2024-02-28"),
      },
    }),
    prisma.demand.create({
      data: {
        demandNumber: "REQ-2024-011",
        title: "電子簽核流程數位化",
        description: "將紙本簽核流程數位化，支援線上審批和電子簽章。",
        businessPurpose: "加速審批流程，減少紙張浪費，實現無紙化辦公。",
        status: DemandStatus.ACCEPTANCE,
        priority: DemandPriority.high,
        estimatedSp: 21,
        confirmedSp: 21,
        organizationId: panjitTech.id,
        submitterId: userPanjitTech.id,
        creatorId: userPanjitTech.id,
        managerId: userAdmin.id,
        developerId: userJV.id,
        expectedDate: new Date("2024-02-15"),
      },
    }),
    // CLOSED - 已結案
    prisma.demand.create({
      data: {
        demandNumber: "REQ-2023-045",
        title: "使用者介面優化",
        description: "全面優化系統使用者介面，提升操作體驗和視覺設計。",
        businessPurpose: "提升使用者滿意度，降低培訓成本。",
        status: DemandStatus.CLOSED,
        priority: DemandPriority.medium,
        estimatedSp: 8,
        confirmedSp: 8,
        organizationId: panjit.id,
        submitterId: userPanjit.id,
        creatorId: userPanjit.id,
        managerId: userAdmin.id,
        developerId: userJV.id,
        completedDate: new Date("2024-01-20"),
      },
    }),
    prisma.demand.create({
      data: {
        demandNumber: "REQ-2023-048",
        title: "批次匯入功能",
        description: "支援 Excel 批次匯入客戶資料和產品資料。",
        businessPurpose: "加速初始資料建立和大量資料更新作業。",
        status: DemandStatus.CLOSED,
        priority: DemandPriority.low,
        estimatedSp: 5,
        confirmedSp: 5,
        organizationId: ymoptics.id,
        submitterId: userYmoptics.id,
        creatorId: userYmoptics.id,
        managerId: userAdmin.id,
        developerId: userJV.id,
        completedDate: new Date("2024-01-10"),
      },
    }),
    // REJECTED - 已駁回
    prisma.demand.create({
      data: {
        demandNumber: "REQ-2024-012",
        title: "區塊鏈整合",
        description: "整合區塊鏈技術進行供應鏈追溯。",
        businessPurpose: "建立供應鏈透明度，提升客戶信任。",
        status: DemandStatus.REJECTED,
        priority: DemandPriority.low,
        estimatedSp: 89,
        organizationId: panjit.id,
        submitterId: userPanjit.id,
        creatorId: userPanjit.id,
        rejectReason: "技術成熟度不足，建議延後至 2025 年再評估。ROI 不明確，SP 需求過高。",
      },
    }),
    prisma.demand.create({
      data: {
        demandNumber: "REQ-2024-013",
        title: "AI 推薦系統",
        description: "建立 AI 推薦引擎，自動推薦相關產品和服務。",
        businessPurpose: "提升交叉銷售機會，增加營收。",
        status: DemandStatus.REJECTED,
        priority: DemandPriority.medium,
        estimatedSp: 55,
        organizationId: panjitTech.id,
        submitterId: userPanjitTech.id,
        creatorId: userPanjitTech.id,
        rejectReason: "目前數據量不足以支撐 AI 模型訓練，建議先完善數據蒐集再評估。",
      },
    }),
  ])

  console.log(`✅ 建立 ${demands.length} 筆需求`)

  // ============================================================
  // 5. Demand Status History (為幾筆進階狀態的需求建立歷史)
  // ============================================================
  const demandMap = Object.fromEntries(demands.map((d) => [d.demandNumber, d]))

  // REQ-2024-007 (DEVELOPING) 的歷史
  await prisma.demandStatusHistory.createMany({
    data: [
      {
        demandId: demandMap["REQ-2024-007"].id,
        fromStatus: null,
        toStatus: DemandStatus.SUBMITTED,
        changedBy: userPanjit.name,
        createdAt: new Date("2024-01-05"),
      },
      {
        demandId: demandMap["REQ-2024-007"].id,
        fromStatus: DemandStatus.SUBMITTED,
        toStatus: DemandStatus.PRD_REVIEW,
        changedBy: userAdmin.name,
        comment: "PRD 文件已收到，進行確認中",
        createdAt: new Date("2024-01-08"),
      },
      {
        demandId: demandMap["REQ-2024-007"].id,
        fromStatus: DemandStatus.PRD_REVIEW,
        toStatus: DemandStatus.SP_REVIEW,
        changedBy: userAdmin.name,
        comment: "PRD 已確認，SP 估算 21 點",
        createdAt: new Date("2024-01-12"),
      },
      {
        demandId: demandMap["REQ-2024-007"].id,
        fromStatus: DemandStatus.SP_REVIEW,
        toStatus: DemandStatus.DEVELOPING,
        changedBy: userAdmin.name,
        comment: "CEO 已確認 SP，指派 JV 團隊開發",
        createdAt: new Date("2024-01-15"),
      },
    ],
  })

  // REQ-2023-045 (CLOSED) 的完整歷史
  await prisma.demandStatusHistory.createMany({
    data: [
      {
        demandId: demandMap["REQ-2023-045"].id,
        fromStatus: null,
        toStatus: DemandStatus.SUBMITTED,
        changedBy: userPanjit.name,
        createdAt: new Date("2023-11-01"),
      },
      {
        demandId: demandMap["REQ-2023-045"].id,
        fromStatus: DemandStatus.SUBMITTED,
        toStatus: DemandStatus.PRD_REVIEW,
        changedBy: userAdmin.name,
        createdAt: new Date("2023-11-05"),
      },
      {
        demandId: demandMap["REQ-2023-045"].id,
        fromStatus: DemandStatus.PRD_REVIEW,
        toStatus: DemandStatus.SP_REVIEW,
        changedBy: userAdmin.name,
        createdAt: new Date("2023-11-10"),
      },
      {
        demandId: demandMap["REQ-2023-045"].id,
        fromStatus: DemandStatus.SP_REVIEW,
        toStatus: DemandStatus.DEVELOPING,
        changedBy: userAdmin.name,
        createdAt: new Date("2023-11-15"),
      },
      {
        demandId: demandMap["REQ-2023-045"].id,
        fromStatus: DemandStatus.DEVELOPING,
        toStatus: DemandStatus.ACCEPTANCE,
        changedBy: userJV.name,
        comment: "開發完成，交付驗收",
        createdAt: new Date("2024-01-10"),
      },
      {
        demandId: demandMap["REQ-2023-045"].id,
        fromStatus: DemandStatus.ACCEPTANCE,
        toStatus: DemandStatus.CLOSED,
        changedBy: userPanjit.name,
        comment: "驗收通過",
        createdAt: new Date("2024-01-20"),
      },
    ],
  })

  console.log("✅ 建立需求狀態歷史")

  // ============================================================
  // 6. Demand Documents
  // ============================================================
  await prisma.demandDocument.createMany({
    data: [
      {
        demandId: demandMap["REQ-2024-001"].id,
        type: DocumentType.MEETING_NOTES,
        fileName: "2024-01-03_需求討論會議記錄.pdf",
        fileSize: 245000,
        uploadedBy: userPanjit.name,
        createdAt: new Date("2024-01-03"),
      },
      {
        demandId: demandMap["REQ-2024-003"].id,
        type: DocumentType.PRD,
        fileName: "行動版介面_PRD_v1.0.pdf",
        fileSize: 1280000,
        uploadedBy: userAdmin.name,
        createdAt: new Date("2024-01-10"),
      },
      {
        demandId: demandMap["REQ-2024-003"].id,
        type: DocumentType.SDD,
        fileName: "行動版介面_SDD_v0.8.pdf",
        fileSize: 890000,
        uploadedBy: userJV.name,
        createdAt: new Date("2024-01-15"),
      },
      {
        demandId: demandMap["REQ-2024-007"].id,
        type: DocumentType.PRD,
        fileName: "權限管理重構_PRD_v2.0.pdf",
        fileSize: 560000,
        uploadedBy: userAdmin.name,
        createdAt: new Date("2024-01-08"),
      },
      {
        demandId: demandMap["REQ-2024-007"].id,
        type: DocumentType.SDD,
        fileName: "權限管理重構_SDD_v1.0.pdf",
        fileSize: 720000,
        uploadedBy: userJV.name,
        createdAt: new Date("2024-01-12"),
      },
      {
        demandId: demandMap["REQ-2024-010"].id,
        type: DocumentType.TEST_REPORT,
        fileName: "自動化測試框架_測試報告.pdf",
        fileSize: 340000,
        uploadedBy: userJV.name,
        createdAt: new Date("2024-02-25"),
      },
      {
        demandId: demandMap["REQ-2023-045"].id,
        type: DocumentType.MEETING_NOTES,
        fileName: "UI優化_需求啟動會議記錄.pdf",
        fileSize: 180000,
        uploadedBy: userPanjit.name,
        createdAt: new Date("2023-11-01"),
      },
      {
        demandId: demandMap["REQ-2023-045"].id,
        type: DocumentType.PRD,
        fileName: "UI優化_PRD_v1.0.pdf",
        fileSize: 450000,
        uploadedBy: userAdmin.name,
        createdAt: new Date("2023-11-05"),
      },
    ],
  })

  console.log("✅ 建立需求文件")

  // ============================================================
  // 7. SP Transactions (強茂的錢包)
  // ============================================================
  const panjitWallet = wallets[0]

  await prisma.spTransaction.createMany({
    data: [
      {
        walletId: panjitWallet.id,
        type: SpTransactionType.QUOTA,
        amount: 500,
        balance: 500,
        description: "2024 年度 SP 配額發放",
        createdAt: new Date("2024-01-01"),
      },
      {
        walletId: panjitWallet.id,
        type: SpTransactionType.COMMIT,
        amount: -21,
        balance: 479,
        description: "REQ-2024-007 權限管理模組重構 進入開發",
        demandId: demandMap["REQ-2024-007"].id,
        createdAt: new Date("2024-01-15"),
      },
      {
        walletId: panjitWallet.id,
        type: SpTransactionType.COMMIT,
        amount: -13,
        balance: 466,
        description: "REQ-2024-010 自動化測試框架 進入開發",
        demandId: demandMap["REQ-2024-010"].id,
        createdAt: new Date("2024-01-20"),
      },
      {
        walletId: panjitWallet.id,
        type: SpTransactionType.DEDUCT,
        amount: -8,
        balance: 458,
        description: "REQ-2023-045 使用者介面優化 驗收通過",
        demandId: demandMap["REQ-2023-045"].id,
        createdAt: new Date("2024-01-20"),
      },
      {
        walletId: panjitWallet.id,
        type: SpTransactionType.ADJUST,
        amount: 5,
        balance: 463,
        description: "REQ-2024-003 SP 估點調整（原 39 調為 34）",
        demandId: demandMap["REQ-2024-003"].id,
        createdAt: new Date("2024-01-25"),
      },
    ],
  })

  console.log("✅ 建立 SP 交易紀錄")

  // ============================================================
  // 8. Demand Comments
  // ============================================================
  await prisma.demandComment.createMany({
    data: [
      {
        demandId: demandMap["REQ-2024-001"].id,
        userId: userPanjit.id,
        content: "這個功能是業務部門反映最急迫的需求，希望能儘快排入開發。",
        createdAt: new Date("2024-01-04"),
      },
      {
        demandId: demandMap["REQ-2024-001"].id,
        userId: userAdmin.id,
        content: "已收到需求，預計本週安排需求確認會議。",
        createdAt: new Date("2024-01-05"),
      },
      {
        demandId: demandMap["REQ-2024-007"].id,
        userId: userAdmin.id,
        content: "此需求技術複雜度較高，需要 JV 團隊提前評估技術方案。",
        isInternal: true,
        createdAt: new Date("2024-01-10"),
      },
      {
        demandId: demandMap["REQ-2024-007"].id,
        userId: userJV.id,
        content: "已開始開發，預計分兩個階段交付。第一階段完成基礎權限模型，第二階段實現角色繼承。",
        createdAt: new Date("2024-01-16"),
      },
    ],
  })

  console.log("✅ 建立需求討論")

  // ============================================================
  // 9. Acceptance Records
  // ============================================================
  await prisma.acceptanceRecord.create({
    data: {
      demandId: demandMap["REQ-2023-045"].id,
      reviewerId: userPanjit.id,
      result: "PASS",
      rating: 4,
      feedback: "整體介面改善明顯，操作流程更加直覺。部分頁面的載入速度仍有改善空間。",
      workUrl: "https://staging.govora.com/ui-demo",
      checkItems: JSON.stringify([
        { id: "1", label: "功能符合需求說明", checked: true },
        { id: "2", label: "介面操作流暢", checked: true },
        { id: "3", label: "測試環境可正常運作", checked: true },
        { id: "4", label: "相關文件已更新", checked: true },
      ]),
      createdAt: new Date("2024-01-20"),
    },
  })

  console.log("✅ 建立驗收記錄")

  // ============================================================
  // 10. Notifications
  // ============================================================
  await prisma.notification.createMany({
    data: [
      {
        userId: userPanjit.id,
        type: NotificationType.DEMAND_STATUS,
        title: "需求已核准",
        message: "您的需求「客戶管理系統新增匯出功能」(REQ-2024-001) 已收到，正在進行評估。",
        isRead: false,
        linkUrl: "/subsidiary/demands/REQ-2024-001",
        createdAt: new Date("2024-01-05"),
      },
      {
        userId: userPanjit.id,
        type: NotificationType.ACCEPTANCE,
        title: "待您驗收",
        message: "需求「自動化測試框架建置」(REQ-2024-010) 已開發完成，請進行驗收測試。",
        isRead: false,
        linkUrl: "/subsidiary/acceptance",
        createdAt: new Date("2024-02-25"),
      },
      {
        userId: userPanjit.id,
        type: NotificationType.SP_CHANGE,
        title: "SP 錢包變動",
        message: "因 REQ-2023-045 驗收通過，已扣除 8 SP。目前可用餘額：156 SP。",
        isRead: true,
        linkUrl: "/subsidiary/wallet",
        createdAt: new Date("2024-01-20"),
      },
      {
        userId: userAdmin.id,
        type: NotificationType.DEMAND_STATUS,
        title: "新需求待審核",
        message: "強茂提交了新需求「客戶管理系統新增匯出功能」(REQ-2024-001)，請進行初步審核。",
        isRead: false,
        linkUrl: "/governance/inbox",
        createdAt: new Date("2024-01-03"),
      },
      {
        userId: userAdmin.id,
        type: NotificationType.DEMAND_STATUS,
        title: "新需求待審核",
        message: "璟茂科技提交了新需求「報表匯出功能優化」(REQ-2024-002)，請進行初步審核。",
        isRead: false,
        linkUrl: "/governance/inbox",
        createdAt: new Date("2024-01-04"),
      },
      {
        userId: userJV.id,
        type: NotificationType.DEMAND_STATUS,
        title: "新專案指派",
        message: "您已被指派為「權限管理模組重構」(REQ-2024-007) 的開發負責人。",
        isRead: true,
        linkUrl: "/delivery",
        createdAt: new Date("2024-01-15"),
      },
      {
        userId: userJV.id,
        type: NotificationType.SYSTEM,
        title: "系統公告",
        message: "GOVORA 系統將於 2024/03/01 進行版本更新，預計停機 2 小時。",
        isRead: false,
        createdAt: new Date("2024-02-20"),
      },
    ],
  })

  console.log("✅ 建立通知")

  console.log("\n🎉 種子數據建立完成！")
  console.log("📊 統計:")
  console.log(`   - 組織: ${orgs.length}`)
  console.log(`   - 使用者: ${users.length}`)
  console.log(`   - SP 錢包: ${wallets.length}`)
  console.log(`   - 需求: ${demands.length}`)
  console.log("   - 狀態歷史: 10 筆")
  console.log("   - 文件: 8 筆")
  console.log("   - SP 交易: 5 筆")
  console.log("   - 討論: 4 筆")
  console.log("   - 驗收記錄: 1 筆")
  console.log("   - 通知: 7 筆")
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

import cron from "node-cron"
import { prisma } from "@/lib/prisma"
import { sendMailAndLog } from "@/lib/mail"
import { monthlyReportTemplate } from "@/lib/mail-templates"
import { STATUS_MAP, SP_RATE, calcUsedSp } from "@/lib/constants/demand"
import ExcelJS from "exceljs"

/**
 * Start the monthly SP report cron job.
 * Runs every day at 08:00 — checks if today is the org's reportSendDay.
 */
export function startMailCron() {
  cron.schedule("0 8 * * *", async () => {
    console.log("[CRON] Checking monthly report schedule...")
    try {
      await sendMonthlyReports()
    } catch (err) {
      console.error("[CRON] Monthly report error:", err)
    }
  })

  console.log("[CRON] Monthly SP report scheduler started")
}

async function sendMonthlyReports() {
  const today = new Date().getDate()

  const settings = await prisma.emailSetting.findMany({
    where: {
      reportSendDay: today,
      accountingEmail: { not: null },
    },
    include: { organization: true },
  })

  if (settings.length === 0) {
    console.log("[CRON] No reports scheduled for today")
    return
  }

  const now = new Date()
  // Report for previous month
  const reportMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const reportYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const monthLabel = `${reportYear}-${String(reportMonth).padStart(2, "0")}`

  for (const setting of settings) {
    if (!setting.accountingEmail) continue

    try {
      // Dedup check: skip if already sent this month for this org
      const alreadySent = await prisma.mailLog.findFirst({
        where: {
          type: "MONTHLY_REPORT",
          status: "SUCCESS",
          subject: { contains: monthLabel },
          toAddresses: { contains: setting.accountingEmail },
          createdAt: {
            gte: new Date(now.getFullYear(), now.getMonth(), 1),
          },
        },
      })
      if (alreadySent) {
        console.log(`[CRON] Report already sent for ${setting.organization.name} (${monthLabel}), skipping`)
        continue
      }

      const buffer = await generateMonthlyReport(setting.organizationId, reportYear)
      const base64 = Buffer.from(buffer).toString("base64")

      await sendMailAndLog({
        type: "MONTHLY_REPORT",
        to: [setting.accountingEmail],
        subject: `[${setting.organization.name}] ${monthLabel} SP 月報`,
        body: monthlyReportTemplate({
          orgName: setting.organization.name,
          monthLabel,
        }),
        bodyType: "html",
        attachments: [
          {
            filename: `SP_Report_${setting.organization.code}_${monthLabel}.xlsx`,
            content: base64,
          },
        ],
      })

      console.log(`[CRON] Monthly report sent to ${setting.accountingEmail} for ${setting.organization.name}`)
    } catch (err) {
      console.error(`[CRON] Failed to send report for ${setting.organization.name}:`, err)
    }
  }
}

async function generateMonthlyReport(organizationId: string, year: number): Promise<Buffer> {
  // Get all demands for this org
  const demands = await prisma.demand.findMany({
    where: { organizationId },
    select: {
      demandNumber: true,
      title: true,
      status: true,
      estimatedSp: true,
      confirmedSp: true,
      heldFromStatus: true,
      completedDate: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  })

  // Get SP wallet
  const wallet = await prisma.spWallet.findFirst({
    where: { organizationId, year },
  })

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "JV 需求管理系統"
  workbook.created = new Date()

  const sheet = workbook.addWorksheet("SP 月報")

  // Header style
  const headerFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2563EB" },
  }
  const headerFont: Partial<ExcelJS.Font> = {
    bold: true,
    color: { argb: "FFFFFFFF" },
    size: 11,
  }

  sheet.columns = [
    { header: "需求編號", key: "demandNumber", width: 18 },
    { header: "需求名稱", key: "title", width: 35 },
    { header: "狀態", key: "status", width: 12 },
    { header: "估算 SP", key: "estimatedSp", width: 10 },
    { header: "確認 SP", key: "confirmedSp", width: 10 },
    { header: "已消耗 SP", key: "usedSp", width: 12 },
    { header: "金額 (NT$)", key: "amount", width: 16 },
    { header: "建立日期", key: "createdAt", width: 14 },
    { header: "完成日期", key: "completedDate", width: 14 },
  ]

  // Style header row
  const headerRow = sheet.getRow(1)
  headerRow.eachCell((cell) => {
    cell.fill = headerFill
    cell.font = headerFont
    cell.alignment = { vertical: "middle", horizontal: "center" }
  })

  let totalUsedSp = 0
  for (const d of demands) {
    const sp = d.confirmedSp ?? d.estimatedSp
    const usedSp = calcUsedSp(d.status, sp, d.heldFromStatus)
    totalUsedSp += usedSp

    sheet.addRow({
      demandNumber: d.demandNumber,
      title: d.title,
      status: STATUS_MAP[d.status]?.label || d.status,
      estimatedSp: d.estimatedSp,
      confirmedSp: d.confirmedSp,
      usedSp,
      amount: usedSp * SP_RATE,
      createdAt: d.createdAt ? new Date(d.createdAt).toLocaleDateString("zh-TW") : "",
      completedDate: d.completedDate ? new Date(d.completedDate).toLocaleDateString("zh-TW") : "",
    })
  }

  // Blank row
  sheet.addRow({})

  // Summary row
  const summaryRow = sheet.addRow({
    demandNumber: "合計",
    title: `共 ${demands.length} 筆需求`,
    usedSp: totalUsedSp,
    amount: totalUsedSp * SP_RATE,
  })
  summaryRow.font = { bold: true }

  // Wallet info
  if (wallet) {
    sheet.addRow({})
    sheet.addRow({ demandNumber: "年度配額", usedSp: wallet.totalQuota, amount: wallet.totalQuota * SP_RATE })
    sheet.addRow({ demandNumber: "已使用", usedSp: wallet.usedSp, amount: wallet.usedSp * SP_RATE })
    sheet.addRow({ demandNumber: "剩餘", usedSp: wallet.totalQuota - wallet.usedSp, amount: (wallet.totalQuota - wallet.usedSp) * SP_RATE })
  }

  // Format amount column as currency
  sheet.getColumn("amount").numFmt = "#,##0"

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

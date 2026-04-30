/**
 * export-demands.mjs
 * 查詢所有需求並匯出至 Excel
 * 執行方式: node scripts/export-demands.mjs
 */
import { PrismaClient } from "../lib/generated/prisma/client.js"
import ExcelJS from "exceljs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const prisma = new PrismaClient()

const STATUS_LABEL = {
  SUBMITTED:   "需求確認",
  PRD_REVIEW:  "MVP 架構確認",
  SP_REVIEW:   "開案確認",
  DEVELOPING:  "開發中",
  ACCEPTANCE:  "驗收中",
  CLOSED:      "已結案",
  REJECTED:    "已駁回",
  ON_HOLD:     "暫緩",
}

const SP_PROGRESS_RATE = {
  SUBMITTED:   0,
  PRD_REVIEW:  0,
  SP_REVIEW:   0.8,
  DEVELOPING:  0.8,
  ACCEPTANCE:  0.8,
  CLOSED:      1.0,
  ON_HOLD:     0,
  REJECTED:    0,
}

function calcUsedSp(status, effectiveSp, heldFromStatus) {
  let effectiveStatus = status
  if (status === "ON_HOLD" || status === "REJECTED") {
    effectiveStatus = heldFromStatus || status
  }
  const rate = SP_PROGRESS_RATE[effectiveStatus] ?? 0
  return Math.round(effectiveSp * rate)
}

async function main() {
  const demands = await prisma.demand.findMany({
    orderBy: { demandNumber: "asc" },
    select: {
      demandNumber:   true,
      title:          true,
      status:         true,
      estimatedSp:    true,
      confirmedSp:    true,
      heldFromStatus: true,
      createdAt:      true,
      desiredDate:    true,
      expectedDate:   true,
      completedDate:  true,
      organization: { select: { name: true } },
      submitter:    { select: { name: true } },
      contactPerson_: { select: { name: true } },
      manager:      { select: { name: true } },
      developer:    { select: { name: true } },
    },
  })

  const wb = new ExcelJS.Workbook()
  wb.creator = "DemandGovernance"
  wb.created = new Date()

  const ws = wb.addWorksheet("需求清單", {
    views: [{ state: "frozen", ySplit: 1 }],
  })

  // Define columns
  ws.columns = [
    { header: "需求編號",       key: "demandNumber",  width: 16 },
    { header: "專案名稱",       key: "title",         width: 38 },
    { header: "需求者組織",     key: "org",           width: 20 },
    { header: "需求者窗口",     key: "contact",       width: 14 },
    { header: "PM",             key: "manager",       width: 14 },
    { header: "開發者",         key: "developer",     width: 14 },
    { header: "目前狀態",       key: "status",        width: 14 },
    { header: "總 SP",          key: "totalSp",       width: 10 },
    { header: "已計費 SP",      key: "usedSp",        width: 12 },
    { header: "計費比例",       key: "rate",          width: 10 },
    { header: "希望完成日",     key: "desiredDate",   width: 14 },
    { header: "預計完成日",     key: "expectedDate",  width: 14 },
    { header: "實際完成日",     key: "completedDate", width: 14 },
    { header: "建立日期",       key: "createdAt",     width: 14 },
  ]

  // Style header row
  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } }
  headerRow.fill = {
    type: "pattern", pattern: "solid",
    fgColor: { argb: "FF374151" },
  }
  headerRow.alignment = { vertical: "middle", horizontal: "center" }
  headerRow.height = 22

  const STATUS_COLOR = {
    SUBMITTED:   "FFFEF3C7", // yellow-100
    PRD_REVIEW:  "FFFFF7ED", // orange-50
    SP_REVIEW:   "FFECFDF5", // emerald-50
    DEVELOPING:  "FFEFF6FF", // blue-50
    ACCEPTANCE:  "FFF5F3FF", // violet-50
    CLOSED:      "FFF0FDF4", // green-50
    REJECTED:    "FFFFF1F2", // rose-50
    ON_HOLD:     "FFF9FAFB", // gray-50
  }

  let totalSpSum = 0
  let usedSpSum = 0

  for (const d of demands) {
    const effectiveSp = d.confirmedSp ?? d.estimatedSp
    const usedSp = calcUsedSp(d.status, effectiveSp, d.heldFromStatus)
    const rateKey = d.status === "ON_HOLD" || d.status === "REJECTED"
      ? (d.heldFromStatus || d.status) : d.status
    const rate = SP_PROGRESS_RATE[rateKey] ?? 0

    totalSpSum += effectiveSp
    usedSpSum += usedSp

    const row = ws.addRow({
      demandNumber: d.demandNumber,
      title:        d.title,
      org:          d.organization?.name ?? "—",
      contact:      d.contactPerson_?.name ?? d.submitter?.name ?? "—",
      manager:      d.manager?.name ?? "—",
      developer:    d.developer?.name ?? "—",
      status:       STATUS_LABEL[d.status] ?? d.status,
      totalSp:      effectiveSp,
      usedSp:       usedSp,
      rate:         `${Math.round(rate * 100)}%`,
      desiredDate:  d.desiredDate   ? new Date(d.desiredDate).toLocaleDateString("zh-TW")   : "—",
      expectedDate: d.expectedDate  ? new Date(d.expectedDate).toLocaleDateString("zh-TW")  : "—",
      completedDate:d.completedDate ? new Date(d.completedDate).toLocaleDateString("zh-TW") : "—",
      createdAt:    new Date(d.createdAt).toLocaleDateString("zh-TW"),
    })

    row.height = 18
    row.alignment = { vertical: "middle" }

    // Fill row background by status
    const fillColor = STATUS_COLOR[d.status] || "FFFFFFFF"
    row.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } }
    })

    // Right-align numbers
    row.getCell("totalSp").alignment = { horizontal: "center" }
    row.getCell("usedSp").alignment  = { horizontal: "center" }
    row.getCell("rate").alignment    = { horizontal: "center" }
  }

  // Summary row
  ws.addRow({})
  const sumRow = ws.addRow({
    demandNumber: "合計",
    totalSp:      totalSpSum,
    usedSp:       usedSpSum,
    rate:         totalSpSum > 0 ? `${Math.round(usedSpSum / totalSpSum * 100)}%` : "—",
  })
  sumRow.font = { bold: true }
  sumRow.getCell("demandNumber").alignment = { horizontal: "right" }
  sumRow.getCell("totalSp").alignment = { horizontal: "center" }
  sumRow.getCell("usedSp").alignment  = { horizontal: "center" }
  sumRow.getCell("rate").alignment    = { horizontal: "center" }
  sumRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } }
  })

  // Add borders to all data rows
  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return
    row.eachCell((cell) => {
      cell.border = {
        top:    { style: "thin", color: { argb: "FFD1D5DB" } },
        left:   { style: "thin", color: { argb: "FFD1D5DB" } },
        bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
        right:  { style: "thin", color: { argb: "FFD1D5DB" } },
      }
    })
  })

  const outPath = path.resolve(__dirname, "../demands-export.xlsx")
  await wb.xlsx.writeFile(outPath)
  console.log(`✅ 已匯出 ${demands.length} 筆需求 → ${outPath}`)
  console.log(`   總 SP: ${totalSpSum}，已計費 SP: ${usedSpSum}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

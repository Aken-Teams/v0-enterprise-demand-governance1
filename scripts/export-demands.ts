/**
 * export-demands.ts
 * 查詢所有需求並匯出至 Excel
 * 執行方式: npx tsx scripts/export-demands.ts
 */
import * as dotenv from "dotenv"
dotenv.config({ path: ".env" })

import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import ExcelJS from "exceljs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!)
const prisma = new PrismaClient({ adapter })

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED:   "需求確認",
  PRD_REVIEW:  "MVP 架構確認",
  SP_REVIEW:   "開案確認",
  DEVELOPING:  "開發中",
  ACCEPTANCE:  "驗收中",
  CLOSED:      "已結案",
  REJECTED:    "已駁回",
  ON_HOLD:     "暫緩",
}

const SP_PROGRESS_RATE: Record<string, number> = {
  SUBMITTED:   0,
  PRD_REVIEW:  0,
  SP_REVIEW:   0.8,
  DEVELOPING:  0.8,
  ACCEPTANCE:  0.8,
  CLOSED:      1.0,
  ON_HOLD:     0,
  REJECTED:    0,
}

function calcUsedSp(status: string, effectiveSp: number, heldFromStatus?: string | null): number {
  let effectiveStatus = status
  if (status === "ON_HOLD" || status === "REJECTED") {
    effectiveStatus = heldFromStatus || status
  }
  const rate = SP_PROGRESS_RATE[effectiveStatus] ?? 0
  return Math.round(effectiveSp * rate)
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("zh-TW")
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
      organization:   { select: { name: true } },
      submitter:      { select: { name: true } },
      contactPerson_: { select: { name: true } },
      manager:        { select: { name: true } },
      developer:      { select: { name: true } },
    },
  })

  console.log(`查詢到 ${demands.length} 筆需求`)

  const wb = new ExcelJS.Workbook()
  wb.creator = "DemandGovernance"
  wb.created = new Date()

  const ws = wb.addWorksheet("需求清單", {
    views: [{ state: "frozen", ySplit: 1 }],
  })

  ws.columns = [
    { header: "需求編號",   key: "demandNumber",  width: 16 },
    { header: "專案名稱",   key: "title",         width: 36 },
    { header: "需求者組織", key: "org",           width: 20 },
    { header: "需求者窗口", key: "contact",       width: 14 },
    { header: "PM",         key: "manager",       width: 14 },
    { header: "開發者",     key: "developer",     width: 14 },
    { header: "目前狀態",   key: "status",        width: 14 },
    { header: "總 SP",      key: "totalSp",       width: 10 },
    { header: "已計費 SP",  key: "usedSp",        width: 12 },
    { header: "計費比例",   key: "rate",          width: 10 },
    { header: "希望完成日", key: "desiredDate",   width: 14 },
    { header: "預計完成日", key: "expectedDate",  width: 14 },
    { header: "實際完成日", key: "completedDate", width: 14 },
    { header: "建立日期",   key: "createdAt",     width: 14 },
  ]

  // Header style
  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 }
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } }
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: false }
  headerRow.height = 24

  const STATUS_COLOR: Record<string, string> = {
    SUBMITTED:   "FFFEF3C7",
    PRD_REVIEW:  "FFFFEDD5",
    SP_REVIEW:   "FFD1FAE5",
    DEVELOPING:  "FFDBEAFE",
    ACCEPTANCE:  "FFEDE9FE",
    CLOSED:      "FFDCFCE7",
    REJECTED:    "FFFFE4E6",
    ON_HOLD:     "FFF3F4F6",
  }

  let totalSpSum = 0
  let usedSpSum = 0

  for (const d of demands) {
    const effectiveSp = d.confirmedSp ?? d.estimatedSp
    const usedSp = calcUsedSp(d.status, effectiveSp, d.heldFromStatus)
    const rateKey = (d.status === "ON_HOLD" || d.status === "REJECTED")
      ? (d.heldFromStatus || d.status) : d.status
    const rate = SP_PROGRESS_RATE[rateKey] ?? 0

    totalSpSum += effectiveSp
    usedSpSum += usedSp

    const row = ws.addRow({
      demandNumber:  d.demandNumber,
      title:         d.title,
      org:           d.organization?.name ?? "—",
      contact:       d.contactPerson_?.name ?? d.submitter?.name ?? "—",
      manager:       d.manager?.name ?? "—",
      developer:     d.developer?.name ?? "—",
      status:        STATUS_LABEL[d.status] ?? d.status,
      totalSp:       effectiveSp,
      usedSp:        usedSp,
      rate:          `${Math.round(rate * 100)}%`,
      desiredDate:   fmtDate(d.desiredDate),
      expectedDate:  fmtDate(d.expectedDate),
      completedDate: fmtDate(d.completedDate),
      createdAt:     fmtDate(d.createdAt),
    })

    row.height = 18
    row.alignment = { vertical: "middle" }

    const fillColor = STATUS_COLOR[d.status] || "FFFFFFFF"
    row.eachCell({ includeEmpty: true }, (cell, colIdx) => {
      if (colIdx <= ws.columnCount) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } }
        cell.border = {
          top:    { style: "thin", color: { argb: "FFD1D5DB" } },
          left:   { style: "thin", color: { argb: "FFD1D5DB" } },
          bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
          right:  { style: "thin", color: { argb: "FFD1D5DB" } },
        }
      }
    })

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
  sumRow.font = { bold: true, size: 11 }
  sumRow.getCell("demandNumber").alignment = { horizontal: "right" }
  sumRow.getCell("totalSp").alignment = { horizontal: "center" }
  sumRow.getCell("usedSp").alignment  = { horizontal: "center" }
  sumRow.getCell("rate").alignment    = { horizontal: "center" }
  sumRow.eachCell({ includeEmpty: true }, (cell, colIdx) => {
    if (colIdx <= ws.columnCount) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } }
      cell.border = {
        top:    { style: "medium", color: { argb: "FF6B7280" } },
        left:   { style: "thin",   color: { argb: "FFD1D5DB" } },
        bottom: { style: "medium", color: { argb: "FF6B7280" } },
        right:  { style: "thin",   color: { argb: "FFD1D5DB" } },
      }
    }
  })

  const outPath = path.resolve(__dirname, "../demands-export.xlsx")
  await wb.xlsx.writeFile(outPath)
  console.log(`✅ 已匯出 ${demands.length} 筆需求 → ${outPath}`)
  console.log(`   總 SP: ${totalSpSum}，已計費 SP: ${usedSpSum}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

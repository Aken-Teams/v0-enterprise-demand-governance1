import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole } from "@/lib/auth"
import { calcUsedSp, SP_RATE, STATUS_MAP } from "@/lib/constants/demand"
import ExcelJS from "exceljs"

export async function GET(request: NextRequest) {
  try {
    const auth = verifyRole(request, ["admin", "viewer"])

    const currentYear = new Date().getFullYear()

    const [demands, wallets] = await Promise.all([
      prisma.demand.findMany({
        select: {
          demandNumber: true,
          title: true,
          status: true,
          estimatedSp: true,
          confirmedSp: true,
          heldFromStatus: true,
          vendor: true,
          desiredDate: true,
          expectedDate: true,
          completedDate: true,
          createdAt: true,
          organization: { select: { name: true } },
          contactPerson_: { select: { name: true } },
          manager: { select: { name: true } },
          developer: { select: { name: true } },
        },
        orderBy: { demandNumber: "asc" },
      }),
      prisma.spWallet.findMany({
        where: { year: currentYear },
        select: {
          vendor: true,
          totalQuota: true,
          usedSp: true,
          organization: { select: { name: true } },
        },
      }),
    ])

    const workbook = new ExcelJS.Workbook()
    workbook.creator = "企業需求管理平台"
    workbook.created = new Date()

    const sheet = workbook.addWorksheet("需求列表清單")

    const headerFill: ExcelJS.Fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    }
    const headerFont: Partial<ExcelJS.Font> = {
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 11,
    }
    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    }

    sheet.columns = [
      { header: "需求編號", key: "demandNumber", width: 16 },
      { header: "專案名稱", key: "title", width: 40 },
      { header: "需求者組織", key: "org", width: 18 },
      { header: "需求者窗口", key: "contact", width: 12 },
      { header: "PM", key: "pm", width: 16 },
      { header: "開發者", key: "dev", width: 16 },
      { header: "開發商", key: "vendor", width: 14 },
      { header: "目前狀態", key: "status", width: 14 },
      { header: "總 SP", key: "estimatedSp", width: 8 },
      { header: "已消耗 SP", key: "usedSp", width: 12 },
      { header: "消耗比例", key: "rate", width: 10 },
      { header: "希望完成日", key: "desiredDate", width: 14 },
      { header: "預計完成日", key: "expectedDate", width: 14 },
      { header: "實際完成日", key: "completedDate", width: 14 },
      { header: "建立日期", key: "createdAt", width: 14 },
    ]

    const headerRow = sheet.getRow(1)
    headerRow.eachCell((cell) => {
      cell.fill = headerFill
      cell.font = headerFont
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true }
      cell.border = thinBorder
    })

    const statusFills: Record<string, ExcelJS.Fill> = {
      SUBMITTED: { type: "pattern", pattern: "solid", fgColor: { argb: "FFDAEEF3" } },
      PRD_REVIEW: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } },
      SP_REVIEW: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } },
      DEVELOPING: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFDA" } },
      ACCEPTANCE: { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E2F3" } },
      CLOSED: { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6EFCE" } },
    }

    const SP_PROGRESS_RATE: Record<string, number> = {
      SUBMITTED: 0, PRD_REVIEW: 0, SP_REVIEW: 0,
      DEVELOPING: 0.5, ACCEPTANCE: 0.75, CLOSED: 1.0,
      ON_HOLD: 0, REJECTED: 0,
    }

    const fmtDate = (d: Date | null) => d ? new Date(d).toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "/") : "—"

    const fmtRate = (rate: number) => {
      if (rate === 0) return "0%"
      if (rate === 0.5) return "50%"
      if (rate === 0.75) return "75%"
      if (rate === 1.0) return "100%"
      return `${Math.round(rate * 100)}%`
    }

    let totalSp = 0
    let totalUsed = 0

    for (const d of demands) {
      const effectiveSp = d.confirmedSp ?? d.estimatedSp
      const usedSp = calcUsedSp(d.status, effectiveSp, d.heldFromStatus)

      let effectiveStatus = d.status
      if (d.status === "ON_HOLD" || d.status === "REJECTED") {
        effectiveStatus = d.heldFromStatus || d.status
      }
      const rate = SP_PROGRESS_RATE[effectiveStatus] ?? 0

      totalSp += d.estimatedSp
      totalUsed += usedSp

      const row = sheet.addRow({
        demandNumber: d.demandNumber,
        title: d.title,
        org: d.organization?.name || "",
        contact: d.contactPerson_?.name || "",
        pm: d.manager?.name || "",
        dev: d.developer?.name || "",
        vendor: d.vendor || "",
        status: STATUS_MAP[d.status]?.label || d.status,
        estimatedSp: d.estimatedSp,
        usedSp,
        rate: fmtRate(rate),
        desiredDate: fmtDate(d.desiredDate),
        expectedDate: fmtDate(d.expectedDate),
        completedDate: fmtDate(d.completedDate),
        createdAt: fmtDate(d.createdAt),
      })

      row.eachCell((cell, colNumber) => {
        cell.border = thinBorder
        cell.alignment = {
          vertical: "middle",
          horizontal: colNumber === 2 ? "left" : "center",
        }
      })

      const statusCell = row.getCell("status")
      if (statusFills[d.status]) {
        statusCell.fill = statusFills[d.status]
      }
    }

    // Blank row
    sheet.addRow({})

    // Summary row
    const totalRate = totalSp > 0 ? `${Math.round((totalUsed / totalSp) * 100)}%` : "0%"
    const summaryRow = sheet.addRow({
      demandNumber: "合計",
      estimatedSp: totalSp,
      usedSp: totalUsed,
      rate: totalRate,
    })
    summaryRow.font = { bold: true, size: 11 }
    const summaryFill: ExcelJS.Fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF2F2F2" },
    }
    summaryRow.eachCell((cell) => {
      cell.border = thinBorder
      cell.alignment = { vertical: "middle", horizontal: "center" }
      cell.fill = summaryFill
    })

    sheet.autoFilter = { from: "A1", to: `O${demands.length + 1}` }
    sheet.views = [{ state: "frozen", ySplit: 1 }]

    const buffer = await workbook.xlsx.writeBuffer()

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "")
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="SP_Report_${today}.xlsx"`,
      },
    })
  } catch (err: any) {
    if (err?.status) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error("Export error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

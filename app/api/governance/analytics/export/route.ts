import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole } from "@/lib/auth"
import { calcUsedSp, SP_RATE, STATUS_MAP } from "@/lib/constants/demand"
import ExcelJS from "exceljs"

export async function GET(request: NextRequest) {
  try {
    const auth = verifyRole(request, ["admin", "viewer"])

    const currentYear = new Date().getFullYear()

    const [demands, wallets, spAdjustments] = await Promise.all([
      prisma.demand.findMany({
        select: {
          id: true,
          demandNumber: true,
          title: true,
          status: true,
          estimatedSp: true,
          confirmedSp: true,
          heldFromStatus: true,
          vendor: true,
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
      // SP 調整紀錄（結案時調整），用於「備註」欄
      prisma.demandStatusHistory.findMany({
        where: { comment: { contains: "SP_ADJUSTMENT" } },
        select: { demandId: true, comment: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ])

    // demandId → 結案 SP 調整列表
    const adjByDemand = new Map<string, { oldSp: number; newSp: number; reason: string | null }[]>()
    for (const h of spAdjustments) {
      if (!h.comment) continue
      try {
        const p = JSON.parse(h.comment)
        if (p?.type !== "SP_ADJUSTMENT") continue
        const arr = adjByDemand.get(h.demandId) ?? []
        arr.push({ oldSp: Number(p.oldSp), newSp: Number(p.newSp), reason: p.reason ?? null })
        adjByDemand.set(h.demandId, arr)
      } catch { /* comment 非 JSON，略過 */ }
    }

    // 產生「備註」文字：優先顯示結案調整，其次顯示開案確認與初估的差異
    const buildRemark = (d: { id: string; estimatedSp: number; confirmedSp: number | null }): string => {
      const adjustments = adjByDemand.get(d.id) ?? []
      if (adjustments.length > 0) {
        return adjustments
          .map((a) => `結案調整 SP：${a.oldSp} → ${a.newSp}${a.reason ? `，原因：${a.reason}` : ""}`)
          .join("；")
      }
      if (d.confirmedSp != null && d.confirmedSp !== d.estimatedSp) {
        return `開案確認 SP：估算 ${d.estimatedSp} → 確認 ${d.confirmedSp}`
      }
      return ""
    }

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
      { header: "調整後 SP", key: "adjustedSp", width: 10 },
      { header: "已消耗 SP", key: "usedSp", width: 12 },
      { header: "消耗比例", key: "rate", width: 10 },
      { header: "備註", key: "remark", width: 48 },
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

    const fmtRate = (rate: number) => {
      if (rate === 0) return "0%"
      if (rate === 0.5) return "50%"
      if (rate === 0.75) return "75%"
      if (rate === 1.0) return "100%"
      return `${Math.round(rate * 100)}%`
    }

    let totalSp = 0
    let totalAdjusted = 0
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
      totalAdjusted += effectiveSp
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
        adjustedSp: effectiveSp,
        usedSp,
        rate: fmtRate(rate),
        remark: buildRemark(d),
      })

      row.eachCell((cell, colNumber) => {
        cell.border = thinBorder
        // 專案名稱(2) 與 備註(13) 靠左，備註自動換行
        const isText = colNumber === 2 || colNumber === 13
        cell.alignment = {
          vertical: "middle",
          horizontal: isText ? "left" : "center",
          wrapText: colNumber === 13,
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
    const totalRate = totalAdjusted > 0 ? `${Math.round((totalUsed / totalAdjusted) * 100)}%` : "0%"
    const summaryRow = sheet.addRow({
      demandNumber: "合計",
      estimatedSp: totalSp,
      adjustedSp: totalAdjusted,
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

    sheet.autoFilter = { from: "A1", to: `M${demands.length + 1}` }
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

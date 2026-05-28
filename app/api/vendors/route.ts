import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"

/**
 * GET /api/vendors
 * 取得所有已使用的開發商名稱（從 demands + sp_wallets 的 distinct vendor）
 */
export async function GET(request: NextRequest) {
  try {
    verifyRole(request, ["admin", "delivery", "subsidiary", "viewer"])

    const [demandVendors, walletVendors] = await Promise.all([
      prisma.demand.findMany({ select: { vendor: true }, distinct: ["vendor"] }),
      prisma.spWallet.findMany({ select: { vendor: true }, distinct: ["vendor"] }),
    ])

    const vendors = Array.from(
      new Set([
        ...demandVendors.map((d) => d.vendor),
        ...walletVendors.map((w) => w.vendor),
      ])
    ).sort()

    // Include demand count per vendor
    const vendorStats = await Promise.all(
      vendors.map(async (vendor) => {
        const demandCount = await prisma.demand.count({ where: { vendor } })
        return { name: vendor, demandCount }
      })
    )

    return NextResponse.json({ vendors: vendorStats })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("GET /api/vendors error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

/**
 * POST /api/vendors
 * 新增開發商（在所有組織建立 SpWallet 記錄使其出現在 vendor 列表）
 */
export async function POST(request: NextRequest) {
  try {
    verifyRole(request, ["admin"])

    const { name } = await request.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: "請提供開發商名稱" }, { status: 400 })
    }

    const trimmed = name.trim()

    // Check if already exists
    const existing = await prisma.demand.findFirst({ where: { vendor: trimmed } })
    const existingWallet = await prisma.spWallet.findFirst({ where: { vendor: trimmed } })
    if (existing || existingWallet) {
      return NextResponse.json({ error: `開發商「${trimmed}」已存在` }, { status: 400 })
    }

    // Create wallet entries for all organizations so vendor appears in the list
    const orgs = await prisma.organization.findMany({ select: { id: true } })
    const year = new Date().getFullYear()
    await prisma.spWallet.createMany({
      data: orgs.map((org) => ({
        organizationId: org.id,
        year,
        vendor: trimmed,
        totalQuota: 0,
        usedSp: 0,
      })),
      skipDuplicates: true,
    })

    return NextResponse.json({ success: true, message: `已新增開發商「${trimmed}」` })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("POST /api/vendors error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

/**
 * PATCH /api/vendors
 * 重新命名開發商（更新所有 demands + sp_wallets 中的 vendor 欄位）
 */
export async function PATCH(request: NextRequest) {
  try {
    verifyRole(request, ["admin"])

    const { oldName, newName } = await request.json()
    if (!oldName?.trim() || !newName?.trim()) {
      return NextResponse.json({ error: "請提供舊名稱和新名稱" }, { status: 400 })
    }

    const trimmedOld = oldName.trim()
    const trimmedNew = newName.trim()

    if (trimmedOld === trimmedNew) {
      return NextResponse.json({ error: "新舊名稱相同" }, { status: 400 })
    }

    // Check if new name already exists
    const existing = await prisma.demand.findFirst({ where: { vendor: trimmedNew } })
    const existingWallet = await prisma.spWallet.findFirst({ where: { vendor: trimmedNew } })
    if (existing || existingWallet) {
      return NextResponse.json({ error: `開發商「${trimmedNew}」已存在` }, { status: 400 })
    }

    // Update all demands and wallets
    const [demandResult, walletResult] = await Promise.all([
      prisma.demand.updateMany({ where: { vendor: trimmedOld }, data: { vendor: trimmedNew } }),
      prisma.spWallet.updateMany({ where: { vendor: trimmedOld }, data: { vendor: trimmedNew } }),
    ])

    return NextResponse.json({
      success: true,
      message: `已將「${trimmedOld}」更名為「${trimmedNew}」`,
      updatedDemands: demandResult.count,
      updatedWallets: walletResult.count,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("PATCH /api/vendors error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

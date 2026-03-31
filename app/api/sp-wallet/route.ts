import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth, AuthError } from "@/lib/auth"
import { calcUsedSp } from "@/lib/constants/demand"

export async function GET(request: NextRequest) {
  try {
    const auth = verifyAuth(request)

    // Look up user + check if restricted
    const [user, accessCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: auth.userId },
        select: { organizationId: true },
      }),
      prisma.demandAccess.count({ where: { userId: auth.userId } }),
    ])

    // Restricted users (with DemandAccess whitelist) cannot access SP wallet
    if (accessCount > 0) {
      return NextResponse.json({ error: "您的帳號無權查看 SP 錢包" }, { status: 403 })
    }

    if (!user?.organizationId) {
      return NextResponse.json({ error: "使用者未關聯組織" }, { status: 400 })
    }

    const currentYear = new Date().getFullYear()

    // Fetch wallet and demands in parallel
    const [wallet, demands] = await Promise.all([
      prisma.spWallet.findUnique({
        where: {
          organizationId_year: {
            organizationId: user.organizationId,
            year: currentYear,
          },
        },
        select: {
          totalQuota: true,
          usedSp: true,
          committedSp: true,
          year: true,
        },
      }),
      prisma.demand.findMany({
        where: { organizationId: user.organizationId },
        select: {
          id: true,
          demandNumber: true,
          title: true,
          status: true,
          estimatedSp: true,
          confirmedSp: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
    ])

    const totalQuota = wallet?.totalQuota ?? 0

    // Calculate progressive SP consumption from actual demands
    let usedSp = 0
    const demandBreakdown: {
      id: string; demandNumber: string; title: string
      status: string; sp: number; spUsed: number; updatedAt: Date
    }[] = []

    for (const d of demands) {
      if (d.status === "REJECTED") continue
      const sp = d.confirmedSp ?? d.estimatedSp
      const spUsed = calcUsedSp(d.status, sp)
      usedSp += spUsed
      demandBreakdown.push({
        id: d.id, demandNumber: d.demandNumber, title: d.title,
        status: d.status, sp, spUsed, updatedAt: d.updatedAt,
      })
    }

    const availableSp = totalQuota - usedSp

    return NextResponse.json({
      year: currentYear,
      totalQuota,
      usedSp,
      availableSp,
      demands: demandBreakdown,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("SP wallet error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"

// GET: 強合管理者專用 — 列出所有含智合報價單的需求，區分「待審核」與「可下載」
export async function GET(request: NextRequest) {
  try {
    const auth = verifyRole(request, ["admin"])
    const me = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { managerCompany: true },
    })
    if (me?.managerCompany !== "QIANGHE") {
      return NextResponse.json({ error: "僅強合管理者可使用報價單審核" }, { status: 403 })
    }

    // 側邊欄紅點：只回傳待審核數量
    if (request.nextUrl.searchParams.get("countOnly")) {
      const count = await prisma.demand.count({
        where: { quoteReviewedAt: null, documents: { some: { type: "ZHIHE_QUOTE" } } },
      })
      return NextResponse.json({ count })
    }

    const rows = await prisma.demand.findMany({
      where: { documents: { some: { type: "ZHIHE_QUOTE" } } },
      select: {
        id: true,
        demandNumber: true,
        title: true,
        status: true,
        isTerminated: true,
        vendor: true,
        quoteReviewedAt: true,
        quoteReviewedBy: { select: { name: true } },
        organization: { select: { name: true } },
        documents: {
          where: { type: "ZHIHE_QUOTE" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, fileName: true, fileSize: true, createdAt: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    })

    const items = rows
      .filter((r) => r.documents.length > 0)
      .map((r) => {
        const doc = r.documents[0]
        return {
          id: r.id,
          demandNumber: r.demandNumber,
          title: r.title,
          status: r.status,
          isTerminated: r.isTerminated,
          vendor: r.vendor ?? null,
          organization: r.organization?.name ?? null,
          reviewed: !!r.quoteReviewedAt,
          reviewedAt: r.quoteReviewedAt,
          reviewedBy: r.quoteReviewedBy?.name ?? null,
          docId: doc.id,
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          uploadedAt: doc.createdAt,
        }
      })

    return NextResponse.json({
      pending: items.filter((i) => !i.reviewed),
      approved: items.filter((i) => i.reviewed),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Quote review list error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { nanoid } from "nanoid"
import { prisma } from "@/lib/prisma"
import { verifyRole, verifyAdminFull, AuthError } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

/**
 * 開發流程文件的公開分享連結（僅管理者可建立／撤銷）。
 *
 * 連結本身為公開存取——供沒有平台帳號者檢視流程規範，
 * 故僅輸出最新版內容，且分享頁不提供下載。
 */

const SHARE_DAYS = 7

// GET: 列出尚未失效的分享連結
export async function GET(request: NextRequest) {
  try {
    const auth = verifyRole(request, ["admin"])
    verifyAdminFull(auth)

    const shares = await prisma.processDocShare.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        token: true,
        expiresAt: true,
        viewCount: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ shares })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    console.error("List process doc shares error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// POST: 建立新的分享連結
export async function POST(request: NextRequest) {
  try {
    const auth = verifyRole(request, ["admin"])
    verifyAdminFull(auth)

    // 沒有任何版本時不允許分享，避免對方打開看到空白
    const hasDoc = await prisma.processDoc.count()
    if (hasDoc === 0) {
      return NextResponse.json({ error: "尚未上傳流程文件，無法建立分享連結" }, { status: 400 })
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + SHARE_DAYS)

    const share = await prisma.processDocShare.create({
      data: { token: nanoid(12), createdById: auth.userId, expiresAt },
      select: { token: true, expiresAt: true },
    })

    logAudit({
      userId: auth.userId,
      action: "CREATE",
      entity: "PROCESS_DOC_SHARE",
      entityId: share.token,
      details: { token: share.token, expiresAt: share.expiresAt },
      request,
    })

    return NextResponse.json(
      { token: share.token, url: `/process/share/${share.token}`, expiresAt: share.expiresAt },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    console.error("Create process doc share error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// DELETE: 撤銷分享連結（?token=xxx）
export async function DELETE(request: NextRequest) {
  try {
    const auth = verifyRole(request, ["admin"])
    verifyAdminFull(auth)

    const token = request.nextUrl.searchParams.get("token")
    if (!token) return NextResponse.json({ error: "缺少 token" }, { status: 400 })

    const result = await prisma.processDocShare.updateMany({
      where: { token, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    if (result.count === 0) {
      return NextResponse.json({ error: "分享連結不存在或已失效" }, { status: 404 })
    }

    logAudit({
      userId: auth.userId, action: "DELETE", entity: "PROCESS_DOC_SHARE",
      entityId: token, details: { token }, request,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    console.error("Revoke process doc share error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

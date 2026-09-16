import { NextRequest, NextResponse } from "next/server"
import { nanoid } from "nanoid"
import { prisma } from "@/lib/prisma"
import { verifyRole, verifyAdminFull, AuthError } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { resolveShareExpiry } from "@/lib/share-expiry"

/**
 * 開發流程文件的公開分享連結。
 *
 * 連結本身為公開存取——供沒有平台帳號者檢視流程規範，
 * 故僅輸出最新版內容，且分享頁不提供下載。
 *
 * 誰能建立：所有登入者。流程規範本來就是雙方共同遵循、人人可讀的文件，
 * 需求方要轉給自己單位的同事看是常態，不需要回頭找管理者代發。
 * 惟「自訂有效期」限管理者，一般使用者一律 7 天（見 lib/share-expiry.ts）。
 * 列表與撤銷：管理者看得到全部，其他人只看得到自己建立的。
 */

// GET: 列出尚未失效的分享連結
export async function GET(request: NextRequest) {
  try {
    const auth = verifyRole(request, ["admin", "delivery", "subsidiary", "viewer"])
    if (auth.role === "admin") verifyAdminFull(auth)

    const shares = await prisma.processDocShare.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() },
        // 非管理者只看得到自己建立的連結
        ...(auth.role === "admin" ? {} : { createdById: auth.userId }),
      },
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
    const auth = verifyRole(request, ["admin", "delivery", "subsidiary", "viewer"])
    if (auth.role === "admin") verifyAdminFull(auth)

    // 沒有任何版本時不允許分享，避免對方打開看到空白
    const hasDoc = await prisma.processDoc.count()
    if (hasDoc === 0) {
      return NextResponse.json({ error: "尚未上傳流程文件，無法建立分享連結" }, { status: 400 })
    }

    // 有效期：管理者可自訂，其餘角色一律 7 天
    const body = await request.json().catch(() => ({}))
    const expiresAt = resolveShareExpiry(auth.role, body)

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
    const auth = verifyRole(request, ["admin", "delivery", "subsidiary", "viewer"])
    if (auth.role === "admin") verifyAdminFull(auth)

    const token = request.nextUrl.searchParams.get("token")
    if (!token) return NextResponse.json({ error: "缺少 token" }, { status: 400 })

    const result = await prisma.processDocShare.updateMany({
      // 非管理者只能撤銷自己建立的連結
      where: { token, revokedAt: null, ...(auth.role === "admin" ? {} : { createdById: auth.userId }) },
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

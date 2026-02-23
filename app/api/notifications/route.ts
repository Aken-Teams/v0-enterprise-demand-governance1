import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth, AuthError } from "@/lib/auth"

// GET: Fetch notifications for the current user
export async function GET(request: NextRequest) {
  try {
    const auth = verifyAuth(request)
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")))
    const filter = searchParams.get("filter") // "unread" | "read" | null

    const where: Record<string, unknown> = { userId: auth.userId }
    if (filter === "unread") where.isRead = false
    if (filter === "read") where.isRead = true

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: auth.userId, isRead: false } }),
    ])

    return NextResponse.json({ notifications, total, unreadCount, page, limit })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Get notifications error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// PATCH: Mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const auth = verifyAuth(request)
    const body = await request.json()
    const { ids, markAll } = body as { ids?: string[]; markAll?: boolean }

    if (markAll) {
      await prisma.notification.updateMany({
        where: { userId: auth.userId, isRead: false },
        data: { isRead: true },
      })
    } else if (Array.isArray(ids) && ids.length > 0) {
      await prisma.notification.updateMany({
        where: { id: { in: ids }, userId: auth.userId },
        data: { isRead: true },
      })
    } else {
      return NextResponse.json({ error: "請提供 ids 或 markAll" }, { status: 400 })
    }

    const unreadCount = await prisma.notification.count({
      where: { userId: auth.userId, isRead: false },
    })

    return NextResponse.json({ success: true, unreadCount })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Mark notifications read error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// DELETE: Delete notifications
export async function DELETE(request: NextRequest) {
  try {
    const auth = verifyAuth(request)
    const body = await request.json()
    const { ids } = body as { ids?: string[] }

    if (Array.isArray(ids) && ids.length > 0) {
      await prisma.notification.deleteMany({
        where: { id: { in: ids }, userId: auth.userId },
      })
    } else {
      // Clean up read notifications older than 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      await prisma.notification.deleteMany({
        where: { userId: auth.userId, isRead: true, createdAt: { lt: thirtyDaysAgo } },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Delete notifications error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

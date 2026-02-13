import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth, AuthError } from "@/lib/auth"

const ROLE_LABELS: Record<string, string> = {
  admin: "管理員",
  delivery: "交付團隊",
  subsidiary: "需求單位",
}

export async function GET(request: NextRequest) {
  try {
    const payload = verifyAuth(request)

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        organization: { select: { id: true, name: true } },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "使用者不存在" }, { status: 404 })
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleLabel: ROLE_LABELS[user.role] || user.role,
      organizationId: user.organizationId,
      organizationName: user.organization?.name || null,
      createdAt: user.createdAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Profile GET error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = verifyAuth(request)
    const body = await request.json()
    const { name, email } = body

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (email !== undefined) {
      const existing = await prisma.user.findFirst({
        where: { email, id: { not: payload.userId } },
      })
      if (existing) {
        return NextResponse.json({ error: "此電子郵件已被使用" }, { status: 409 })
      }
      data.email = email
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "未提供任何更新欄位" }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id: payload.userId },
      include: { organization: { select: { name: true } } },
    data,
    })

    return NextResponse.json({
      success: true,
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        roleLabel: ROLE_LABELS[updated.role] || updated.role,
        organizationName: updated.organization?.name || null,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Profile PATCH error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

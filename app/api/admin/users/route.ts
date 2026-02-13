import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"

const ROLE_LABELS: Record<string, string> = {
  admin: "管理員",
  delivery: "交付團隊",
  subsidiary: "需求單位",
}

export async function GET(request: NextRequest) {
  try {
    verifyRole(request, ["admin"])

    const users = await prisma.user.findMany({
      include: {
        organization: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    const result = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      roleLabel: ROLE_LABELS[u.role] || u.role,
      isActive: u.isActive,
      organizationId: u.organizationId,
      organizationName: u.organization?.name || null,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    }))

    const totalUsers = result.length
    const activeUsers = result.filter((u) => u.isActive).length
    const roleCounts: Record<string, number> = {}
    for (const u of result) {
      roleCounts[u.role] = (roleCounts[u.role] || 0) + 1
    }

    return NextResponse.json({
      users: result,
      summary: { totalUsers, activeUsers, roleCounts },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Admin users error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    verifyRole(request, ["admin"])
    const body = await request.json()
    const { id, name, email, role, isActive, organizationId } = body

    if (!id) {
      return NextResponse.json({ error: "缺少使用者 ID" }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (email !== undefined) data.email = email
    if (role !== undefined) data.role = role
    if (isActive !== undefined) data.isActive = isActive
    if (organizationId !== undefined) data.organizationId = organizationId || null

    await prisma.user.update({ where: { id }, data })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Admin update user error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

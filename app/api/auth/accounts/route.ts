import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Public endpoint for login page — lists available accounts per organization/role
export async function GET() {
  try {
    const [organizations, adminUsers] = await Promise.all([
      prisma.organization.findMany({
        include: {
          users: {
            where: { isActive: true, role: "subsidiary" },
            select: { id: true, name: true, email: true },
            orderBy: { name: "asc" },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { isActive: true, role: { in: ["admin", "delivery"] } },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      }),
    ])

    return NextResponse.json({
      organizations: organizations.map((org) => ({
        id: org.id,
        name: org.name,
        users: org.users,
      })),
      adminUsers,
    })
  } catch (error) {
    console.error("Get accounts error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

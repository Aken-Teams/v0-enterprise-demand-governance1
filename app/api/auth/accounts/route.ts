import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Public endpoint for login page — lists available accounts per organization/role
export async function GET() {
  try {
    const [organizations, adminUsers] = await Promise.all([
      prisma.organization.findMany({
        include: {
          users: {
            where: { isActive: true, role: { in: ["subsidiary", "viewer"] } },
            select: {
              id: true, name: true, email: true, role: true,
              demandAccessGrants: { select: { signoffRole: true } },
            },
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
        users: org.users
          .map((u) => {
            const roles = [...new Set(u.demandAccessGrants.map((a) => a.signoffRole))]
            return {
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              signoffRoles: roles,
            }
          })
          .sort((a, b) => {
            // 1. Org-named account first (name matches org name)
            const aIsOrg = a.name === org.name ? 1 : 0
            const bIsOrg = b.name === org.name ? 1 : 0
            if (aIsOrg !== bIsOrg) return bIsOrg - aIsOrg
            // 2. Board members second
            const aBoard = a.signoffRoles.includes("BOARD") ? 1 : 0
            const bBoard = b.signoffRoles.includes("BOARD") ? 1 : 0
            if (aBoard !== bBoard) return bBoard - aBoard
            // 3. Requester / Manager third
            const aReq = a.signoffRoles.includes("REQUESTER") || a.signoffRoles.includes("MANAGER") ? 1 : 0
            const bReq = b.signoffRoles.includes("REQUESTER") || b.signoffRoles.includes("MANAGER") ? 1 : 0
            if (aReq !== bReq) return bReq - aReq
            // 4. Alphabetical
            return a.name.localeCompare(b.name)
          }),
      })),
      adminUsers,
    })
  } catch (error) {
    console.error("Get accounts error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

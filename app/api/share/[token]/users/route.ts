import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET: List organizations & users who can access this demand (for share login)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Validate share token and get associated demand
    const share = await prisma.demandShare.findUnique({
      where: { token },
      include: {
        demand: {
          select: { id: true, organizationId: true },
        },
      },
    })
    if (!share || share.expiresAt < new Date()) {
      return NextResponse.json({ error: "分享連結無效或已過期" }, { status: 404 })
    }

    const { organizationId, id: demandId } = share.demand

    // Get users with explicit DemandAccess grants for this demand
    const accessGrants = await prisma.demandAccess.findMany({
      where: { demandId },
      select: { userId: true },
    })
    const grantedUserIds = new Set(accessGrants.map((g) => g.userId))

    // Get the demand's organization with its subsidiary users
    const demandOrg = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        users: {
          where: { isActive: true, role: { in: ["subsidiary", "delivery", "viewer"] } },
          select: { id: true, name: true, email: true, ldapUsername: true },
          orderBy: { name: "asc" },
        },
      },
    })

    const organizations: { id: string; name: string; users: { id: string; name: string; email: string; ldapUsername: string | null }[] }[] = []

    if (demandOrg) {
      organizations.push({
        id: demandOrg.id,
        name: demandOrg.name,
        users: demandOrg.users,
      })
    }



    // If there are explicit access grants, include those users grouped by their org
    if (grantedUserIds.size > 0) {
      const grantedUsers = await prisma.user.findMany({
        where: {
          id: { in: [...grantedUserIds] },
          isActive: true,
          role: "subsidiary",
        },
        select: { id: true, name: true, email: true, ldapUsername: true, organizationId: true },
        orderBy: { name: "asc" },
      })

      // Group granted users by their organization (skip if already in demand org)
      const extraOrgIds = new Set<string>()
      for (const u of grantedUsers) {
        if (u.organizationId && u.organizationId !== organizationId) {
          extraOrgIds.add(u.organizationId)
        }
      }

      if (extraOrgIds.size > 0) {
        const extraOrgs = await prisma.organization.findMany({
          where: { id: { in: [...extraOrgIds] } },
          include: {
            users: {
              where: {
                isActive: true,
                role: "subsidiary",
                id: { in: [...grantedUserIds] },
              },
              select: { id: true, name: true, email: true },
              orderBy: { name: "asc" },
            },
          },
          orderBy: { name: "asc" },
        })

        for (const org of extraOrgs) {
          if (org.users.length > 0) {
            organizations.push({ id: org.id, name: org.name, users: org.users })
          }
        }
      }
    }

    return NextResponse.json({ organizations })
  } catch (error) {
    console.error("Share users error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

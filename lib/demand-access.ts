import { prisma } from "@/lib/prisma"

interface AuthPayload {
  userId: string
  role: string
  adminScopeType?: string
}

/**
 * Build a Prisma `where` filter based on the user's DemandAccess whitelist.
 *
 * Whitelist logic:
 * - admin(all) → always null (no restriction)
 * - admin(organization) → restrict to AdminAccess org IDs
 * - admin(project) → restrict to AdminAccess demand IDs
 * - viewer/board member → restricted by restrictBoardViewToOrg
 * - If user has DemandAccess records → restrict to only those demand IDs
 * - If user has NO DemandAccess records → return null (no extra restriction;
 *   the caller's existing filters like organizationId/developerId still apply)
 */
export async function buildDemandVisibilityFilter(
  auth: AuthPayload,
): Promise<Record<string, unknown> | null> {
  if (auth.role === "admin") {
    if (!auth.adminScopeType || auth.adminScopeType === "all") return null
    return buildAdminScopeFilter(auth.userId, auth.adminScopeType)
  }

  // Board members: restricted ones only see their own org's demands
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { isBoardMember: true, restrictBoardViewToOrg: true, organizationId: true },
  })
  if (user?.isBoardMember) {
    if (user.restrictBoardViewToOrg && user.organizationId) {
      return { organizationId: user.organizationId }
    }
    return null
  }

  const grants = await prisma.demandAccess.findMany({
    where: { userId: auth.userId },
    select: { demandId: true },
  })

  if (grants.length === 0) return null

  return { id: { in: grants.map((g) => g.demandId) } }
}

/**
 * Check whether a specific user can access a specific demand.
 *
 * Whitelist logic:
 * - admin → always allowed
 * - viewer/board member → restricted by restrictBoardViewToOrg
 * - User with whitelist → demand must be in the whitelist
 * - User without whitelist → fall back to role-based defaults:
 *   - subsidiary: demand must be from same organization
 *   - delivery: demand must be assigned to the user (developerId)
 */
export async function canAccessDemand(
  auth: AuthPayload,
  demand: { id: string; organizationId: string; developerId: string | null },
): Promise<boolean> {
  if (auth.role === "admin") {
    if (!auth.adminScopeType || auth.adminScopeType === "all") return true
    return checkAdminDemandAccess(auth.userId, auth.adminScopeType, demand)
  }

  // Board members: restricted ones can only access their own org's demands
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { isBoardMember: true, restrictBoardViewToOrg: true, organizationId: true },
  })
  if (user?.isBoardMember) {
    if (user.restrictBoardViewToOrg) return demand.organizationId === user.organizationId
    return true
  }

  // Check whitelist
  const grants = await prisma.demandAccess.findMany({
    where: { userId: auth.userId },
    select: { demandId: true },
  })

  if (grants.length > 0) {
    return grants.some((g) => g.demandId === demand.id)
  }

  // No whitelist — use role-based defaults
  if (auth.role === "subsidiary") {
    return demand.organizationId === user?.organizationId
  }

  if (auth.role === "delivery") {
    return demand.developerId === auth.userId
  }

  return false
}

// ── Admin scope helpers ──────────────────────────────────────────────

/**
 * Build Prisma `where` filter for non-"all" admins based on AdminAccess grants.
 */
async function buildAdminScopeFilter(
  userId: string,
  scopeType: string,
): Promise<Record<string, unknown> | null> {
  const grants = await prisma.adminAccess.findMany({
    where: { userId },
    select: { organizationId: true, demandId: true },
  })

  if (grants.length === 0) {
    // No grants → can't see anything
    return { id: "__none__" }
  }

  if (scopeType === "organization") {
    const orgIds = grants.map((g) => g.organizationId).filter(Boolean) as string[]
    return orgIds.length > 0 ? { organizationId: { in: orgIds } } : { id: "__none__" }
  }

  if (scopeType === "project") {
    const demandIds = grants.map((g) => g.demandId).filter(Boolean) as string[]
    return demandIds.length > 0 ? { id: { in: demandIds } } : { id: "__none__" }
  }

  return null
}

/**
 * Check whether a non-"all" admin can see a specific demand.
 */
async function checkAdminDemandAccess(
  userId: string,
  scopeType: string,
  demand: { id: string; organizationId: string },
): Promise<boolean> {
  if (scopeType === "organization") {
    const grant = await prisma.adminAccess.findUnique({
      where: { userId_organizationId: { userId, organizationId: demand.organizationId } },
    })
    return !!grant
  }

  if (scopeType === "project") {
    const grant = await prisma.adminAccess.findUnique({
      where: { userId_demandId: { userId, demandId: demand.id } },
    })
    return !!grant
  }

  return false
}

/**
 * Check whether an admin user has "edit" permission for a specific demand.
 * - all scope → always true
 * - organization scope → AdminAccess for that org must have permission="edit"
 * - project scope → AdminAccess for that demand must have permission="edit"
 */
export async function canAdminWrite(
  userId: string,
  adminScopeType: string | undefined,
  demand: { id: string; organizationId: string },
): Promise<boolean> {
  if (!adminScopeType || adminScopeType === "all") return true

  if (adminScopeType === "organization") {
    const grant = await prisma.adminAccess.findUnique({
      where: { userId_organizationId: { userId, organizationId: demand.organizationId } },
    })
    return grant?.permission === "edit"
  }

  if (adminScopeType === "project") {
    const grant = await prisma.adminAccess.findUnique({
      where: { userId_demandId: { userId, demandId: demand.id } },
    })
    return grant?.permission === "edit"
  }

  return false
}

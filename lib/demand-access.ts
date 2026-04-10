import { prisma } from "@/lib/prisma"

interface AuthPayload {
  userId: string
  role: string
}

/**
 * Build a Prisma `where` filter based on the user's DemandAccess whitelist.
 *
 * Whitelist logic:
 * - admin / viewer / board member → always null (no restriction)
 * - If user has DemandAccess records → restrict to only those demand IDs
 * - If user has NO DemandAccess records → return null (no extra restriction;
 *   the caller's existing filters like organizationId/developerId still apply)
 */
export async function buildDemandVisibilityFilter(
  auth: AuthPayload,
): Promise<Record<string, unknown> | null> {
  if (auth.role === "admin" || auth.role === "viewer") return null

  // Board members can see all demands
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { isBoardMember: true },
  })
  if (user?.isBoardMember) return null

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
 * - admin / board member → always allowed
 * - User with whitelist → demand must be in the whitelist
 * - User without whitelist → fall back to role-based defaults:
 *   - subsidiary: demand must be from same organization
 *   - delivery: demand must be assigned to the user (developerId)
 */
export async function canAccessDemand(
  auth: AuthPayload,
  demand: { id: string; organizationId: string; developerId: string | null },
): Promise<boolean> {
  if (auth.role === "admin" || auth.role === "viewer") return true

  // Board members can access all demands
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { isBoardMember: true, organizationId: true },
  })
  if (user?.isBoardMember) return true

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

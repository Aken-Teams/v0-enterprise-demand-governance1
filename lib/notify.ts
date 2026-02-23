import { prisma } from "@/lib/prisma"
import type { NotificationType } from "@/lib/generated/prisma/client"

interface NotifyInput {
  type: NotificationType
  title: string
  message: string
  linkUrl?: string
}

/**
 * Creates notification records for multiple users.
 * Fire-and-forget: errors are logged but never thrown to callers.
 */
export async function notifyUsers(
  userIds: string[],
  data: NotifyInput
): Promise<void> {
  if (userIds.length === 0) return
  try {
    const uniqueIds = [...new Set(userIds)]
    await prisma.notification.createMany({
      data: uniqueIds.map((userId) => ({
        userId,
        type: data.type,
        title: data.title,
        message: data.message,
        linkUrl: data.linkUrl ?? null,
      })),
    })
  } catch (error) {
    console.error("Failed to create notifications:", error)
  }
}

/**
 * Get stakeholder user IDs for a demand (submitter, manager, developer).
 */
export async function getDemandStakeholderIds(demandId: string): Promise<string[]> {
  const demand = await prisma.demand.findUnique({
    where: { id: demandId },
    select: { submitterId: true, managerId: true, developerId: true },
  })
  if (!demand) return []
  return [demand.submitterId, demand.managerId, demand.developerId].filter(
    (id): id is string => id !== null
  )
}

/**
 * Get subsidiary user IDs for an organization.
 */
export async function getOrgSubsidiaryUserIds(organizationId: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { organizationId, role: "subsidiary", isActive: true },
    select: { id: true },
  })
  return users.map((u) => u.id)
}

/**
 * Get all admin user IDs.
 */
export async function getAdminUserIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: "admin", isActive: true },
    select: { id: true },
  })
  return admins.map((u) => u.id)
}

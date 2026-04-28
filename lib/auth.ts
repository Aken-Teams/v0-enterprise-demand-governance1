import jwt from "jsonwebtoken"
import { createHash } from "crypto"
import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"

const JWT_SECRET = process.env.JWT_SECRET || "REDACTED-SECRET-ROTATED"

export interface JwtPayload {
  userId: string
  email: string
  role: "subsidiary" | "admin" | "delivery" | "viewer"
  adminScopeType?: string // "all" | "organization" | "project"
}

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message)
  }
}

export function verifyAuth(request: NextRequest): JwtPayload {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("未提供認證令牌", 401)
  }
  const token = authHeader.slice(7)
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload
  } catch {
    throw new AuthError("認證令牌無效或已過期", 401)
  }
}

export function verifyRole(
  request: NextRequest,
  allowedRoles: JwtPayload["role"][]
): JwtPayload {
  const payload = verifyAuth(request)
  if (!allowedRoles.includes(payload.role)) {
    throw new AuthError("權限不足", 403)
  }
  return payload
}

/**
 * Verify that the admin user has full ("all") scope for system management operations.
 * Non-"all" admins cannot access user/org/LDAP management or create demands.
 */
export function verifyAdminFull(payload: JwtPayload): void {
  if (payload.role === "admin" && payload.adminScopeType && payload.adminScopeType !== "all") {
    throw new AuthError("此管理員無完整管理權限", 403)
  }
}

export interface ApiKeyPayload {
  apiKeyId: string
  name: string
  createdById: string
}

/** 驗證外部 API 金鑰（X-API-Key header） */
export async function verifyApiKey(request: NextRequest): Promise<ApiKeyPayload> {
  const rawKey = request.headers.get("X-API-Key")
  if (!rawKey) {
    throw new AuthError("未提供 API 金鑰", 401)
  }

  const keyHash = createHash("sha256").update(rawKey).digest("hex")

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
  })

  if (!apiKey || apiKey.revokedAt) {
    throw new AuthError("API 金鑰無效或已撤銷", 401)
  }

  // Fire-and-forget: update lastUsedAt
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {})

  return {
    apiKeyId: apiKey.id,
    name: apiKey.name,
    createdById: apiKey.createdById,
  }
}

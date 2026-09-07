import jwt from "jsonwebtoken"
import { createHash } from "crypto"
import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * 取得 JWT 簽發/驗證密鑰。
 * 未設定 JWT_SECRET 時直接拋錯，避免正式環境誤用可預測的預設值導致 token 可被偽造。
 * 採呼叫時才讀取（而非模組載入時），確保建置階段不會因環境變數尚未注入而失敗。
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error("環境變數 JWT_SECRET 未設定，無法簽發或驗證認證令牌")
  }
  return secret
}

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
  // 先取密鑰：缺少設定屬伺服器設定錯誤，不可被下方 catch 誤判為「令牌無效」
  const secret = getJwtSecret()
  try {
    return jwt.verify(token, secret) as JwtPayload
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

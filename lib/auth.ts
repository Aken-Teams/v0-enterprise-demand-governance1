import jwt from "jsonwebtoken"
import { NextRequest } from "next/server"

const JWT_SECRET = process.env.JWT_SECRET || "REDACTED-SECRET-ROTATED"

export interface JwtPayload {
  userId: string
  email: string
  role: "subsidiary" | "admin" | "delivery" | "viewer"
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

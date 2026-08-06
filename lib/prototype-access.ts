import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth, AuthError } from "@/lib/auth"

/**
 * 原型檢視授權：允許「登入使用者（Bearer）」或「有效的分享連結（?shareToken）」。
 * 原型非機密文件，客戶端（分享頁）亦可互動預覽。
 */
export async function authorizePrototypeView(request: NextRequest, demandId: string): Promise<void> {
  const shareToken = request.nextUrl.searchParams.get("shareToken")
  if (shareToken) {
    const share = await prisma.demandShare.findUnique({ where: { token: shareToken } })
    if (!share || share.demandId !== demandId || share.expiresAt < new Date()) {
      throw new AuthError("分享連結無效或已過期", 403)
    }
    return
  }
  verifyAuth(request) // 無有效 JWT 會丟出 AuthError
}

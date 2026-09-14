import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * 以分享 token 取得開發流程文件（**公開端點，不需認證**）。
 *
 * 僅輸出最新版的呈現所需欄位；不回傳版本清單、上傳者等內部資訊，
 * 也不提供任何下載入口。另附前一版內容，供閱讀頁標示本版的變更段落。
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const share = await prisma.processDocShare.findUnique({
      where: { token },
      select: { id: true, expiresAt: true, revokedAt: true },
    })

    if (!share) {
      return NextResponse.json({ error: "分享連結不存在" }, { status: 404 })
    }
    if (share.revokedAt) {
      return NextResponse.json({ error: "分享連結已撤銷" }, { status: 410 })
    }
    if (share.expiresAt < new Date()) {
      return NextResponse.json({ error: "分享連結已過期" }, { status: 410 })
    }

    const [doc, prev] = await Promise.all([
      prisma.processDoc.findFirst({
        orderBy: { seq: "desc" },
        select: { versionLabel: true, title: true, content: true, changeNote: true, createdAt: true },
      }),
      // 前一版：供閱讀頁標註「本版新增／修改」的段落，不對外顯示其內容本身
      prisma.processDoc.findFirst({
        orderBy: { seq: "desc" },
        skip: 1,
        select: { versionLabel: true, content: true },
      }),
    ])

    if (!doc) {
      return NextResponse.json({ error: "尚未上傳流程文件" }, { status: 404 })
    }

    // 瀏覽次數：fire-and-forget，計數失敗不影響閱讀
    prisma.processDocShare
      .update({ where: { id: share.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {})

    return NextResponse.json({ doc, prev, expiresAt: share.expiresAt })
  } catch (error) {
    console.error("Get shared process doc error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

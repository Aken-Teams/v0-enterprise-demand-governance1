import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAuth, verifyRole, verifyAdminFull, AuthError } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

/**
 * 開發流程規範文件。
 *
 * 全體角色（需求者／管理者／董事會／交付團隊）皆可檢視，作為流程爭議時的共同依據；
 * 僅管理者可上傳新版本。內容存於資料庫，不提供檔案下載端點——
 * 這份文件的定位是「線上共同閱讀的規範」，不是可散佈的附件。
 */

const MAX_CONTENT_LENGTH = 500_000 // 約 500KB Markdown，足夠容納長篇流程文件

// GET: 版本清單（?seq=n 取單一版本內容；預設回傳最新版）
export async function GET(request: NextRequest) {
  try {
    verifyAuth(request)

    const seqParam = request.nextUrl.searchParams.get("seq")

    const versions = await prisma.processDoc.findMany({
      orderBy: { seq: "desc" },
      select: {
        id: true,
        seq: true,
        versionLabel: true,
        title: true,
        changeNote: true,
        createdAt: true,
        uploadedBy: { select: { id: true, name: true } },
      },
    })

    if (versions.length === 0) {
      return NextResponse.json({ versions: [], doc: null })
    }

    const targetSeq = seqParam ? Number(seqParam) : versions[0].seq
    if (!Number.isFinite(targetSeq)) {
      return NextResponse.json({ error: "版本參數無效" }, { status: 400 })
    }

    // 同時取出前一版，供前端直接做差異比對
    const [doc, prev] = await Promise.all([
      prisma.processDoc.findUnique({
        where: { seq: targetSeq },
        include: { uploadedBy: { select: { id: true, name: true } } },
      }),
      prisma.processDoc.findFirst({
        where: { seq: { lt: targetSeq } },
        orderBy: { seq: "desc" },
        select: { seq: true, versionLabel: true, content: true },
      }),
    ])

    if (!doc) {
      return NextResponse.json({ error: "版本不存在" }, { status: 404 })
    }

    return NextResponse.json({ versions, doc, previous: prev })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    console.error("Get process doc error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// POST: 上傳新版本（僅管理者）。支援直接貼上內容或上傳 .md 檔
export async function POST(request: NextRequest) {
  try {
    const auth = verifyRole(request, ["admin"])
    verifyAdminFull(auth)

    const contentType = request.headers.get("content-type") || ""
    let content = ""
    let versionLabel = ""
    let title = ""
    let changeNote: string | null = null

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      const file = formData.get("file") as File | null
      versionLabel = ((formData.get("versionLabel") as string) ?? "").trim()
      title = ((formData.get("title") as string) ?? "").trim()
      changeNote = ((formData.get("changeNote") as string) ?? "").trim() || null

      const pasted = ((formData.get("content") as string) ?? "").trim()
      if (pasted) {
        content = pasted
      } else if (file && file.size > 0) {
        const name = file.name.toLowerCase()
        if (!name.endsWith(".md") && !name.endsWith(".markdown") && !name.endsWith(".txt")) {
          return NextResponse.json({ error: "僅接受 .md / .markdown / .txt 檔案" }, { status: 400 })
        }
        if (file.size > MAX_CONTENT_LENGTH) {
          return NextResponse.json({ error: "檔案過大（上限約 500KB）" }, { status: 400 })
        }
        content = await file.text()
        // 沒填標題就沿用檔名（去掉副檔名）
        if (!title) title = file.name.replace(/\.(md|markdown|txt)$/i, "")
      }
    } else {
      const body = await request.json()
      content = ((body.content as string) ?? "").trim()
      versionLabel = ((body.versionLabel as string) ?? "").trim()
      title = ((body.title as string) ?? "").trim()
      changeNote = ((body.changeNote as string) ?? "").trim() || null
    }

    if (!content) {
      return NextResponse.json({ error: "請上傳 .md 檔或貼上文件內容" }, { status: 400 })
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json({ error: "內容過長（上限約 500KB）" }, { status: 400 })
    }
    if (!versionLabel) {
      return NextResponse.json({ error: "請填寫版本號（例如 v1.3）" }, { status: 400 })
    }

    const last = await prisma.processDoc.findFirst({ orderBy: { seq: "desc" }, select: { seq: true, content: true, title: true } })

    // 內容與上一版完全相同時擋下，避免版本清單被無意義的重複版本灌爆
    if (last && last.content.replace(/\r\n?/g, "\n") === content.replace(/\r\n?/g, "\n")) {
      return NextResponse.json({ error: "內容與上一版完全相同，無需建立新版本" }, { status: 400 })
    }

    if (!title) title = last?.title || "開發流程"

    const created = await prisma.processDoc.create({
      data: {
        seq: (last?.seq ?? 0) + 1,
        versionLabel,
        title,
        content,
        changeNote,
        uploadedById: auth.userId,
      },
      select: { id: true, seq: true, versionLabel: true },
    })

    logAudit({
      userId: auth.userId,
      action: "CREATE",
      entity: "PROCESS_DOC",
      entityId: created.id,
      details: { seq: created.seq, versionLabel, title, length: content.length },
      request,
    })

    return NextResponse.json({ doc: created }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    console.error("Create process doc error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// DELETE: 移除最新版本（僅管理者；用於上傳錯誤時回退）
export async function DELETE(request: NextRequest) {
  try {
    const auth = verifyRole(request, ["admin"])
    verifyAdminFull(auth)

    const seq = Number(request.nextUrl.searchParams.get("seq"))
    if (!Number.isFinite(seq)) {
      return NextResponse.json({ error: "版本參數無效" }, { status: 400 })
    }

    const last = await prisma.processDoc.findFirst({ orderBy: { seq: "desc" }, select: { seq: true } })
    if (!last || last.seq !== seq) {
      // 只允許刪最新版：刪中間版本會讓「與前一版比對」的歷程出現斷層
      return NextResponse.json({ error: "僅能刪除最新版本" }, { status: 400 })
    }

    await prisma.processDoc.delete({ where: { seq } })

    logAudit({
      userId: auth.userId, action: "DELETE", entity: "PROCESS_DOC", entityId: String(seq),
      details: { seq }, request,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode })
    console.error("Delete process doc error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

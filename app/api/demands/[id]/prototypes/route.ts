import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { randomUUID } from "crypto"
import path from "path"
import { prisma } from "@/lib/prisma"
import { verifyRole, AuthError } from "@/lib/auth"
import { authorizePrototypeView } from "@/lib/prototype-access"
import { logAudit } from "@/lib/audit"

function baseName(fileName: string): string {
  return path.basename(fileName).replace(/\.[^.]+$/, "").trim() || "畫面"
}

// GET: 列出此需求的原型版本（含各畫面 metadata） — 登入使用者或有效分享連結
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await authorizePrototypeView(request, id)

    const prototypes = await prisma.prototype.findMany({
      where: { demandId: id },
      orderBy: { version: "desc" },
      include: { screens: { orderBy: { order: "asc" } } },
    })

    const out = prototypes.map((p) => ({
      id: p.id,
      version: p.version,
      note: p.note,
      createdAt: p.createdAt,
      screenCount: p.screens.length,
      screens: p.screens.map((s) => ({
        id: s.id,
        name: s.name,
        order: s.order,
        screenshotUrl: s.screenshotFile ? `/api/uploads/demands/${id}/${s.screenshotFile}` : null,
      })),
    }))

    return NextResponse.json({ prototypes: out })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("List prototypes error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// POST: 上傳一個新原型版本（一組 HTML 畫面 + 選填截圖） — 管理者／交付團隊
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = verifyRole(request, ["admin", "delivery"])
    const { id } = await params

    const demand = await prisma.demand.findUnique({ where: { id }, select: { id: true } })
    if (!demand) {
      return NextResponse.json({ error: "需求不存在" }, { status: 404 })
    }

    const form = await request.formData()
    const note = ((form.get("note") as string | null) || "").trim() || null
    const htmlFiles = form.getAll("html").filter((f): f is File => f instanceof File)
    const shotFiles = form.getAll("screenshot").filter((f): f is File => f instanceof File)

    if (htmlFiles.length === 0) {
      return NextResponse.json({ error: "請至少上傳一個 HTML 畫面" }, { status: 400 })
    }
    if (!htmlFiles.every((f) => /\.html?$/i.test(f.name))) {
      return NextResponse.json({ error: "原型畫面僅接受 .html 檔" }, { status: 400 })
    }

    const uploadDir = path.join(process.cwd(), "uploads", "demands", id)
    await mkdir(uploadDir, { recursive: true })

    // 依「檔名（去副檔名）」配對截圖
    const shotByBase = new Map<string, File>()
    for (const s of shotFiles) shotByBase.set(baseName(s.name).toLowerCase(), s)

    const last = await prisma.prototype.findFirst({
      where: { demandId: id },
      orderBy: { version: "desc" },
      select: { version: true },
    })
    const version = (last?.version ?? 0) + 1

    const proto = await prisma.prototype.create({
      data: { demandId: id, version, note, uploadedBy: auth.userId },
    })

    let order = 0
    for (const hf of htmlFiles) {
      const base = baseName(hf.name)
      const htmlName = `proto-${proto.id}-${randomUUID()}.html`
      await writeFile(path.join(uploadDir, htmlName), Buffer.from(await hf.arrayBuffer()))

      let shotName: string | null = null
      const shot = shotByBase.get(base.toLowerCase())
      if (shot) {
        const ext = (path.extname(shot.name) || ".png").toLowerCase()
        shotName = `proto-${proto.id}-${randomUUID()}${ext}`
        await writeFile(path.join(uploadDir, shotName), Buffer.from(await shot.arrayBuffer()))
      }

      await prisma.prototypeScreen.create({
        data: { prototypeId: proto.id, name: base, order: order++, htmlFile: htmlName, screenshotFile: shotName },
      })
    }

    logAudit({
      userId: auth.userId,
      action: "CREATE",
      entity: "DEMAND",
      entityId: proto.id,
      demandId: id,
      details: { kind: "PROTOTYPE", version, screens: htmlFiles.length },
      request,
    })

    return NextResponse.json({ id: proto.id, version })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("Upload prototype error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

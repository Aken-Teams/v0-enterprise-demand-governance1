"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { useAuth } from "@/hooks/use-auth"
import {
  STATUS_MAP,
  PIPELINE_STEPS,
  PHASE_DESCRIPTIONS,
  PHASE_ACTIONS,
  PHASE_DOCUMENT_MAP,
  DOCUMENT_TYPE_LABELS,
} from "@/lib/constants/demand"

const DOC_DESCRIPTIONS: Record<string, string> = {
  MEETING_NOTES: "需求訪談的會議紀錄，記錄核心訴求與期望目標",
  PRD: "由 PM 撰寫的產品需求規格書，詳述功能範圍與驗收標準",
  SP_PLAN: "SP 點數分配與甘特圖時程規劃",
  SDD: "系統架構、資料庫設計與 API 規格",
  BDD: "以 Given-When-Then 格式撰寫的行為測試場景",
  TDD: "單元測試與整合測試的設計與執行結果",
  TEST_REPORT: "測試範圍、通過率與缺陷清單",
  APP_RESULT: "部署連結、安裝包或展示截圖",
  ATTACHMENT: "一般附件",
  AUDIO: "音訊檔案",
  VIDEO: "影片檔案",
}

/* ─── 需求者（subsidiary）看到的內容 ─── */
function SubsidiaryGuide() {
  return (
    <>
      <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
        {/* 需求處理流程 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">需求處理流程</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              您提交的需求會依序經過以下階段，每個階段完成後自動推進至下一階段：
            </p>
            <div className="divide-y">
              {PIPELINE_STEPS.map((step, idx) => {
                const info = STATUS_MAP[step]
                const desc: Record<string, string> = {
                  SUBMITTED: "管理者與您面談確認需求內容",
                  PRD_REVIEW: "PM 撰寫需求規格書，工程師進行架構設計",
                  SP_REVIEW: "管理者確認 SP 點數與開發時程",
                  DEVELOPING: "工程師進行開發，產出系統設計與成果",
                  ACCEPTANCE: "您驗收開發成果，確認是否符合需求",
                  CLOSED: "需求完成結案，SP 點數結算",
                }
                return (
                  <div key={step} className={`flex items-center gap-3 ${idx === 0 ? "pb-3" : idx === PIPELINE_STEPS.length - 1 ? "pt-3" : "py-3"}`}>
                    <span className="text-xs font-medium text-muted-foreground/60 w-4 shrink-0 text-center">{idx + 1}</span>
                    <Badge className={`${info.color} shrink-0`}>{info.label}</Badge>
                    <span className="text-sm text-muted-foreground">{desc[step]}</span>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              ※ 需求在任何階段都可能被駁回。駁回後需重新建立新需求。
            </p>
          </CardContent>
        </Card>

        {/* SP 點數（需求者版） */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">SP 點數</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground divide-y">
            <div className="pb-4">
              <p className="font-medium text-foreground mb-1">什麼是 SP？</p>
              <p>
                SP（Story Points）代表需求的開發工作量。點數越高，代表需求越複雜、所需時間越長。
              </p>
            </div>
            <div className="py-4">
              <p className="font-medium text-foreground mb-1">SP 錢包</p>
              <p>您的子公司每年有固定的 SP 配額，所有需求共用此額度。</p>
              <ul className="mt-2 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0 mt-1.5" />
                  <span><span className="font-medium text-foreground">年度配額</span> — 今年可使用的 SP 總量</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                  <span><span className="font-medium text-foreground">已使用</span> — 依需求階段漸進消耗的 SP（需求確認 50%、MVP 確認後 80%、結案 100%）</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0 mt-1.5" />
                  <span><span className="font-medium text-foreground">可用餘額</span> — 配額 − 已使用</span>
                </li>
              </ul>
            </div>
            <div className="pt-4">
              <p className="font-medium text-foreground mb-1">SP 不夠用怎麼辦？</p>
              <p>
                可聯繫管理者申請追加配額、將低優先級需求延後至下一年度，或與內部討論改由公司 IT 團隊自行開發。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SP 漸進消耗機制 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">SP 漸進消耗機制</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-4">
          <p>
            為使 SP 使用更加透明、讓各階段進度清晰可追蹤，系統採用<span className="font-medium text-foreground">漸進式消耗</span>機制 —
            需求一旦提出即開始扣除 SP，隨著階段推進逐步增加消耗比例。
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium text-foreground">階段</th>
                  <th className="pb-2 font-medium text-foreground text-center">消耗比例</th>
                  <th className="pb-2 font-medium text-foreground">說明</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-2.5"><Badge className="bg-blue-100 text-blue-700">需求確認</Badge></td>
                  <td className="py-2.5 text-center font-semibold text-foreground">50%</td>
                  <td className="py-2.5">需求提出後立即消耗一半 SP，確保需求者審慎提出需求</td>
                </tr>
                <tr>
                  <td className="py-2.5"><Badge className="bg-amber-100 text-amber-700">MVP 確認</Badge></td>
                  <td className="py-2.5 text-center font-semibold text-foreground">80%</td>
                  <td className="py-2.5">MVP 架構確認後累計消耗 80%，避免消極確認導致專案停擺</td>
                </tr>
                <tr>
                  <td className="py-2.5">
                    <div className="flex flex-wrap gap-1">
                      <Badge className="bg-orange-100 text-orange-700">開案確認</Badge>
                      <Badge className="bg-violet-100 text-violet-700">開發中</Badge>
                      <Badge className="bg-purple-100 text-purple-700">驗收中</Badge>
                    </div>
                  </td>
                  <td className="py-2.5 text-center font-semibold text-foreground">80%</td>
                  <td className="py-2.5">維持 80% 消耗直到結案，開發期間不額外增加消耗</td>
                </tr>
                <tr>
                  <td className="py-2.5"><Badge className="bg-emerald-100 text-emerald-700">已結案</Badge></td>
                  <td className="py-2.5 text-center font-semibold text-foreground">100%</td>
                  <td className="py-2.5">結案後完整消耗全部 SP</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <p className="font-medium text-foreground text-xs">計算範例</p>
            <p className="text-xs">
              假設一筆需求預估 <span className="font-semibold text-foreground">20 SP</span>：
            </p>
            <ul className="text-xs space-y-1">
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-muted-foreground/50 shrink-0" />
                提出需求 → 立即消耗 <span className="font-semibold text-foreground">10 SP</span>（20 × 50%）
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-muted-foreground/50 shrink-0" />
                MVP 確認後 → 累計消耗 <span className="font-semibold text-foreground">16 SP</span>（20 × 80%）
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-muted-foreground/50 shrink-0" />
                結案後 → 完整消耗 <span className="font-semibold text-foreground">20 SP</span>（20 × 100%）
              </li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground/70">
            ※ 需求被駁回（取消／暫緩）時，已消耗的 SP 會全數退還。結案時若有 SP 調整（增減），以調整後的 SP 為準計算。
          </p>
        </CardContent>
      </Card>

      {/* 如何使用系統 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">如何使用系統</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="track">
              <AccordionTrigger>
                <span className="text-sm">追蹤需求進度</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>在「需求列表」中點擊任一需求可查看詳細資訊，包含：</p>
                  <ul className="space-y-1">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                      目前所在階段與階段歷程
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                      已上傳的相關文件
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                      指派的團隊成員與時程
                    </li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="wallet">
              <AccordionTrigger>
                <span className="text-sm">查看 SP 錢包</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>前往「SP 錢包」頁面可查看：</p>
                  <ul className="space-y-1">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                      年度 SP 配額與使用狀況
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                      每筆需求的 SP 消耗明細
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                      剩餘可用額度
                    </li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="acceptance">
              <AccordionTrigger>
                <span className="text-sm">驗收需求</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>當需求進入「驗收中」階段，您需要：</p>
                  <ol className="space-y-1 list-decimal list-inside">
                    <li>查看工程師提供測試報告和確認清單</li>
                    <li>確認開發成果是否符合需求</li>
                    <li>通過驗收後需求進入「已結案」</li>
                  </ol>
                  <p className="text-xs">驗收不通過會退回開發階段重新修正。</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </>
  )
}

/* ─── 管理者 / 交付團隊看到的內容 ─── */
function AdminDeliveryGuide() {
  return (
    <>
      <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
        {/* 各階段說明 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">各階段說明</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {PIPELINE_STEPS.map((step) => {
                const info = STATUS_MAP[step]
                const actions = PHASE_ACTIONS[step]
                const docs = PHASE_DOCUMENT_MAP[step]
                const allDocs = [...docs.required, ...docs.optional]
                return (
                  <AccordionItem key={step} value={step}>
                    <AccordionTrigger>
                      <div className="flex items-center gap-3">
                        <Badge className={info.color}>{info.label}</Badge>
                        <span className="text-sm text-muted-foreground font-normal">
                          {PHASE_DESCRIPTIONS[step]}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pl-2">
                        {actions.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-foreground mb-2">關鍵動作</p>
                            <ul className="space-y-1 text-sm text-muted-foreground">
                              {actions.map((a, i) => (
                                <li key={i} className="flex items-center gap-2">
                                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                                  {a}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {allDocs.length > 0 && (
                          <div className="border-t pt-3">
                            <p className="text-sm font-medium text-foreground mb-2">相關文件</p>
                            <div className="space-y-2">
                              {allDocs.map((d) => (
                                <div key={d} className="flex items-baseline gap-2 text-sm">
                                  <span className="font-medium text-foreground shrink-0">
                                    {DOCUMENT_TYPE_LABELS[d] ?? d}
                                  </span>
                                  {docs.required.includes(d) ? (
                                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">必填</Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">選填</Badge>
                                  )}
                                  {DOC_DESCRIPTIONS[d] && (
                                    <span className="text-muted-foreground">{DOC_DESCRIPTIONS[d]}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {actions.length === 0 && allDocs.length === 0 && (
                          <p className="text-sm text-muted-foreground">此階段為結案狀態，無需額外操作。</p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </CardContent>
        </Card>

        {/* SP 點數 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">SP 點數</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground divide-y">
            <div className="pb-4">
              <p className="font-medium text-foreground mb-1">什麼是 SP？</p>
              <p>
                SP（Story Points）是衡量需求開發工作量的單位，綜合考量複雜度、工時與風險。點數越高代表工作量越大。
              </p>
            </div>
            <div className="py-4">
              <p className="font-medium text-foreground mb-1">SP 錢包</p>
              <p>每個子公司每年有固定的 SP 配額，所有需求共用此額度。</p>
              <ul className="mt-2 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0 mt-1.5" />
                  <span><span className="font-medium text-foreground">年度配額</span> — 管理者每年分配的 SP 總量</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                  <span><span className="font-medium text-foreground">已使用</span> — 依需求階段漸進消耗的 SP（需求確認 50%、MVP 確認後 80%、結案 100%）</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0 mt-1.5" />
                  <span><span className="font-medium text-foreground">可用餘額</span> — 配額 − 已使用</span>
                </li>
              </ul>
            </div>
            <div className="pt-4">
              <p className="font-medium text-foreground mb-1">預估 vs 確認</p>
              <p>
                提交需求時填寫「預估 SP」，進入開案確認階段後由管理者審核並確認為「確認 SP」，作為實際扣款依據。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SP 漸進消耗機制 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">SP 漸進消耗機制</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-4">
          <p>
            系統採用<span className="font-medium text-foreground">漸進式消耗</span>機制，需求提出即開始消耗 SP，
            避免需求者在 MVP 確認或驗收階段消極配合、不斷追加需求導致專案停擺。
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium text-foreground">階段</th>
                  <th className="pb-2 font-medium text-foreground text-center">消耗比例</th>
                  <th className="pb-2 font-medium text-foreground">說明</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-2.5"><Badge className="bg-blue-100 text-blue-700">需求確認</Badge></td>
                  <td className="py-2.5 text-center font-semibold text-foreground">50%</td>
                  <td className="py-2.5">需求提出後立即消耗一半，確保需求者審慎提出</td>
                </tr>
                <tr>
                  <td className="py-2.5"><Badge className="bg-amber-100 text-amber-700">MVP 確認</Badge></td>
                  <td className="py-2.5 text-center font-semibold text-foreground">80%</td>
                  <td className="py-2.5">MVP 架構確認後累計 80%，促進積極確認</td>
                </tr>
                <tr>
                  <td className="py-2.5">
                    <div className="flex flex-wrap gap-1">
                      <Badge className="bg-orange-100 text-orange-700">開案確認</Badge>
                      <Badge className="bg-violet-100 text-violet-700">開發中</Badge>
                      <Badge className="bg-purple-100 text-purple-700">驗收中</Badge>
                    </div>
                  </td>
                  <td className="py-2.5 text-center font-semibold text-foreground">80%</td>
                  <td className="py-2.5">維持 80% 直到結案</td>
                </tr>
                <tr>
                  <td className="py-2.5"><Badge className="bg-emerald-100 text-emerald-700">已結案</Badge></td>
                  <td className="py-2.5 text-center font-semibold text-foreground">100%</td>
                  <td className="py-2.5">完整消耗，結案時可進行 SP 調整</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-xs">
            <p className="font-medium text-foreground">Wallet 計算邏輯</p>
            <p>已使用 SP = Σ（各需求確認 SP × 該階段消耗比例）</p>
            <p>可用 SP = 年度配額 − 已使用 SP</p>
            <p>狀態變更時自動計算差額（delta）並更新錢包，支援前進與倒退。駁回時全額退還。</p>
          </div>
        </CardContent>
      </Card>

      {/* 常見問題 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">常見問題</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="q1">
              <AccordionTrigger>如何推進需求階段？</AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground">
                  在需求詳情頁確認該階段所有必要文件已上傳且關鍵動作已完成後，點擊「推進階段」按鈕即可將需求推進至下一階段。
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q2">
              <AccordionTrigger>如何調整子公司的 SP 配額？</AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground">
                  前往「管理設定」中的 SP 錢包管理功能，可為各子公司設定年度配額或進行追加。
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q3">
              <AccordionTrigger>需求被駁回後會怎樣？</AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground">
                  駁回後需求不再進入流程，佔用的 SP 會釋放。需求者需根據駁回原因重新建立新需求。
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </>
  )
}

export default function DocumentsPage() {
  const { user } = useAuth()
  const role = user?.role ?? "subsidiary"
  const isSubsidiary = role === "subsidiary"

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            使用指南
          </h1>
          <p className="text-muted-foreground">
            {isSubsidiary
              ? "了解如何提交需求、追蹤進度與管理 SP 點數"
              : "了解需求流程、SP 點數與各階段操作方式"}
          </p>
        </div>

        {isSubsidiary ? <SubsidiaryGuide /> : <AdminDeliveryGuide />}
      </div>
    </AppLayout>
  )
}

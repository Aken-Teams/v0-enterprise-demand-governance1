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

export default function DocumentsPage() {
  return (
    <AppLayout userRole="subsidiary">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            使用指南
          </h1>
          <p className="text-muted-foreground">
            了解需求流程、SP 點數與各階段操作方式
          </p>
        </div>

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
                            <div>
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
            <CardContent className="text-sm text-muted-foreground space-y-4">
              <div>
                <p className="font-medium text-foreground mb-1">什麼是 SP？</p>
                <p>
                  SP（Story Points）是衡量需求開發工作量的單位，綜合考量複雜度、工時與風險。點數越高代表工作量越大。
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">SP 錢包</p>
                <p>每個子公司每年有固定的 SP 配額，所有需求共用此額度。</p>
                <ul className="mt-2 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0 mt-1.5" />
                    <span><span className="font-medium text-foreground">年度配額</span> — 管理者每年分配的 SP 總量</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                    <span><span className="font-medium text-foreground">已使用</span> — 已結案需求消耗的 SP</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                    <span><span className="font-medium text-foreground">已承諾</span> — 開發中與驗收中需求佔用的 SP</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0 mt-1.5" />
                    <span><span className="font-medium text-foreground">可用餘額</span> — 配額 − 已使用 − 已承諾</span>
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">預估 vs 確認</p>
                <p>
                  提交需求時填寫「預估 SP」，進入開案確認階段後由管理者審核並確認為「確認 SP」，作為實際扣款依據。
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 常見問題 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">常見問題</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="q1">
                <AccordionTrigger>如何提交新需求？</AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">
                    前往「需求列表」，點擊「新增需求」，填寫標題、描述、預估 SP 與期望完成日期後送出。
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q2">
                <AccordionTrigger>SP 不夠用怎麼辦？</AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">
                    聯繫管理者申請追加配額，或將低優先級需求延後至下一年度。
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q3">
                <AccordionTrigger>需求被駁回後可以重新提交嗎？</AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">
                    駁回後無法直接恢復，請根據駁回原因修改後重新建立一筆新需求。
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

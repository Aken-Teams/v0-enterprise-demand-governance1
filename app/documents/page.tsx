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
  BookOpen,
  FileText,
  Workflow,
  Coins,
  AlertTriangle,
  HelpCircle,
} from "lucide-react"
import {
  STATUS_MAP,
  PIPELINE_STEPS,
  PHASE_DESCRIPTIONS,
  PHASE_ACTIONS,
  PHASE_DOCUMENT_MAP,
  DOCUMENT_TYPE_LABELS,
} from "@/lib/constants/demand"

const PRIORITY_DEFINITIONS = [
  {
    level: "低",
    color: "bg-green-100 text-green-700",
    description: "非緊急需求，可排入下一季度處理。不影響日常業務運作。",
  },
  {
    level: "中",
    color: "bg-blue-100 text-blue-700",
    description: "一般需求，建議在當季度內處理。可能影響部分業務效率。",
  },
  {
    level: "高",
    color: "bg-amber-100 text-amber-700",
    description: "重要需求，需優先安排處理。對業務運作有明顯影響。",
  },
  {
    level: "緊急",
    color: "bg-red-100 text-red-700",
    description: "緊急需求，需立即處理。嚴重影響業務運作或有合規風險。",
  },
]

export default function DocumentsPage() {
  return (
    <AppLayout userRole="subsidiary">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            使用指南與規範
          </h1>
          <p className="text-muted-foreground">
            了解系統功能、流程定義與操作方式
          </p>
        </div>

        {/* 需求生命週期 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Workflow className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">需求生命週期</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              每筆需求從提出到結案，會依序經過以下階段。每個階段都有對應的操作與文件要求。
            </p>
            <div className="flex flex-wrap gap-2">
              {PIPELINE_STEPS.map((step, i) => {
                const info = STATUS_MAP[step]
                return (
                  <div key={step} className="flex items-center gap-1.5">
                    <Badge className={info.color}>{info.label}</Badge>
                    {i < PIPELINE_STEPS.length - 1 && (
                      <span className="text-muted-foreground text-xs">→</span>
                    )}
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              ※ 需求在任何階段都可能被駁回（已駁回），駁回後不再進入流程。
            </p>
          </CardContent>
        </Card>

        {/* 各階段操作指引 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">各階段操作指引</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {PIPELINE_STEPS.map((step) => {
                const info = STATUS_MAP[step]
                const desc = PHASE_DESCRIPTIONS[step]
                const actions = PHASE_ACTIONS[step]
                const docs = PHASE_DOCUMENT_MAP[step]
                return (
                  <AccordionItem key={step} value={step}>
                    <AccordionTrigger>
                      <div className="flex items-center gap-2">
                        <Badge className={info.color}>{info.label}</Badge>
                        <span className="text-muted-foreground text-xs font-normal">
                          {desc}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pl-1">
                        {actions.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-foreground mb-1">
                              關鍵動作
                            </p>
                            <ul className="text-xs text-muted-foreground space-y-0.5">
                              {actions.map((a, i) => (
                                <li key={i}>• {a}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {docs.required.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-foreground mb-1">
                              必要文件
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {docs.required.map((d) => (
                                <Badge
                                  key={d}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {DOCUMENT_TYPE_LABELS[d] ?? d}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {docs.optional.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-foreground mb-1">
                              可選文件
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {docs.optional.map((d) => (
                                <Badge
                                  key={d}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {DOCUMENT_TYPE_LABELS[d] ?? d}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {actions.length === 0 &&
                          docs.required.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              此階段為結案狀態，無需額外操作。
                            </p>
                          )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </CardContent>
        </Card>

        {/* SP 點數說明 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">SP 點數說明</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              SP（Story Points）是衡量需求開發工作量的單位。每個子公司每年有固定的
              SP 配額，用於分配至各項需求。
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs font-medium text-foreground">年度配額</p>
                <p className="text-xs mt-0.5">
                  每年由管理者分配給各子公司的 SP 總量
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs font-medium text-foreground">已使用</p>
                <p className="text-xs mt-0.5">
                  已結案需求所消耗的 SP 點數
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs font-medium text-foreground">已承諾</p>
                <p className="text-xs mt-0.5">
                  開發中與驗收中需求已佔用的 SP 點數
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs font-medium text-foreground">可用餘額</p>
                <p className="text-xs mt-0.5">
                  配額 − 已使用 − 已承諾 = 可用於新需求的 SP
                </p>
              </div>
            </div>
            <p className="text-xs">
              ※ 需求提出時填寫的是「預估 SP」，在開案確認階段由管理者確認為「確認
              SP」。
            </p>
          </CardContent>
        </Card>

        {/* 優先級定義 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">優先級定義</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {PRIORITY_DEFINITIONS.map((p) => (
                <div
                  key={p.level}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <Badge className={`${p.color} shrink-0`}>{p.level}</Badge>
                  <p className="text-xs text-muted-foreground">
                    {p.description}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 文件類型定義 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">文件類型定義</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              以下是系統中各類文件的用途說明，協助您了解每個階段需要準備的內容。
            </p>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="meeting">
                <AccordionTrigger>
                  <span>會議記錄（Meeting Notes）</span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-muted-foreground">
                    需求訪談時的會議紀錄，記錄需求者的核心訴求、業務背景、期望目標與時程。用於需求確認階段，確保雙方對需求理解一致。
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="prd">
                <AccordionTrigger>
                  <span>PRD 需求規格書</span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-muted-foreground">
                    產品需求規格書（Product Requirements
                    Document），由 PM
                    撰寫。詳述功能範圍、使用者故事、介面流程、技術限制與驗收標準。是開發團隊的主要依據文件。
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="sp-plan">
                <AccordionTrigger>
                  <span>SP 規劃文件</span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-muted-foreground">
                    SP
                    點數分配與時程規劃文件。記錄各開發階段的
                    SP 分配、甘特圖時程、人力安排與風險評估。用於開案確認階段。
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="sdd">
                <AccordionTrigger>
                  <span>SDD 系統設計文件</span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-muted-foreground">
                    系統設計文件（System Design
                    Document），描述系統架構、模組設計、資料庫設計、API
                    規格與技術選型。由工程師在開發階段產出。
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="bdd">
                <AccordionTrigger>
                  <span>BDD 行為驅動開發文件</span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-muted-foreground">
                    行為驅動開發文件（Behavior Driven
                    Development），以使用者行為角度撰寫測試場景（Given-When-Then
                    格式）。確保開發結果符合業務需求。用於驗收階段。
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="tdd">
                <AccordionTrigger>
                  <span>TDD 測試驅動開發文件</span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-muted-foreground">
                    測試驅動開發文件（Test Driven
                    Development），記錄單元測試、整合測試的設計與執行結果。確保程式碼品質與功能正確性。用於驗收階段。
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="test-report">
                <AccordionTrigger>
                  <span>測試報告</span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-muted-foreground">
                    完整的測試執行報告，包含測試範圍、測試案例、通過/失敗統計、缺陷清單與結論。用於驗收階段，作為品質判定依據。
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="app-result">
                <AccordionTrigger>
                  <span>APP 交付成果</span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-muted-foreground">
                    開發完成的應用程式成果，可包含部署連結、安裝包或展示截圖。用於開發階段，展示實際開發產出。
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* 常見問題 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">常見問題</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="q1">
                <AccordionTrigger>如何提交新需求？</AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-muted-foreground">
                    前往「需求列表」頁面，點擊右上角的「新增需求」按鈕。填寫需求標題、描述、預估
                    SP 與期望完成日期後送出即可。需求將自動進入「需求確認」階段。
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q2">
                <AccordionTrigger>
                  SP 不夠用怎麼辦？
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-muted-foreground">
                    請聯繫管理者申請追加 SP
                    配額，或調整現有需求的優先級，將低優先級需求延後至下一年度。
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q3">
                <AccordionTrigger>需求被駁回後可以重新提交嗎？</AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-muted-foreground">
                    被駁回的需求無法直接恢復。請根據駁回原因修改內容後，重新建立一筆新需求提交。
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q4">
                <AccordionTrigger>如何查看需求的處理進度？</AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-muted-foreground">
                    前往「需求列表」頁面，點擊任一需求可查看詳細進度。包含目前所在階段、已上傳的文件、指派的團隊成員與時程資訊。
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q5">
                <AccordionTrigger>驗收不通過怎麼處理？</AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-muted-foreground">
                    驗收不通過時，需求會退回開發階段進行修正。工程師修復問題後會重新提交驗收，直到通過標準為止。
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

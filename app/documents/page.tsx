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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FileSearch } from "lucide-react"
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
  ATDD: "以使用者驗收標準驅動的測試案例設計",
  ATTACHMENT: "一般附件",
  AUDIO: "音訊檔案",
  VIDEO: "影片檔案",
}

/** 必填文件的標準格式說明 */
const DOC_STANDARD_FORMAT: Record<string, { sections: { title: string; content: string }[] }> = {
  MEETING_NOTES: {
    sections: [
      { title: "會議基本資訊", content: "日期、時間、地點、與會人員" },
      { title: "需求背景", content: "需求提出的原因、目前遇到的問題" },
      { title: "核心需求", content: "需求者期望的功能與目標，依優先級排列" },
      { title: "預期效益", content: "預計帶來的效益或改善" },
      { title: "待確認事項", content: "需進一步釐清的問題" },
      { title: "下一步行動", content: "雙方的後續行動與時程" },
    ],
  },
  PRD: {
    sections: [
      { title: "需求概述", content: "需求背景、目標與範圍定義" },
      { title: "使用者故事", content: "以使用者角度描述功能需求（As a... I want... So that...）" },
      { title: "功能規格", content: "詳細的功能描述、頁面流程、欄位定義" },
      { title: "非功能需求", content: "效能、安全性、相容性等要求" },
      { title: "驗收標準", content: "每個功能的驗收條件，明確且可衡量" },
      { title: "附錄", content: "UI 原型、流程圖、參考資料" },
    ],
  },
  SP_PLAN: {
    sections: [
      { title: "SP 總點數", content: "需求的總 SP 點數與分配依據" },
      { title: "各階段 SP 分配", content: "每個開發階段的 SP 點數" },
      { title: "甘特圖時程", content: "各階段的計畫開始與結束時間" },
      { title: "主要開發模組", content: "需開發的模組清單、功能說明與預估 SP" },
    ],
  },
  SDD: {
    sections: [
      { title: "系統架構", content: "整體架構圖、技術棧選擇" },
      { title: "資料庫設計", content: "ER 圖、資料表結構與關聯" },
      { title: "API 規格", content: "API 端點、請求/回應格式" },
      { title: "模組設計", content: "各模組職責與介面定義" },
    ],
  },
  BDD: {
    sections: [
      { title: "格式", content: "以 Given-When-Then 格式撰寫" },
      { title: "Given（前置條件）", content: "描述測試場景的初始狀態" },
      { title: "When（操作動作）", content: "使用者執行的操作" },
      { title: "Then（預期結果）", content: "操作後系統應產生的結果" },
      { title: "涵蓋範圍", content: "應涵蓋所有主要功能流程與邊界情境" },
    ],
  },
  TDD: {
    sections: [
      { title: "測試範圍", content: "單元測試與整合測試的涵蓋範圍" },
      { title: "測試案例", content: "每個功能模組的測試案例清單" },
      { title: "測試結果", content: "各測試案例的通過/失敗狀態" },
      { title: "覆蓋率", content: "程式碼覆蓋率統計" },
    ],
  },
  ATDD: {
    sections: [
      { title: "驗收標準", content: "根據需求規格定義的驗收條件，以使用者角度撰寫" },
      { title: "測試場景", content: "以 Given-When-Then 格式描述驗收測試場景" },
      { title: "測試資料", content: "測試所需的前置資料與環境準備" },
      { title: "預期結果", content: "每個場景的預期行為與輸出" },
      { title: "執行結果", content: "各場景的通過/失敗狀態與截圖佐證" },
    ],
  },
  TEST_REPORT: {
    sections: [
      { title: "測試摘要", content: "測試環境、測試日期、測試人員" },
      { title: "測試範圍", content: "本次測試涵蓋的功能模組" },
      { title: "測試結果", content: "總測試數、通過數、失敗數、通過率" },
      { title: "缺陷清單", content: "未通過項目的描述、嚴重程度、修復狀態" },
      { title: "結論與建議", content: "是否建議上線、待修復項目" },
    ],
  },
}

/** 需求者簽核階段的審核指引 */
const SIGNOFF_REVIEW_GUIDE: Record<string, { summary: string; points: string[] }> = {
  PRD_REVIEW: {
    summary: "確認 PRD 內容與 MVP 架構方向是否符合您的需求",
    points: [
      "功能範圍是否與您的需求一致",
      "驗收標準是否明確且可衡量",
      "使用者流程是否符合實際操作情境",
      "是否有遺漏的功能需求",
      "MVP 架構方向是否符合期望",
    ],
  },
  SP_REVIEW: {
    summary: "確認 SP 點數與開發時程是否可接受",
    points: [
      "確認 SP 點數是否在預算範圍內",
      "各階段時程安排是否合理",
      "甘特圖的里程碑是否可接受",
    ],
  },
  ACCEPTANCE: {
    summary: "驗收開發成果是否符合需求規格與品質標準",
    points: [
      "實際操作 APP 確認所有功能正常運作",
      "對照 PRD 驗收標準逐項確認",
      "測試報告通過率是否達標",
      "是否有未修復的重大缺陷",
      "BDD 測試場景是否涵蓋主要功能",
    ],
  },
  CLOSED: {
    summary: "最終確認交付成果完整，同意結案",
    points: [
      "確認所有需求功能皆已完成",
      "確認 APP 運行正常無重大問題",
      "確認 SP 點數結算正確",
    ],
  },
}

const SUBSIDIARY_PHASE_DETAIL: Record<string, { desc: string; actions: string[]; note?: string }> = {
  SUBMITTED: {
    desc: "管理者與您面談確認需求內容",
    actions: ["與管理者進行需求訪談", "確認需求範圍與期望目標"],
    note: "此階段不列入 SP 扣除範圍，待進入 MVP 確認後才開始計算消耗。",
  },
  PRD_REVIEW: {
    desc: "PM 撰寫需求規格書，工程師進行架構設計",
    actions: ["收到 PRD 後審閱需求規格是否正確", "確認 MVP 架構方向", "簽核確認 PRD 內容"],
    note: "進入此階段後開始計算消耗（需求訪談 50% + MVP 30% = 80%）。",
  },
  SP_REVIEW: {
    desc: "管理者確認 SP 點數與開發時程",
    actions: ["查看管理者核定的確認 SP 與時程", "簽核確認開案"],
  },
  DEVELOPING: {
    desc: "工程師進行開發，產出系統設計與成果",
    actions: ["可隨時查看甘特圖追蹤進度", "查看交付成果頁面預覽 APP"],
    note: "開發期間如有問題可聯繫需求者窗口。",
  },
  ACCEPTANCE: {
    desc: "您驗收開發成果，確認是否符合需求",
    actions: ["查看測試報告與 BDD/TDD 文件", "實際操作 APP 確認功能", "簽核通過或退回修正"],
    note: "驗收不通過會退回開發階段重新修正。",
  },
  CLOSED: {
    desc: "需求完成結案，SP 點數結算",
    actions: [],
    note: "結案後 SP 完整消耗 100%，若有 SP 調整以調整後為準。",
  },
}

/* ─── 需求者（subsidiary）看到的內容 ─── */
function SubsidiaryGuide() {
  return (
    <>
      <div className="grid gap-4 sm:gap-6 md:grid-cols-[1fr_1fr]">
        {/* 需求處理流程 */}
        <Card>
          <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
            <CardTitle className="text-sm sm:text-base">各階段說明</CardTitle>
            <p className="text-xs sm:text-sm text-muted-foreground">您提交的需求會依序經過以下階段，點擊可查看詳細說明</p>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <Accordion type="single" collapsible className="w-full">
              {PIPELINE_STEPS.map((step) => {
                const info = STATUS_MAP[step]
                const detail = SUBSIDIARY_PHASE_DETAIL[step]
                return (
                  <AccordionItem key={step} value={step}>
                    <AccordionTrigger>
                      <div className="flex items-center gap-2 sm:gap-3 text-left">
                        <Badge className={`${info.color} shrink-0 text-[10px] sm:text-xs`}>{info.label}</Badge>
                        <span className="text-xs sm:text-sm text-muted-foreground font-normal">
                          {detail.desc}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {(() => {
                        const docs = PHASE_DOCUMENT_MAP[step]
                        const allDocs = docs ? [...docs.required, ...docs.optional] : []
                        const reviewGuide = SIGNOFF_REVIEW_GUIDE[step]
                        return (
                          <div className="space-y-3 pl-1 sm:pl-2">
                            {detail.actions.length > 0 && (
                              <div>
                                <p className="text-xs sm:text-sm font-medium text-foreground mb-1.5 sm:mb-2">您需要做的事</p>
                                <ul className="space-y-1 text-xs sm:text-sm text-muted-foreground">
                                  {detail.actions.map((a, i) => (
                                    <li key={i} className="flex items-center gap-2">
                                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                                      {a}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {allDocs.length > 0 && (
                              <div className={detail.actions.length > 0 ? "border-t pt-3" : ""}>
                                <p className="text-xs sm:text-sm font-medium text-foreground mb-1.5 sm:mb-2">相關文件</p>
                                <div className="space-y-1.5">
                                  {allDocs.map((d) => {
                                    const isRequired = docs!.required.includes(d)
                                    return (
                                      <div key={d} className="flex flex-wrap items-baseline gap-1 sm:gap-2 text-xs sm:text-sm">
                                        <span className="font-medium text-foreground shrink-0">
                                          {DOCUMENT_TYPE_LABELS[d] ?? d}
                                        </span>
                                        {isRequired ? (
                                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">必填</Badge>
                                        ) : (
                                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">選填</Badge>
                                        )}
                                        {DOC_DESCRIPTIONS[d] && (
                                          <span className="text-muted-foreground text-[10px] sm:text-xs">{DOC_DESCRIPTIONS[d]}</span>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                            {reviewGuide && (
                              <div className="border-t pt-3">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <button className="flex items-center gap-2 text-xs sm:text-sm text-blue-600 hover:text-blue-700 hover:underline transition-colors">
                                      <FileSearch className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                      需求者審核指引
                                    </button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md p-4 sm:p-6">
                                    <DialogHeader>
                                      <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                                        <Badge className={`${info.color} text-[10px] sm:text-xs`}>{info.label}</Badge>
                                        審核指引
                                      </DialogTitle>
                                    </DialogHeader>
                                    <div className="mt-2 space-y-2 sm:space-y-3">
                                      <p className="text-xs sm:text-sm text-muted-foreground">{reviewGuide.summary}</p>
                                      <div className="bg-muted/40 rounded-lg p-2.5 sm:p-3">
                                        <p className="text-[10px] sm:text-xs font-medium text-foreground mb-1.5 sm:mb-2">審核重點</p>
                                        <ul className="space-y-1.5">
                                          {reviewGuide.points.map((point, pi) => (
                                            <li key={pi} className="flex items-start gap-2 text-[10px] sm:text-xs text-muted-foreground">
                                              <span className="h-1 w-1 rounded-full bg-blue-400 shrink-0 mt-1.5" />
                                              {point}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            )}
                            {detail.note && (
                              <p className="text-[10px] sm:text-xs text-muted-foreground/70 border-t pt-2">※ {detail.note}</p>
                            )}
                            {detail.actions.length === 0 && allDocs.length === 0 && !reviewGuide && (
                              <p className="text-xs sm:text-sm text-muted-foreground">此階段為結案狀態，無需額外操作。</p>
                            )}
                          </div>
                        )
                      })()}
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-3 sm:mt-4">
              ※ 需求在任何階段都可能被駁回。駁回後需重新建立新需求。
            </p>
          </CardContent>
        </Card>

        {/* SP 點數（需求者版） */}
        <Card>
          <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
            <CardTitle className="text-sm sm:text-base">SP 點數</CardTitle>
          </CardHeader>
          <CardContent className="text-xs sm:text-sm text-muted-foreground divide-y px-4 sm:px-6">
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
                  <span><span className="font-medium text-foreground">已使用</span> — 依需求階段漸進消耗的 SP（需求訪談 50% + MVP 30% = 80%、結案 +20% = 100%；僅需求確認階段不列入扣除）</span>
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
        <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
          <CardTitle className="text-sm sm:text-base">SP 漸進消耗機制</CardTitle>
        </CardHeader>
        <CardContent className="text-xs sm:text-sm text-muted-foreground space-y-3 sm:space-y-4 px-4 sm:px-6">
          <p>
            系統採用<span className="font-medium text-foreground">漸進式消耗</span>機制，以<span className="font-medium text-foreground">審核通過</span>為計算基準。
            需求確認與 MVP 審核中的需求<span className="font-medium text-foreground">不列入 SP 扣除範圍</span>，待 MVP 架構確認<span className="font-medium text-foreground">審核通過</span>後才開始計算消耗 80%，結案<span className="font-medium text-foreground">審核通過</span>時達到 100%。
          </p>

          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium text-foreground">階段</th>
                  <th className="pb-2 font-medium text-foreground text-center">累計消耗</th>
                  <th className="pb-2 font-medium text-foreground text-center hidden sm:table-cell">階段增量</th>
                  <th className="pb-2 font-medium text-foreground hidden sm:table-cell">說明</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-2 sm:py-2.5"><Badge className="bg-blue-100 text-blue-700 text-[10px] sm:text-xs">需求確認</Badge></td>
                  <td className="py-2 sm:py-2.5 text-center text-muted-foreground">—</td>
                  <td className="py-2 sm:py-2.5 text-center text-muted-foreground hidden sm:table-cell">—</td>
                  <td className="py-2 sm:py-2.5 hidden sm:table-cell">僅需求訪談，不列入 SP 扣除範圍</td>
                </tr>
                <tr>
                  <td className="py-2 sm:py-2.5"><Badge className="bg-amber-100 text-amber-700 text-[10px] sm:text-xs">MVP 確認</Badge></td>
                  <td className="py-2 sm:py-2.5 text-center text-muted-foreground">—</td>
                  <td className="py-2 sm:py-2.5 text-center text-muted-foreground hidden sm:table-cell">—</td>
                  <td className="py-2 sm:py-2.5 hidden sm:table-cell">審核通過前不計算消耗</td>
                </tr>
                <tr>
                  <td className="py-2 sm:py-2.5">
                    <div className="flex flex-wrap gap-1">
                      <Badge className="bg-orange-100 text-orange-700 text-[10px] sm:text-xs">開案確認</Badge>
                      <Badge className="bg-violet-100 text-violet-700 text-[10px] sm:text-xs">開發中</Badge>
                      <Badge className="bg-purple-100 text-purple-700 text-[10px] sm:text-xs">驗收中</Badge>
                    </div>
                  </td>
                  <td className="py-2 sm:py-2.5 text-center font-semibold text-foreground">80%</td>
                  <td className="py-2 sm:py-2.5 text-center text-foreground hidden sm:table-cell">訪談 50% + MVP 30%</td>
                  <td className="py-2.5">MVP 審核通過後一次起算 80%</td>
                </tr>
                <tr>
                  <td className="py-2 sm:py-2.5"><Badge className="bg-emerald-100 text-emerald-700 text-[10px] sm:text-xs">已結案</Badge></td>
                  <td className="py-2 sm:py-2.5 text-center font-semibold text-foreground">100%</td>
                  <td className="py-2 sm:py-2.5 text-center text-foreground hidden sm:table-cell">+20%</td>
                  <td className="py-2 sm:py-2.5 hidden sm:table-cell">結案審核通過後完整消耗全部 SP</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border bg-muted/30 p-2.5 sm:p-3 space-y-1.5 sm:space-y-2">
            <p className="font-medium text-foreground text-[10px] sm:text-xs">計算範例</p>
            <p className="text-[10px] sm:text-xs">
              假設一筆需求預估 <span className="font-semibold text-foreground">20 SP</span>：
            </p>
            <ul className="text-[10px] sm:text-xs space-y-1">
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-muted-foreground/50 shrink-0" />
                提出需求（需求確認） → 消耗 <span className="font-semibold text-foreground">0 SP</span>（僅訪談，不扣除）
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-muted-foreground/50 shrink-0" />
                MVP 審核中 → 消耗 <span className="font-semibold text-foreground">0 SP</span>（審核通過前不計算）
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-muted-foreground/50 shrink-0" />
                MVP 審核通過（進入開案） → 消耗 <span className="font-semibold text-foreground">16 SP</span>（20 × 80%）
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-muted-foreground/50 shrink-0" />
                結案審核通過 → 完整消耗 <span className="font-semibold text-foreground">20 SP</span>（20 × 100%）
              </li>
            </ul>
          </div>

          <p className="text-[10px] sm:text-xs text-muted-foreground/70">
            ※ 需求被駁回（取消／暫緩）時，已消耗的 SP 會全數退還。結案時若有 SP 調整（增減），以調整後的 SP 為準計算。
          </p>
        </CardContent>
      </Card>

      {/* 設計變更流程（需求者視角） */}
      <Card>
        <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <Badge className="bg-indigo-100 text-indigo-700 text-[10px] sm:text-xs">設計變更</Badge>
            流程說明
          </CardTitle>
          <p className="text-xs sm:text-sm text-muted-foreground">
            設計變更是用於記錄專案進行中需求內容新增或調整的機制，
            通知工程團隊有新任務並作為後續 SP 增減的依據。此流程非必要，僅在需要留下正式紀錄時啟動。
          </p>
        </CardHeader>
        <CardContent className="text-xs sm:text-sm text-muted-foreground space-y-3 sm:space-y-4 px-4 sm:px-6">
          <div>
            <p className="font-medium text-foreground mb-1.5 sm:mb-2">可發起階段</p>
            <p>
              僅能在以下三個階段發起設計變更：
              <Badge className="ml-1 bg-amber-100 text-amber-700 text-[10px] sm:text-xs">MVP 確認</Badge>
              <Badge className="ml-1 bg-orange-100 text-orange-700 text-[10px] sm:text-xs">開案確認</Badge>
              <Badge className="ml-1 bg-purple-100 text-purple-700 text-[10px] sm:text-xs">驗收中</Badge>
            </p>
          </div>

          <div className="border-t pt-3">
            <p className="font-medium text-foreground mb-1.5 sm:mb-2">審核流程</p>
            <ol className="space-y-1.5 list-decimal list-inside">
              <li>收到設計變更通知後，進入需求詳情頁</li>
              <li>閱讀變更原因與上傳的附件</li>
              <li>判斷是否認同此次需求內容的調整</li>
              <li>選擇<span className="font-medium text-foreground">通過</span>或<span className="font-medium text-foreground">退回</span>（退回時請填寫原因）</li>
            </ol>
          </div>

          <div className="border-t pt-3">
            <p className="font-medium text-foreground mb-2">重要說明</p>
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                <span>
                  設計變更期間，階段狀態會顯示為
                  <span className="font-medium text-foreground mx-1">「階段名稱 - 設計變更」</span>
                  （例如：驗收中 - 設計變更）。
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                <span>
                  <span className="font-medium text-foreground">通過設計變更 ≠ 通過該階段簽核。</span>
                  設計變更僅表示認同需求內容有新增／調整；階段簽核（MVP／開案／驗收）仍須另行完成。
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                <span>
                  審核人為<span className="font-medium text-foreground">需求窗口</span>（必要）；若有指派<span className="font-medium text-foreground">主管</span>則兩位皆須通過才算完成。
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                <span>
                  通過後<span className="font-medium text-foreground">不會</span>自動調整需求狀態或 SP 點數，相關 SP 增減於結案時一併處理。
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                <span>
                  退回時請填寫原因（例如：紀錄內容不完整、變更已不需要）。發起人會依原因決定補充資訊重新發起，或不再發起。
                </span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 如何使用系統 */}
      <Card>
        <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
          <CardTitle className="text-sm sm:text-base">如何使用系統</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="track">
              <AccordionTrigger>
                <span className="text-xs sm:text-sm">追蹤需求進度</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="text-xs sm:text-sm text-muted-foreground space-y-2">
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
                <span className="text-xs sm:text-sm">查看 SP 錢包</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="text-xs sm:text-sm text-muted-foreground space-y-2">
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
                <span className="text-xs sm:text-sm">驗收需求</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="text-xs sm:text-sm text-muted-foreground space-y-2">
                  <p>當需求進入「驗收中」階段，您需要：</p>
                  <ol className="space-y-1 list-decimal list-inside">
                    <li>查看工程師提供測試報告和確認清單</li>
                    <li>確認開發成果是否符合需求</li>
                    <li>通過驗收後需求進入「已結案」</li>
                  </ol>
                  <p className="text-[10px] sm:text-xs">驗收不通過會退回開發階段重新修正。</p>
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
      <div className="grid gap-4 sm:gap-6 md:grid-cols-[1fr_1fr]">
        {/* 各階段說明 */}
        <Card>
          <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
            <CardTitle className="text-sm sm:text-base">各階段說明</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <Accordion type="single" collapsible className="w-full">
              {PIPELINE_STEPS.map((step) => {
                const info = STATUS_MAP[step]
                const actions = PHASE_ACTIONS[step]
                const docs = PHASE_DOCUMENT_MAP[step]
                const allDocs = [...docs.required, ...docs.optional]
                return (
                  <AccordionItem key={step} value={step}>
                    <AccordionTrigger>
                      <div className="flex items-center gap-2 sm:gap-3 text-left">
                        <Badge className={`${info.color} shrink-0 text-[10px] sm:text-xs`}>{info.label}</Badge>
                        <span className="text-xs sm:text-sm text-muted-foreground font-normal">
                          {PHASE_DESCRIPTIONS[step]}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 sm:space-y-4 pl-1 sm:pl-2">
                        {actions.length > 0 && (
                          <div>
                            <p className="text-xs sm:text-sm font-medium text-foreground mb-1.5 sm:mb-2">關鍵動作</p>
                            <ul className="space-y-1 text-xs sm:text-sm text-muted-foreground">
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
                            <p className="text-xs sm:text-sm font-medium text-foreground mb-1.5 sm:mb-2">相關文件</p>
                            <div className="space-y-1.5 sm:space-y-2">
                              {allDocs.map((d) => (
                                <div key={d} className="flex flex-wrap items-baseline gap-1 sm:gap-2 text-xs sm:text-sm">
                                  <span className="font-medium text-foreground shrink-0">
                                    {DOCUMENT_TYPE_LABELS[d] ?? d}
                                  </span>
                                  {docs.required.includes(d) ? (
                                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">必填</Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">選填</Badge>
                                  )}
                                  {DOC_DESCRIPTIONS[d] && (
                                    <span className="text-muted-foreground text-[10px] sm:text-xs">{DOC_DESCRIPTIONS[d]}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {actions.length === 0 && allDocs.length === 0 && (
                          <p className="text-xs sm:text-sm text-muted-foreground">此階段為結案狀態，無需額外操作。</p>
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
          <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
            <CardTitle className="text-sm sm:text-base">SP 點數</CardTitle>
          </CardHeader>
          <CardContent className="text-xs sm:text-sm text-muted-foreground divide-y px-4 sm:px-6">
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
                  <span><span className="font-medium text-foreground">已使用</span> — 依需求階段漸進消耗的 SP（需求訪談 50% + MVP 30% = 80%、結案 +20% = 100%；僅需求確認階段不列入扣除）</span>
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
        <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
          <CardTitle className="text-sm sm:text-base">SP 漸進消耗機制</CardTitle>
        </CardHeader>
        <CardContent className="text-xs sm:text-sm text-muted-foreground space-y-3 sm:space-y-4 px-4 sm:px-6">
          <p>
            系統採用<span className="font-medium text-foreground">漸進式消耗</span>機制，以<span className="font-medium text-foreground">審核通過</span>為計算基準。
            需求確認與 MVP 審核中的需求<span className="font-medium text-foreground">不列入 SP 扣除範圍</span>，待 MVP 架構確認<span className="font-medium text-foreground">審核通過</span>後才開始計算消耗 80%，結案<span className="font-medium text-foreground">審核通過</span>時達到 100%。
          </p>

          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium text-foreground">階段</th>
                  <th className="pb-2 font-medium text-foreground text-center">累計消耗</th>
                  <th className="pb-2 font-medium text-foreground text-center hidden sm:table-cell">階段增量</th>
                  <th className="pb-2 font-medium text-foreground hidden sm:table-cell">說明</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-2.5"><Badge className="bg-blue-100 text-blue-700">需求確認</Badge></td>
                  <td className="py-2.5 text-center text-muted-foreground">—</td>
                  <td className="py-2.5 text-center text-muted-foreground">—</td>
                  <td className="py-2.5">僅需求訪談不列入扣除範圍</td>
                </tr>
                <tr>
                  <td className="py-2.5"><Badge className="bg-amber-100 text-amber-700">MVP 確認</Badge></td>
                  <td className="py-2.5 text-center text-muted-foreground">—</td>
                  <td className="py-2.5 text-center text-muted-foreground">—</td>
                  <td className="py-2.5">審核通過前不計算消耗</td>
                </tr>
                <tr>
                  <td className="py-2 sm:py-2.5">
                    <div className="flex flex-wrap gap-1">
                      <Badge className="bg-orange-100 text-orange-700 text-[10px] sm:text-xs">開案確認</Badge>
                      <Badge className="bg-violet-100 text-violet-700 text-[10px] sm:text-xs">開發中</Badge>
                      <Badge className="bg-purple-100 text-purple-700 text-[10px] sm:text-xs">驗收中</Badge>
                    </div>
                  </td>
                  <td className="py-2 sm:py-2.5 text-center font-semibold text-foreground">80%</td>
                  <td className="py-2 sm:py-2.5 text-center text-foreground hidden sm:table-cell">訪談 50% + MVP 30%</td>
                  <td className="py-2.5">MVP 審核通過後一次起算 80%</td>
                </tr>
                <tr>
                  <td className="py-2 sm:py-2.5"><Badge className="bg-emerald-100 text-emerald-700 text-[10px] sm:text-xs">已結案</Badge></td>
                  <td className="py-2 sm:py-2.5 text-center font-semibold text-foreground">100%</td>
                  <td className="py-2 sm:py-2.5 text-center text-foreground hidden sm:table-cell">+20%</td>
                  <td className="py-2 sm:py-2.5 hidden sm:table-cell">結案審核通過後完整消耗，可進行 SP 調整</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border bg-muted/30 p-2.5 sm:p-3 space-y-1.5 text-[10px] sm:text-xs">
            <p className="font-medium text-foreground">Wallet 計算邏輯</p>
            <p>已使用 SP = Σ（各需求確認 SP × 該階段消耗比例）</p>
            <p>可用 SP = 年度配額 − 已使用 SP</p>
            <p>狀態變更時自動計算差額（delta）並更新錢包，支援前進與倒退。駁回時全額退還。</p>
            <p className="text-muted-foreground/70">※ 需求確認與 MVP 審核中的需求 SP 不計入已使用</p>
            <p className="text-muted-foreground/70">※ SP 消耗以審核通過為準，MVP 通過才起算 80%，結案通過才達 100%</p>
          </div>
        </CardContent>
      </Card>

      {/* 設計變更流程（管理/交付視角） */}
      <Card>
        <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <Badge className="bg-indigo-100 text-indigo-700 text-[10px] sm:text-xs">設計變更</Badge>
            流程說明
          </CardTitle>
          <p className="text-xs sm:text-sm text-muted-foreground">
            設計變更是用於記錄專案進行中需求內容新增或調整的機制，通知工程團隊有新任務並作為結案時 SP 增減的依據。
            此流程非必要，僅在需要留下正式紀錄時發起。
          </p>
        </CardHeader>
        <CardContent className="text-xs sm:text-sm text-muted-foreground space-y-3 sm:space-y-4 px-4 sm:px-6">
          <div>
            <p className="font-medium text-foreground mb-1.5 sm:mb-2">可發起階段</p>
            <p>
              僅能在以下三個階段發起：
              <Badge className="ml-1 bg-amber-100 text-amber-700 text-[10px] sm:text-xs">MVP 確認</Badge>
              <Badge className="ml-1 bg-orange-100 text-orange-700 text-[10px] sm:text-xs">開案確認</Badge>
              <Badge className="ml-1 bg-purple-100 text-purple-700 text-[10px] sm:text-xs">驗收中</Badge>
            </p>
          </div>

          <div className="border-t pt-3">
            <p className="font-medium text-foreground mb-2">發起流程</p>
            <ol className="space-y-1.5 list-decimal list-inside">
              <li>於需求詳情頁點擊「提出設計變更」按鈕</li>
              <li>填寫<span className="font-medium text-foreground">變更原因</span>（必填），說明新增或調整的需求內容</li>
              <li>上傳相關附件（會議紀錄、修訂的設計稿等）</li>
              <li>確認審核名單後送出，系統會自動通知所有審核人</li>
            </ol>
          </div>

          <div className="border-t pt-3">
            <p className="font-medium text-foreground mb-2">審核人員</p>
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0 mt-1.5" />
                <span>
                  <span className="font-medium text-foreground">需求窗口（必要）</span> — 未指派時無法發起，請先完成指派
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0 mt-1.5" />
                <span>
                  <span className="font-medium text-foreground">主管（若有指派）</span> — 兩位皆須通過才算完成
                </span>
              </li>
            </ul>
          </div>

          <div className="border-t pt-3">
            <p className="font-medium text-foreground mb-2">重要說明</p>
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                <span>
                  設計變更期間，階段狀態會顯示為
                  <span className="font-medium text-foreground mx-1">「階段名稱 - 設計變更」</span>
                  （例如：驗收中 - 設計變更）。
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                <span>
                  設計變更<span className="font-medium text-foreground">僅為紀錄</span>，與階段簽核為獨立流程，通過後不自動改變需求狀態、SP 或既有簽核。
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                <span>
                  相關的 SP 增減請於<span className="font-medium text-foreground">結案階段</span>一併調整，勿於中途修改已確認的 SP。
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                <span>
                  同一階段同時僅能存在一筆尚未完成（未被通過或退回）的設計變更。
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                <span>
                  被退回時請依退回原因判斷：若是資訊不足，補充後再次發起；若變更本身不成立，則無需再發起。
                </span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 常見問題 */}
      <Card>
        <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
          <CardTitle className="text-sm sm:text-base">常見問題</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="q1">
              <AccordionTrigger className="text-xs sm:text-sm">如何推進需求階段？</AccordionTrigger>
              <AccordionContent>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  在需求詳情頁確認該階段所有必要文件已上傳且關鍵動作已完成後，點擊「推進階段」按鈕即可將需求推進至下一階段。
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q2">
              <AccordionTrigger className="text-xs sm:text-sm">如何調整子公司的 SP 配額？</AccordionTrigger>
              <AccordionContent>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  前往「管理設定」中的 SP 錢包管理功能，可為各子公司設定年度配額或進行追加。
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q3">
              <AccordionTrigger className="text-xs sm:text-sm">需求被駁回後會怎樣？</AccordionTrigger>
              <AccordionContent>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  駁回後需求不再進入流程，佔用的 SP 會釋放。需求者需根據駁回原因重新建立新需求。
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q4">
              <AccordionTrigger className="text-xs sm:text-sm">什麼情況該用設計變更而不是駁回？</AccordionTrigger>
              <AccordionContent>
                <div className="text-xs sm:text-sm text-muted-foreground space-y-2 sm:space-y-3">
                  <p>
                    簡單說：
                    <span className="text-red-700 font-medium">駁回</span>是「目前完成的內容不符合需求方要求」；
                    <span className="text-indigo-700 font-medium">設計變更</span>是「需求方有新需求，且認為需要討論」。
                  </p>
                  <div className="rounded-md border border-red-200 bg-red-50/40 p-2.5 sm:p-3 space-y-1.5">
                    <p className="font-medium text-red-900">駁回 — 現有內容不符合要求</p>
                    <ul className="text-red-900/80 space-y-1 list-none">
                      <li>• 觸發：審核者在簽核當下選擇不通過</li>
                      <li>• 影響：當前階段簽核不通過，需依退回原因補充或修正後重新提交，流程暫停在該階段</li>
                      <li>• 常見情境：內容不完整、品質不達標、文件缺漏</li>
                    </ul>
                  </div>
                  <div className="rounded-md border border-indigo-200 bg-indigo-50/40 p-2.5 sm:p-3 space-y-1.5">
                    <p className="font-medium text-indigo-900">設計變更 — 需求方有新需求需要討論</p>
                    <ul className="text-indigo-900/80 space-y-1 list-none">
                      <li>• 觸發：管理者在專案進行中主動發起</li>
                      <li>• 影響：獨立於簽核流程，不改變需求狀態、SP 或既有簽核；僅作為紀錄，並供結案時 SP 調整參考</li>
                      <li>• 常見情境：過程中新增、刪減或調整項目、需求方提出新想法</li>
                    </ul>
                  </div>
                  <p>
                    判斷方式：先問「問題出在現有內容，還是在有新需求？」 —
                    <span className="text-red-700">現有內容不符合 → 駁回</span>；
                    <span className="text-indigo-700">有新需求需要討論 → 設計變更</span>。
                  </p>
                  <p>設計變更僅限 MVP 確認、開案確認、驗收中三個階段可發起。</p>
                </div>
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
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">
            使用指南
          </h1>
          <p className="text-xs sm:text-base text-muted-foreground">
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

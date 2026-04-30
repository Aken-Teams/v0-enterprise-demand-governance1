"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Eye, Download } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import { STATUS_MAP } from "@/lib/constants/demand"

/* ─── 各階段定義 ─── */
const PHASES = [
  {
    key: "SUBMITTED",
    summary: "與需求者面談了解需求，記錄會議內容與核心訴求。",
    docs: ["MEETING_NOTES"],
  },
  {
    key: "PRD_REVIEW",
    summary: "PM 撰寫 PRD，詳述功能範圍、使用者故事與驗收標準，指派工程師進行 MVP 架構設計。",
    docs: ["PRD"],
  },
  {
    key: "SP_REVIEW",
    summary: "填寫 SP 規劃文件，分配各階段 SP 點數與時程安排。",
    docs: ["SP_PLAN"],
  },
  {
    key: "DEVELOPING",
    summary: "依甘特圖進行開發，產出系統設計文件（SDD）與 APP 成果。",
    docs: ["SDD"],
  },
  {
    key: "ACCEPTANCE",
    summary: "工程師提供測試文件，使用者進行驗收測試確認功能完整性。",
    docs: ["TDD", "BDD", "ATDD"],
  },
]

/* ─── 文件資訊 ─── */
const DOC_INFO: Record<string, { label: string; desc: string }> = {
  MEETING_NOTES: { label: "會議紀錄", desc: "需求訪談的會議紀錄，記錄核心訴求與期望目標" },
  PRD: { label: "PRD（產品需求規格書）", desc: "詳述功能範圍、使用者故事與驗收標準" },
  SP_PLAN: { label: "SP 規劃書", desc: "SP 點數分配與甘特圖時程規劃" },
  SDD: { label: "SDD（系統設計文件）", desc: "系統架構、資料庫設計與 API 規格" },
  TDD: { label: "TDD（測試驅動開發）", desc: "單元測試與整合測試的設計與執行結果" },
  BDD: { label: "BDD（行為驅動開發）", desc: "以 Given-When-Then 格式撰寫的行為測試場景" },
  ATDD: { label: "ATDD（驗收測試驅動開發）", desc: "以使用者驗收標準驅動的測試案例設計" },
}

/* ─── Markdown 範本內容 ─── */
const MD_TEMPLATES: Record<string, string> = {
  MEETING_NOTES: `# 會議紀錄

## 1. 會議基本資訊

| 項目 | 內容 |
|------|------|
| 日期 | YYYY/MM/DD |
| 時間 | HH:MM ~ HH:MM |
| 地點 | （會議室/線上會議連結） |
| 與會人員 | （列出所有參與者與角色） |
| 記錄人 | （姓名） |

## 2. 需求背景

> 說明需求提出的原因、目前遇到的問題或痛點。

## 3. 核心需求

依優先級排列需求者期望的功能與目標：

1. **（需求項目一）**
   - 說明：
   - 優先級：高/中/低

2. **（需求項目二）**
   - 說明：
   - 優先級：高/中/低

## 4. 預期效益

- （預計帶來的效益或改善項目）

## 5. 待確認事項

- [ ] （需進一步釐清的問題一）
- [ ] （需進一步釐清的問題二）

## 6. 下一步行動

| 行動項目 | 負責人 | 預計完成日期 |
|----------|--------|-------------|
| （行動一） | （姓名） | YYYY/MM/DD |
| （行動二） | （姓名） | YYYY/MM/DD |

## 7. 需求決策流程

\`\`\`mermaid
flowchart TD
    A[需求訪談] --> B{需求明確？}
    B -- 是 --> C[記錄核心需求]
    B -- 否 --> D[補充釐清]
    D --> A
    C --> E[確認優先級]
    E --> F[進入 PRD 階段]
\`\`\`
`,

  PRD: `# 產品需求規格書（PRD）

## 1. 需求概述

### 1.1 背景
> 說明需求產生的背景與業務脈絡。

### 1.2 目標
> 本次開發的核心目標。

### 1.3 範圍
> 功能範圍定義，明確包含與不包含的項目。

## 2. 使用者故事

### Story 1
- **As a**（角色）
- **I want**（功能）
- **So that**（價值）

### Story 2
- **As a**（角色）
- **I want**（功能）
- **So that**（價值）

## 3. 功能規格

### 3.1 功能一
- **描述**：
- **頁面流程**：
- **欄位定義**：

| 欄位名稱 | 類型 | 必填 | 說明 |
|----------|------|------|------|
| （欄位） | （類型） | 是/否 | （說明） |

### 3.2 功能二
- **描述**：
- **頁面流程**：
- **欄位定義**：

## 4. 非功能需求

- **效能**：（回應時間、併發數等）
- **安全性**：（權限控制、資料加密等）
- **相容性**：（瀏覽器、裝置等）

## 5. 驗收標準

| 編號 | 驗收項目 | 驗收條件 | 通過標準 |
|------|---------|---------|---------|
| AC-01 | （項目） | （條件） | （標準） |
| AC-02 | （項目） | （條件） | （標準） |

## 6. 頁面流程圖

\`\`\`mermaid
flowchart LR
    A[首頁] --> B[功能列表]
    B --> C[功能詳情]
    C --> D{操作}
    D -- 新增 --> E[表單頁]
    D -- 編輯 --> F[編輯頁]
    D -- 刪除 --> G[確認刪除]
    E --> H[送出成功]
    F --> H
\`\`\`

## 7. 附錄

- UI 原型連結：
- 流程圖：
- 參考資料：
`,

  SP_PLAN: `# SP 規劃書

## 1. SP 總點數

| 項目 | 數值 |
|------|------|
| 預估 SP | （數字） |
| 確認 SP | （數字） |
| 分配依據 | （說明） |

## 2. 各階段 SP 分配

| 階段 | SP 點數 | 占比 | 說明 |
|------|--------|------|------|
| 需求確認 | | | |
| MVP 確認 | | | |
| 開發 | | | |
| 驗收 | | | |
| **合計** | | **100%** | |

## 3. 甘特圖時程

| 階段 | 計畫開始 | 計畫結束 | 負責人 |
|------|---------|---------|--------|
| 需求確認 | YYYY/MM/DD | YYYY/MM/DD | （姓名） |
| MVP 確認 | YYYY/MM/DD | YYYY/MM/DD | （姓名） |
| 開案確認 | YYYY/MM/DD | YYYY/MM/DD | （姓名） |
| 開發 | YYYY/MM/DD | YYYY/MM/DD | （姓名） |
| 驗收 | YYYY/MM/DD | YYYY/MM/DD | （姓名） |

## 4. 時程甘特圖

\`\`\`mermaid
gantt
    title 專案時程規劃
    dateFormat YYYY-MM-DD
    section 需求階段
        需求確認     :a1, 2025-01-01, 7d
        MVP 確認     :a2, after a1, 7d
    section 開案階段
        開案確認     :a3, after a2, 5d
    section 開發階段
        模組一開發   :a4, after a3, 14d
        模組二開發   :a5, after a4, 10d
    section 驗收階段
        測試與驗收   :a6, after a5, 7d
\`\`\`

## 5. 主要開發模組

| 模組名稱 | 功能說明 | 預估 SP | 優先級 |
|----------|---------|--------|--------|
| （模組一） | （功能說明） | | 高/中/低 |
| （模組二） | （功能說明） | | 高/中/低 |
| （模組三） | （功能說明） | | 高/中/低 |
`,

  SDD: `# 系統設計文件（SDD）

## 1. 系統架構

### 1.1 架構圖

\`\`\`mermaid
flowchart TB
    Client[使用者瀏覽器] --> LB[負載平衡器]
    LB --> FE[前端 Next.js]
    FE --> API[API Server]
    API --> DB[(資料庫)]
    API --> Cache[(快取)]
    API --> Storage[檔案儲存]
\`\`\`

### 1.2 技術棧

| 層級 | 技術 | 版本 | 說明 |
|------|------|------|------|
| 前端 | | | |
| 後端 | | | |
| 資料庫 | | | |
| 部署 | | | |

## 2. 資料庫設計

### 2.1 ER 圖

\`\`\`mermaid
erDiagram
    USER ||--o{ ORDER : places
    USER {
        string id PK
        string name
        string email
    }
    ORDER ||--|{ ORDER_ITEM : contains
    ORDER {
        string id PK
        date createdAt
        string status
    }
    ORDER_ITEM }o--|| PRODUCT : references
    ORDER_ITEM {
        string id PK
        int quantity
    }
    PRODUCT {
        string id PK
        string name
        decimal price
    }
\`\`\`

### 2.2 資料表結構

#### Table: （表名）

| 欄位 | 類型 | 可為空 | 說明 |
|------|------|--------|------|
| id | UUID | N | 主鍵 |
| （欄位） | （類型） | Y/N | （說明） |

## 3. API 規格

### 3.1 API 總覽

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| GET | /api/xxx | （說明） | （角色） |
| POST | /api/xxx | （說明） | （角色） |
| PATCH | /api/xxx/:id | （說明） | （角色） |
| DELETE | /api/xxx/:id | （說明） | （角色） |

### 3.2 API 詳細規格

#### GET /api/xxx

| 項目 | 內容 |
|------|------|
| 說明 | （功能說明） |
| 驗證 | （需要的權限或角色） |
| Query 參數 | page, limit, search |
| 回傳格式 | JSON |

**Request 參數**

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| page | number | 否 | 頁碼，預設 1 |
| limit | number | 否 | 每頁數量，預設 20 |

**Response 欄位**

| 欄位 | 類型 | 說明 |
|------|------|------|
| data | array | 資料列表 |
| total | number | 總筆數 |

#### POST /api/xxx

| 項目 | 內容 |
|------|------|
| 說明 | （功能說明） |
| Content-Type | application/json |

**Request Body**

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| name | string | 是 | （說明） |
| description | string | 否 | （說明） |

**錯誤碼**

| HTTP 狀態碼 | 說明 |
|-------------|------|
| 400 | 參數驗證失敗 |
| 401 | 未登入 |
| 403 | 權限不足 |
| 500 | 伺服器錯誤 |

### 3.3 API 時序圖

\`\`\`mermaid
sequenceDiagram
    actor U as 使用者
    participant FE as 前端
    participant API as API Server
    participant DB as 資料庫

    U->>FE: 操作請求
    FE->>API: HTTP Request
    API->>DB: Query
    DB-->>API: Result
    API-->>FE: JSON Response
    FE-->>U: 顯示結果
\`\`\`

## 4. 模組設計

### 4.1 模組一
- **職責**：
- **介面**：
- **依賴**：
`,

  TDD: `# TDD 測試文件

## 測試流程

\`\`\`mermaid
flowchart LR
    A[撰寫測試] --> B[執行測試]
    B --> C{通過？}
    C -- 否 --> D[撰寫產品代碼]
    D --> B
    C -- 是 --> E[重構]
    E --> B
\`\`\`

## 1. 測試範圍

### 1.1 單元測試
- （列出涵蓋的模組與函式）

### 1.2 整合測試
- （列出涵蓋的 API 與流程）

## 2. 測試案例

### 模組一：（模組名稱）

| 編號 | 測試案例 | 輸入 | 預期輸出 | 結果 |
|------|---------|------|---------|------|
| UT-01 | （案例描述） | （輸入） | （預期） | PASS/FAIL |
| UT-02 | （案例描述） | （輸入） | （預期） | PASS/FAIL |

### 模組二：（模組名稱）

| 編號 | 測試案例 | 輸入 | 預期輸出 | 結果 |
|------|---------|------|---------|------|
| UT-03 | （案例描述） | （輸入） | （預期） | PASS/FAIL |

## 3. 測試結果

| 項目 | 數值 |
|------|------|
| 總測試數 | |
| 通過數 | |
| 失敗數 | |
| 通過率 | % |

## 4. 覆蓋率

| 模組 | 行覆蓋率 | 分支覆蓋率 |
|------|---------|-----------|
| （模組一） | % | % |
| （模組二） | % | % |
| **整體** | **%** | **%** |
`,

  BDD: `# BDD 行為測試文件

## BDD 流程

\`\`\`mermaid
flowchart TD
    A[定義 Feature] --> B[撰寫 Scenario]
    B --> C[Given 前置條件]
    C --> D[When 操作動作]
    D --> E[Then 預期結果]
    E --> F{自動化測試通過？}
    F -- 否 --> G[修正實作]
    G --> F
    F -- 是 --> H[驗收完成]
\`\`\`

## 測試場景總覽

| 編號 | 功能 | 場景數 | 狀態 |
|------|------|--------|------|
| F-01 | （功能一） | | PASS/FAIL |
| F-02 | （功能二） | | PASS/FAIL |

---

## Feature: （功能一名稱）

### Scenario 1: （場景描述）

\`\`\`gherkin
Given （前置條件：描述測試場景的初始狀態）
  And （附加前置條件，如有需要）
When （操作動作：使用者執行的操作）
  And （附加操作，如有需要）
Then （預期結果：操作後系統應產生的結果）
  And （附加預期結果，如有需要）
\`\`\`

- **測試結果**：PASS / FAIL
- **備註**：

### Scenario 2: （場景描述）

\`\`\`gherkin
Given （前置條件）
When （操作動作）
Then （預期結果）
\`\`\`

- **測試結果**：PASS / FAIL

---

## Feature: （功能二名稱）

### Scenario 1: （場景描述）

\`\`\`gherkin
Given （前置條件）
When （操作動作）
Then （預期結果）
\`\`\`

- **測試結果**：PASS / FAIL
`,

  ATDD: `# ATDD 驗收測試文件

## 驗收測試流程

\`\`\`mermaid
flowchart TD
    A[PRD 驗收標準] --> B[撰寫驗收測試場景]
    B --> C[準備測試資料]
    C --> D[執行驗收測試]
    D --> E{全部通過？}
    E -- 否 --> F[記錄缺陷]
    F --> G[修正開發]
    G --> D
    E -- 是 --> H[產出測試報告]
    H --> I[驗收簽核]
\`\`\`

## 1. 驗收標準

根據 PRD 定義的驗收條件，以使用者角度撰寫：

| 編號 | 驗收項目 | 對應 PRD | 優先級 |
|------|---------|---------|--------|
| AT-01 | （驗收項目描述） | AC-01 | 高/中/低 |
| AT-02 | （驗收項目描述） | AC-02 | 高/中/低 |

## 2. 測試場景

### AT-01: （驗收項目）

\`\`\`gherkin
Given （前置條件與測試環境）
  And （測試資料準備）
When （使用者操作步驟）
Then （預期的系統行為與輸出）
\`\`\`

### AT-02: （驗收項目）

\`\`\`gherkin
Given （前置條件與測試環境）
When （使用者操作步驟）
Then （預期的系統行為與輸出）
\`\`\`

## 3. 測試資料

| 資料項目 | 說明 | 準備方式 |
|----------|------|---------|
| （資料一） | （說明） | （手動建立/腳本產生） |
| （資料二） | （說明） | （手動建立/腳本產生） |

## 4. 預期結果

| 編號 | 場景 | 預期行為 | 通過標準 |
|------|------|---------|---------|
| AT-01 | （場景） | （行為） | （標準） |
| AT-02 | （場景） | （行為） | （標準） |

## 5. 執行結果

| 編號 | 結果 | 執行日期 | 備註 |
|------|------|---------|------|
| AT-01 | PASS/FAIL | YYYY/MM/DD | （截圖連結或說明） |
| AT-02 | PASS/FAIL | YYYY/MM/DD | （截圖連結或說明） |

### 總結

| 項目 | 數值 |
|------|------|
| 總驗收項目 | |
| 通過數 | |
| 失敗數 | |
| 通過率 | % |
`,
}

/* ─── Mermaid 渲染元件 ─── */
function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string>("")

  useEffect(() => {
    let cancelled = false
    import("mermaid").then((mod) => {
      const mermaid = mod.default
      mermaid.initialize({ startOnLoad: false, theme: "neutral", fontFamily: "inherit" })
      const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`
      mermaid.render(id, code).then(({ svg: result }) => {
        if (!cancelled) setSvg(result)
      }).catch(() => {
        if (!cancelled) setSvg(`<pre style="color:red;font-size:12px">Mermaid 語法錯誤</pre>`)
      })
    })
    return () => { cancelled = true }
  }, [code])

  return (
    <div
      ref={ref}
      className="my-4 flex justify-center overflow-x-auto rounded-lg border bg-white p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

/* ─── 下載 MD 檔案 ─── */
function downloadMd(key: string) {
  const content = MD_TEMPLATES[key]
  const label = DOC_INFO[key]?.label ?? key
  if (!content) return
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${label}.md`
  a.click()
  URL.revokeObjectURL(url)
}

export default function DocumentTemplatesPage() {
  const [previewDoc, setPreviewDoc] = useState<string | null>(null)

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            文件範本
          </h1>
          <p className="text-muted-foreground">
            依階段查看需要產出的文件與標準格式，可預覽或下載 Markdown 範本
          </p>
        </div>

        <Tabs defaultValue="SUBMITTED">
          <TabsList className="flex-wrap h-auto gap-1">
            {PHASES.map((phase) => {
              const info = STATUS_MAP[phase.key]
              return (
                <TabsTrigger key={phase.key} value={phase.key} className="gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: getPhaseColor(phase.key) }}
                  />
                  {info?.label ?? phase.key}
                </TabsTrigger>
              )
            })}
          </TabsList>

          {PHASES.map((phase) => {
            const info = STATUS_MAP[phase.key]
            return (
              <TabsContent key={phase.key} value={phase.key}>
                <div className="space-y-4 mt-2">
                  {/* 階段重點 */}
                  <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
                    <Badge className={`${info?.color ?? ""} shrink-0`}>{info?.label}</Badge>
                    <p className="text-sm text-muted-foreground">{phase.summary}</p>
                  </div>

                  {/* 文件列表 */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {phase.docs.map((docKey) => {
                      const doc = DOC_INFO[docKey]
                      if (!doc) return null
                      return (
                        <Card key={docKey}>
                          <CardContent className="pt-5 space-y-3">
                            <div>
                              <p className="font-medium text-foreground text-sm">{doc.label}</p>
                              <p className="text-xs text-muted-foreground mt-1">{doc.desc}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 text-xs"
                                onClick={() => setPreviewDoc(docKey)}
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" />
                                預覽範本
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 text-xs"
                                onClick={() => downloadMd(docKey)}
                              >
                                <Download className="h-3.5 w-3.5 mr-1" />
                                下載 .md
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              </TabsContent>
            )
          })}
        </Tabs>
      </div>

      {/* 預覽 Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {previewDoc && DOC_INFO[previewDoc]?.label}
              {previewDoc && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs ml-auto"
                  onClick={() => downloadMd(previewDoc)}
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  下載 .md
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto flex-1 rounded-lg border bg-muted/20 p-6 prose prose-sm prose-slate dark:prose-invert max-w-none
            prose-headings:text-foreground prose-h1:text-lg prose-h1:border-b prose-h1:pb-2 prose-h2:text-base prose-h3:text-sm
            prose-table:text-xs prose-th:px-3 prose-th:py-1.5 prose-td:px-3 prose-td:py-1.5
            prose-th:bg-muted/50 prose-th:font-medium
            prose-pre:bg-muted prose-pre:text-xs prose-pre:text-foreground prose-code:text-xs prose-code:text-foreground
            prose-blockquote:text-muted-foreground prose-blockquote:border-muted-foreground/30
            prose-li:text-muted-foreground prose-p:text-muted-foreground
          ">
            {previewDoc && (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                remarkRehypeOptions={{ allowDangerousHtml: true }}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-mermaid/.exec(className || "")
                    if (match) {
                      return <MermaidBlock code={String(children).trim()} />
                    }
                    // Inline code (no className) or block code
                    if (className) {
                      return (
                        <pre className="bg-muted text-foreground text-xs rounded-lg p-4 overflow-x-auto">
                          <code className={className} {...props}>{children}</code>
                        </pre>
                      )
                    }
                    return <code className={className} {...props}>{children}</code>
                  },
                  pre({ children }) {
                    return <>{children}</>
                  },
                }}
              >
                {MD_TEMPLATES[previewDoc] ?? ""}
              </ReactMarkdown>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

function getPhaseColor(phase: string): string {
  const map: Record<string, string> = {
    SUBMITTED: "#3b82f6",
    PRD_REVIEW: "#f59e0b",
    SP_REVIEW: "#f97316",
    DEVELOPING: "#8b5cf6",
    ACCEPTANCE: "#a855f7",
  }
  return map[phase] ?? "#6b7280"
}

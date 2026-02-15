# JV 需求管理平台

企業級 IT 需求管理與治理平台，專為子公司與管理方之間的需求協調、資源配置、開發追蹤與交付管控而設計。

## 功能特色

- **多角色登入** — 子公司（需求方）、管理者（admin）、交付團隊（delivery）各有獨立儀表板與導覽
- **需求全流程管理** — 提交 → PRD 審核 → SP 評估 → 開發中 → 驗收 → 結案，完整生命週期追蹤
- **SP 錢包與資源配置** — 以 Story Points 量化工作量，管理各子公司年度 SP 配額、承諾與消耗
- **文件管理** — 各階段上傳會議記錄、PRD、SDD、測試報告等文件，支援 PDF 浮水印下載與 Excel 預覽
- **開發追蹤** — 子任務拆分、狀態更新、階段計畫編輯，交付團隊可即時管理開發進度
- **Markdown & Mermaid** — 需求描述支援 Markdown 渲染與 Mermaid 流程圖
- **通知提醒** — 需求狀態變更、SP 異動等即時 Toast 通知

## 需求工作流程

```
提交 (SUBMITTED) → PRD 審核 (PRD_REVIEW) → SP 評估 (SP_REVIEW)
    → 開發中 (DEVELOPING) → 驗收 (ACCEPTANCE) → 結案 (CLOSED)

（任何階段皆可駁回 → REJECTED）
```

每個階段有對應的必要文件要求（會議紀錄、PRD、SP 計畫、SDD、測試報告等）。

## 技術堆疊

| 類別 | 技術 |
|------|------|
| 框架 | Next.js 16 (App Router + Turbopack) / React 19 / TypeScript 5 |
| UI | Radix UI + Tailwind CSS 4 + shadcn/ui |
| 資料庫 | MariaDB + Prisma 7 ORM (@prisma/adapter-mariadb) |
| 認證 | JWT (jsonwebtoken + bcryptjs) |
| 表單驗證 | React Hook Form + Zod |
| 文件處理 | pdf-lib (PDF 浮水印) / ExcelJS + xlsx (Excel 預覽) |
| Markdown | react-markdown + remark-gfm + Mermaid 流程圖 |
| 通知 | Sonner (Toast) |
| 部署 | Vercel |

## 安裝與執行

### 前置需求

- Node.js 18+
- MariaDB / MySQL

### 安裝步驟

```bash
# 1. 克隆專案
git clone https://github.com/your-org/v0-enterprise-demand-governance.git
cd v0-enterprise-demand-governance

# 2. 安裝依賴
npm install

# 3. 設定環境變數
cp .env .env.local
# 編輯 .env.local 填入資料庫連線與 JWT 密鑰

# 4. 產生 Prisma Client 並同步資料庫
npx prisma generate
npx prisma db push

# 5. （可選）匯入種子資料
npx prisma db seed

# 6. 啟動開發伺服器
npm run dev
```

開啟瀏覽器訪問 [http://localhost:3000](http://localhost:3000)

## 環境變數

| 變數 | 說明 |
|------|------|
| `DATABASE_URL` | MySQL 連線字串 (`mysql://user:pass@host:port/db`) |
| `MARIADB_URL` | MariaDB 連線字串 (`mariadb://user:pass@host:port/db`) |
| `JWT_SECRET` | JWT 簽發密鑰 |

## 角色與功能對照

| 角色 | 導覽項目 | 說明 |
|------|----------|------|
| `subsidiary` | 需求總覽、需求列表、SP 錢包、使用指南 | 子公司使用者：提交需求、查看進度、SP 餘額 |
| `admin` | 需求看板、報表分析、帳號管理、SP 管理、使用指南 | 治理團隊：審核需求、配置資源、管理帳號 |
| `delivery` | 我的專案、需求列表、使用指南 | 交付團隊（JV / 智合）：開發追蹤、子任務管理 |

## 前端路由

### 子公司模組 (`/subsidiary`)
- `/subsidiary` — 需求總覽儀表板（需求統計、SP 使用、近期動態）
- `/subsidiary/demands` — 需求列表
- `/subsidiary/demands/[id]` — 需求詳情
- `/subsidiary/wallet` — SP 錢包總覽

### 治理模組 (`/governance`)
- `/governance/inbox` — 需求看板（管理者 & 交付團隊共用）
- `/governance/create` — 建立新需求（僅管理者）
- `/governance/demands/[id]` — 需求詳情（含 Markdown / Mermaid 渲染）
- `/governance/analytics` — 報表分析

### 交付團隊模組 (`/delivery`)
- `/delivery` — 我的專案（子任務編輯、文件上傳、進度追蹤）

### 管理模組 (`/admin`)
- `/admin/users` — 帳號管理
- `/admin/organizations` — 組織 / SP 配額管理

### 共用頁面
- `/` — 登入頁（依角色導向對應儀表板）
- `/profile` — 個人設定
- `/documents` — 使用指南（依角色顯示不同內容）

## API 端點

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/auth/login` | POST | 帳號登入，回傳 JWT |
| `/api/profile` | GET / PATCH | 個人資料查詢與更新 |
| `/api/demands` | GET / POST | 需求列表查詢與建立 |
| `/api/demands/[id]` | GET / PATCH | 需求詳情與狀態流轉 |
| `/api/demands/[id]/documents` | GET / POST | 文件列表與上傳 |
| `/api/demands/[id]/documents/[docId]` | PATCH / DELETE | 文件更新與刪除 |
| `/api/demands/[id]/documents/[docId]/download` | GET | 文件下載（含安全驗證） |
| `/api/demands/[id]/comments` | GET / POST | 討論留言 |
| `/api/demands/[id]/phase-plans` | GET / POST / PUT | 階段計畫管理 |
| `/api/demands/[id]/sub-tasks` | GET / POST | 子任務列表與建立 |
| `/api/demands/[id]/sub-tasks/[taskId]` | PATCH | 子任務狀態更新 |
| `/api/sp-wallet` | GET / POST | SP 錢包查詢與交易 |
| `/api/organizations` | GET | 組織列表 |
| `/api/admin/users` | GET / POST | 帳號管理（僅 admin） |
| `/api/admin/organizations` | GET / POST / PATCH | 組織管理（僅 admin） |
| `/api/subsidiary/dashboard` | GET | 子公司儀表板資料彙整 |
| `/api/governance/analytics` | GET | 治理分析報表 |
| `/api/uploads/demands/[demandId]/[filename]` | GET | 檔案串流 |
| `/api/uploads/.../preview` | GET | 文件預覽（Excel 等） |

## 資料模型

| 資料表 | 說明 |
|--------|------|
| `Organization` | 子公司 / 組織（代碼、名稱、狀態） |
| `User` | 使用者（角色：subsidiary / admin / delivery） |
| `Demand` | 需求主體（編號 REQ-YYYY-NNN、狀態、SP、時程） |
| `DemandPhasePlan` | 階段計畫（預計 / 實際 SP 與時程） |
| `DemandSubTask` | 開發子任務拆分 |
| `DemandDocument` | 需求文件（12 種類型：PRD、SDD、測試報告等） |
| `DemandComment` | 討論留言（支援內部備註） |
| `DemandStatusHistory` | 狀態變更歷史（稽核軌跡） |
| `SpWallet` | SP 錢包（組織年度配額、承諾、已用） |
| `SpTransaction` | SP 交易紀錄（配額 / 承諾 / 扣減 / 調整 / 退還） |
| `AcceptanceRecord` | 驗收紀錄（通過 / 駁回、評分、回饋） |
| `Notification` | 系統通知 |

## 專案結構

```
├── app/
│   ├── page.tsx                    # 登入頁
│   ├── layout.tsx                  # 根佈局 (AuthProvider)
│   ├── admin/                      # 管理者（帳號、組織）
│   ├── governance/                 # 需求治理（看板、建立、詳情、分析）
│   ├── subsidiary/                 # 子公司（總覽、需求、SP 錢包）
│   ├── delivery/                   # 交付團隊（專案管理）
│   ├── documents/                  # 使用指南
│   ├── profile/                    # 個人設定
│   └── api/                        # API Routes (19 端點)
├── components/
│   ├── ui/                         # shadcn/ui 基礎組件
│   ├── demand/                     # 需求業務組件
│   │   ├── phase-plan-editor       #   階段計畫編輯器
│   │   ├── sub-task-editor         #   子任務編輯器
│   │   ├── sp-allocation-chart     #   SP 配置圖表
│   │   ├── phase-documents         #   階段文件管理
│   │   └── step-navigation         #   工作流步驟導覽
│   ├── app-layout.tsx              # 應用主佈局（側邊欄 + 角色導覽）
│   └── excel-preview.tsx           # Excel 檔案預覽
├── hooks/
│   ├── use-auth.tsx                # 認證 Context & Hook
│   ├── use-mobile.ts              # 行動裝置偵測
│   └── use-toast.ts               # Toast 通知
├── lib/
│   ├── auth.ts                     # JWT 驗證與角色檢查
│   ├── prisma.ts                   # Prisma Client 單例
│   ├── demand-number.ts            # 需求編號產生 (REQ-YYYY-NNN)
│   ├── pdf-watermark.ts            # PDF 浮水印
│   ├── utils.ts                    # Tailwind cn() 工具
│   ├── constants/demand.ts         # 工作流常數與狀態定義
│   └── validations/                # Zod 驗證 Schema
├── prisma/
│   ├── schema.prisma               # 資料模型定義 (12 張表)
│   └── seed.ts                     # 種子資料
├── uploads/                        # 使用者上傳檔案 (本地儲存)
└── public/                         # 靜態資源
```

## 可用腳本

| 指令 | 說明 |
|------|------|
| `npm run dev` | 啟動開發伺服器 (Turbopack) |
| `npm run build` | 建置生產版本 |
| `npm run start` | 啟動生產伺服器 |
| `npm run lint` | 執行程式碼檢查 |

---

© 2025 JV 需求管理平台 Powered by [智合科技](https://www.zh-aoi.com/)

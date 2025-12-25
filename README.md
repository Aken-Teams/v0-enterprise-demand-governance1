# 企業需求治理系統 (Enterprise Demand Governance)

一個基於 Next.js 的企業級需求管理與治理平台，專為子公司與總公司之間的需求協調與管理而設計。

## 🚀 功能特色

- **多角色儀表板** - 支援子公司、總公司行政、董事會、交付團隊與治理團隊等不同角色
- **需求管理** - 完整的需求提交、審核、追蹤與交付流程
- **數據視覺化** - 包含甘特圖、趨勢圖、進度圖表等豐富的數據展示
- **權限管理** - 基於角色的權限控制與組織管理
- **實時通知** - 需求狀態更新與重要事件提醒
- **文件管理** - 支援需求相關文件的上傳與管理

## 🛠 技術堆疊

- **前端框架**: Next.js 16.0.10 (React 19.2.0)
- **UI 組件**: Radix UI + Tailwind CSS
- **圖表庫**: Recharts
- **表單處理**: React Hook Form + Zod
- **動畫**: Lottie React
- **類型檢查**: TypeScript
- **樣式**: Tailwind CSS

## 📦 安裝與執行

### 前置需求

- Node.js 18.0 或更高版本
- npm 或 pnpm

### 安裝步驟

1. 克隆專案
```bash
git clone https://github.com/your-username/v0-enterprise-demand-governance.git
cd v0-enterprise-demand-governance
```

2. 安裝依賴
```bash
npm install
# 或
pnpm install
```

3. 設定環境變數
```bash
cp .env.example .env.local
```
編輯 `.env.local` 並填入必要的環境變數

4. 啟動開發服務器
```bash
npm run dev
# 或
pnpm dev
```

5. 開啟瀏覽器訪問 [http://localhost:3000](http://localhost:3000)

## 📝 可用腳本

- `npm run dev` - 啟動開發服務器
- `npm run build` - 建置生產版本
- `npm run start` - 啟動生產服務器
- `npm run lint` - 執行程式碼檢查

## 🏗 專案結構

```
├── app/                    # Next.js App Router 頁面
│   ├── admin/             # 管理員頁面
│   ├── board/             # 董事會頁面
│   ├── delivery/          # 交付團隊頁面
│   ├── governance/        # 治理團隊頁面
│   └── subsidiary/        # 子公司頁面
├── components/            # 共用組件
│   └── ui/               # UI 基礎組件
├── hooks/                # 自定義 Hooks
├── lib/                  # 工具函式
├── public/               # 靜態資源
└── styles/               # 全局樣式
```

## 🔒 環境變數

創建 `.env.local` 檔案並設定以下變數：

```env
# 資料庫連線 (如適用)
DATABASE_URL=your_database_url

# 認證相關 (如適用)
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# 外部 API (如適用)
API_BASE_URL=your_api_base_url
```

## 🤝 貢獻指南

1. Fork 專案
2. 創建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 開啟 Pull Request

## 📄 授權條款

此專案採用 MIT 授權條款 - 詳見 [LICENSE](LICENSE) 檔案

## 📞 支援

如有問題或建議，請透過以下方式聯繫：

- 開啟 [GitHub Issue](https://github.com/your-username/v0-enterprise-demand-governance/issues)
- 聯繫開發團隊

---

© 2025 Enterprise Demand Governance Team

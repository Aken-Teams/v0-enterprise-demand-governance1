"use client"

import { useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Star,
  ThumbsUp,
  MessageSquare,
  FileText,
  User,
  Calendar,
  Coins,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Link as LinkIcon,
  Github,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

// 同步「我的需求」頁面中的待驗收項目
interface AcceptanceItem {
  id: string
  title: string
  description: string
  completedDate: string
  sp: number
  sprint: string
  sprintNumber: number
  daysWaiting: number
  pm: string
  developer: string
  submitter: string
  checkItems: {
    id: string
    label: string
    description: string
  }[]
}

const acceptanceItems: AcceptanceItem[] = [
  {
    id: "REQ-2024-002",
    title: "報表匯出功能",
    description: "支援將報表匯出為 Excel 與 PDF 格式，含自訂欄位選擇",
    completedDate: "2024-02-05",
    sp: 13,
    sprint: "Sprint 24-02",
    sprintNumber: 2,
    daysWaiting: 3,
    pm: "張治理",
    developer: "李小華",
    submitter: "業務部",
    checkItems: [
      { id: "func", label: "功能符合需求說明", description: "確認所有功能點皆已實作並符合原始需求" },
      { id: "excel", label: "Excel 匯出功能正常", description: "可成功匯出 Excel 格式，欄位資料正確" },
      { id: "pdf", label: "PDF 匯出功能正常", description: "可成功匯出 PDF 格式，版面排版正確" },
      { id: "custom", label: "自訂欄位選擇功能正常", description: "可自由選擇匯出欄位，設定被正確保存" },
      { id: "test", label: "測試環境可正常運作", description: "在測試環境中完整測試所有功能流程" },
      { id: "doc", label: "相關文件已更新", description: "使用手冊、API 文件等已同步更新" },
    ],
  },
  {
    id: "REQ-2024-015",
    title: "客戶滿意度調查模組",
    description: "建立問卷調查功能，自動發送並統計客戶回饋",
    completedDate: "2024-02-01",
    sp: 11,
    sprint: "Sprint 24-02",
    sprintNumber: 2,
    daysWaiting: 7,
    pm: "張治理",
    developer: "吳小芳",
    submitter: "客服部",
    checkItems: [
      { id: "func", label: "功能符合需求說明", description: "確認所有功能點皆已實作並符合原始需求" },
      { id: "template", label: "問卷模板管理功能正常", description: "可新增、編輯、刪除問卷模板" },
      { id: "schedule", label: "自動發送排程功能正常", description: "排程設定後可自動發送問卷" },
      { id: "stats", label: "統計分析功能正常", description: "可查看回收率、NPS 分數等統計數據" },
      { id: "test", label: "測試環境可正常運作", description: "在測試環境中完整測試所有功能流程" },
      { id: "doc", label: "相關文件已更新", description: "使用手冊、API 文件等已同步更新" },
    ],
  },
]

// 計算統計數據
const totalPendingSP = acceptanceItems.reduce((sum, item) => sum + item.sp, 0)
const monthlyAcceptedCount = 12
const monthlyAcceptedSP = 89
const avgAcceptanceDays = 4.2

export default function AcceptancePage() {
  const [selectedItem, setSelectedItem] = useState<AcceptanceItem | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [acceptanceDialogOpen, setAcceptanceDialogOpen] = useState(false)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})
  const [feedback, setFeedback] = useState("")
  const [rating, setRating] = useState(0)
  const [acceptanceResult, setAcceptanceResult] = useState<"pass" | "reject" | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [workUrl, setWorkUrl] = useState("")
  const [giteaUrl, setGiteaUrl] = useState("")

  // URL 驗證函數
  const isValidUrl = (url: string) => {
    if (!url) return true // 空值視為有效（選填）
    try {
      new URL(url)
      return url.startsWith('http://') || url.startsWith('https://')
    } catch {
      return false
    }
  }

  const handleViewDetail = (item: AcceptanceItem) => {
    setSelectedItem(item)
    setDetailDialogOpen(true)
  }

  const handleStartAcceptance = (item: AcceptanceItem) => {
    setSelectedItem(item)
    setCheckedItems({})
    setFeedback("")
    setRating(0)
    setAcceptanceResult(null)
    setRejectReason("")
    setWorkUrl("")
    setGiteaUrl("")
    setAcceptanceDialogOpen(true)
  }

  const handleCheckItem = (itemId: string, checked: boolean) => {
    setCheckedItems((prev) => ({ ...prev, [itemId]: checked }))
  }

  const allItemsChecked = selectedItem
    ? selectedItem.checkItems.every((item) => checkedItems[item.id])
    : false

  const handleSubmitAcceptance = () => {
    if (acceptanceResult === "pass") {
      // 驗收通過邏輯
      alert(`需求 ${selectedItem?.id} 驗收通過！\n評分：${rating} 星\n回饋：${feedback || "無"}\n作品網址：${workUrl || "未填寫"}\nGitea 網址：${giteaUrl || "未填寫"}`)
    } else {
      // 驗收不通過邏輯
      alert(`需求 ${selectedItem?.id} 驗收不通過\n原因：${rejectReason}`)
    }
    setAcceptanceDialogOpen(false)
  }

  return (
    <AppLayout userRole="subsidiary">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">驗收中心</h1>
          <p className="text-sm text-muted-foreground mt-0.5">檢視並驗收已完成開發的需求</p>
        </div>

        {/* Alert for overdue items */}
        {acceptanceItems.some((item) => item.daysWaiting > 7) && (
          <Card className="border-amber-500/50 bg-amber-50">
            <CardContent className="flex items-start gap-3 pt-6">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600" />
              <div className="flex-1">
                <p className="font-medium text-foreground">有需求待驗收超過 7 天</p>
                <p className="text-sm text-muted-foreground">
                  長時間未驗收會影響團隊 Story Points 結算，請盡快完成驗收流程
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">待驗收</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{acceptanceItems.length}</div>
              <p className="text-xs text-muted-foreground">共 {totalPendingSP} Story Points</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">本月已驗收</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{monthlyAcceptedCount}</div>
              <p className="text-xs text-green-600">共 {monthlyAcceptedSP} Story Points</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">平均驗收時間</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{avgAcceptanceDays} 天</div>
              <p className="text-xs text-muted-foreground">建議目標: 3 天內</p>
            </CardContent>
          </Card>
        </div>

        {/* Acceptance List */}
        <div className="space-y-4">
          {acceptanceItems.map((item) => (
            <Card
              key={item.id}
              className={cn(
                "transition-all hover:shadow-md",
                item.daysWaiting > 7 && "border-amber-500/50 bg-amber-50/30"
              )}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{item.title}</CardTitle>
                      {item.daysWaiting > 7 && (
                        <Badge variant="destructive" className="text-xs">
                          超過 7 天
                        </Badge>
                      )}
                    </div>
                    <CardDescription>
                      需求編號: {item.id} • {item.sprint} • Story Points: {item.sp}
                    </CardDescription>
                    <p className="text-sm text-muted-foreground mt-2">{item.description}</p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground flex-shrink-0">
                    <p>完成日期</p>
                    <p className="font-medium text-foreground">{item.completedDate}</p>
                    <p className="mt-1 text-xs">
                      等待{" "}
                      <span className={item.daysWaiting > 7 ? "text-destructive font-medium" : ""}>
                        {item.daysWaiting}
                      </span>{" "}
                      天
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        PM: {item.pm}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        開發: {item.developer}
                      </span>
                    </div>
                    <div className="text-sm">
                      <p className="text-muted-foreground mb-1">驗收檢查項目:</p>
                      <ul className="list-inside list-disc space-y-0.5 text-muted-foreground text-xs">
                        {item.checkItems.slice(0, 3).map((check) => (
                          <li key={check.id}>{check.label}</li>
                        ))}
                        {item.checkItems.length > 3 && (
                          <li className="text-primary">還有 {item.checkItems.length - 3} 項...</li>
                        )}
                      </ul>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={() => handleViewDetail(item)}>
                      <FileText className="h-4 w-4 mr-1.5" />
                      查看詳情
                    </Button>
                    <Button size="sm" onClick={() => handleStartAcceptance(item)}>
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      開始驗收
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {acceptanceItems.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium text-foreground">目前沒有待驗收項目</p>
              <p className="text-sm text-muted-foreground">所有需求都已完成驗收</p>
            </CardContent>
          </Card>
        )}

        {/* 查看詳情對話框 */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                需求詳情
              </DialogTitle>
              <DialogDescription>查看需求的完整資訊</DialogDescription>
            </DialogHeader>

            {selectedItem && (
              <div className="space-y-6">
                {/* 基本資訊 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{selectedItem.title}</h3>
                    <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                      待驗收
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
                </div>

                {/* 詳細資訊網格 */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-muted-foreground">需求編號</p>
                    <p className="font-medium">{selectedItem.id}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Story Points</p>
                    <p className="font-medium flex items-center gap-1">
                      <Coins className="h-4 w-4 text-amber-500" />
                      {selectedItem.sp} SP
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">所屬 Sprint</p>
                    <p className="font-medium">{selectedItem.sprint}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">完成日期</p>
                    <p className="font-medium flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {selectedItem.completedDate}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">專案經理</p>
                    <p className="font-medium">{selectedItem.pm}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">開發人員</p>
                    <p className="font-medium">{selectedItem.developer}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">提交部門</p>
                    <p className="font-medium">{selectedItem.submitter}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">等待驗收</p>
                    <p className={cn("font-medium", selectedItem.daysWaiting > 7 && "text-destructive")}>
                      {selectedItem.daysWaiting} 天
                    </p>
                  </div>
                </div>

                {/* 驗收檢查項目 */}
                <div className="space-y-3">
                  <h4 className="font-medium">驗收檢查項目</h4>
                  <div className="space-y-2">
                    {selectedItem.checkItems.map((check) => (
                      <div key={check.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">{check.label}</p>
                          <p className="text-xs text-muted-foreground">{check.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="outline" asChild>
                    <Link href={`/subsidiary/demands/${selectedItem.id}`}>
                      <ExternalLink className="h-4 w-4 mr-1.5" />
                      前往需求頁面
                    </Link>
                  </Button>
                  <Button
                    onClick={() => {
                      setDetailDialogOpen(false)
                      handleStartAcceptance(selectedItem)
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    開始驗收
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* 開始驗收對話框 */}
        <Dialog open={acceptanceDialogOpen} onOpenChange={setAcceptanceDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                驗收需求
              </DialogTitle>
              <DialogDescription>
                {selectedItem?.id} - {selectedItem?.title}
              </DialogDescription>
            </DialogHeader>

            {selectedItem && (
              <div className="space-y-6">
                {/* 驗收檢查清單 */}
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <span>驗收檢查項目</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      ({Object.values(checkedItems).filter(Boolean).length}/{selectedItem.checkItems.length} 已確認)
                    </span>
                  </h4>
                  <div className="space-y-2">
                    {selectedItem.checkItems.map((check) => (
                      <div
                        key={check.id}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                          checkedItems[check.id]
                            ? "bg-green-50 border-green-200"
                            : "bg-white border-border hover:bg-muted/50"
                        )}
                        onClick={() => handleCheckItem(check.id, !checkedItems[check.id])}
                      >
                        <Checkbox
                          id={check.id}
                          checked={checkedItems[check.id] || false}
                          onCheckedChange={(checked) => handleCheckItem(check.id, checked as boolean)}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <label htmlFor={check.id} className="font-medium text-sm cursor-pointer">
                            {check.label}
                          </label>
                          <p className="text-xs text-muted-foreground">{check.description}</p>
                        </div>
                        {checkedItems[check.id] && (
                          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 作品與程式碼網址 */}
                <div className="space-y-4 p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <h4 className="font-medium flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-blue-600" />
                    作品與程式碼網址
                  </h4>
                  
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="workUrl" className="text-sm font-medium">
                        作品網址 <span className="text-muted-foreground">(選填)</span>
                      </Label>
                      <Input
                        id="workUrl"
                        type="url"
                        placeholder="https://example.com/demo"
                        value={workUrl}
                        onChange={(e) => setWorkUrl(e.target.value)}
                        className={cn(
                          "bg-white",
                          workUrl && !isValidUrl(workUrl) && "border-red-500 focus-visible:ring-red-500"
                        )}
                      />
                      {workUrl && !isValidUrl(workUrl) && (
                        <p className="text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          請輸入有效的網址格式（http:// 或 https://）
                        </p>
                      )}
                      {workUrl && isValidUrl(workUrl) && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          <Link href={workUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            預覽作品 ↗
                          </Link>
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        請提供可訪問的作品展示網址或 Demo 連結
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="giteaUrl" className="text-sm font-medium flex items-center gap-1">
                        <Github className="h-3.5 w-3.5" />
                        Gitea 網址 <span className="text-muted-foreground">(選填)</span>
                      </Label>
                      <Input
                        id="giteaUrl"
                        type="url"
                        placeholder="https://gitea.company.com/project/repo"
                        value={giteaUrl}
                        onChange={(e) => setGiteaUrl(e.target.value)}
                        className={cn(
                          "bg-white",
                          giteaUrl && !isValidUrl(giteaUrl) && "border-red-500 focus-visible:ring-red-500"
                        )}
                      />
                      {giteaUrl && !isValidUrl(giteaUrl) && (
                        <p className="text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          請輸入有效的網址格式（http:// 或 https://）
                        </p>
                      )}
                      {giteaUrl && isValidUrl(giteaUrl) && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          <Link href={giteaUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            查看程式碼 ↗
                          </Link>
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        請提供 Gitea 或其他版本控制系統的專案網址
                      </p>
                    </div>
                  </div>
                </div>

                {/* 驗收結果選擇 */}
                <div className="space-y-3">
                  <h4 className="font-medium">驗收結果</h4>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant={acceptanceResult === "pass" ? "default" : "outline"}
                      className={cn(
                        "flex-1 h-auto py-4",
                        acceptanceResult === "pass" && "bg-green-600 hover:bg-green-700"
                      )}
                      onClick={() => setAcceptanceResult("pass")}
                      disabled={!allItemsChecked}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <ThumbsUp className="h-5 w-5" />
                        <span>驗收通過</span>
                      </div>
                    </Button>
                    <Button
                      type="button"
                      variant={acceptanceResult === "reject" ? "destructive" : "outline"}
                      className="flex-1 h-auto py-4"
                      onClick={() => setAcceptanceResult("reject")}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <XCircle className="h-5 w-5" />
                        <span>驗收不通過</span>
                      </div>
                    </Button>
                  </div>
                  {!allItemsChecked && (
                    <p className="text-xs text-amber-600">
                      * 請先確認所有檢查項目後才能選擇「驗收通過」
                    </p>
                  )}
                </div>

                {/* 驗收通過 - 評分與回饋 */}
                {acceptanceResult === "pass" && (
                  <div className="space-y-4 p-4 rounded-lg bg-green-50 border border-green-200">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-500" />
                        開發品質評分
                      </Label>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            className="p-1 transition-transform hover:scale-110"
                          >
                            <Star
                              className={cn(
                                "h-8 w-8 transition-colors",
                                star <= rating
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-gray-300"
                              )}
                            />
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {rating === 0 && "請選擇評分"}
                        {rating === 1 && "需要改進"}
                        {rating === 2 && "尚可"}
                        {rating === 3 && "符合預期"}
                        {rating === 4 && "良好"}
                        {rating === 5 && "非常優秀"}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="feedback" className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        回饋與建議（選填）
                      </Label>
                      <Textarea
                        id="feedback"
                        placeholder="分享您對開發成果的回饋，幫助團隊持續改進..."
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        className="min-h-[80px] bg-white"
                      />
                    </div>
                  </div>
                )}

                {/* 驗收不通過 - 原因說明 */}
                {acceptanceResult === "reject" && (
                  <div className="space-y-3 p-4 rounded-lg bg-red-50 border border-red-200">
                    <div className="space-y-2">
                      <Label htmlFor="rejectReason" className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        不通過原因 *
                      </Label>
                      <Textarea
                        id="rejectReason"
                        placeholder="請詳細說明驗收不通過的原因，以便開發團隊進行修正..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="min-h-[100px] bg-white"
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      驗收不通過後，需求將退回開發團隊進行修正，修正完成後會再次進入待驗收狀態。
                    </p>
                  </div>
                )}

                <DialogFooter className="gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setAcceptanceDialogOpen(false)}>
                    取消
                  </Button>
                  <Button
                    onClick={handleSubmitAcceptance}
                    disabled={
                      !acceptanceResult ||
                      (acceptanceResult === "pass" && rating === 0) ||
                      (acceptanceResult === "reject" && !rejectReason.trim())
                    }
                    className={cn(
                      acceptanceResult === "pass" && "bg-green-600 hover:bg-green-700",
                      acceptanceResult === "reject" && "bg-destructive hover:bg-destructive/90"
                    )}
                  >
                    {acceptanceResult === "pass" ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-1.5" />
                        確認通過
                      </>
                    ) : acceptanceResult === "reject" ? (
                      <>
                        <XCircle className="h-4 w-4 mr-1.5" />
                        確認不通過
                      </>
                    ) : (
                      "提交驗收結果"
                    )}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}

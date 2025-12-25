"use client"

import { useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, CheckCircle2, Upload, FileText, User, Calendar, ArrowRight } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

const stories = [
  {
    id: "DEV-232",
    title: "客戶列表頁面優化",
    description: "改善客戶列表頁面的載入速度與使用者體驗，包含分頁功能、搜尋優化、批次操作等",
    status: "ready",
    sp: 8,
    priority: "high",
    subsidiary: "子公司 A",
    assignee: "張開發",
    sprint: "Sprint #12",
    acceptanceCriteria: [
      "頁面載入時間小於 2 秒",
      "支援關鍵字搜尋與進階篩選",
      "實作分頁功能，每頁顯示 20 筆",
      "支援批次匯出功能",
    ],
    technicalNotes: "使用虛擬滾動技術優化大量資料渲染，API 需要支援分頁參數",
  },
  {
    id: "DEV-245",
    title: "API 對接開發",
    description: "與第三方支付系統進行 API 整合，實作金流處理功能",
    status: "in_progress",
    sp: 13,
    priority: "high",
    subsidiary: "子公司 B",
    assignee: "李工程師",
    sprint: "Sprint #12",
    acceptanceCriteria: ["完成支付 API 對接", "實作交易狀態查詢", "錯誤處理與重試機制", "交易記錄保存"],
    technicalNotes: "需要處理非同步回調，注意交易安全性與資料加密",
  },
]

export default function DeliveryStoriesPage() {
  const [selectedStory, setSelectedStory] = useState(stories[0])
  const [status, setStatus] = useState(selectedStory.status)
  const [notes, setNotes] = useState("")
  const [showSuccess, setShowSuccess] = useState(false)

  const handleUpdateStatus = () => {
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 3000)
  }

  const handleMarkReady = () => {
    setStatus("ready")
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 3000)
  }

  return (
    <AppLayout userRole="delivery">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Story 執行頁</h1>
          <p className="text-muted-foreground">更新執行狀態、記錄進度、提交交付成果</p>
        </div>

        {showSuccess && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-900">狀態更新成功！</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Story List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>進行中的 Stories</CardTitle>
              <CardDescription>點選查看詳細資訊</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {stories.map((story) => (
                <button
                  key={story.id}
                  onClick={() => {
                    setSelectedStory(story)
                    setStatus(story.status)
                  }}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selectedStory.id === story.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{story.id}</p>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{story.title}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {story.sp} SP
                    </Badge>
                  </div>
                  <div className="mt-2">
                    <Badge
                      variant="secondary"
                      className={
                        story.status === "in_progress" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                      }
                    >
                      {story.status === "in_progress" ? "進行中" : "待驗收"}
                    </Badge>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Story Detail */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-2xl">{selectedStory.id}</CardTitle>
                    {selectedStory.priority === "high" && (
                      <Badge variant="destructive" className="text-xs">
                        高優先級
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="mt-2 text-base">{selectedStory.title}</CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{selectedStory.sp}</div>
                  <p className="text-xs text-muted-foreground">Story Points</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="details" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="details">Story 詳情</TabsTrigger>
                  <TabsTrigger value="execution">執行更新</TabsTrigger>
                  <TabsTrigger value="attachments">交付證明</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                  {/* Basic Info */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">需求來源</Label>
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <User className="h-4 w-4" />
                        {selectedStory.subsidiary}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">分配給</Label>
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <User className="h-4 w-4" />
                        {selectedStory.assignee}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Sprint</Label>
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <Calendar className="h-4 w-4" />
                        {selectedStory.sprint}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">當前狀態</Label>
                      <Badge
                        className={
                          selectedStory.status === "in_progress"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }
                      >
                        {selectedStory.status === "in_progress" ? "進行中" : "待驗收"}
                      </Badge>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">需求描述</Label>
                    <p className="rounded-lg bg-muted p-3 text-sm">{selectedStory.description}</p>
                  </div>

                  {/* Acceptance Criteria */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">驗收標準（唯讀）</Label>
                    <ul className="space-y-2">
                      {selectedStory.acceptanceCriteria.map((criteria, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
                          <span>{criteria}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Technical Notes */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">技術備註</Label>
                    <div className="rounded-lg bg-blue-50 p-3">
                      <p className="text-sm text-blue-900">{selectedStory.technicalNotes}</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="execution" className="space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="status">更新執行狀態</Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger id="status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">待處理</SelectItem>
                          <SelectItem value="in_progress">進行中</SelectItem>
                          <SelectItem value="done">已完成</SelectItem>
                          <SelectItem value="blocked">阻礙中</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">進度備註</Label>
                      <Textarea
                        id="notes"
                        placeholder="記錄當前進度、遇到的問題或需要的協助..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={6}
                      />
                      <p className="text-xs text-muted-foreground">這些備註將同步給治理團隊，協助追蹤執行狀況</p>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleUpdateStatus} className="gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        更新狀態
                      </Button>
                    </div>

                    {status === "done" && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>Story 完成後，請記得上傳交付證明並標記為「待驗收」</AlertDescription>
                      </Alert>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="attachments" className="space-y-4">
                  <div className="space-y-4">
                    <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
                      <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                      <h3 className="mt-4 text-sm font-semibold">上傳交付證明</h3>
                      <p className="mt-1 text-xs text-muted-foreground">支援螢幕截圖、測試報告、部署紀錄等文件</p>
                      <Button variant="outline" className="mt-4 bg-transparent">
                        選擇檔案
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">已上傳的檔案</Label>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between rounded-lg border border-border p-3">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <div>
                              <p className="text-sm font-medium">測試報告.pdf</p>
                              <p className="text-xs text-muted-foreground">2.4 MB • 2024-01-20</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            下載
                          </Button>
                        </div>
                      </div>
                    </div>

                    <Button onClick={handleMarkReady} size="lg" className="w-full gap-2">
                      <CheckCircle2 className="h-5 w-5" />
                      標記為待驗收
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}

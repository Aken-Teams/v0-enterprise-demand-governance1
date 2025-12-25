"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

export default function SubmitDemandPage() {
  const [date, setDate] = useState<Date>()

  return (
    <AppLayout userRole="subsidiary">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">提交需求</h1>
          <p className="text-muted-foreground">填寫需求詳細資訊，合資企業團隊將進行評估</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>需求資訊</CardTitle>
            <CardDescription>請詳細描述您的需求，以便我們進行準確評估</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">需求標題 *</Label>
                <Input id="title" placeholder="例如：客戶管理系統新增匯出功能" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">需求說明 *</Label>
                <Textarea
                  id="description"
                  placeholder="詳細描述需求的內容、範圍和具體要求..."
                  className="min-h-[120px]"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="purpose">商業目的 / 預期效益 *</Label>
                <Textarea
                  id="purpose"
                  placeholder="說明此需求對業務的價值，預期帶來的效益..."
                  className="min-h-[100px]"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>希望完成時間</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? date.toLocaleDateString("zh-TW") : "選擇日期"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">此為參考時間，不具約束力</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="attachments">附件上傳</Label>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="outline" className="w-full bg-transparent">
                    <Upload className="mr-2 h-4 w-4" />
                    選擇檔案
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">支援 PDF, Word, Excel, 圖片檔案，單檔最大 10MB</p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1">
                  提交需求
                </Button>
                <Button type="button" variant="outline">
                  儲存草稿
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">提交前提醒</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• 需求提交後將進入評估流程，通常需要 3-5 個工作天</p>
            <p>• 治理團隊將評估需求並填寫 Story Points，請留意通知</p>
            <p>• 治理團隊可能會要求補充資訊，請配合提供相關資料</p>
            <p>• 核准後的需求將進入 Backlog，等待 Sprint 規劃</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

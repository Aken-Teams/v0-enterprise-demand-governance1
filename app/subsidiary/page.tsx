"use client"

import { useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  Coins, 
  TrendingUp, 
  TrendingDown,
  AlertCircle, 
  Plus, 
  CalendarIcon, 
  Upload, 
  GitBranch, 
  HelpCircle,
  ArrowUpRight,
  Activity,
  Target,
  Zap,
  Timer,
  ListTodo,
  ChartBar,
  ChartLine,
  Users,
  FolderOpen,
  Rocket,
  BarChart3,
  PieChart,
  Gauge
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import Link from "next/link"

// 模擬圖表數據
const monthlyData = [
  { month: "Jan", submitted: 4, completed: 3 },
  { month: "Feb", submitted: 7, completed: 5 },
  { month: "Mar", submitted: 8, completed: 8 },
  { month: "Apr", submitted: 6, completed: 4 },
  { month: "May", submitted: 9, completed: 7 },
  { month: "Jun", submitted: 5, completed: 5 },
]

// 圓餅圖組件
const CircularProgress = ({ percentage, size = 80, strokeWidth = 8, color = "#3b82f6" }: { percentage: number, size?: number, strokeWidth?: number, color?: string }) => {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span className="absolute text-lg font-bold" style={{ color }}>
        {percentage}%
      </span>
    </div>
  )
}

// 迷你線圖組件
const MiniLineChart = ({ data, color = "#3b82f6" }: { data: number[], color?: string }) => {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min

  const points = data
    .map((value: number, index: number) => {
      const x = (index / (data.length - 1)) * 100
      const y = range === 0 ? 50 : ((max - value) / range) * 80 + 10
      return `${x},${y}`
    })
    .join(" ")

  return (
    <div className="w-20 h-8">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-80"
        />
      </svg>
    </div>
  )
}

// 半圓形進度儀表
const HalfCircleGauge = ({ percentage, size = 120, title, value }: { percentage: number, size?: number, title: string, value: string | number }) => {
  const radius = (size - 20) / 2
  const circumference = Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width={size} height={size / 2 + 10} className="overflow-visible">
          <defs>
            <linearGradient id={`gradient-${title}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
          <path
            d={`M 10 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2}`}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d={`M 10 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2}`}
            fill="none"
            stroke={`url(#gradient-${title})`}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-center">
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{title}</div>
        </div>
      </div>
    </div>
  )
}

// 堆疊圓環圖組件
const DonutChart = ({ data, size = 120 }: { data: Array<{ value: number, color: string, label: string }>, size?: number }) => {
  const total = data.reduce((sum: number, item: { value: number }) => sum + item.value, 0)
  let cumulativePercentage = 0

  const radius = 35
  const circumference = 2 * Math.PI * radius

  return (
    <div className="relative">
      <svg width={size} height={size} className="transform -rotate-90">
        {data.map((item: { value: number, color: string }, index: number) => {
          const percentage = (item.value / total) * 100
          const offset = circumference - (cumulativePercentage / 100) * circumference
          const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`
          
          cumulativePercentage += percentage

          return (
            <circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth="12"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={-offset}
              className="transition-all duration-1000 ease-out"
            />
          )
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-bold">{total}</div>
          <div className="text-xs text-muted-foreground">總計</div>
        </div>
      </div>
    </div>
  )
}

export default function SubsidiaryDashboard() {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState<Date>()
  
  const spData = [
    { name: "已使用", value: 244, color: "#3b82f6", label: "已使用" },
    { name: "已承諾", value: 100, color: "#f59e0b", label: "已承諾" },
    { name: "可用", value: 156, color: "#10b981", label: "可用" }
  ]

  const trendData = [4, 7, 8, 6, 9, 5, 8]
  
  return (
    <AppLayout userRole="subsidiary">
      <div className="space-y-6">
        {/* Header Section with Welcome Message */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">子公司總覽</h1>
            <p className="text-muted-foreground">歡迎回來，查看您的需求管理概況</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href="/subsidiary/demands">
                <ListTodo className="mr-2 h-4 w-4" />
                我的需求
              </Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                  <Plus className="mr-2 h-4 w-4" />
                  提交需求
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[900px]">
                <div className="flex gap-6">
                  {/* Left - Form */}
                  <div className="flex-1 min-w-0">
                    <DialogHeader className="mb-4">
                      <DialogTitle>提交需求</DialogTitle>
                      <DialogDescription>填寫需求詳細資訊，合資企業團隊將進行評估</DialogDescription>
                    </DialogHeader>
                    <form className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="title">需求標題 *</Label>
                        <Input id="title" placeholder="例如：客戶管理系統新增匯出功能" required />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description">需求說明 *</Label>
                        <Textarea
                          id="description"
                          placeholder="詳細描述需求的內容、範圍和具體要求..."
                          className="min-h-[100px]"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="purpose">商業目的 / 預期效益 *</Label>
                        <Textarea
                          id="purpose"
                          placeholder="說明此需求對業務的價值，預期帶來的效益..."
                          className="min-h-[80px]"
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
                        <Button type="button" variant="outline" className="w-full bg-transparent">
                          <Upload className="mr-2 h-4 w-4" />
                          選擇檔案
                        </Button>
                        <p className="text-xs text-muted-foreground">支援 PDF, Word, Excel, 圖片檔案，單檔最大 10MB</p>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button type="submit" className="flex-1">
                          提交需求
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                          取消
                        </Button>
                      </div>
                    </form>
                  </div>

                  {/* Right - Process Guide */}
                  <div className="hidden sm:block w-[260px] flex-shrink-0 border-l border-border pl-5 space-y-8 overflow-y-auto max-h-[calc(90vh-80px)]">
                    {/* 剩餘 SP */}
                    <div className="rounded-lg border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-green-700">目前可用 SP</p>
                        <Coins className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex items-center gap-3">
                        <CircularProgress percentage={31.2} size={60} color="#10b981" />
                        <div>
                          <p className="text-2xl font-bold text-green-600">156</p>
                          <p className="text-xs text-green-600/70">年度配額 500 SP</p>
                        </div>
                      </div>
                    </div>

                    {/* 需求處理流程 */}
                    <div>
                      <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                        <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                        需求處理流程
                      </h4>
                      <div className="space-y-2.5">
                        <div className="relative pl-4">
                          <div className="absolute left-0 top-1 h-3 w-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600" />
                          <div className="absolute left-[5px] top-4 h-full w-0.5 bg-gradient-to-b from-blue-300 to-transparent" />
                          <p className="text-xs font-medium text-foreground">1. 提交需求</p>
                          <p className="text-[11px] text-muted-foreground">填寫需求資訊</p>
                        </div>
                        <div className="relative pl-4">
                          <div className="absolute left-0 top-1 h-3 w-3 rounded-full bg-gray-300" />
                          <div className="absolute left-[5px] top-4 h-full w-0.5 bg-gray-200" />
                          <p className="text-xs font-medium text-muted-foreground">2. 治理審核</p>
                          <p className="text-[11px] text-muted-foreground">評估需求，確認 SP</p>
                        </div>
                        <div className="relative pl-4">
                          <div className="absolute left-0 top-1 h-3 w-3 rounded-full bg-gray-300" />
                          <div className="absolute left-[5px] top-4 h-full w-0.5 bg-gray-200" />
                          <p className="text-xs font-medium text-muted-foreground">3. 排入開發</p>
                          <p className="text-[11px] text-muted-foreground">進入 Backlog 等待規劃</p>
                        </div>
                        <div className="relative pl-4">
                          <div className="absolute left-0 top-1 h-3 w-3 rounded-full bg-gray-300" />
                          <div className="absolute left-[5px] top-4 h-full w-0.5 bg-gray-200" />
                          <p className="text-xs font-medium text-muted-foreground">4. 開發階段</p>
                          <p className="text-[11px] text-muted-foreground">交付團隊執行開發</p>
                        </div>
                        <div className="relative pl-4">
                          <div className="absolute left-0 top-1 h-3 w-3 rounded-full bg-gray-300" />
                          <p className="text-xs font-medium text-muted-foreground">5. 驗收結案</p>
                          <p className="text-[11px] text-muted-foreground">驗收後自動扣除 SP</p>
                        </div>
                      </div>
                    </div>

                    {/* 常見問題 - 手風琴 */}
                    <div>
                      <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        常見問題
                      </h4>
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="q1" className="border-b-0">
                          <AccordionTrigger className="py-2 text-xs hover:no-underline">
                            審核需要多久？
                          </AccordionTrigger>
                          <AccordionContent className="text-xs text-muted-foreground pb-2">
                            通常 3-5 個工作天
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="q2" className="border-b-0">
                          <AccordionTrigger className="py-2 text-xs hover:no-underline">
                            SP 不夠怎麼辦？
                          </AccordionTrigger>
                          <AccordionContent className="text-xs text-muted-foreground pb-2">
                            可申請額外配額或調整優先序
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="q3" className="border-b-0">
                          <AccordionTrigger className="py-2 text-xs hover:no-underline">
                            可以修改已提交的需求嗎？
                          </AccordionTrigger>
                          <AccordionContent className="text-xs text-muted-foreground pb-2">
                            審核前可在「我的需求」修改
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Enhanced KPI Cards with Visual Graphics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          <Card className="group hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-blue-700">總需求數</CardTitle>
              <div className="p-2 bg-blue-100 rounded-full">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-blue-900">24</div>
                <MiniLineChart data={[4, 7, 8, 6, 9, 5, 8]} color="#3b82f6" />
              </div>
              <div className="flex items-center gap-1 text-xs">
                <ArrowUpRight className="h-3 w-3 text-green-500" />
                <span className="text-green-600 font-medium">+14%</span>
                <span className="text-blue-600/70">vs 上月</span>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-purple-700">進行中</CardTitle>
              <div className="p-2 bg-purple-100 rounded-full">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-purple-900">8</div>
                <CircularProgress percentage={67} size={50} color="#8b5cf6" />
              </div>
              <div className="flex items-center gap-1 text-xs">
                <Activity className="h-3 w-3 text-purple-500" />
                <span className="text-purple-600/70">跨 3 個 Sprint</span>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-orange-700">待驗收</CardTitle>
              <div className="p-2 bg-orange-100 rounded-full">
                <CheckCircle className="h-5 w-5 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-orange-900">5</div>
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-4 border-orange-200">
                    <div className="w-full h-full rounded-full bg-gradient-to-r from-orange-400 to-red-400 flex items-center justify-center">
                      <AlertCircle className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <AlertCircle className="h-3 w-3 text-red-500" />
                <span className="text-red-600 font-medium">2 項逾期</span>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-green-700">可用 SP</CardTitle>
              <div className="p-2 bg-green-100 rounded-full">
                <Coins className="h-5 w-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-green-900">156</div>
                <CircularProgress percentage={31.2} size={50} color="#10b981" />
              </div>
              <div className="w-full">
                <div className="text-xs text-green-600/70 mb-1">剩餘 31.2%</div>
                <Progress value={31.2} className="h-2 bg-green-100 [&>div]:bg-gradient-to-r [&>div]:from-green-400 [&>div]:to-emerald-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-cyan-50 to-teal-50 border-cyan-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-cyan-700">本月完成</CardTitle>
              <div className="p-2 bg-cyan-100 rounded-full">
                <Target className="h-5 w-5 text-cyan-600" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-cyan-900">7</div>
                <div className="relative">
                  <svg width="50" height="50" className="transform -rotate-90">
                    <circle cx="25" cy="25" r="20" stroke="#e0f2fe" strokeWidth="4" fill="none" />
                    <circle cx="25" cy="25" r="20" stroke="#06b6d4" strokeWidth="4" fill="none" 
                            strokeDasharray={`${2 * Math.PI * 20}`} strokeDashoffset={`${2 * Math.PI * 20 * (1 - 0.8)}`}
                            strokeLinecap="round" className="transition-all duration-1000" />
                  </svg>
                  <Zap className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-4 w-4 text-cyan-600" />
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span className="text-green-600 font-medium">提前 2 天</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Visual Dashboard */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left - SP 使用分析圓餅圖 */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                SP 使用分析
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <DonutChart data={spData} size={150} />
              <div className="grid grid-cols-3 gap-4 w-full text-center">
                {spData.map((item, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    </div>
                    <div className="text-sm font-medium">{item.value}</div>
                    <div className="text-xs text-muted-foreground">{item.name}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Center - 績效儀表板 */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Gauge className="h-5 w-5" />
                績效儀表板
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <HalfCircleGauge percentage={92} title="交付率" value="92%" />
                </div>
                <div className="text-center">
                  <HalfCircleGauge percentage={78} title="通過率" value="78%" />
                </div>
              </div>
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">平均處理時間</span>
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">8.5 天</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">SP 效率</span>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-green-600 font-medium">+15%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right - 月度趨勢 */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ChartLine className="h-5 w-5" />
                月度趨勢
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {monthlyData.map((data, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground w-8">{data.month}</span>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 bg-secondary rounded-full h-6 relative overflow-hidden">
                        <div 
                          className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full flex items-center justify-end pr-2 transition-all duration-1000 ease-out"
                          style={{ width: `${(data.submitted / 10) * 100}%` }}
                        >
                          <span className="text-xs text-white font-medium">{data.submitted}</span>
                        </div>
                      </div>
                      <div className="flex-1 bg-secondary rounded-full h-6 relative overflow-hidden">
                        <div 
                          className="absolute left-0 top-0 h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full flex items-center justify-end pr-2 transition-all duration-1000 ease-out"
                          style={{ width: `${(data.completed / 10) * 100}%` }}
                        >
                          <span className="text-xs text-white font-medium">{data.completed}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-4 pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-gradient-to-r from-blue-400 to-blue-600" />
                    <span className="text-xs text-muted-foreground">已提交</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-gradient-to-r from-green-400 to-green-600" />
                    <span className="text-xs text-muted-foreground">已完成</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Activity Feed & Actions */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Activity Feed with visual enhancements */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  最近活動
                </CardTitle>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-1 animate-pulse" />
                  即時更新
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { 
                    action: "需求已核准", 
                    title: "客戶管理系統優化", 
                    time: "2 小時前", 
                    status: "success",
                    sp: 15,
                    user: "張經理",
                    priority: "高"
                  },
                  { 
                    action: "待您驗收", 
                    title: "報表匯出功能", 
                    time: "5 小時前", 
                    status: "warning",
                    sp: 8,
                    user: "系統",
                    priority: "中"
                  },
                  { 
                    action: "評估中", 
                    title: "行動版介面開發", 
                    time: "1 天前", 
                    status: "info",
                    sp: 25,
                    user: "李主任",
                    priority: "高"
                  },
                  { 
                    action: "Sprint 完成", 
                    title: "權限管理模組", 
                    time: "2 天前", 
                    status: "success",
                    sp: 12,
                    user: "開發團隊",
                    priority: "低"
                  },
                ].map((activity, i) => (
                  <div key={i} className="flex items-start gap-4 p-3 rounded-lg hover:bg-gradient-to-r hover:from-muted/30 hover:to-transparent transition-all duration-200 border border-transparent hover:border-border/50">
                    <div className="relative">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium",
                          activity.status === "success" && "bg-gradient-to-r from-green-400 to-green-600",
                          activity.status === "warning" && "bg-gradient-to-r from-orange-400 to-orange-600",
                          activity.status === "info" && "bg-gradient-to-r from-blue-400 to-blue-600",
                          activity.status === "error" && "bg-gradient-to-r from-red-400 to-red-600",
                        )}
                      >
                        {activity.status === "success" && <CheckCircle className="h-5 w-5" />}
                        {activity.status === "warning" && <Clock className="h-5 w-5" />}
                        {activity.status === "info" && <FileText className="h-5 w-5" />}
                        {activity.status === "error" && <AlertCircle className="h-5 w-5" />}
                      </div>
                      {i < 3 && <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-0.5 h-4 bg-border" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{activity.title}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-xs text-muted-foreground">
                              {activity.action} • {activity.time}
                            </p>
                            {activity.sp > 0 && (
                              <Badge variant="secondary" className="text-xs px-2 py-0">
                                {activity.sp} SP
                              </Badge>
                            )}
                            <Badge 
                              variant={activity.priority === "高" ? "destructive" : activity.priority === "中" ? "default" : "secondary"}
                              className="text-xs px-2 py-0"
                            >
                              {activity.priority}
                            </Badge>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <ArrowUpRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-4 border-t">
                <Button variant="link" className="p-0 h-auto text-primary">
                  查看所有活動 →
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Quick Actions */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Rocket className="h-5 w-5" />
                快速操作
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <Button className="w-full justify-start bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700" asChild>
                  <Link href="/subsidiary/demands">
                    <FolderOpen className="mr-3 h-4 w-4" />
                    查看所有需求
                  </Link>
                </Button>
                <Button className="w-full justify-start bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700" asChild>
                  <Link href="/subsidiary/acceptance">
                    <CheckCircle className="mr-3 h-4 w-4" />
                    前往驗收中心
                  </Link>
                </Button>
                <Button className="w-full justify-start bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700" asChild>
                  <Link href="/subsidiary/wallet">
                    <Coins className="mr-3 h-4 w-4" />
                    查看 SP 錢包
                  </Link>
                </Button>
              </div>

              {/* Quick Stats */}
              <div className="space-y-3 pt-4 border-t">
                <div className="text-sm font-medium text-foreground mb-2">今日概況</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-3 rounded-lg text-center">
                    <div className="text-lg font-bold text-blue-700">3</div>
                    <div className="text-xs text-blue-600">新增需求</div>
                  </div>
                  <div className="bg-gradient-to-r from-green-50 to-green-100 p-3 rounded-lg text-center">
                    <div className="text-lg font-bold text-green-700">2</div>
                    <div className="text-xs text-green-600">已完成</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Milestones with Enhanced Visuals */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-5 w-5" />
                即將到來的里程碑
              </CardTitle>
              <Button variant="ghost" size="sm">
                查看全部
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  title: "Q2 Sprint 結束",
                  date: "2024/03/31",
                  items: ["5 個需求交付", "預計釋放 45 SP"],
                  status: "urgent",
                  daysLeft: 7,
                  color: "red"
                },
                {
                  title: "年中審核",
                  date: "2024/04/15",
                  items: ["SP 配額調整", "優先級重新評估"],
                  status: "upcoming",
                  daysLeft: 22,
                  color: "orange"
                },
                {
                  title: "系統升級",
                  date: "2024/04/30",
                  items: ["新功能上線", "介面改版"],
                  status: "planning",
                  daysLeft: 37,
                  color: "blue"
                },
              ].map((milestone, i) => (
                <div key={i} className={cn(
                  "relative space-y-4 rounded-lg border-2 p-4 transition-all duration-300 hover:shadow-lg",
                  milestone.color === "red" && "border-red-200 bg-gradient-to-br from-red-50 to-rose-50",
                  milestone.color === "orange" && "border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50",
                  milestone.color === "blue" && "border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50"
                )}>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{milestone.title}</p>
                      <p className="text-xs text-muted-foreground">{milestone.date}</p>
                    </div>
                    <div className="text-center">
                      <div className={cn(
                        "inline-flex items-center justify-center w-12 h-12 rounded-full text-white text-lg font-bold",
                        milestone.color === "red" && "bg-gradient-to-r from-red-400 to-red-600",
                        milestone.color === "orange" && "bg-gradient-to-r from-orange-400 to-orange-600",
                        milestone.color === "blue" && "bg-gradient-to-r from-blue-400 to-blue-600"
                      )}>
                        {milestone.daysLeft}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">天</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {milestone.items.map((item, j) => (
                      <div key={j} className="flex items-center gap-2">
                        <div className={cn(
                          "h-2 w-2 rounded-full",
                          milestone.color === "red" && "bg-red-400",
                          milestone.color === "orange" && "bg-orange-400",
                          milestone.color === "blue" && "bg-blue-400"
                        )} />
                        <span className="text-xs text-muted-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                  <div className="absolute top-2 right-2">
                    <div className={cn(
                      "w-3 h-3 rounded-full animate-pulse",
                      milestone.status === "urgent" && "bg-red-400",
                      milestone.status === "upcoming" && "bg-orange-400",
                      milestone.status === "planning" && "bg-blue-400"
                    )} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
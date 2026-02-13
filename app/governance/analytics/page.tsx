"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart3,
  FileText,
  Coins,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
} from "lucide-react"

export default function GovernanceAnalyticsPage() {
  return (
    <AppLayout userRole="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">分析報表</h1>
          <p className="text-muted-foreground">治理數據分析與決策支援報表</p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">活躍需求</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">0</div>
              <p className="text-xs text-muted-foreground">進行中的需求</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">本月交付</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">0</div>
              <p className="text-xs text-muted-foreground">完成驗收需求數</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">SP 投入</CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">0</div>
              <p className="text-xs text-muted-foreground">YTD 累計使用</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">交付效率</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">—</div>
              <p className="text-xs text-muted-foreground">尚無數據</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">總覽</TabsTrigger>
            <TabsTrigger value="flow">需求流動</TabsTrigger>
            <TabsTrigger value="metrics">指標分析</TabsTrigger>
            <TabsTrigger value="trends">趨勢分析</TabsTrigger>
            <TabsTrigger value="risks">風險管理</TabsTrigger>
            <TabsTrigger value="sp-usage">SP 分析</TabsTrigger>
          </TabsList>

          {["overview", "flow", "metrics", "trends", "risks", "sp-usage"].map((tab) => (
            <TabsContent key={tab} value={tab}>
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">尚無資料</p>
                  <p className="text-sm text-muted-foreground/60 mt-1">待有需求數據後將自動生成報表</p>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  )
}

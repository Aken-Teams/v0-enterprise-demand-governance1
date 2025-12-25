"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Settings, Database, Mail, Bell, Globe, Shield, Zap, Save, RotateCcw, AlertTriangle, CheckCircle } from "lucide-react"
import { useState } from "react"

interface SystemSettings {
  systemName: string
  systemVersion: string
  defaultSprintCapacity: number
  sprintDurationDays: number
  autoGenerateTicketNumbers: boolean
  allowDraftRequests: boolean
  evaluationTargetDays: number
  acceptanceTargetDays: number
  overdueWarningDays: number
  spApprovalRequired: boolean
  spApprovalThreshold: number
  emailNotifications: boolean
  smtpServer: string
  smtpPort: number
  fromEmail: string
  statusChangeNotifications: boolean
  sprintStartNotifications: boolean
  overdueReminders: boolean
  dailySummary: boolean
  autoBackup: boolean
  dataRetentionDays: number
  maintenanceMode: boolean
  debugMode: boolean
  maxFileUploadSize: number
  sessionTimeoutMinutes: number
  passwordMinLength: number
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({
    systemName: "GOVORA - 照亮企業決策的治理平台",
    systemVersion: "1.0.0",
    defaultSprintCapacity: 100,
    sprintDurationDays: 14,
    autoGenerateTicketNumbers: true,
    allowDraftRequests: true,
    evaluationTargetDays: 3,
    acceptanceTargetDays: 3,
    overdueWarningDays: 7,
    spApprovalRequired: true,
    spApprovalThreshold: 20,
    emailNotifications: true,
    smtpServer: "smtp.company.com",
    smtpPort: 587,
    fromEmail: "noreply@company.com",
    statusChangeNotifications: true,
    sprintStartNotifications: true,
    overdueReminders: true,
    dailySummary: false,
    autoBackup: true,
    dataRetentionDays: 365,
    maintenanceMode: false,
    debugMode: false,
    maxFileUploadSize: 50,
    sessionTimeoutMinutes: 480,
    passwordMinLength: 8
  })
  const [hasChanges, setHasChanges] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")

  const updateSetting = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
    setSaveStatus("idle")
  }

  const resetSettings = () => {
    setSettings({
      systemName: "GOVORA - 照亮企業決策的治理平台",
      systemVersion: "1.0.0",
      defaultSprintCapacity: 100,
      sprintDurationDays: 14,
      autoGenerateTicketNumbers: true,
      allowDraftRequests: true,
      evaluationTargetDays: 3,
      acceptanceTargetDays: 3,
      overdueWarningDays: 7,
      spApprovalRequired: true,
      spApprovalThreshold: 20,
      emailNotifications: true,
      smtpServer: "smtp.company.com",
      smtpPort: 587,
      fromEmail: "noreply@company.com",
      statusChangeNotifications: true,
      sprintStartNotifications: true,
      overdueReminders: true,
      dailySummary: false,
      autoBackup: true,
      dataRetentionDays: 365,
      maintenanceMode: false,
      debugMode: false,
      maxFileUploadSize: 50,
      sessionTimeoutMinutes: 480,
      passwordMinLength: 8
    })
    setHasChanges(false)
    setSaveStatus("idle")
  }

  const saveSettings = async () => {
    setSaveStatus("saving")
    // Simulate save operation
    await new Promise(resolve => setTimeout(resolve, 1500))
    setSaveStatus("saved")
    setHasChanges(false)
    setTimeout(() => setSaveStatus("idle"), 3000)
  }

  return (
    <AppLayout userRole="admin">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">系統參數設定</h1>
            <p className="text-muted-foreground">管理系統全域設定與參數配置</p>
          </div>
          
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              onClick={resetSettings}
              disabled={!hasChanges || saveStatus === "saving"}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              重置
            </Button>
            <Button 
              onClick={saveSettings}
              disabled={!hasChanges || saveStatus === "saving"}
            >
              {saveStatus === "saving" ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  儲存中...
                </>
              ) : saveStatus === "saved" ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  已儲存
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  儲存變更
                </>
              )}
            </Button>
          </div>
        </div>

        {hasChanges && saveStatus !== "saved" && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="flex items-center gap-2 pt-4">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <p className="text-sm text-orange-700">您有未儲存的設定變更</p>
            </CardContent>
          </Card>
        )}

        {saveStatus === "saved" && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="flex items-center gap-2 pt-4">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <p className="text-sm text-green-700">設定已成功儲存</p>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general">一般設定</TabsTrigger>
            <TabsTrigger value="workflow">工作流程</TabsTrigger>
            <TabsTrigger value="notifications">通知設定</TabsTrigger>
            <TabsTrigger value="security">安全設定</TabsTrigger>
            <TabsTrigger value="system">系統維護</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  <CardTitle>系統基本設定</CardTitle>
                </div>
                <CardDescription>系統基本資訊與核心參數</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="systemName">系統名稱</Label>
                    <Input 
                      id="systemName" 
                      value={settings.systemName} 
                      onChange={(e) => updateSetting('systemName', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="systemVersion">系統版本</Label>
                    <Input 
                      id="systemVersion" 
                      value={settings.systemVersion}
                      onChange={(e) => updateSetting('systemVersion', e.target.value)}
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="defaultSP">預設 Sprint 容量 (SP)</Label>
                    <Input 
                      id="defaultSP" 
                      type="number" 
                      value={settings.defaultSprintCapacity}
                      onChange={(e) => updateSetting('defaultSprintCapacity', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sprintDuration">Sprint 週期 (天)</Label>
                    <Select 
                      value={settings.sprintDurationDays.toString()} 
                      onValueChange={(value) => updateSetting('sprintDurationDays', Number(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">1 週 (7 天)</SelectItem>
                        <SelectItem value="14">2 週 (14 天)</SelectItem>
                        <SelectItem value="21">3 週 (21 天)</SelectItem>
                        <SelectItem value="30">1 個月 (30 天)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">需求自動編號</Label>
                      <p className="text-sm text-muted-foreground">自動產生需求編號 (格式: REQ-YYYY-MMDD-XXX)</p>
                    </div>
                    <Switch 
                      checked={settings.autoGenerateTicketNumbers} 
                      onCheckedChange={(checked) => updateSetting('autoGenerateTicketNumbers', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">啟用需求草稿</Label>
                      <p className="text-sm text-muted-foreground">允許儲存未完成的需求草稿</p>
                    </div>
                    <Switch 
                      checked={settings.allowDraftRequests} 
                      onCheckedChange={(checked) => updateSetting('allowDraftRequests', checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workflow" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  <CardTitle>工作流程設定</CardTitle>
                </div>
                <CardDescription>需求評估與驗收流程參數</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="evaluationTarget">評估目標時間 (天)</Label>
                    <Input 
                      id="evaluationTarget" 
                      type="number" 
                      value={settings.evaluationTargetDays}
                      onChange={(e) => updateSetting('evaluationTargetDays', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="acceptanceTarget">驗收目標時間 (天)</Label>
                    <Input 
                      id="acceptanceTarget" 
                      type="number" 
                      value={settings.acceptanceTargetDays}
                      onChange={(e) => updateSetting('acceptanceTargetDays', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="overdueDays">逾期警示天數</Label>
                    <Input 
                      id="overdueDays" 
                      type="number" 
                      value={settings.overdueWarningDays}
                      onChange={(e) => updateSetting('overdueWarningDays', Number(e.target.value))}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">SP 調整需核准</Label>
                      <p className="text-sm text-muted-foreground">
                        SP 調整超過 {settings.spApprovalThreshold}% 需額外核准
                      </p>
                    </div>
                    <Switch 
                      checked={settings.spApprovalRequired} 
                      onCheckedChange={(checked) => updateSetting('spApprovalRequired', checked)}
                    />
                  </div>

                  {settings.spApprovalRequired && (
                    <div className="space-y-2">
                      <Label htmlFor="spApprovalThreshold">SP 調整核准閾值 (%)</Label>
                      <Input 
                        id="spApprovalThreshold" 
                        type="number" 
                        value={settings.spApprovalThreshold}
                        onChange={(e) => updateSetting('spApprovalThreshold', Number(e.target.value))}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  <CardTitle>郵件設定</CardTitle>
                </div>
                <CardDescription>系統郵件通知設定</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">啟用郵件通知</Label>
                    <p className="text-sm text-muted-foreground">寄送系統通知郵件</p>
                  </div>
                  <Switch 
                    checked={settings.emailNotifications} 
                    onCheckedChange={(checked) => updateSetting('emailNotifications', checked)}
                  />
                </div>

                {settings.emailNotifications && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="smtpServer">SMTP 伺服器</Label>
                        <Input 
                          id="smtpServer" 
                          value={settings.smtpServer}
                          onChange={(e) => updateSetting('smtpServer', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtpPort">SMTP 埠號</Label>
                        <Input 
                          id="smtpPort" 
                          type="number" 
                          value={settings.smtpPort}
                          onChange={(e) => updateSetting('smtpPort', Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fromEmail">寄件者信箱</Label>
                      <Input 
                        id="fromEmail" 
                        type="email" 
                        value={settings.fromEmail}
                        onChange={(e) => updateSetting('fromEmail', e.target.value)}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  <CardTitle>通知行為設定</CardTitle>
                </div>
                <CardDescription>系統通知觸發條件</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">需求狀態變更通知</Label>
                    <p className="text-sm text-muted-foreground">需求狀態改變時通知相關人員</p>
                  </div>
                  <Switch 
                    checked={settings.statusChangeNotifications} 
                    onCheckedChange={(checked) => updateSetting('statusChangeNotifications', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Sprint 開始通知</Label>
                    <p className="text-sm text-muted-foreground">Sprint 啟動時通知團隊成員</p>
                  </div>
                  <Switch 
                    checked={settings.sprintStartNotifications} 
                    onCheckedChange={(checked) => updateSetting('sprintStartNotifications', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">逾期提醒</Label>
                    <p className="text-sm text-muted-foreground">項目逾期時自動提醒</p>
                  </div>
                  <Switch 
                    checked={settings.overdueReminders} 
                    onCheckedChange={(checked) => updateSetting('overdueReminders', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">每日摘要</Label>
                    <p className="text-sm text-muted-foreground">每日寄送活動摘要報告</p>
                  </div>
                  <Switch 
                    checked={settings.dailySummary} 
                    onCheckedChange={(checked) => updateSetting('dailySummary', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  <CardTitle>安全性設定</CardTitle>
                </div>
                <CardDescription>使用者認證與存取控制設定</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sessionTimeout">工作階段逾時 (分鐘)</Label>
                    <Select 
                      value={settings.sessionTimeoutMinutes.toString()} 
                      onValueChange={(value) => updateSetting('sessionTimeoutMinutes', Number(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="60">1 小時</SelectItem>
                        <SelectItem value="240">4 小時</SelectItem>
                        <SelectItem value="480">8 小時</SelectItem>
                        <SelectItem value="1440">24 小時</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="passwordLength">密碼最小長度</Label>
                    <Select 
                      value={settings.passwordMinLength.toString()} 
                      onValueChange={(value) => updateSetting('passwordMinLength', Number(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="6">6 字元</SelectItem>
                        <SelectItem value="8">8 字元</SelectItem>
                        <SelectItem value="12">12 字元</SelectItem>
                        <SelectItem value="16">16 字元</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxFileUpload">檔案上傳大小限制 (MB)</Label>
                  <Input 
                    id="maxFileUpload" 
                    type="number" 
                    value={settings.maxFileUploadSize}
                    onChange={(e) => updateSetting('maxFileUploadSize', Number(e.target.value))}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  <CardTitle>資料維護</CardTitle>
                </div>
                <CardDescription>資料備份與清理設定</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>資料備份操作</Label>
                  <div className="flex gap-2">
                    <Button variant="outline">立即備份</Button>
                    <Button variant="outline">還原備份</Button>
                    <Button variant="outline">下載備份檔</Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retentionDays">資料保留天數</Label>
                  <Input 
                    id="retentionDays" 
                    type="number" 
                    value={settings.dataRetentionDays}
                    onChange={(e) => updateSetting('dataRetentionDays', Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">已結案需求的保留期限</p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">自動備份</Label>
                    <p className="text-sm text-muted-foreground">每日自動備份資料</p>
                  </div>
                  <Switch 
                    checked={settings.autoBackup} 
                    onCheckedChange={(checked) => updateSetting('autoBackup', checked)}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">維護模式</Label>
                      <p className="text-sm text-muted-foreground">
                        啟用時系統將顯示維護訊息
                        {settings.maintenanceMode && <Badge className="ml-2">已啟用</Badge>}
                      </p>
                    </div>
                    <Switch 
                      checked={settings.maintenanceMode} 
                      onCheckedChange={(checked) => updateSetting('maintenanceMode', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">除錯模式</Label>
                      <p className="text-sm text-muted-foreground">
                        顯示詳細的系統除錯資訊
                        {settings.debugMode && <Badge variant="secondary" className="ml-2">已啟用</Badge>}
                      </p>
                    </div>
                    <Switch 
                      checked={settings.debugMode} 
                      onCheckedChange={(checked) => updateSetting('debugMode', checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  <CardTitle>系統資訊</CardTitle>
                </div>
                <CardDescription>目前系統狀態與統計</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">系統版本：</span>
                    <span className="font-medium">{settings.systemVersion}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">資料庫版本：</span>
                    <span className="font-medium">PostgreSQL 15.2</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">上次備份：</span>
                    <span className="font-medium">2024-12-24 03:00</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">系統啟動時間：</span>
                    <span className="font-medium">2024-12-20 09:15</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}

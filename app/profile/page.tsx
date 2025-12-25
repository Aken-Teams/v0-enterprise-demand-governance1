"use client"

import { useState, useRef, useEffect } from "react"
import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User, Mail, Building2, Bell, Globe, Shield, Upload, Camera, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

export default function ProfilePage() {
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 載入已儲存的頭像
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAvatar = localStorage.getItem('userAvatar')
      if (savedAvatar) {
        setCurrentUserAvatar(savedAvatar)
      }
    }
  }, [])

  // 預設頭像選項
  const defaultAvatars = [
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1494790108755-2616c9c4b91e?w=150&h=150&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face",
  ]

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // 驗證檔案格式
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      if (!validTypes.includes(file.type)) {
        alert('請上傳有效的圖片檔案 (JPG, PNG, GIF, WebP)')
        return
      }
      
      // 驗證檔案大小 (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('檔案大小不能超過 5MB')
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string)
        setSelectedAvatar(null)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDefaultAvatarSelect = (avatarUrl: string) => {
    setSelectedAvatar(avatarUrl)
    setAvatarPreview(null)
  }

  const handleSaveAvatar = () => {
    const newAvatar = avatarPreview || selectedAvatar
    if (newAvatar) {
      // 儲存到 localStorage
      localStorage.setItem('userAvatar', newAvatar)
      setCurrentUserAvatar(newAvatar)
      console.log('儲存新頭像:', newAvatar)
      alert('頭像更新成功！')
      setAvatarDialogOpen(false)
      setAvatarPreview(null)
      setSelectedAvatar(null)
    }
  }

  const handleRemoveAvatar = () => {
    localStorage.removeItem('userAvatar')
    setCurrentUserAvatar(null)
    setAvatarPreview(null)
    setSelectedAvatar(null)
    alert('頭像已移除！')
  }

  const currentAvatar = avatarPreview || selectedAvatar || currentUserAvatar

  return (
    <AppLayout userRole="subsidiary">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">個人設定</h1>
          <p className="text-muted-foreground">管理您的帳戶資訊與偏好設定</p>
        </div>

        {/* Profile Info */}
        <Card>
          <CardHeader>
            <CardTitle>基本資料</CardTitle>
            <CardDescription>您的個人資訊與聯絡方式</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={currentAvatar || undefined} alt="用戶頭像" />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <User className="h-10 w-10" />
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setAvatarDialogOpen(true)
                    setAvatarPreview(null)
                    setSelectedAvatar(null)
                  }}
                  className="flex items-center gap-2"
                >
                  <Camera className="h-4 w-4" />
                  更換頭像
                </Button>
                <p className="text-xs text-muted-foreground">
                  支援 JPG, PNG, GIF 格式，檔案大小不超過 5MB
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">姓名</Label>
                <Input id="name" defaultValue="張小明" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">電子郵件</Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <Input id="email" type="email" defaultValue="ming.chang@company.com" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="organization">所屬組織</Label>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <Input id="organization" defaultValue="子公司 A" disabled />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">角色</Label>
                <Input id="role" defaultValue="子公司使用者" disabled />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button>儲存變更</Button>
              <Button variant="outline">取消</Button>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              通知設定
            </CardTitle>
            <CardDescription>管理您接收通知的方式與時機</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">需求狀態更新</Label>
                <p className="text-sm text-muted-foreground">當需求狀態改變時通知我</p>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">驗收提醒</Label>
                <p className="text-sm text-muted-foreground">當有需求待驗收時提醒我</p>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Sprint 通知</Label>
                <p className="text-sm text-muted-foreground">Sprint 開始與結束時通知我</p>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">系統公告</Label>
                <p className="text-sm text-muted-foreground">接收系統維護與更新通知</p>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">電子郵件摘要</Label>
                <p className="text-sm text-muted-foreground">每日接收活動摘要郵件</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              介面偏好
            </CardTitle>
            <CardDescription>自訂您的使用體驗</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="language">語言</Label>
              <Select defaultValue="zh-TW">
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zh-TW">繁體中文</SelectItem>
                  <SelectItem value="zh-CN">简体中文</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">時區</Label>
              <Select defaultValue="asia-taipei">
                <SelectTrigger id="timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asia-taipei">台北 (GMT+8)</SelectItem>
                  <SelectItem value="asia-shanghai">上海 (GMT+8)</SelectItem>
                  <SelectItem value="asia-tokyo">東京 (GMT+9)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pageSize">每頁顯示筆數</Label>
              <Select defaultValue="20">
                <SelectTrigger id="pageSize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 筆</SelectItem>
                  <SelectItem value="20">20 筆</SelectItem>
                  <SelectItem value="50">50 筆</SelectItem>
                  <SelectItem value="100">100 筆</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              安全性
            </CardTitle>
            <CardDescription>管理您的帳戶安全設定</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>變更密碼</Label>
              <Button variant="outline">更新密碼</Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">雙重驗證</Label>
                <p className="text-sm text-muted-foreground">增強帳戶安全性</p>
              </div>
              <Switch />
            </div>

            <div className="space-y-2">
              <Label>登入記錄</Label>
              <Button variant="outline">查看最近登入</Button>
            </div>
          </CardContent>
        </Card>

        {/* 頭像更換對話框 */}
        <Dialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                更換頭像
              </DialogTitle>
              <DialogDescription>
                選擇新的頭像或上傳自己的照片
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* 目前預覽 */}
              <div className="flex flex-col items-center gap-3">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={currentAvatar || undefined} alt="頭像預覽" />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <User className="h-12 w-12" />
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm text-muted-foreground">預覽</p>
              </div>

              {/* 上傳檔案 */}
              <div className="space-y-3">
                <Label className="text-base font-medium">上傳自定義頭像</Label>
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    選擇檔案
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    支援 JPG, PNG, GIF, WebP 格式，大小不超過 5MB
                  </p>
                </div>
              </div>

              {/* 預設頭像選擇 */}
              <div className="space-y-3">
                <Label className="text-base font-medium">選擇預設頭像</Label>
                <div className="grid grid-cols-3 gap-3">
                  {defaultAvatars.map((avatar, index) => (
                    <button
                      key={index}
                      onClick={() => handleDefaultAvatarSelect(avatar)}
                      className={cn(
                        "relative rounded-full border-2 transition-all hover:scale-105",
                        selectedAvatar === avatar
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={avatar} alt={`預設頭像 ${index + 1}`} />
                        <AvatarFallback>
                          <User className="h-8 w-8" />
                        </AvatarFallback>
                      </Avatar>
                      {selectedAvatar === avatar && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-primary/20">
                          <div className="rounded-full bg-primary p-1">
                            <User className="h-3 w-3 text-primary-foreground" />
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 移除頭像選項 */}
              {currentUserAvatar && (
                <div className="space-y-3 border-t pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveAvatar}
                    className="w-full text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    移除當前頭像
                  </Button>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setAvatarDialogOpen(false)}>
                取消
              </Button>
              <Button 
                onClick={handleSaveAvatar}
                disabled={!avatarPreview && !selectedAvatar}
              >
                儲存頭像
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}

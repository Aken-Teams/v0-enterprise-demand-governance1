"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  Plus, Trash2, AlertTriangle, Calendar, Save, Loader2,
} from "lucide-react"
import { DEFAULT_SUBTASK_TEMPLATES } from "@/lib/constants/demand"

interface SubTask {
  id: string
  name: string
  plannedStart: string | null
  plannedEnd: string | null
  actualStart: string | null
  actualEnd: string | null
  status: string
  assignee: { id: string; name: string } | null
  order: number
}

interface SubTaskEditorProps {
  subTasks: SubTask[]
  demandId: string
  token: string | null
  staffUsers: { id: string; name: string }[]
  /** DEVELOPING phase planned date range */
  devStart: string | null
  devEnd: string | null
  onRefresh: () => void
  onViewGantt: () => void
}

function toDateInput(val: string | null) {
  if (!val) return ""
  return new Date(val).toISOString().slice(0, 10)
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-400",
  in_progress: "bg-blue-500",
  completed: "bg-emerald-500",
}

const STATUS_LABELS: Record<string, string> = {
  pending: "待開始",
  in_progress: "進行中",
  completed: "已完成",
}

export function SubTaskEditor({
  subTasks,
  demandId,
  token,
  staffUsers,
  devStart,
  devEnd,
  onRefresh,
  onViewGantt,
}: SubTaskEditorProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newTaskName, setNewTaskName] = useState("")
  const [newTaskStart, setNewTaskStart] = useState("")
  const [newTaskEnd, setNewTaskEnd] = useState("")
  const [newTaskAssignee, setNewTaskAssignee] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  const devStartDate = devStart ? toDateInput(devStart) : ""
  const devEndDate = devEnd ? toDateInput(devEnd) : ""

  const isOutOfRange = (start: string, end: string) => {
    if (!devStartDate || !devEndDate) return false
    if (start && start < devStartDate) return true
    if (end && end > devEndDate) return true
    return false
  }

  const handleAddTask = async () => {
    if (!token || !newTaskName.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/demands/${demandId}/sub-tasks`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTaskName.trim(),
          plannedStart: newTaskStart || null,
          plannedEnd: newTaskEnd || null,
          assigneeId: newTaskAssignee || null,
          order: subTasks.length,
        }),
      })
      if (res.ok) {
        setShowAddDialog(false)
        setNewTaskName("")
        setNewTaskStart("")
        setNewTaskEnd("")
        setNewTaskAssignee("")
        onRefresh()
      }
    } catch { /* ignore */ } finally {
      setSubmitting(false)
    }
  }

  const handleAddTemplates = async () => {
    if (!token) return
    setSubmitting(true)
    try {
      for (let i = 0; i < DEFAULT_SUBTASK_TEMPLATES.length; i++) {
        await fetch(`/api/demands/${demandId}/sub-tasks`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: DEFAULT_SUBTASK_TEMPLATES[i], order: i }),
        })
      }
      onRefresh()
    } catch { /* ignore */ } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (taskId: string, field: string, value: string | null) => {
    if (!token) return
    setSavingId(taskId)
    try {
      await fetch(`/api/demands/${demandId}/sub-tasks/${taskId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      })
      onRefresh()
    } catch { /* ignore */ } finally {
      setSavingId(null)
    }
  }

  const handleDelete = async (taskId: string) => {
    if (!token) return
    try {
      await fetch(`/api/demands/${demandId}/sub-tasks/${taskId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      onRefresh()
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-3">
      {/* Dev phase date range reference */}
      {(devStartDate || devEndDate) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span>開發階段時程：</span>
          <span className="font-medium text-foreground">
            {devStartDate || "未設定"} ~ {devEndDate || "未設定"}
          </span>
          <span className="text-muted-foreground">（子任務時間需在此範圍內）</span>
        </div>
      )}

      {/* Table header */}
      {subTasks.length > 0 && (
        <div className="grid grid-cols-[auto_1fr_100px_100px_120px_auto] gap-2 text-xs font-medium text-muted-foreground px-1 items-center">
          <span className="w-5" />
          <span>任務名稱</span>
          <span>開始日期</span>
          <span>結束日期</span>
          <span>負責人</span>
          <span className="w-8" />
        </div>
      )}

      {/* Task rows */}
      {subTasks.map((task) => {
        const taskStart = toDateInput(task.plannedStart)
        const taskEnd = toDateInput(task.plannedEnd)
        const outOfRange = isOutOfRange(taskStart, taskEnd)

        return (
          <div key={task.id} className={cn(
            "grid grid-cols-[auto_1fr_100px_100px_120px_auto] gap-2 items-center rounded-md px-1 py-1",
            outOfRange && "bg-red-50/50",
          )}>
            {/* Status dot */}
            <button
              onClick={() => {
                const next = task.status === "pending" ? "in_progress" : task.status === "in_progress" ? "completed" : "pending"
                handleUpdate(task.id, "status", next)
              }}
              className={cn("h-4 w-4 rounded-full shrink-0 transition-colors cursor-pointer", STATUS_COLORS[task.status])}
              title={`${STATUS_LABELS[task.status]}（點擊切換）`}
            />

            {/* Name */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={cn("text-sm truncate", task.status === "completed" && "line-through text-muted-foreground")}>
                {task.name}
              </span>
              {savingId === task.id && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />}
              {outOfRange && (
                <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" title="日期超出開發階段範圍" />
              )}
            </div>

            {/* Planned Start */}
            <Input
              type="date"
              className={cn("h-7 text-xs", outOfRange && taskStart && taskStart < devStartDate && "border-red-300")}
              value={taskStart}
              min={devStartDate || undefined}
              max={devEndDate || undefined}
              onChange={(e) => handleUpdate(task.id, "plannedStart", e.target.value || null)}
            />

            {/* Planned End */}
            <Input
              type="date"
              className={cn("h-7 text-xs", outOfRange && taskEnd && taskEnd > devEndDate && "border-red-300")}
              value={taskEnd}
              min={devStartDate || undefined}
              max={devEndDate || undefined}
              onChange={(e) => handleUpdate(task.id, "plannedEnd", e.target.value || null)}
            />

            {/* Assignee */}
            <Select
              value={task.assignee?.id || "none"}
              onValueChange={(v) => handleUpdate(task.id, "assigneeId", v === "none" ? null : v)}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">未指派</SelectItem>
                {staffUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Delete */}
            <button
              onClick={() => handleDelete(task.id)}
              className="text-muted-foreground/40 hover:text-destructive transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}

      {subTasks.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">尚未建立子任務</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-border/50">
        <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          新增子任務
        </Button>
        {subTasks.length === 0 && (
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={handleAddTemplates} disabled={submitting}>
            使用預設模板
          </Button>
        )}
        <Button variant="outline" size="sm" className="text-xs ml-auto" onClick={onViewGantt}>
          查看甘特圖
        </Button>
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新增子任務</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">任務名稱</Label>
              <Input value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} placeholder="例如：前端開發" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">計畫開始</Label>
                <Input
                  type="date"
                  value={newTaskStart}
                  min={devStartDate || undefined}
                  max={devEndDate || undefined}
                  onChange={(e) => setNewTaskStart(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-sm">計畫結束</Label>
                <Input
                  type="date"
                  value={newTaskEnd}
                  min={devStartDate || undefined}
                  max={devEndDate || undefined}
                  onChange={(e) => setNewTaskEnd(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label className="text-sm">負責人</Label>
              <Select value={newTaskAssignee || "none"} onValueChange={(v) => setNewTaskAssignee(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">未指派</SelectItem>
                  {staffUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {devStartDate && devEndDate && (
              <p className="text-xs text-muted-foreground">
                開發階段：{devStartDate} ~ {devEndDate}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>取消</Button>
            <Button onClick={handleAddTask} disabled={!newTaskName.trim() || submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              新增
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

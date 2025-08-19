"use client"

import { useState, useMemo } from "react"
import { useData } from "../../hooks/useData"
import { MainLayout } from "../../components/layout/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select"
import { Badge } from "../../components/ui/badge"
import { StatusBadge } from "../../components/ui/status-badge"
import { ConfirmationDialog } from "../../components/ui/confirmation-dialog"
import { DroppableDay } from "../../components/calendar/droppable-day"
import { ChevronLeft, ChevronRight, Filter, CalendarIcon } from "lucide-react"
import { detectConflicts } from "../../utils/schedulingUtils"
import type { ScheduleSession } from "../../utils/schedulingUtils"

export default function CalendarPage() {
  const { batches, courses, subjects, trainers, holidays, schedules, loading, setSchedules } = useData()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<"month" | "week">("month")
  const [selectedBatch, setSelectedBatch] = useState<string>("all")
  const [selectedTrainer, setSelectedTrainer] = useState<string>("all")
  const [selectedLocation, setSelectedLocation] = useState<string>("all")

  const [draggedSession, setDraggedSession] = useState<
    (ScheduleSession & { batchId: string; batchName: string }) | null
  >(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingReschedule, setPendingReschedule] = useState<{
    session: ScheduleSession & { batchId: string; batchName: string }
    newDate: string
    conflicts: string[]
  } | null>(null)

  // Use normalized schedules table and decorate with batch info for display
  const allSessions = useMemo(() => {
    const sessions: (ScheduleSession & { batchId: string; batchName: string; id?: string })[] = []
    schedules.forEach((entry) => {
      const batch = batches.find((b) => b.id === entry.batchId)
      if (!batch) return
      sessions.push({
        id: entry.id,
        date: entry.date,
        subjectId: entry.subjectId,
        trainerId: entry.trainerId,
        status: entry.status,
        timeSlot: entry.timeSlot,
        sessionType: entry.sessionType,
        batchId: entry.batchId,
        batchName: batch.name,
      })
    })
    return sessions
  }, [schedules, batches])

  // Filter sessions based on selected filters
  const filteredSessions = useMemo(() => {
    return allSessions.filter((session) => {
      if (selectedBatch !== "all" && session.batchId !== selectedBatch) return false
      if (selectedTrainer !== "all" && session.trainerId !== selectedTrainer) return false

      if (selectedLocation !== "all") {
        const batch = batches.find((b) => b.id === session.batchId)
        if (batch?.location !== selectedLocation) return false
      }

      return true
    })
  }, [allSessions, selectedBatch, selectedTrainer, selectedLocation, batches])

  const handleDragStart = (session: ScheduleSession & { batchId: string; batchName: string }) => {
    setDraggedSession(session)
  }

  const handleDragEnd = () => {
    setDraggedSession(null)
  }

  const handleDrop = (targetDate: string, session: ScheduleSession & { batchId: string; batchName: string }) => {
    // Check for conflicts before rescheduling
    const batch = batches.find((b) => b.id === session.batchId)
    if (!batch) return

    // Create a temporary schedule with the moved session
    const tempSchedule = allSessions.map((s) => (s.id === session.id ? { ...s, date: targetDate } : s))
    const conflicts = detectConflicts(tempSchedule, trainers)
    const sessionConflicts = conflicts.filter((c) => c.sessionId === session.id)

    if (sessionConflicts.length > 0) {
      setPendingReschedule({
        session,
        newDate: targetDate,
        conflicts: sessionConflicts.map((c) => c.reason),
      })
      setShowConfirmDialog(true)
    } else {
      // No conflicts, proceed with rescheduling
      performReschedule(session, targetDate)
    }
  }

  const performReschedule = (session: ScheduleSession & { batchId: string; batchName: string }, newDate: string) => {
    // Update schedules table entry date
    const updated = schedules.map((e) => (e.id === session.id ? { ...e, date: newDate } : e))
    setSchedules(updated as any)
  }

  const handleConfirmReschedule = () => {
    if (pendingReschedule) {
      performReschedule(pendingReschedule.session, pendingReschedule.newDate)
      setPendingReschedule(null)
    }
  }

  const handleCancelReschedule = () => {
    setPendingReschedule(null)
  }

  // Get calendar days for current view
  const getCalendarDays = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    if (viewMode === "month") {
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0)
      const startDate = new Date(firstDay)
      startDate.setDate(startDate.getDate() - firstDay.getDay())

      const days = []
      const current = new Date(startDate)

      for (let i = 0; i < 42; i++) {
        days.push(new Date(current))
        current.setDate(current.getDate() + 1)
      }

      return days
    } else {
      // Week view
      const startOfWeek = new Date(currentDate)
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())

      const days = []
      const current = new Date(startOfWeek)

      for (let i = 0; i < 7; i++) {
        days.push(new Date(current))
        current.setDate(current.getDate() + 1)
      }

      return days
    }
  }

  const calendarDays = getCalendarDays()

  // Get sessions for a specific date
  const getSessionsForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0]
    return filteredSessions.filter((session) => session.date === dateStr)
  }

  // Navigation functions
  const navigatePrevious = () => {
    const newDate = new Date(currentDate)
    if (viewMode === "month") {
      newDate.setMonth(newDate.getMonth() - 1)
    } else {
      newDate.setDate(newDate.getDate() - 7)
    }
    setCurrentDate(newDate)
  }

  const navigateNext = () => {
    const newDate = new Date(currentDate)
    if (viewMode === "month") {
      newDate.setMonth(newDate.getMonth() + 1)
    } else {
      newDate.setDate(newDate.getDate() + 7)
    }
    setCurrentDate(newDate)
  }

  const navigateToday = () => {
    setCurrentDate(new Date())
  }

  // Get unique locations
  const locations = Array.from(new Set(batches.map((batch) => batch.location)))

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg">Loading...</div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master Calendar</h1>
          <p className="text-gray-600">View and manage all training schedules • Drag sessions to reschedule</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={navigateToday}>
            Today
          </Button>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={navigatePrevious}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={navigateNext}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Select value={viewMode} onValueChange={(value: "month" | "week") => setViewMode(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="week">Week</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <Filter className="w-4 h-4 text-gray-400" />
            <Select value={selectedBatch} onValueChange={setSelectedBatch}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Batches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Batches</SelectItem>
                {batches.map((batch) => (
                  <SelectItem key={batch.id} value={batch.id}>
                    {batch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedTrainer} onValueChange={setSelectedTrainer}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Trainers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trainers</SelectItem>
                {trainers.map((trainer) => (
                  <SelectItem key={trainer.id} value={trainer.id}>
                    {trainer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={location} value={location}>
                    {location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <CalendarIcon className="w-5 h-5 mr-2" />
              {currentDate.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
                ...(viewMode === "week" && { day: "numeric" }),
              })}
            </span>
            <div className="flex items-center space-x-2">
                              <Badge variant="outline" className="bg-primary/10 text-primary">
                {filteredSessions.filter((s) => s.status === "assigned").length} Assigned
              </Badge>
              <Badge variant="outline" className="bg-orange-50 text-orange-700">
                {filteredSessions.filter((s) => s.status === "unassigned").length} Unassigned
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Calendar Grid */}
          <div className={`grid gap-1 ${viewMode === "month" ? "grid-cols-7" : "grid-cols-7"}`}>
            {/* Day Headers */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="p-2 text-center text-sm font-medium text-gray-500 border-b">
                {day}
              </div>
            ))}

            {/* Calendar Days - Updated to use DroppableDay component */}
            {calendarDays.map((day, index) => {
              const sessions = getSessionsForDate(day)
              const isCurrentMonth = day.getMonth() === currentDate.getMonth()
              const isToday = day.toDateString() === new Date().toDateString()
              const isWeekend = day.getDay() === 0 || day.getDay() === 6

              return (
                <DroppableDay
                  key={index}
                  day={day}
                  sessions={sessions}
                  subjects={subjects}
                  trainers={trainers}
                  batches={batches}
                  isCurrentMonth={isCurrentMonth}
                  isToday={isToday}
                  isWeekend={isWeekend}
                  viewMode={viewMode}
                  draggedSession={draggedSession}
                  onDrop={handleDrop}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                />
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Schedule Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Schedule Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm">Total Sessions</span>
                <span className="font-medium">{filteredSessions.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Assigned Sessions</span>
                <span className="font-medium text-primary">
                  {filteredSessions.filter((s) => s.status === "assigned").length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Unassigned Sessions</span>
                <span className="font-medium text-orange-600">
                  {filteredSessions.filter((s) => s.status === "unassigned").length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Completion Rate</span>
                <span className="font-medium">
                  {filteredSessions.length > 0
                    ? Math.round(
                        (filteredSessions.filter((s) => s.status === "assigned").length / filteredSessions.length) *
                          100,
                      )
                    : 0}
                  %
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredSessions
                .filter((session) => new Date(session.date) >= new Date())
                .slice(0, 5)
                .map((session, index) => {
                  const subject = subjects.find((s) => s.id === session.subjectId)
                  const trainer = trainers.find((t) => t.id === session.trainerId)
                  const batch = batches.find((b) => b.id === session.batchId)

                  return (
                    <div key={index} className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{subject?.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {batch?.name} • {session.date}
                        </div>
                      </div>
                      <StatusBadge status={session.status} />
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conflicts & Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredSessions
                .filter((session) => session.conflicts && session.conflicts.length > 0)
                .slice(0, 5)
                .map((session, index) => {
                  const subject = subjects.find((s) => s.id === session.subjectId)
                  const batch = batches.find((b) => b.id === session.batchId)

                  return (
                    <div key={index} className="p-2 bg-red-50 rounded border border-red-200">
                      <div className="text-sm font-medium text-red-800">{subject?.name}</div>
                      <div className="text-xs text-red-600">
                        {batch?.name} • {session.date}
                      </div>
                      <div className="text-xs text-red-600 mt-1">{session.conflicts?.[0]}</div>
                    </div>
                  )
                })}
              {filteredSessions.filter((session) => session.conflicts && session.conflicts.length > 0).length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  <CalendarIcon className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm">No conflicts detected</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title="Reschedule with Conflicts"
        description={
          pendingReschedule
            ? `The following conflicts were detected when rescheduling this session:\n\n${pendingReschedule.conflicts.join("\n")}\n\nDo you want to proceed anyway?`
            : ""
        }
        confirmText="Reschedule Anyway"
        cancelText="Cancel"
        onConfirm={handleConfirmReschedule}
        onCancel={handleCancelReschedule}
        variant="destructive"
      />
    </MainLayout>
  )
}

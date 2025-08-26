"use client"

import { useState } from "react"
import { useData } from "../../hooks/useData"
import { MainLayout } from "../../components/layout/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { StatusBadge } from "../../components/ui/status-badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog"
import { Label } from "../../components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select"
import { Plus, Search, Edit, Calendar, MapPin, Users, BookOpen, Clock, AlertTriangle, RefreshCw } from "lucide-react"
import { generateSchedule, calculateBatchEndDate, optimizeSchedule } from "../../utils/schedulingUtils"
import type { Batch } from "../../hooks/useData"
import { getSupabaseClient } from "../../lib/supabaseClient"

export default function BatchesPage() {
  const { batches, courses, trainers, subjects, holidays, schedules, setBatches, setSchedules, loading } = useData()
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null)
  const [errorOpen, setErrorOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>("")

  const [formData, setFormData] = useState({
    name: "",
    courseId: "",
    location: "",
    timeSlot: "",
    batchType: "weekday" as "weekday" | "weekend", // Added batch type for weekend/weekday
    startDate: "",
    endDate: "",
    maxStudents: 20,
    currentStudents: 0,
    status: "active" as "active" | "completed" | "cancelled",
  })

  const filteredBatches = batches.filter((batch) => batch.name.toLowerCase().includes(searchTerm.toLowerCase()))

  const handleAddBatch = async () => {
    const course = courses.find((c) => c.id === formData.courseId)
    const calculatedEndDate = course
      ? calculateBatchEndDate(formData.startDate, course, subjects, formData.batchType as "weekday" | "weekend")
      : formData.endDate

    const supabase = getSupabaseClient()
    const courseIdNum = Number.isNaN(Number.parseInt(formData.courseId)) ? null : Number.parseInt(formData.courseId)
    const allowedStatuses = ["active", "completed", "cancelled"] as const
    const statusSafe = allowedStatuses.includes(formData.status as any) ? formData.status : "active"
    const insertPayload = {
      batch_name: formData.name,
      course_id: courseIdNum,
      location: formData.location,
      status: statusSafe,
      start_date: formData.startDate,
      end_date: calculatedEndDate,
      current_students: formData.currentStudents,
    }
    const { data: inserted, error } = await supabase.from("batches").insert(insertPayload).select("*").single()
    if (error) {
      console.error("Failed to insert batch:", error)
      setErrorMessage(error.message || "Failed to add batch")
      setErrorOpen(true)
      return
    }
    const newBatch: Batch = {
      id: String(inserted.batch_id ?? inserted.id),
      name: inserted.batch_name,
      courseId: String(inserted.course_id),
      location: inserted.location,
      timeSlot: undefined,
      batchType: undefined,
      startDate: inserted.start_date,
      endDate: inserted.end_date,
      status: inserted.status,
      maxStudents: formData.maxStudents,
      currentStudents: inserted.current_students ?? 0,
      generatedSchedule: [],
      subjectAssignments: [],
    }

    if (course) {
      const schedule = generateSchedule(newBatch, course, subjects, trainers, holidays)
      newBatch.generatedSchedule = schedule

      // Generate subject assignments for each subject in the course
      newBatch.subjectAssignments = course.subjects.map((subjectId) => {
        const subject = subjects.find((s) => s.id === subjectId)
        const subjectSessions = schedule.filter((s) => s.subjectId === subjectId)
        const assignedTrainer = subjectSessions.find((s) => s.trainerId)?.trainerId

        return {
          subjectId,
          subjectName: subject?.name || "Unknown Subject",
          trainerId: assignedTrainer || null,
          trainerName: assignedTrainer
            ? trainers.find((t) => t.id === assignedTrainer)?.name || "Unassigned"
            : "Unassigned",
          startDate: subjectSessions[0]?.date || "",
          endDate: subjectSessions[subjectSessions.length - 1]?.date || "",
          sessionsCount: subjectSessions.length,
          status: assignedTrainer ? "assigned" : "unassigned",
          canChange: true,
        }
      })
    }

    setBatches([...batches, newBatch])
    setIsAddDialogOpen(false)
    resetForm()
  }

  const handleEditBatch = (batch: Batch) => {
    setEditingBatch(batch)
    setFormData({
      name: batch.name,
      courseId: batch.courseId,
      location: batch.location,
      timeSlot: batch.timeSlot || "", // Include time slot in edit
      batchType: (batch.batchType as "weekday" | "weekend") || "weekday", // Include batch type in edit
      startDate: batch.startDate,
      endDate: batch.endDate,
      maxStudents: batch.maxStudents,
      currentStudents: batch.currentStudents,
      status: (batch.status as "active" | "completed" | "cancelled") || "active",
    })
  }

  const handleUpdateBatch = async () => {
    if (!editingBatch) return
    const supabase = getSupabaseClient()
    const courseIdNum = Number.isNaN(Number.parseInt(formData.courseId)) ? null : Number.parseInt(formData.courseId)
    const allowedStatuses = ["active", "completed", "cancelled"] as const
    const statusSafe = allowedStatuses.includes(formData.status as any) ? formData.status : "active"
    const payload = {
      batch_name: formData.name,
      course_id: courseIdNum,
      location: formData.location,
      status: statusSafe,
      start_date: formData.startDate,
      end_date: formData.endDate,
      current_students: formData.currentStudents,
    }
    const batchIdNum = Number.parseInt(editingBatch.id)
    try {
      const { error } = await supabase
        .from("batches")
        .update(payload)
        .eq("batch_id", batchIdNum)
        .select("*")
        .single()
      if (error) throw error
    } catch (e: any) {
      console.error("Failed to update batch:", e)
      setErrorMessage(e?.message || "Failed to update batch")
      setErrorOpen(true)
    }
    const updatedBatches = batches.map((batch) =>
      batch.id === editingBatch.id
        ? {
            ...batch,
            name: formData.name,
            courseId: formData.courseId,
            location: formData.location,
            timeSlot: formData.timeSlot || undefined,
            batchType: formData.batchType,
            startDate: formData.startDate,
            endDate: formData.endDate,
            maxStudents: formData.maxStudents,
            currentStudents: formData.currentStudents,
            status: formData.status,
          }
        : batch,
    )
    setBatches(updatedBatches)
    setEditingBatch(null)
    resetForm()
  }

  const handleDeleteBatch = async (batchId: string) => {
    const supabase = getSupabaseClient()
    const batchIdNum = Number.parseInt(batchId)
    try {
      const { error } = await supabase.from("batches").delete().eq("batch_id", batchIdNum)
      if (error) throw error
    } catch (e: any) {
      console.error("Failed to delete batch:", e)
      setErrorMessage(e?.message || "Failed to delete batch")
      setErrorOpen(true)
      return
    }
    setBatches(batches.filter((b) => b.id !== batchId))
  }

  const handleGenerateSchedule = async (batch: Batch) => {
    const course = courses.find((c) => c.id === batch.courseId)
    if (!course) return

    const schedule = optimizeSchedule(
      generateSchedule(batch, course, subjects, trainers, holidays),
      trainers,
    )
    const updatedBatches = batches.map((b) => (b.id === batch.id ? { ...b, generatedSchedule: schedule } : b))
    setBatches(updatedBatches)

    // Persist generated schedule to Supabase 'schedules' table
    const supabase = getSupabaseClient()
    const batchIdNum = Number.parseInt(batch.id)
    const rows = schedule.map((s) => {
      const [rawStart, rawEnd] = (s.timeSlot || "09:00-17:00").split("-")
      const start_time = rawStart.length === 5 ? `${rawStart}:00` : rawStart
      const end_time = rawEnd.length === 5 ? `${rawEnd}:00` : rawEnd
      return {
        batch_id: batchIdNum,
        trainer_id: s.trainerId ? Number.parseInt(s.trainerId) : null,
        subject_id: Number.isNaN(Number.parseInt(s.subjectId)) ? null : Number.parseInt(s.subjectId),
        date: s.date,
        start_time,
        end_time,
        status: "planned",
      }
    })
    try {
      // Replace any existing generated schedules for this batch
      await supabase.from("schedules").delete().eq("batch_id", batchIdNum)
      const insertable = rows.filter((r) => r.trainer_id !== null)
      const skipped = rows.length - insertable.length
      const { error: insError } = await supabase.from("schedules").insert(insertable)
      if (insError) throw insError

      // Refresh schedules in client state for this batch
      const { data: fresh, error: fetchErr } = await supabase
        .from("schedules")
        .select("*")
        .eq("batch_id", batchIdNum)
      if (fetchErr) throw fetchErr

      const batchIdStr = String(batchIdNum)
      const refreshed = (fresh || []).map((s: any) => {
        const startTime = s.start_time ?? "09:00:00"
        const endTime = s.end_time ?? "17:00:00"
        const timeSlot = `${String(startTime).slice(0,5)}-${String(endTime).slice(0,5)}`
        const trainerId = s.trainer_id != null ? String(s.trainer_id) : undefined
        const status = trainerId ? "assigned" : "unassigned"
        return {
          id: String(s.schedule_id ?? s.id),
          batchId: batchIdStr,
          courseId: batch.courseId,
          date: s.date ?? "",
          subjectId: String(s.subject_id ?? ""),
          trainerId,
          status,
          timeSlot,
          sessionType: "regular",
        }
      })
      setSchedules((prev: any[]) => {
        const others = (prev || []).filter((p: any) => p.batchId !== batchIdStr)
        return [...others, ...refreshed]
      })

      if (skipped > 0) {
        setErrorMessage(`${skipped} sessions had no trainer and were not saved. Use Regenerate or assign trainers.`)
        setErrorOpen(true)
      }
    } catch (e) {
      console.error("Failed to persist schedule:", e)
      setErrorMessage((e as any)?.message || "Failed to persist schedule")
      setErrorOpen(true)
    }
  }

  const handleReassignTrainer = (batchId: string, subjectId: string, newTrainerId: string) => {
    const updatedBatches = batches.map((batch) => {
      if (batch.id === batchId) {
        // Update subject assignments
        const updatedSubjectAssignments =
          batch.subjectAssignments?.map((assignment) => {
            if (assignment.subjectId === subjectId) {
              const newTrainer = trainers.find((t) => t.id === newTrainerId)
              return {
                ...assignment,
                trainerId: newTrainerId,
                trainerName: newTrainer?.name || "Unassigned",
                status: "assigned" as const,
              }
            }
            return assignment
          }) || []

        // Update generated schedule
        const updatedSchedule = batch.generatedSchedule.map((session) => {
          if (session.subjectId === subjectId) {
            return {
              ...session,
              trainerId: newTrainerId,
              status: "assigned" as const,
            }
          }
          return session
        })

        return {
          ...batch,
          subjectAssignments: updatedSubjectAssignments,
          generatedSchedule: updatedSchedule,
        }
      }
      return batch
    })

    setBatches(updatedBatches)
  }

  const getAssignedTrainer = (batch: Batch) => {
    const assignedSessions = batch.generatedSchedule.filter((s) => s.status === "assigned")
    if (assignedSessions.length === 0) return null

    const trainerCounts = assignedSessions.reduce(
      (acc, session) => {
        if (session.trainerId) {
          acc[session.trainerId] = (acc[session.trainerId] || 0) + 1
        }
        return acc
      },
      {} as Record<string, number>,
    )

    const primaryTrainerId = Object.entries(trainerCounts).sort(([, a], [, b]) => b - a)[0]?.[0]

    return trainers.find((t) => t.id === primaryTrainerId)
  }

  const getUnassignedSessions = (batch: Batch) => {
    return batch.generatedSchedule.filter((s) => s.status === "unassigned").length
  }

  const resetForm = () => {
    setFormData({
      name: "",
      courseId: "",
      location: "",
      timeSlot: "", // Reset time slot
      batchType: "weekday", // Reset batch type
      startDate: "",
      endDate: "",
      maxStudents: 20,
      currentStudents: 0,
      status: "active",
    })
  }

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
      {/* Error Dialog */}
      <Dialog open={errorOpen} onOpenChange={setErrorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-red-700">{errorMessage}</div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => setErrorOpen(false)}>OK</Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Batches</h1>
          <p className="text-gray-600">Manage training batches with automatic scheduling</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Add Batch
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Batch</DialogTitle>
            </DialogHeader>
            <BatchForm
              formData={formData}
              setFormData={setFormData}
              courses={courses}
              trainers={trainers}
              onSubmit={handleAddBatch}
              onCancel={() => setIsAddDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search batches..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Batches Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredBatches.map((batch) => {
          const course = courses.find((c) => c.id === batch.courseId)
          const sessionsForBatch = schedules.filter((s) => s.batchId === batch.id)
          const assignedSessions = sessionsForBatch.filter((s) => s.status === "assigned").length
          const totalSessions = sessionsForBatch.length
          const unassignedSessions = sessionsForBatch.filter((s) => s.status === "unassigned").length

          return (
            <Card key={batch.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2">{batch.name}</CardTitle>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center">
                        <BookOpen className="w-4 h-4 mr-1" />
                        {course?.name}
                      </div>
                      <StatusBadge status={batch.status} />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={() => handleEditBatch(batch)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Edit Batch</DialogTitle>
                        </DialogHeader>
                        <BatchForm
                          formData={formData}
                          setFormData={setFormData}
                          courses={courses}
                          trainers={trainers}
                          onSubmit={handleUpdateBatch}
                          onCancel={() => setEditingBatch(null)}
                          isEditing
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Batch Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium">Start Date</div>
                      <div className="text-xs text-muted-foreground">{batch.startDate}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium">Location</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {batch.location === "online" ? "🌐 Online" : `📍 ${batch.location}`}
                        {batch.location !== "online" && (
                          <span className="ml-1 text-xs bg-gray-200 px-1 rounded">
                            {batch.batchType === "weekend" ? "Weekend" : "Weekday"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {batch.location === "online" && batch.timeSlot && (
                  <div className="flex items-center space-x-2 p-2 bg-blue-50 rounded border border-blue-200">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <div>
                      <div className="text-sm font-medium text-blue-800">Time Slot</div>
                      <div className="text-xs text-blue-600">{batch.timeSlot}</div>
                    </div>
                  </div>
                )}

                {/* Subject Assignments derived from schedules */}
                {(() => {
                  const course = courses.find((c) => c.id === batch.courseId)
                  if (!course) return null

                  const subjectAssignments = course.subjects.map((subjectId) => {
                    const subject = subjects.find((s) => s.id === subjectId)
                    const subjectSessions = sessionsForBatch.filter((s) => s.subjectId === subjectId)
                    const assignedSession = subjectSessions.find((s) => s.trainerId)
                    const trainerId = assignedSession?.trainerId || null
                    const trainerName = trainerId ? trainers.find((t) => t.id === trainerId)?.name || "Unassigned" : "Unassigned"
                    const dates = subjectSessions.map((s) => s.date).sort()
                    const startDate = dates[0] || ""
                    const endDate = dates[dates.length - 1] || ""
                    return {
                      subjectId,
                      subjectName: subject?.name || "Unknown Subject",
                      trainerId,
                      trainerName,
                      startDate,
                      endDate,
                      sessionsCount: subjectSessions.length,
                      status: trainerId ? "assigned" : "unassigned",
                    }
                  })

                  return (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Subject Assignments</div>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {subjectAssignments.map((assignment) => (
                          <div key={assignment.subjectId} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                            <div className="flex-1">
                              <div className="font-medium">{assignment.subjectName}</div>
                              <div className="text-xs text-muted-foreground">
                                {assignment.startDate} → {assignment.endDate} • {assignment.sessionsCount} sessions
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs">{assignment.trainerName}</span>
                              <div className={`w-2 h-2 rounded-full ${assignment.status === "assigned" ? "bg-primary" : "bg-red-500"}`} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Trainer assignment ranges for this batch */}
                {(() => {
                  const map: Record<string, { start: string; end: string; count: number }> = {}
                  sessionsForBatch.forEach((s) => {
                    if (!s.trainerId) return
                    if (!map[s.trainerId]) {
                      map[s.trainerId] = { start: s.date, end: s.date, count: 0 }
                    }
                    map[s.trainerId].start = map[s.trainerId].start < s.date ? map[s.trainerId].start : s.date
                    map[s.trainerId].end = map[s.trainerId].end > s.date ? map[s.trainerId].end : s.date
                    map[s.trainerId].count += 1
                  })
                  const entries = Object.entries(map)
                  if (entries.length === 0) return null
                  return (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Trainer Assignments (date ranges)</div>
                      <div className="space-y-1">
                        {entries.map(([trainerId, info]) => {
                          const t = trainers.find((tr) => tr.id === trainerId)
                          return (
                            <div key={trainerId} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                              <span className="font-medium">{t?.name || trainerId}</span>
                              <span className="text-muted-foreground">{info.start} → {info.end} • {info.count} sessions</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Students */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium">Students</span>
                  </div>
                  <div className="text-sm">
                    {batch.currentStudents} / {batch.maxStudents}
                  </div>
                </div>

                {totalSessions > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Schedule Progress</span>
                      <span className="text-sm text-muted-foreground">
                        {assignedSessions} / {totalSessions} assigned
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${totalSessions > 0 ? (assignedSessions / totalSessions) * 100 : 0}%` }}
                      />
                    </div>

                    {unassignedSessions > 0 && (
                      <div className="flex items-center space-x-2 p-2 bg-red-50 border border-red-200 rounded">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <div className="text-sm text-red-800">
                          <strong>{unassignedSessions}</strong> sessions need trainer assignment
                        </div>
                      </div>
                    )}

                    <div className="flex justify-center">
                      <Button
                        onClick={() => handleGenerateSchedule(batch)}
                        variant="outline"
                        size="sm"
                        className="text-primary border-primary hover:bg-primary/10"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Regenerate Schedule
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Button
                      onClick={() => handleGenerateSchedule(batch)}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      size="sm"
                    >
                      Generate Schedule
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </MainLayout>
  )
}

interface BatchFormProps {
  formData: any
  setFormData: (data: any) => void
  courses: any[]
  trainers: any[]
  onSubmit: () => void
  onCancel: () => void
  isEditing?: boolean
}

function BatchForm({ formData, setFormData, courses, trainers, onSubmit, onCancel, isEditing }: BatchFormProps) {
  const locationOptions = [
    { value: "online", label: "🌐 Online", type: "online" },
    { value: "kochi", label: "📍 Kochi", type: "physical" },
    { value: "calicut", label: "📍 Calicut", type: "physical" },
  ]

  const timeSlotOptions = [
    { value: "09:00-12:00", label: "Morning (9:00 AM - 12:00 PM)" },
    { value: "14:00-17:00", label: "Afternoon (2:00 PM - 5:00 PM)" },
    { value: "18:00-21:00", label: "Evening (6:00 PM - 9:00 PM)" },
    { value: "10:00-13:00", label: "Late Morning (10:00 AM - 1:00 PM)" },
    { value: "15:00-18:00", label: "Late Afternoon (3:00 PM - 6:00 PM)" },
  ]

  const batchTypeOptions = [
    { value: "weekday", label: "📅 Weekday (Mon-Fri)", description: "Monday to Friday classes" },
    { value: "weekend", label: "📅 Weekend (Sat-Sun)", description: "Saturday and Sunday classes" },
  ]

  const isOnlineLocation = formData.location === "online"
  const isPhysicalLocation = formData.location !== "online" && formData.location !== ""

  const handleStartDateChange = (startDate: string) => {
    setFormData({ ...formData, startDate })

    if (startDate && formData.courseId) {
      const course = courses.find((c) => c.id === formData.courseId)
      if (course) {
        const calculatedEndDate = calculateBatchEndDate(
          startDate,
          course,
          courses,
          formData.batchType as "weekday" | "weekend",
        )
        setFormData((prev: any) => ({ ...prev, startDate, endDate: calculatedEndDate }))
      }
    }
  }

  const handleCourseChange = (courseId: string) => {
    setFormData({ ...formData, courseId })

    if (formData.startDate && courseId) {
      const course = courses.find((c) => c.id === courseId)
      if (course) {
        const calculatedEndDate = calculateBatchEndDate(
          formData.startDate,
          course,
          courses,
          formData.batchType as "weekday" | "weekend",
        )
        setFormData((prev: any) => ({ ...prev, courseId, endDate: calculatedEndDate }))
      }
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">Batch Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="FSWD-2024-Q1"
        />
      </div>

      <div>
        <Label htmlFor="course">Course</Label>
        <Select value={formData.courseId} onValueChange={handleCourseChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select a course" />
          </SelectTrigger>
          <SelectContent>
            {courses.map((course) => (
              <SelectItem key={course.id} value={course.id}>
                <div className="flex flex-col">
                  <span className="font-medium">{course.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {course.subjects.length} subjects • {course.duration} weeks
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="location">Location</Label>
          <Select
            value={formData.location}
            onValueChange={(value) =>
              setFormData({
                ...formData,
                location: value,
                timeSlot: value === "online" ? formData.timeSlot : "",
                batchType: value === "online" ? "" : formData.batchType,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {locationOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center justify-between w-full">
                    <span>{option.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {option.type === "online" ? "Time slots" : "Full day"}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isOnlineLocation ? (
          <div>
            <Label htmlFor="timeSlot">Time Slot</Label>
            <Select value={formData.timeSlot} onValueChange={(value) => setFormData({ ...formData, timeSlot: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select time slot" />
              </SelectTrigger>
              <SelectContent>
                {timeSlotOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : isPhysicalLocation ? (
          <div>
            <Label htmlFor="batchType">Batch Type</Label>
            <Select
              value={formData.batchType}
              onValueChange={(value) => setFormData({ ...formData, batchType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select batch type" />
              </SelectTrigger>
              <SelectContent>
                {batchTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col">
                      <span>{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value: "active" | "completed" | "cancelled") => setFormData({ ...formData, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">🟢 Active</SelectItem>
                <SelectItem value="completed">✅ Completed</SelectItem>
                <SelectItem value="cancelled">⛔ Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Status field for when location is selected */}
      {(isOnlineLocation || isPhysicalLocation) && (
        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">🟢 Active</SelectItem>
              <SelectItem value="completed">✅ Completed</SelectItem>
              <SelectItem value="cancelled">⛔ Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            id="startDate"
            type="date"
            value={formData.startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="endDate">End Date (Auto-calculated)</Label>
          <Input
            id="endDate"
            type="date"
            value={formData.endDate}
            disabled
            className="bg-gray-100 cursor-not-allowed"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Automatically calculated based on course duration and batch type
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="maxStudents">Max Students</Label>
          <Input
            id="maxStudents"
            type="number"
            value={formData.maxStudents}
            onChange={(e) => setFormData({ ...formData, maxStudents: Number.parseInt(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label htmlFor="currentStudents">Current Students</Label>
          <Input
            id="currentStudents"
            type="number"
            value={formData.currentStudents}
            onChange={(e) => setFormData({ ...formData, currentStudents: Number.parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div className="p-3 rounded-lg border bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <div className="text-sm text-purple-800">
          <strong>📋 Enhanced Automatic Scheduling:</strong> When you add this batch, the system will:
          <ul className="mt-1 ml-4 list-disc text-xs">
            <li>Generate trainer assignments for each subject individually</li>
            <li>Prioritize Senior → Core → Junior trainers based on expertise</li>
            {isOnlineLocation ? (
              <>
                <li>Schedule 2-hour sessions within the selected time slot</li>
                <li>Allow trainers to handle 3-4 online sessions per day</li>
              </>
            ) : isPhysicalLocation ? (
              <>
                <li>
                  Schedule {formData.batchType === "weekend" ? "weekend (Sat-Sun)" : "weekday (Mon-Fri)"} sessions
                </li>
                <li>Use full-day scheduling for physical locations</li>
                <li>Automatically exclude Saturdays and Sundays as leave days for weekday batches</li>
              </>
            ) : (
              <li>Configure scheduling based on selected location type</li>
            )}
            <li>Enable individual trainer reassignment for each subject</li>
            <li>Detect and report scheduling conflicts automatically</li>
          </ul>
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSubmit} className="bg-primary text-primary-foreground hover:bg-primary/90">
          {isEditing ? "Update" : "Add"} Batch
        </Button>
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { useData } from "../../hooks/useData"
import { MainLayout } from "../../components/layout/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { StatusBadge } from "../../components/ui/status-badge"
import { Badge } from "../../components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "../../components/ui/dialog"
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
  const [manualAssignmentOpen, setManualAssignmentOpen] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [batchToDelete, setBatchToDelete] = useState<Batch | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    courseId: "",
    location: "",
    startTime: "10:00",
    endTime: "16:00", // Default 10:00 AM - 4:00 PM for offline batches
    batchType: "weekday" as "weekday" | "weekend",
    startDate: "",
    endDate: "",
    status: "active" as "active" | "completed" | "cancelled",
  })

  const filteredBatches = batches.filter((batch) => batch.name.toLowerCase().includes(searchTerm.toLowerCase()))

  const handleAddBatch = async () => {
    // Ensure batchType is always valid
    const validBatchType = formData.batchType || "weekday"
    if (validBatchType !== "weekday" && validBatchType !== "weekend") {
      setErrorMessage("Batch type is required. Please select weekday or weekend.")
      setErrorOpen(true)
      return
    }

    // Validate online session duration (max 2 hours)
    if (formData.location === "online") {
      const start = new Date(`2000-01-01T${formData.startTime}`)
      const end = new Date(`2000-01-01T${formData.endTime}`)
      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      
      if (durationHours > 2) {
        setErrorMessage("Online sessions cannot exceed 2 hours. Please adjust the time range.")
        setErrorOpen(true)
        return
      }
    }

    const course = courses.find((c) => c.id === formData.courseId)
    const calculatedEndDate = course
      ? calculateBatchEndDate(formData.startDate, course, subjects, validBatchType)
      : formData.endDate

    const supabase = getSupabaseClient()
    const courseIdNum = Number.isNaN(Number.parseInt(formData.courseId)) ? null : Number.parseInt(formData.courseId)
    const allowedStatuses = ["active", "completed", "cancelled"] as const
    const statusSafe = allowedStatuses.includes(formData.status as any) ? formData.status : "active"
    const insertPayload = {
      batch_name: formData.name,
      course_id: courseIdNum,
      location: formData.location,
      batch_type: validBatchType,
      start_time: formData.startTime,
      end_time: formData.endTime,
      status: statusSafe,
      start_date: formData.startDate,
      end_date: calculatedEndDate,
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
      batchType: validBatchType,
      startDate: inserted.start_date,
      endDate: inserted.end_date,
      status: inserted.status,
      maxStudents: 20, // Default value
      currentStudents: 0, // Default value
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
      startTime: "10:00", // Default start time for offline batches
      endTime: "16:00", // Default end time for offline batches
      batchType: (batch.batchType as "weekday" | "weekend") || "weekday",
      startDate: batch.startDate,
      endDate: batch.endDate,
      status: (batch.status as "active" | "completed" | "cancelled") || "active",
    })
  }

  const handleUpdateBatch = async () => {
    if (!editingBatch) return
    
    // Ensure batchType is always valid
    const validBatchType = formData.batchType || "weekday"
    if (validBatchType !== "weekday" && validBatchType !== "weekend") {
      setErrorMessage("Batch type is required. Please select weekday or weekend.")
      setErrorOpen(true)
      return
    }

    // Validate online session duration (max 2 hours)
    if (formData.location === "online") {
      const start = new Date(`2000-01-01T${formData.startTime}`)
      const end = new Date(`2000-01-01T${formData.endTime}`)
      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      
      if (durationHours > 2) {
        setErrorMessage("Online sessions cannot exceed 2 hours. Please adjust the time range.")
        setErrorOpen(true)
        return
      }
    }
    
    const supabase = getSupabaseClient()
    const courseIdNum = Number.isNaN(Number.parseInt(formData.courseId)) ? null : Number.parseInt(formData.courseId)
    const allowedStatuses = ["active", "completed", "cancelled"] as const
    const statusSafe = allowedStatuses.includes(formData.status as any) ? formData.status : "active"
    const payload = {
      batch_name: formData.name,
      course_id: courseIdNum,
      location: formData.location,
      batch_type: validBatchType,
      start_time: formData.startTime,
      end_time: formData.endTime,
      status: statusSafe,
      start_date: formData.startDate,
      end_date: formData.endDate,
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
            timeSlot: undefined, // Not used anymore
            batchType: validBatchType,
            startDate: formData.startDate,
            endDate: formData.endDate,
            maxStudents: 20, // Default value
            status: formData.status,
          }
        : batch,
    )
    setBatches(updatedBatches)
    
    // Check for scheduling conflicts after date update
    if (editingBatch.startDate !== formData.startDate || editingBatch.endDate !== formData.endDate) {
      console.log(`[CONFLICT CHECK] Batch dates changed, checking for trainer conflicts...`)
      await checkAndResolveSchedulingConflicts(editingBatch.id, formData.startDate, formData.endDate)
    }
    
    setEditingBatch(null)
    resetForm()
  }

  const checkAndResolveSchedulingConflicts = async (batchId: string, newStartDate: string, newEndDate: string) => {
    try {
      const supabase = getSupabaseClient()
      const batchIdNum = Number.parseInt(batchId)
      
      console.log(`[CONFLICT CHECK] Checking conflicts for batch ${batchId} with new dates: ${newStartDate} to ${newEndDate}`)
      
      // Get all sessions for this batch
      const { data: batchSessions, error: sessionsError } = await supabase
        .from("schedules")
        .select("*")
        .eq("batch_id", batchIdNum)
      
      if (sessionsError || !batchSessions) {
        console.error("[CONFLICT CHECK] Failed to fetch batch sessions:", sessionsError)
        return
      }
      
      console.log(`[CONFLICT CHECK] Found ${batchSessions.length} sessions to check`)
      
      let conflictsResolved = 0
      let conflictsUnresolved = 0
      
      // Check each session for conflicts
      for (const session of batchSessions) {
        if (!session.trainer_id) continue // Skip unassigned sessions
        
        const trainerId = String(session.trainer_id)
        const sessionDate = session.date
        
        // Check if this trainer has conflicts on this date with other batches
        const { data: conflictingSessions, error: conflictError } = await supabase
          .from("schedules")
          .select("*")
          .eq("trainer_id", session.trainer_id)
          .eq("date", sessionDate)
          .neq("batch_id", batchIdNum) // Exclude current batch
        
        if (conflictError) {
          console.error(`[CONFLICT CHECK] Error checking conflicts for session ${session.id}:`, conflictError)
          continue
        }
        
        if (conflictingSessions && conflictingSessions.length > 0) {
          console.log(`[CONFLICT CHECK] Found conflict: Trainer ${trainerId} has ${conflictingSessions.length} other sessions on ${sessionDate}`)
          
          // Try to find alternative trainer for this subject
          const subject = subjects.find(s => s.id === session.subject_id)
          const alternativeTrainer = await findAlternativeTrainer(
            session.subject_id,
            sessionDate,
            batchId,
            trainerId
          )
          
          if (alternativeTrainer) {
            // Assign alternative trainer
            const { error: updateError } = await supabase
              .from("schedules")
              .update({ trainer_id: Number.parseInt(alternativeTrainer.id) })
              .eq("schedule_id", session.id)
            
            if (!updateError) {
              console.log(`[CONFLICT CHECK] Resolved conflict: Assigned ${alternativeTrainer.name} to session ${session.id}`)
              conflictsResolved++
            } else {
              console.error(`[CONFLICT CHECK] Failed to assign alternative trainer:`, updateError)
              conflictsUnresolved++
            }
          } else {
            // No alternative trainer found, mark as unassigned
            console.log(`[CONFLICT CHECK] No alternative trainer found, marking session ${session.id} as unassigned`)
            
            // Delete the conflicting session
            const { error: deleteError } = await supabase
              .from("schedules")
              .delete()
              .eq("schedule_id", session.id)
            
            if (!deleteError) {
              console.log(`[CONFLICT CHECK] Deleted conflicting session ${session.id}`)
              conflictsUnresolved++
            } else {
              console.error(`[CONFLICT CHECK] Failed to delete conflicting session:`, deleteError)
            }
          }
        }
      }
      
      // Show results to user
      if (conflictsResolved > 0 || conflictsUnresolved > 0) {
        let message = `Date update completed. `
        if (conflictsResolved > 0) {
          message += `${conflictsResolved} conflicts resolved with alternative trainers. `
        }
        if (conflictsUnresolved > 0) {
          message += `${conflictsUnresolved} sessions marked as unassigned due to conflicts. Use "Regenerate Schedule" to reassign them.`
        }
        
        setErrorMessage(message)
        setErrorOpen(true)
      }
      
    } catch (error) {
      console.error("[CONFLICT CHECK] Error during conflict resolution:", error)
    }
  }

  const findAlternativeTrainer = async (subjectId: string, date: string, batchId: string, excludeTrainerId: string) => {
    try {
      // Get all active trainers with expertise in this subject
      const subject = subjects.find(s => s.id === subjectId)
      if (!subject) return null
      
      const availableTrainers = trainers.filter(trainer => {
        // Check if trainer has expertise in this subject
        const hasExpertise = trainer.expertise.some(exp => 
          exp.toLowerCase().includes(subject.name.toLowerCase()) ||
          subject.name.toLowerCase().includes(exp.toLowerCase())
        )
        
        // Check if trainer is active
        const isActive = trainer.status === "active"
        
        // Check if trainer is available on this date (simplified check for now)
        const isAvailable = true // We'll implement proper leave checking later
        
        return hasExpertise && isActive && isAvailable
      })
      
      // Filter out the trainer we're trying to replace
      const alternativeTrainers = availableTrainers.filter(t => t.id !== excludeTrainerId)
      
      if (alternativeTrainers.length === 0) return null
      
      // Sort by priority (Senior > Core > Junior) and return the best option
      const priorityOrder = { "Senior": 1, "Core": 2, "Junior": 3 }
      alternativeTrainers.sort((a, b) => 
        (priorityOrder[a.priority as keyof typeof priorityOrder] || 4) - 
        (priorityOrder[b.priority as keyof typeof priorityOrder] || 4)
      )
      
      return alternativeTrainers[0]
      
    } catch (error) {
      console.error("[CONFLICT CHECK] Error finding alternative trainer:", error)
      return null
    }
  }

  const handleSaveManualAssignments = async () => {
    if (!selectedBatch) return
    
    try {
      const supabase = getSupabaseClient()
      const batchIdNum = Number.parseInt(selectedBatch.id)
      
      // Update schedules table with new trainer assignments
      let successCount = 0
      let errorCount = 0
      
      console.log(`[MANUAL ASSIGNMENT] Starting to update ${selectedBatch.subjectAssignments?.length || 0} subject assignments`)
      console.log(`[MANUAL ASSIGNMENT] Selected batch:`, selectedBatch.id, selectedBatch.name)
      
      for (const assignment of selectedBatch.subjectAssignments || []) {
        console.log(`[MANUAL ASSIGNMENT] Processing assignment:`, {
          subjectId: assignment.subjectId,
          subjectName: assignment.subjectName,
          trainerId: assignment.trainerId,
          status: assignment.status
        })
        
        if (assignment.trainerId && assignment.trainerId !== "unassigned") {
          // Find all sessions for this subject in this batch from the main schedules
          const sessionsToUpdate = schedules.filter(
            s => s.batchId === selectedBatch.id && s.subjectId === assignment.subjectId
          )
          
          console.log(`[MANUAL ASSIGNMENT] Found ${sessionsToUpdate.length} sessions to update for subject ${assignment.subjectName}`)
          
          // Update each session with the new trainer
          for (const session of sessionsToUpdate) {
            try {
              const { error } = await supabase
                .from("schedules")
                .update({ trainer_id: Number.parseInt(assignment.trainerId!) })
                .eq("schedule_id", session.id)
              
              if (error) {
                console.error(`Failed to update session ${session.id}:`, error)
                errorCount++
              } else {
                successCount++
              }
            } catch (updateError) {
              console.error(`Exception updating session ${session.id}:`, updateError)
              errorCount++
            }
          }
        } else if (assignment.trainerId === null || assignment.trainerId === "unassigned") {
          // Remove trainer assignment for unassigned subjects
          const sessionsToUpdate = schedules.filter(
            s => s.batchId === selectedBatch.id && s.subjectId === assignment.subjectId
          )
          
          console.log(`[MANUAL ASSIGNMENT] Removing trainer from ${sessionsToUpdate.length} sessions for subject ${assignment.subjectName}`)
          
          // Instead of trying to set trainer_id to null (which may not be allowed),
          // we'll delete these sessions and let the system regenerate them
          for (const session of sessionsToUpdate) {
            try {
              console.log(`[MANUAL ASSIGNMENT] Deleting unassigned session ${session.id}`)
              const { error } = await supabase
                .from("schedules")
                .delete()
                .eq("schedule_id", session.id)
              
              if (error) {
                console.error(`Failed to delete session ${session.id}:`, error)
                errorCount++
              } else {
                console.log(`[MANUAL ASSIGNMENT] Successfully deleted session ${session.id}`)
                successCount++
              }
            } catch (deleteError) {
              console.error(`Exception deleting session ${session.id}:`, deleteError)
              errorCount++
            }
          }
        }
      }
      
      // Show success message with results
      let message = ""
      if (errorCount > 0) {
        message = `Manual assignments saved with ${errorCount} errors. ${successCount} sessions updated successfully.`
      } else {
        message = `Manual assignments saved successfully! ${successCount} sessions updated.`
        
        // Check if any subjects were unassigned
        const unassignedCount = selectedBatch.subjectAssignments?.filter(a => 
          a.trainerId === null || a.trainerId === "unassigned"
        ).length || 0
        
        if (unassignedCount > 0) {
          message += ` ${unassignedCount} subjects are now unassigned. Use "Regenerate Schedule" to recreate their sessions.`
        }
      }
      
      setErrorMessage(message)
      setErrorOpen(true)
      
      // Close modal
      setManualAssignmentOpen(false)
      setSelectedBatch(null)
      
      // Refresh schedules to show updated data
      const { data: updatedSchedules, error: schedulesError } = await supabase
        .from("schedules")
        .select("*")
        .eq("batch_id", batchIdNum)
      
      if (!schedulesError && updatedSchedules) {
        // Update the schedules state
        const updatedSchedulesList = schedules.map(s => {
          const updated = updatedSchedules.find(us => us.schedule_id === s.id)
          return updated ? { ...s, trainerId: updated.trainer_id ? String(updated.trainer_id) : undefined } : s
        })
        // You would need to add a setSchedules function to update the main schedules state
      }
      
      // Note: After manual assignment, users can use "Regenerate Schedule" 
      // to recreate sessions for any unassigned subjects
      
    } catch (error) {
      console.error("Failed to save manual assignments:", error)
      setErrorMessage("Failed to save manual assignments. Please try again.")
      setErrorOpen(true)
    }
  }

  const handleDeleteConfirm = (batch: Batch) => {
    setBatchToDelete(batch)
    setDeleteConfirmOpen(true)
  }

  const handleDeleteBatch = async () => {
    if (!batchToDelete) return
    
    const batchId = batchToDelete.id
    const supabase = getSupabaseClient()
    const batchIdNum = Number.parseInt(batchId)
    
    try {
      // First, delete all associated schedules
      console.log(`[DELETE] Deleting schedules for batch ${batchId}`)
      const { error: scheduleError } = await supabase
        .from("schedules")
        .delete()
        .eq("batch_id", batchIdNum)
      
      if (scheduleError) {
        console.error("Failed to delete schedules:", scheduleError)
        setErrorMessage(`Failed to delete schedules: ${scheduleError.message}`)
        setErrorOpen(true)
        return
      }
      
      console.log(`[DELETE] Schedules deleted successfully`)
      
      // Then delete the batch
      console.log(`[DELETE] Deleting batch ${batchId}`)
      const { error: batchError } = await supabase
        .from("batches")
        .delete()
        .eq("batch_id", batchIdNum)
      
      if (batchError) {
        console.error("Failed to delete batch:", batchError)
        setErrorMessage(`Failed to delete batch: ${batchError.message}`)
        setErrorOpen(true)
        return
      }
      
      console.log(`[DELETE] Batch deleted successfully`)
      
      // Update local state
      setBatches(batches.filter((b) => b.id !== batchId))
      setSchedules(schedules.filter((s) => s.batchId !== batchId))
      
      // Close confirmation dialog and reset state
      setDeleteConfirmOpen(false)
      setBatchToDelete(null)
      
      console.log(`[DELETE] Batch deletion completed successfully`)
      
    } catch (e: any) {
      console.error("Failed to delete batch:", e)
      setErrorMessage(e?.message || "Failed to delete batch")
      setErrorOpen(true)
      return
    }
  }

  const handleGenerateSchedule = async (batch: Batch) => {
    console.log(`[BATCH] Starting schedule generation for batch: ${batch.name}`)
    console.log(`[BATCH] Batch details:`, { 
      id: batch.id, 
      location: batch.location, 
      batchType: batch.batchType, 
      timeSlot: batch.timeSlot 
    })
    
    const course = courses.find((c) => c.id === batch.courseId)
    if (!course) {
      console.error(`[BATCH] Course not found for batch ${batch.name}`)
      return
    }
    
    console.log(`[BATCH] Course: ${course.name} with ${course.subjects.length} subjects`)
    console.log(`[BATCH] Batch working days: ${batch.batchType || 'weekday (default)'}`)
    console.log(`[BATCH] Available trainers: ${trainers.length}`)
    console.log(`[BATCH] Trainer details:`, trainers.map(t => ({
      id: t.id,
      name: t.name,
      expertise: t.expertise,
      locations: t.locations,
      priority: t.priority,
      startTime: t.startTime,
      endTime: t.endTime,
      availability: t.availability
    })))
    console.log(`[BATCH] Available subjects: ${subjects.length}`)
    console.log(`[BATCH] Subject details:`, subjects.map(s => ({
      id: s.id,
      name: s.name,
      duration: s.duration
    })))
    console.log(`[BATCH] Holidays: ${holidays.length}`)

    // Generate initial schedule
    const initialSchedule = generateSchedule(batch, course, subjects, trainers, holidays)
    console.log(`[BATCH] Initial schedule generated: ${initialSchedule.length} sessions`)
    console.log(`[BATCH] Assigned sessions: ${initialSchedule.filter(s => s.trainerId).length}`)
    console.log(`[BATCH] Unassigned sessions: ${initialSchedule.filter(s => !s.trainerId).length}`)

    // Optimize schedule to balance workload
    const schedule = optimizeSchedule(initialSchedule, trainers)
    console.log(`[BATCH] Optimized schedule: ${schedule.length} sessions`)
    console.log(`[BATCH] Final assigned sessions: ${schedule.filter(s => s.trainerId).length}`)
    console.log(`[BATCH] Final unassigned sessions: ${schedule.filter(s => !s.trainerId).length}`)

    // Update subject assignments based on the generated schedule
    const updatedSubjectAssignments = course.subjects.map((subjectId) => {
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
        status: assignedTrainer ? ("assigned" as const) : ("unassigned" as const),
        canChange: true,
      }
    })

    const updatedBatches = batches.map((b) => (b.id === batch.id ? { 
      ...b, 
      generatedSchedule: schedule,
      subjectAssignments: updatedSubjectAssignments
    } : b))
    setBatches(updatedBatches)

    // Persist generated schedule to Supabase 'schedules' table
    const supabase = getSupabaseClient()
    const batchIdNum = Number.parseInt(batch.id)
    // Filter out any sessions with invalid subject IDs to prevent database errors
    const validSessions = schedule.filter(s => s.subjectId && s.subjectId.trim() !== "")
    
    if (validSessions.length !== schedule.length) {
      console.warn(`[SCHEDULE] Filtered out ${schedule.length - validSessions.length} sessions with invalid subject IDs`)
      console.warn(`[SCHEDULE] Invalid sessions:`, schedule.filter(s => !s.subjectId || s.subjectId.trim() === ""))
    }
    
    console.log(`[SCHEDULE] Processing ${validSessions.length} valid sessions for database insertion`)
    
    const rows = validSessions.map((s) => {
      const [rawStart, rawEnd] = (s.timeSlot || "09:00-17:00").split("-")
      const start_time = rawStart.length === 5 ? `${rawStart}:00` : rawStart
      const end_time = rawEnd.length === 5 ? `${rawEnd}:00` : rawEnd
      return {
        batch_id: batchIdNum,
        trainer_id: s.trainerId ? Number.parseInt(s.trainerId) : null,
        subject_id: Number.parseInt(s.subjectId), // Now guaranteed to be valid
        date: s.date,
        start_time,
        end_time,
        status: "planned",
      }
    })
    try {
      // Replace any existing generated schedules for this batch
      await supabase.from("schedules").delete().eq("batch_id", batchIdNum)
      
      // ENHANCED: Insert ALL sessions, including unassigned ones
      // This ensures admins can see and assign trainers later
      const { error: insError } = await supabase.from("schedules").insert(rows)
      if (insError) throw insError
      
      console.log(`[SCHEDULE] Inserted ${rows.length} sessions (including unassigned ones)`)

      // Refresh schedules in client state for this batch
      const { data: fresh, error: fetchErr } = await supabase
        .from("schedules")
        .select("*")
        .eq("batch_id", batchIdNum)
      if (fetchErr) throw fetchErr

      const batchIdStr = String(batchIdNum)
      const refreshed = (fresh || []).map((s: {
        schedule_id?: number
        id?: number
        start_time?: string
        end_time?: string
        trainer_id?: number | null
        date?: string
        subject_id?: number
      }) => {
        const startTime = s.start_time ?? "09:00:00"
        const endTime = s.end_time ?? "17:00:00"
        const timeSlot = `${String(startTime).slice(0,5)}-${String(endTime).slice(0,5)}`
        const trainerId = s.trainer_id != null ? String(s.trainer_id) : undefined
        const status = trainerId ? "assigned" : "unassigned"
        
        // ENHANCED: Handle unassigned sessions properly
        if (!trainerId) {
          console.log(`[SCHEDULE] Unassigned session found for date ${s.date}, subject ${s.subject_id}`)
        }
        
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
        const others = (prev || []).filter((p: { batchId: string }) => p.batchId !== batchIdStr)
        return [...others, ...refreshed]
      })

      // All sessions are now saved, including unassigned ones
      console.log(`[SCHEDULE] All ${rows.length} sessions saved successfully`)
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
      startTime: "10:00",
      endTime: "16:00", // Will be adjusted based on location
      batchType: "weekday",
      startDate: "",
      endDate: "",
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Delete Batch
            </DialogTitle>
            <DialogDescription className="text-left">
              <div className="space-y-3">
                <div className="font-medium text-gray-900">
                  Are you sure you want to delete <span className="text-red-600 font-bold">&quot;{batchToDelete?.name}&quot;</span>?
                </div>
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-red-800">
                      <div className="font-medium mb-1">⚠️ This action cannot be undone!</div>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>All scheduled sessions will be permanently deleted</li>
                        <li>Trainer assignments will be lost</li>
                        <li>Subject progress tracking will be removed</li>
                        <li>This may affect other parts of the system</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-sm text-blue-800">
                    <div className="font-medium mb-1">💡 Recommendation:</div>
                    <div className="text-xs">Consider changing the batch status to &quot;cancelled&quot; instead of deleting it completely. This preserves the data for reporting and audit purposes.</div>
                  </div>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setDeleteConfirmOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleDeleteBatch}
              className="bg-red-600 hover:bg-red-700 text-white flex-1"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Delete Permanently
            </Button>
          </DialogFooter>
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
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleDeleteConfirm(batch)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </Button>
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
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">Subject Assignments</div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-green-600">
                            {subjectAssignments.filter(a => a.status === "assigned").length} assigned
                          </span>
                          <span className="text-red-500">
                            {subjectAssignments.filter(a => a.status === "unassigned").length} unassigned
                          </span>
                        </div>
                      </div>
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

                {/* Trainer assignment ranges for this batch - Commented out as not needed currently */}
                {/*
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
                */}



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

                    <div className="flex justify-center space-x-2">
                      <Button
                        onClick={() => handleGenerateSchedule(batch)}
                        variant="outline"
                        size="sm"
                        className="text-primary border-primary hover:bg-primary/10"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Regenerate Schedule
                      </Button>
                      <Button
                        onClick={() => {
                          setSelectedBatch(batch)
                          setManualAssignmentOpen(true)
                        }}
                        variant="outline"
                        size="sm"
                        className="text-green-600 border-green-600 hover:bg-green-50"
                      >
                        <Users className="w-3 h-3 mr-1" />
                        Manual Assignment
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 space-y-2">
                    <Button
                      onClick={() => handleGenerateSchedule(batch)}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      size="sm"
                    >
                      Generate Schedule
                    </Button>
                    <div className="text-xs text-muted-foreground">
                      Schedule will be generated automatically
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Manual Assignment Modal */}
      <Dialog open={manualAssignmentOpen} onOpenChange={setManualAssignmentOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manual Trainer Assignment - {selectedBatch?.name}</DialogTitle>
            <DialogDescription>
              Manually assign trainers to subjects for this batch. Only trainers with expertise in each subject are shown in the dropdown. 
              Note: Unassigned subjects will have their sessions removed and can be regenerated later.
            </DialogDescription>
          </DialogHeader>
          
          {selectedBatch && (
            <div className="space-y-6">
              {/* Batch Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label className="text-sm font-medium">Course</Label>
                  <p className="text-sm text-muted-foreground">
                    {courses.find(c => c.id === selectedBatch.courseId)?.name}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Location</Label>
                  <p className="text-sm text-muted-foreground">{selectedBatch.location}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Batch Type</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedBatch.batchType === "weekend" ? "Weekend (Sat-Sun)" : "Weekday (Mon-Fri)"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Time Slot</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedBatch.startTime} - {selectedBatch.endTime}
                  </p>
                </div>
              </div>



              {/* Subject Assignments */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Subject Assignments</h3>
                {(selectedBatch.subjectAssignments || []).map((assignment, index) => {
                  const subject = subjects.find(s => s.id === assignment.subjectId)
                  const currentTrainer = trainers.find(t => t.id === assignment.trainerId)
                  
                  return (
                    <div key={assignment.subjectId} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{subject?.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            Duration: {subject?.duration} days • 
                            Sessions: {assignment.sessionsCount} • 
                            Current: {currentTrainer?.name || "Unassigned"}
                          </p>
                        </div>

                      </div>
                      
                      <div>
                        <Label htmlFor={`trainer-${index}`}>Assign Trainer</Label>
                        <Select
                          value={assignment.trainerId || "unassigned"}
                          onValueChange={(trainerId) => {
                            console.log(`Changing trainer for ${subject?.name} to:`, trainerId)
                            
                            // Update the assignment
                            const updatedAssignments = [...(selectedBatch.subjectAssignments || [])]
                            updatedAssignments[index] = {
                              ...updatedAssignments[index],
                              trainerId: trainerId === "unassigned" ? null : trainerId,
                              trainerName: trainerId === "unassigned" ? "Unassigned" : (trainers.find(t => t.id === trainerId)?.name || "Unknown"),
                              status: trainerId === "unassigned" ? "unassigned" : "assigned"
                            }
                            
                            console.log("Updated assignment:", updatedAssignments[index])
                            
                            // Update local state
                            setSelectedBatch({
                              ...selectedBatch,
                              subjectAssignments: updatedAssignments
                            })
                            
                            // Update batches state
                            const updatedBatches = batches.map(b => 
                              b.id === selectedBatch.id 
                                ? { ...b, subjectAssignments: updatedAssignments }
                                : b
                            )
                            setBatches(updatedBatches)
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select trainer" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {trainers
                              .filter(trainer => {
                                // Only show trainers with expertise in this subject
                                const hasExpertise = trainer.expertise.some(exp => 
                                  exp.toLowerCase().includes((subject?.name || "").toLowerCase()) ||
                                  (subject?.name || "").toLowerCase().includes(exp.toLowerCase())
                                )
                                return hasExpertise
                              })
                              .map((trainer) => {
                                const isAvailable = trainer.status === "active"
                                const isDisabled = !isAvailable
                                
                                return (
                                  <SelectItem 
                                    key={trainer.id} 
                                    value={trainer.id}
                                    disabled={isDisabled}
                                    className={isDisabled ? "opacity-30 text-gray-500" : ""}
                                  >
                                    <div className="flex items-center justify-between w-full">
                                      <span className={isDisabled ? "text-gray-500" : ""}>{trainer.name}</span>
                                      <div className="flex items-center gap-2 text-xs">
                                        <Badge variant="outline" className={`text-xs ${isDisabled ? "opacity-50" : ""}`}>
                                          {trainer.priority}
                                        </Badge>
                                        {!isAvailable && (
                                          <Badge variant="destructive" className="text-xs">
                                            Inactive
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </SelectItem>
                                )
                              })}
                          </SelectContent>
                        </Select>
                        

                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualAssignmentOpen(false)}>
              Close
            </Button>
            <Button 
              onClick={handleSaveManualAssignments}
              className="bg-green-600 hover:bg-green-700"
            >
              Save Assignments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    { value: "online", label: "🌐 Online (2-hour sessions)", type: "online" },
    { value: "kochi", label: "📍 Kochi", type: "physical" },
    { value: "calicut", label: "📍 Calicut", type: "physical" },
  ]

  // Time slot options removed - now using start/end time inputs

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
                    {course.subjects.length} subjects • {course.duration} days
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
                startTime: value === "online" ? "09:00" : "10:00",
                endTime: value === "online" ? "11:00" : "16:00", // 2 hours for online, 10-4 for offline
                batchType: value === "online" ? "weekday" : (formData.batchType || "weekday"),
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
                      {option.type === "online" ? "2-hour max" : "Full day"}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isOnlineLocation ? (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-800">Online Session Rules</span>
              </div>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• Maximum session duration: 2 hours</li>
                <li>• Recommended: 1.5 - 2 hours for optimal engagement</li>
                <li>• Break time included in session duration</li>
              </ul>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => {
                    const startTime = e.target.value
                    setFormData({ ...formData, startTime })
                    
                                         // Auto-calculate end time to maintain 2-hour limit
                     if (startTime) {
                       const start = new Date(`2000-01-01T${startTime}`)
                       const end = new Date(start.getTime() + 2 * 60 * 60 * 1000) // +2 hours
                       const endTime = end.toTimeString().slice(0, 5)
                       setFormData((prev: any) => ({ ...prev, endTime }))
                     }
                  }}
                />
              </div>
              <div>
                <Label htmlFor="endTime">End Time (Max 2 hours)</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => {
                    const endTime = e.target.value
                    const startTime = formData.startTime
                    
                    if (startTime && endTime) {
                      const start = new Date(`2000-01-01T${startTime}`)
                      const end = new Date(`2000-01-01T${endTime}`)
                      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
                      
                                             if (durationHours > 2) {
                         // Reset to 2 hours if exceeded
                         const maxEnd = new Date(start.getTime() + 2 * 60 * 60 * 1000)
                         const maxEndTime = maxEnd.toTimeString().slice(0, 5)
                         setFormData((prev: any) => ({ ...prev, endTime: maxEndTime }))
                         
                         // Show warning - we'll handle this in the parent component
                         console.warn("Online sessions cannot exceed 2 hours. End time adjusted automatically.")
                       } else {
                         setFormData({ ...formData, endTime })
                       }
                    } else {
                      setFormData({ ...formData, endTime })
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Session duration: {(() => {
                    if (formData.startTime && formData.endTime) {
                      const start = new Date(`2000-01-01T${formData.startTime}`)
                      const end = new Date(`2000-01-01T${formData.endTime}`)
                      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
                      return `${durationHours.toFixed(1)} hours`
                    }
                    return "Not set"
                  })()}
                </p>
              </div>
            </div>
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
            <p className="text-xs text-muted-foreground mt-2">
              ⏰ Time slot automatically set to 10:00 AM - 4:00 PM for offline batches
            </p>
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
          <p className="text-xs text-blue-600 mt-1">
            💡 Note: If dates change, the system will automatically resolve trainer conflicts
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        
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
                <li>Use 10:00 AM - 4:00 PM time slots for offline batches</li>
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

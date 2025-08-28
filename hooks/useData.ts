"use client"

import { useState, useEffect } from "react"
import { getSupabaseClient } from "../lib/supabaseClient"

export interface Trainer {
  id: string
  name: string
  email: string
  locations: string[]
  expertise: string[]
  priority: "Senior" | "Core" | "Junior"
  timeSlots: string[] // Added time slots for trainers
  startTime: string // Daily start time (HH:MM format)
  endTime: string // Daily end time (HH:MM format)
  availability: {
    monday: boolean
    tuesday: boolean
    wednesday: boolean
    thursday: boolean
    friday: boolean
    saturday: boolean
    sunday: boolean
    [key: string]: boolean // Allow string indexing
  }
  leaves: Array<{
    startDate: string
    endDate: string
    reason: string
    status: "pending" | "approved" | "rejected"
  }>
  status: "active" | "inactive"
}

export interface Course {
  id: string
  name: string
  description: string
  duration: number
  subjects: string[]
}

export interface Subject {
  id: string
  name: string
  duration: number
}

export interface Batch {
  id: string
  name: string
  courseId: string
  location: string
  timeSlot?: string // Legacy field, will be removed
  startTime?: string // New: Daily start time (HH:MM format)
  endTime?: string // New: Daily end time (HH:MM format)
  batchType?: "weekday" | "weekend"
  startDate: string
  endDate: string
  status: "active" | "completed" | "cancelled" | "scheduled" | "draft"
  maxStudents?: number // Made optional, default to 20
  currentStudents: number
  generatedSchedule: Array<{
    date: string
    subjectId: string
    trainerId?: string
    status: "assigned" | "unassigned"
    timeSlot: string
    conflicts?: string[]
  }>
  subjectAssignments?: Array<{
    subjectId: string
    subjectName: string
    trainerId: string | null
    trainerName: string
    startDate: string
    endDate: string
    sessionsCount: number
    status: "assigned" | "unassigned"
    canChange: boolean
  }>
}

export interface Holiday {
  date: string
  name: string
}

export interface ScheduleSession {
  date: string
  subjectId: string
  trainerId?: string
  status: "assigned" | "unassigned"
  timeSlot: string
  conflicts?: string[]
  sessionType: "regular" | "communication"
}

// Normalized, tabular schedule entry used across the app
export interface ScheduleEntry extends ScheduleSession {
  id: string
  batchId: string
  courseId: string
}

export function useData() {
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = getSupabaseClient()
        const [
          usersResp,
          trainersResp,
          coursesResp,
          subjectsResp,
          courseSubjectsResp,
          batchesResp,
          schedulesResp,
          holidaysResp,
          trainerSubjectsResp,
          trainerLeavesResp,
        ] = await Promise.all([
          supabase.from("users").select("*"),
          supabase.from("trainers").select("*"),
          supabase.from("courses").select("*"),
          supabase.from("subjects").select("*"),
          supabase.from("course_subjects").select("*"),
          supabase.from("batches").select("*"),
          supabase.from("schedules").select("*"),
          supabase.from("holidays").select("*"),
          supabase.from("trainer_subjects").select("*"),
          supabase.from("trainer_leaves").select("*"),
        ])

        if (usersResp.error) throw usersResp.error
        if (coursesResp.error) throw coursesResp.error
        if (subjectsResp.error) throw subjectsResp.error
        if (batchesResp.error) throw batchesResp.error
        if (courseSubjectsResp.error) throw courseSubjectsResp.error
        if (schedulesResp.error) throw schedulesResp.error
        if (holidaysResp.error) throw holidaysResp.error
        if (trainersResp.error) throw trainersResp.error
        if (trainerSubjectsResp.error) throw trainerSubjectsResp.error
        if (trainerLeavesResp.error) throw trainerLeavesResp.error

        // Map courses using course_subjects for ordered curriculum
        const subjectsByCourse = new Map<string, string[]>()
        const grouped: Record<string, { subjectId: string; position: number }[]> = {}
        ;(courseSubjectsResp.data ?? []).forEach((row: any) => {
          const courseId = String(row.course_id)
          const subjectId = String(row.subject_id)
          const position = Number(row.position ?? 0)
          if (!grouped[courseId]) grouped[courseId] = []
          grouped[courseId].push({ subjectId, position })
        })
        Object.entries(grouped).forEach(([courseId, arr]) => {
          arr.sort((a, b) => a.position - b.position)
          subjectsByCourse.set(courseId, arr.map((x) => x.subjectId))
        })

        const mappedCourses: Course[] = (coursesResp.data ?? []).map((c: any) => {
          const id = String(c.course_id ?? c.id)
          return {
            id,
            name: c.course_name ?? c.name ?? "",
            description: c.description ?? "",
            duration: Number(c.duration_days ?? c.duration ?? 0),
            subjects: subjectsByCourse.get(id) ?? [],
          }
        })
        setCourses(mappedCourses)

        // Map subjects
        const mappedSubjects: Subject[] = (subjectsResp.data ?? []).map((s: any) => ({
          id: String(s.subject_id ?? s.id),
          name: s.subject_name ?? s.name ?? "",
          duration: Number(s.duration_days ?? s.duration ?? 0),
        }))
        setSubjects(mappedSubjects)

        // Map batches
        const mappedBatches: Batch[] = (batchesResp.data ?? []).map((row: any) => {
          const id = row.batch_id ?? row.id
          const courseId = row.course_id ?? row.courseId
          return {
            id: String(id),
            name: row.batch_name ?? row.name ?? "",
            courseId: courseId ? String(courseId) : "",
            location: row.location ?? "",
            timeSlot: row.time_slot ?? undefined,
            startTime: row.start_time ? String(row.start_time).substring(0, 5) : "09:00",
            endTime: row.end_time ? String(row.end_time).substring(0, 5) : "17:00",
            batchType: (row.batch_type ?? "weekday") as "weekday" | "weekend",
            startDate: row.start_date ?? row.startDate ?? "",
            endDate: row.end_date ?? row.endDate ?? "",
            status: (row.status ?? "active") as Batch["status"],
            maxStudents: row.max_students ?? row.maxStudents ?? 20,
            currentStudents: row.current_students ?? row.currentStudents ?? 0,
            generatedSchedule: [],
            subjectAssignments: [],
          }
        })

        setBatches(mappedBatches)

        // Map trainers
        const subjectsById = new Map<string, Subject>()
        mappedSubjects.forEach((s) => subjectsById.set(s.id, s))

        const trainerIdToExpertise = new Map<string, string[]>()
        ;(trainerSubjectsResp.data ?? []).forEach((ts: any) => {
          const tId = String(ts.trainer_id ?? ts.trainerId)
          const sId = String(ts.subject_id ?? ts.subjectId)
          const arr = trainerIdToExpertise.get(tId) ?? []
          const subjName = subjectsById.get(sId)?.name
          if (subjName) arr.push(subjName)
          trainerIdToExpertise.set(tId, arr)
        })

        const trainerIdToLeaves = new Map<string, { startDate: string; endDate: string; reason: string; status: "pending" | "approved" | "rejected" }[]>()
        ;(trainerLeavesResp.data ?? []).forEach((lv: any) => {
          const tId = String(lv.trainer_id ?? lv.trainerId)
          const entry = {
            startDate: lv.leave_date ?? lv.start_date ?? "",
            endDate: lv.leave_date ?? lv.end_date ?? lv.leave_date ?? "",
            reason: lv.reason ?? "",
            status: (lv.status ?? "pending") as "pending" | "approved" | "rejected",
          }
          const arr = trainerIdToLeaves.get(tId) ?? []
          arr.push(entry)
          trainerIdToLeaves.set(tId, arr)
        })

        const mappedTrainers: Trainer[] = (trainersResp.data ?? []).map((t: any) => {
          const priorityLevel = Number(t.priority_level ?? 2)
          const priority = priorityLevel <= 1 ? "Senior" : priorityLevel === 2 ? "Core" : "Junior"
          return {
            id: String(t.trainer_id ?? t.id),
            name: t.name ?? "",
            email: t.email ?? "",
            locations: t.location ? [t.location] : [],
            expertise: trainerIdToExpertise.get(String(t.trainer_id ?? t.id)) ?? [],
            priority,
            timeSlots: [],
            startTime: t.start_time ? String(t.start_time).substring(0, 5) : "09:00",
            endTime: t.end_time ? String(t.end_time).substring(0, 5) : "17:00",
            availability: (() => {
              try {
                if (t.availability && typeof t.availability === 'string') {
                  return JSON.parse(t.availability)
                }
                if (t.availability && typeof t.availability === 'object') {
                  return t.availability
                }
              } catch (e) {
                console.warn(`Failed to parse availability for trainer ${t.name}:`, e)
              }
              // Default availability
              return {
                monday: true,
                tuesday: true,
                wednesday: true,
                thursday: true,
                friday: true,
                saturday: true,
                sunday: false
              }
            })(),
            leaves: trainerIdToLeaves.get(String(t.trainer_id ?? t.id)) ?? [],
            status: (t.status ?? "active") as "active" | "inactive",
          }
        })
        setTrainers(mappedTrainers)

        // Map holidays
        const mappedHolidays: Holiday[] = (holidaysResp.data ?? []).map((h: any) => ({
          date: h.holiday_date ?? h.date ?? "",
          name: h.holiday_name ?? h.name ?? "",
        }))
        setHolidays(mappedHolidays)

        // Map schedules to normalized entries expected by UI
        const batchIdToCourseId = new Map<string, string>()
        mappedBatches.forEach((b) => batchIdToCourseId.set(b.id, b.courseId))

        const mappedSchedules: ScheduleEntry[] = (schedulesResp.data ?? []).map((s: any) => {
          const startTime = s.start_time ?? "09:00"
          const endTime = s.end_time ?? "17:00"
          const timeSlot = `${startTime}-${endTime}`
          const trainerId = s.trainer_id != null ? String(s.trainer_id) : undefined
          const status = trainerId ? "assigned" : "unassigned"
          const batchId = String(s.batch_id ?? s.batchId)
          return {
            id: String(s.schedule_id ?? s.id),
            batchId,
            courseId: batchIdToCourseId.get(batchId) ?? "",
            date: s.date ?? "",
            subjectId: String(s.subject_id ?? s.subjectId ?? ""),
            trainerId,
            status,
            timeSlot,
            sessionType: "regular",
          }
        })
        setSchedules(mappedSchedules)
      } catch (error) {
        console.error("Error loading data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  return {
    trainers,
    courses,
    subjects,
    batches,
    holidays,
    schedules,
    loading,
    setTrainers,
    setCourses,
    setSubjects,
    setBatches,
    setHolidays,
    setSchedules,
  }
}

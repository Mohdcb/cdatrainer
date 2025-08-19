"use client"

import { useState, useEffect } from "react"

export interface Trainer {
  id: string
  name: string
  email: string
  locations: string[]
  expertise: string[]
  priority: "Senior" | "Core" | "Junior"
  timeSlots: string[] // Added time slots for trainers
  availability: {
    [key: string]: boolean // Simplified to boolean for each day
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
  timeSlot?: string
  batchType?: "weekday" | "weekend"
  startDate: string
  endDate: string
  status: "scheduled" | "active" | "completed" | "draft"
  maxStudents: number
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
        const [trainersRes, coursesRes, subjectsRes, batchesRes, holidaysRes, schedulesRes] = await Promise.all([
          import("../data/trainers.json"),
          import("../data/courses.json"),
          import("../data/subjects.json"),
          import("../data/batches.json"),
          import("../data/holidays.json"),
          import("../data/schedules.json"),
        ])

        setTrainers(trainersRes.default as Trainer[])
        setCourses(coursesRes.default as Course[])
        setSubjects(subjectsRes.default as Subject[])
        setBatches(batchesRes.default as Batch[])
        setHolidays(holidaysRes.default as Holiday[])
        setSchedules(schedulesRes.default as ScheduleEntry[])
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

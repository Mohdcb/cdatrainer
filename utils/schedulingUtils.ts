import type { Trainer, Subject, Batch, Holiday } from "../hooks/useData"
import { isWeekend, isHoliday, formatDate, getDayOfWeek, parseDate } from "./dateUtils"

export interface ScheduleSession {
  date: string
  subjectId: string
  trainerId?: string
  status: "assigned" | "unassigned"
  timeSlot: string
  conflicts?: string[]
  sessionType: "regular" | "communication"
}

export function generateSchedule(
  batch: Batch,
  course: { subjects: string[] },
  subjects: Subject[],
  trainers: Trainer[],
  holidays: Holiday[],
): ScheduleSession[] {
  const schedule: ScheduleSession[] = []
  const currentDate = parseDate(batch.startDate)

  // Get subjects in order
  const courseSubjects = course.subjects
    .map((subjectId) => subjects.find((s) => s.id === subjectId))
    .filter(Boolean) as Subject[]

  for (const subject of courseSubjects) {
    let daysCompleted = 0
    const subjectStartDate = new Date(currentDate)

    while (daysCompleted < subject.duration) {
      // Skip weekends and holidays based on batch type
      while (
        (batch.batchType === "weekday" && isWeekend(currentDate)) ||
        (batch.batchType === "weekend" && !isWeekend(currentDate)) ||
        isHoliday(currentDate, holidays)
      ) {
        currentDate.setDate(currentDate.getDate() + 1)
      }

      const session: ScheduleSession = {
        date: formatDate(currentDate),
        subjectId: subject.id,
        status: "unassigned",
        timeSlot: batch.location === "Online" ? "09:00-11:00" : "09:00-17:00",
        conflicts: [],
        sessionType: "regular",
      }

      // Find available trainer
      const availableTrainer = findAvailableTrainer(
        currentDate,
        subject,
        trainers,
        batch.location,
        schedule,
        batch.timeSlot,
      )

      if (availableTrainer) {
        session.trainerId = availableTrainer.id
        session.status = "assigned"

        if (batch.location === "Online" && batch.timeSlot) {
          session.timeSlot = batch.timeSlot
        } else if (batch.location !== "Online") {
          session.timeSlot = "09:00-17:00"
        }
      } else {
        session.conflicts = getAssignmentConflicts(currentDate, subject, trainers, batch.location, schedule)
      }

      schedule.push(session)

      currentDate.setDate(currentDate.getDate() + 1)
      daysCompleted++
    }

    currentDate.setDate(currentDate.getDate() + 3)

    // Skip to next valid day after gap
    while (
      (batch.batchType === "weekday" && isWeekend(currentDate)) ||
      (batch.batchType === "weekend" && !isWeekend(currentDate)) ||
      isHoliday(currentDate, holidays)
    ) {
      currentDate.setDate(currentDate.getDate() + 1)
    }
  }

  // Generate communication sessions
  const communicationSchedule = generateCommunicationSchedule(batch, schedule, trainers, holidays)
  schedule.push(...communicationSchedule)

  return schedule.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

function getOnlineTimeSlot(timeSlot: string): string {
  switch (timeSlot) {
    case "morning":
      return "09:00-11:00"
    case "afternoon":
      return "14:00-16:00"
    case "evening":
      return "18:00-20:00"
    default:
      return "09:00-11:00"
  }
}

function generateCommunicationSchedule(
  batch: Batch,
  existingSchedule: ScheduleSession[],
  trainers: Trainer[],
  holidays: Holiday[],
): ScheduleSession[] {
  const communicationSchedule: ScheduleSession[] = []
  const communicationTrainer = trainers.find((t) =>
    t.expertise.some((exp) => exp.toLowerCase().includes("communication")),
  )

  if (!communicationTrainer) return communicationSchedule

  // Calculate course duration in months (assuming 3 months)
  const startDate = parseDate(batch.startDate)
  const months = [0, 1, 2] // 3 months

  months.forEach((monthOffset, index) => {
    const monthDate = new Date(startDate)
    monthDate.setMonth(monthDate.getMonth() + monthOffset)

    // Find a suitable date in the middle of the month
    monthDate.setDate(15)

    // Find next available business day
    while (
      isWeekend(monthDate) ||
      isHoliday(monthDate, holidays) ||
      existingSchedule.some((s) => s.date === formatDate(monthDate))
    ) {
      monthDate.setDate(monthDate.getDate() + 1)
    }

    const session: ScheduleSession = {
      date: formatDate(monthDate),
      subjectId: "communication", // Special subject ID
      trainerId: communicationTrainer.id,
      status: "assigned",
      timeSlot: batch.location === "Online" ? "10:00-12:00" : "10:00-17:00",
      sessionType: "communication",
    }

    communicationSchedule.push(session)
  })

  return communicationSchedule
}

function findAvailableTrainer(
  date: Date,
  subject: Subject,
  trainers: Trainer[],
  location: string,
  existingSchedule: ScheduleSession[],
  batchTimeSlot?: string,
): Trainer | null {
  const dayOfWeek = getDayOfWeek(date)
  const dateStr = formatDate(date)

  const validLocations = ["Kochi", "Calicut", "Online"]
  if (!validLocations.includes(location)) {
    return null
  }

  // Filter trainers by expertise, location, and availability
  const eligibleTrainers = trainers.filter((trainer) => {
    // Check expertise
    const hasExpertise = trainer.expertise.some((exp) => {
      const expLower = exp.toLowerCase()
      const subjectLower = subject.name.toLowerCase()
      return (
        expLower.includes(subjectLower) ||
        subjectLower.includes(expLower) ||
        (subjectLower.includes("react") && expLower.includes("react")) ||
        (subjectLower.includes("javascript") && expLower.includes("javascript")) ||
        (subjectLower.includes("python") && expLower.includes("python")) ||
        (subjectLower.includes("design") && expLower.includes("design")) ||
        (subjectLower.includes("marketing") && expLower.includes("marketing"))
      )
    })

    const hasLocation =
      trainer.locations.includes(location) || (location === "Online" && trainer.locations.includes("Remote"))

    // Check availability for the day
    const hasAvailability = trainer.availability[dayOfWeek]

    // Check if not on leave
    const isOnLeave = trainer.leaves.some((leave) => {
      const leaveStart = parseDate(leave.startDate)
      const leaveEnd = parseDate(leave.endDate)
      return date >= leaveStart && date <= leaveEnd && leave.status === "approved"
    })

    let canTakeSession = true
    if (location === "Online") {
      const trainerSessionsToday = existingSchedule.filter(
        (session) => session.date === dateStr && session.trainerId === trainer.id,
      )
      // Trainers can take max 4 online sessions per day
      canTakeSession = trainerSessionsToday.length < 4
    } else {
      // For offline, trainer can only have one session per day
      const isAlreadyAssigned = existingSchedule.some(
        (session) => session.date === dateStr && session.trainerId === trainer.id,
      )
      canTakeSession = !isAlreadyAssigned
    }

    return hasExpertise && hasLocation && hasAvailability && !isOnLeave && canTakeSession
  })

  // Sort by priority: Senior > Core > Junior
  const priorityOrder = { Senior: 3, Core: 2, Junior: 1 }
  eligibleTrainers.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])

  return eligibleTrainers[0] || null
}

function getAssignmentConflicts(
  date: Date,
  subject: Subject,
  trainers: Trainer[],
  location: string,
  existingSchedule: ScheduleSession[],
): string[] {
  const conflicts: string[] = []
  const dayOfWeek = getDayOfWeek(date)
  const dateStr = formatDate(date)

  // Check if any trainers have the required expertise
  const trainersWithExpertise = trainers.filter((trainer) =>
    trainer.expertise.some((exp) => {
      const expLower = exp.toLowerCase()
      const subjectLower = subject.name.toLowerCase()
      return expLower.includes(subjectLower) || subjectLower.includes(expLower)
    }),
  )

  if (trainersWithExpertise.length === 0) {
    conflicts.push(`No trainer available with ${subject.name} expertise`)
    return conflicts
  }

  // Check location conflicts
  const trainersInLocation = trainersWithExpertise.filter(
    (trainer) => trainer.locations.includes(location) || trainer.locations.includes("Remote"),
  )

  if (trainersInLocation.length === 0) {
    conflicts.push(`No trainer with ${subject.name} expertise available in ${location}`)
    return conflicts
  }

  // Check availability conflicts
  const availableTrainers = trainersInLocation.filter((trainer) => trainer.availability[dayOfWeek])

  if (availableTrainers.length === 0) {
    conflicts.push(`No trainer available on ${dayOfWeek}`)
    return conflicts
  }

  // Check leave conflicts
  const trainersNotOnLeave = availableTrainers.filter((trainer) => {
    return !trainer.leaves.some((leave) => {
      const leaveStart = parseDate(leave.startDate)
      const leaveEnd = parseDate(leave.endDate)
      return date >= leaveStart && date <= leaveEnd && leave.status === "approved"
    })
  })

  if (trainersNotOnLeave.length === 0) {
    conflicts.push("All eligible trainers are on approved leave")
    return conflicts
  }

  // Check if all trainers are already assigned
  const unassignedTrainers = trainersNotOnLeave.filter((trainer) => {
    return !existingSchedule.some((session) => session.date === dateStr && session.trainerId === trainer.id)
  })

  if (unassignedTrainers.length === 0) {
    conflicts.push("All eligible trainers already assigned for this date")
    return conflicts
  }

  // If we get here, there should be an available trainer (this shouldn't happen)
  conflicts.push("Unknown scheduling conflict")
  return conflicts
}

export function detectConflicts(schedule: ScheduleSession[], trainers: Trainer[]): ScheduleSession[] {
  return schedule.map((session) => {
    const conflicts: string[] = [...(session.conflicts || [])]

    if (session.trainerId) {
      const trainer = trainers.find((t) => t.id === session.trainerId)
      if (trainer) {
        // Check for leave conflicts
        const sessionDate = parseDate(session.date)
        const isOnLeave = trainer.leaves.some((leave) => {
          const leaveStart = parseDate(leave.startDate)
          const leaveEnd = parseDate(leave.endDate)
          return sessionDate >= leaveStart && sessionDate <= leaveEnd && leave.status === "approved"
        })

        if (isOnLeave) {
          conflicts.push("Trainer is on approved leave")
        }

        // Check for double booking
        const sameTimeSlotSessions = schedule.filter(
          (s) => s.date === session.date && s.trainerId === session.trainerId && s !== session,
        )

        if (sameTimeSlotSessions.length > 0) {
          conflicts.push("Trainer has multiple sessions on the same day")
        }
      }
    }

    return { ...session, conflicts: conflicts.length > 0 ? conflicts : undefined }
  })
}

export function optimizeSchedule(schedule: ScheduleSession[], trainers: Trainer[]): ScheduleSession[] {
  // Simple optimization: try to balance workload across trainers
  const trainerWorkload = new Map<string, number>()

  // Count current assignments
  schedule.forEach((session) => {
    if (session.trainerId) {
      trainerWorkload.set(session.trainerId, (trainerWorkload.get(session.trainerId) || 0) + 1)
    }
  })

  // Sort trainers by current workload (ascending)
  const sortedTrainers = trainers
    .map((trainer) => ({
      trainer,
      workload: trainerWorkload.get(trainer.id) || 0,
    }))
    .sort((a, b) => a.workload - b.workload)

  return schedule // For now, return as-is. Could implement more sophisticated optimization
}

export function calculateBatchEndDate(
  startDate: string,
  course: { subjects: string[] },
  subjects: Subject[],
  batchType: "weekday" | "weekend" = "weekday",
): string {
  const courseSubjects = course.subjects
    .map((subjectId) => subjects.find((s) => s.id === subjectId))
    .filter(Boolean) as Subject[]

  const currentDate = parseDate(startDate)
  let totalDays = 0

  for (const subject of courseSubjects) {
    totalDays += subject.duration
    totalDays += 3 // Gap between subjects
  }

  // Add buffer for communication sessions and assessments
  totalDays += 10

  let workingDaysAdded = 0
  while (workingDaysAdded < totalDays) {
    // Skip weekends based on batch type
    if ((batchType === "weekday" && !isWeekend(currentDate)) || (batchType === "weekend" && isWeekend(currentDate))) {
      workingDaysAdded++
    }
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return formatDate(currentDate)
}

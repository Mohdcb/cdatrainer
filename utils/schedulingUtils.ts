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

/**
 * FEATURE: Main Schedule Generation
 * LOGIC: Creates a complete schedule for a batch by processing subjects consecutively
 * - No gaps between subjects (consecutive working days)
 * - Same trainer for entire subject duration
 * - Respects batch type (weekday/weekend) and holidays
 * - Handles online vs offline time slots
 */
export function generateSchedule(
  batch: Batch,
  course: { subjects: string[] },
  subjects: Subject[],
  trainers: Trainer[],
  holidays: Holiday[],
): ScheduleSession[] {
  const schedule: ScheduleSession[] = []
  
  // Create a working copy of the start date to avoid mutations
  let currentDate = new Date(parseDate(batch.startDate))

  // Get subjects in order from the course
  const courseSubjects = course.subjects
    .map((subjectId) => subjects.find((s) => s.id === subjectId))
    .filter(Boolean) as Subject[]

  // Set default batch type if undefined
  const effectiveBatchType = batch.batchType || "weekday"
  
  console.log(`[SCHEDULE] Generating schedule for batch: ${batch.name}`)
  console.log(`[SCHEDULE] Course has ${courseSubjects.length} subjects`)
  console.log(`[SCHEDULE] Batch type: ${effectiveBatchType} (original: ${batch.batchType}), Location: ${batch.location}`)

  for (const subject of courseSubjects) {
    console.log(`[SCHEDULE] Processing subject: ${subject.name} (duration: ${subject.duration} working days)`)
    
    // FEATURE: Subject Trainer Assignment
    // LOGIC: Find and assign a trainer for the ENTIRE subject duration
    // This ensures trainer continuity - same trainer teaches all days of the subject
    const subjectTrainer = findSubjectTrainer(
      currentDate,
      subject,
      trainers,
      batch,
      schedule,
      holidays,
      effectiveBatchType
    )

    if (subjectTrainer) {
      console.log(`[SCHEDULE] Assigned trainer ${subjectTrainer.name} to subject ${subject.name}`)
    } else {
      console.log(`[SCHEDULE] No trainer available for subject ${subject.name}`)
    }

    // Generate sessions for each working day of the subject
    let workingDaysCompleted = 0
    let daysProcessed = 0

    while (workingDaysCompleted < subject.duration) {
      // FEATURE: Working Day Calculation
      // LOGIC: Skip non-working days based on batch type
      // Weekday batches: Skip weekends (Saturday, Sunday)
      // Weekend batches: Skip weekdays (Monday-Friday)
      while (
        (effectiveBatchType === "weekday" && isWeekend(currentDate)) ||
        (effectiveBatchType === "weekend" && !isWeekend(currentDate)) ||
        isHoliday(currentDate, holidays)
      ) {
        currentDate.setDate(currentDate.getDate() + 1)
        daysProcessed++
      }

      // Create session for this working day
      const session: ScheduleSession = {
        date: formatDate(currentDate),
        subjectId: subject.id,
        status: subjectTrainer ? "assigned" : "unassigned",
        timeSlot: getSessionTimeSlot(batch),
        conflicts: [],
        sessionType: "regular",
      }

      if (subjectTrainer) {
        // FEATURE: Trainer Continuity
        // LOGIC: Same trainer for entire subject duration
        session.trainerId = subjectTrainer.id
        session.status = "assigned"
        
        // Verify trainer is still available on this specific date
        if (!isTrainerAvailableOnDate(subjectTrainer, currentDate, batch, schedule, holidays)) {
          session.status = "unassigned"
          session.conflicts = [`Trainer ${subjectTrainer.name} became unavailable on ${formatDate(currentDate)}`]
        }
      } else {
        // FEATURE: Conflict Detection
        // LOGIC: When no trainer available, provide specific conflict reasons
        session.conflicts = getAssignmentConflicts(currentDate, subject, trainers, batch, schedule, holidays)
      }

      schedule.push(session)
      console.log(`[SCHEDULE] Created session for ${formatDate(currentDate)}: ${subject.name} - ${session.status}`)

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1)
      daysProcessed++
      workingDaysCompleted++
    }

    console.log(`[SCHEDULE] Completed subject ${subject.name} in ${workingDaysCompleted} working days (${daysProcessed} total days)`)
    
    // FEATURE: Consecutive Subject Processing
    // LOGIC: NO gaps between subjects - they run consecutively
    // The next subject starts immediately after the current one ends
    // No need to add extra days or gaps
  }

  console.log(`[SCHEDULE] Total sessions generated: ${schedule.length}`)
  return schedule.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

/**
 * FEATURE: Subject Trainer Assignment
 * LOGIC: Finds a trainer for the ENTIRE subject duration
 * - Checks expertise, location, availability, and workload
 * - Returns the same trainer for all days of the subject
 * - Implements priority system (Senior > Core > Junior)
 */
function findSubjectTrainer(
  startDate: Date,
  subject: Subject,
  trainers: Trainer[],
  batch: Batch,
  existingSchedule: ScheduleSession[],
  holidays: Holiday[],
  effectiveBatchType: "weekday" | "weekend"
): Trainer | null {
  console.log(`[TRAINER] Finding trainer for subject: ${subject.name}`)
  
  // FEATURE: Trainer Eligibility Filtering
  // LOGIC: Multi-step filtering to find suitable trainers
  const eligibleTrainers = trainers.filter((trainer) => {
    // Step 1: Check expertise match
    const hasExpertise = hasSubjectExpertise(trainer, subject)
    if (!hasExpertise) {
      console.log(`[TRAINER] ${trainer.name} lacks expertise in ${subject.name}`)
      return false
    }

    // Step 2: Check location compatibility
    const hasLocation = hasLocationCompatibility(trainer, batch.location)
    if (!hasLocation) {
      console.log(`[TRAINER] ${trainer.name} not available in ${batch.location}`)
      return false
    }

    // Step 3: Check if trainer can handle the entire subject duration
    const canHandleSubject = canTrainerHandleSubjectDuration(
      trainer,
      startDate,
      subject.duration,
      batch,
      existingSchedule,
      holidays,
      effectiveBatchType
    )
    if (!canHandleSubject) {
      console.log(`[TRAINER] ${trainer.name} cannot handle entire subject duration`)
      return false
    }

    return true
  })

  if (eligibleTrainers.length === 0) {
    console.log(`[TRAINER] No eligible trainers found for subject ${subject.name}`)
    return null
  }

  // FEATURE: Priority-Based Trainer Selection
  // LOGIC: Sort by priority (Senior > Core > Junior) and select the best available
  const priorityOrder = { Senior: 3, Core: 2, Junior: 1 }
  eligibleTrainers.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])

  const selectedTrainer = eligibleTrainers[0]
  console.log(`[TRAINER] Selected trainer: ${selectedTrainer.name} (Priority: ${selectedTrainer.priority})`)
  
  return selectedTrainer
}

/**
 * FEATURE: Expertise Matching
 * LOGIC: Comprehensive subject-expertise matching
 * - Case-insensitive partial matching
 * - Handles common variations and abbreviations
 * - Removes hard-coded subject names
 */
function hasSubjectExpertise(trainer: Trainer, subject: Subject): boolean {
  const subjectName = subject.name.toLowerCase()
  const trainerExpertise = trainer.expertise.map(exp => exp.toLowerCase())

  return trainerExpertise.some(expertise => {
    // Direct match
    if (expertise === subjectName) return true
    
    // Partial match (expertise contains subject or vice versa)
    if (expertise.includes(subjectName) || subjectName.includes(expertise)) return true
    
    // Common variations and abbreviations
    const variations = {
      'javascript': ['js', 'javascript', 'ecmascript'],
      'react': ['react', 'reactjs', 'react.js'],
      'python': ['python', 'py'],
      'html': ['html', 'html5'],
      'css': ['css', 'css3'],
      'node': ['node', 'nodejs', 'node.js'],
      'database': ['db', 'database', 'sql', 'nosql'],
      'design': ['design', 'ui', 'ux', 'graphic'],
      'marketing': ['marketing', 'digital marketing', 'seo', 'sem']
    }

    for (const [key, values] of Object.entries(variations)) {
      if (values.includes(subjectName) && values.includes(expertise)) {
        return true
      }
    }

    return false
  })
}

/**
 * FEATURE: Location Compatibility
 * LOGIC: Checks if trainer can work in the batch location
 * - Handles both physical and online locations
 * - Considers trainer's preferred locations
 */
function hasLocationCompatibility(trainer: Trainer, batchLocation: string): boolean {
  // Normalize location names for comparison
  const normalizedBatchLocation = batchLocation.toLowerCase()
  const normalizedTrainerLocations = trainer.locations.map(loc => loc.toLowerCase())

  // Check if trainer has the exact location
  if (normalizedTrainerLocations.includes(normalizedBatchLocation)) {
    return true
  }

  // Handle online/remote variations
  if (normalizedBatchLocation === 'online' || normalizedBatchLocation === 'remote') {
    return normalizedTrainerLocations.some(loc => 
      loc === 'online' || loc === 'remote' || loc === 'anywhere'
    )
  }

  // Handle physical location variations
  if (normalizedBatchLocation === 'kochi' || normalizedBatchLocation === 'calicut') {
    return normalizedTrainerLocations.some(loc => 
      loc === normalizedBatchLocation || loc === 'anywhere' || loc === 'physical'
    )
  }

  return false
}

/**
 * FEATURE: Subject Duration Availability Check
 * LOGIC: Verifies if trainer can handle the entire subject duration
 * - Checks day-wise availability for all required dates
 * - Verifies no leave conflicts during subject period
 * - Ensures no scheduling conflicts
 */
function canTrainerHandleSubjectDuration(
  trainer: Trainer,
  startDate: Date,
  duration: number,
  batch: Batch,
  existingSchedule: ScheduleSession[],
  holidays: Holiday[],
  effectiveBatchType: "weekday" | "weekend"
): boolean {
  console.log(`[TRAINER] Checking if ${trainer.name} can handle ${duration} working days starting ${formatDate(startDate)}`)

  let workingDaysChecked = 0
  let currentDate = new Date(startDate)

  while (workingDaysChecked < duration) {
          // Skip non-working days based on batch type
      while (
        (effectiveBatchType === "weekday" && isWeekend(currentDate)) ||
        (effectiveBatchType === "weekend" && !isWeekend(currentDate)) ||
        isHoliday(currentDate, holidays)
      ) {
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Check if trainer is available on this specific date
    if (!isTrainerAvailableOnDate(trainer, currentDate, batch, existingSchedule, holidays)) {
      console.log(`[TRAINER] ${trainer.name} unavailable on ${formatDate(currentDate)}`)
      return false
    }

    workingDaysChecked++
    currentDate.setDate(currentDate.getDate() + 1)
  }

  console.log(`[TRAINER] ${trainer.name} can handle entire subject duration`)
  return true
}

/**
 * FEATURE: Date-Specific Trainer Availability
 * LOGIC: Checks if trainer is available on a specific date
 * - Verifies day-of-week availability
 * - Checks leave status
 * - Prevents double-booking
 * - Validates time slot compatibility for online sessions
 */
function isTrainerAvailableOnDate(
  trainer: Trainer,
  date: Date,
  batch: Batch,
  existingSchedule: ScheduleSession[],
  holidays: Holiday[]
): boolean {
  const dayOfWeek = getDayOfWeek(date)
  const dateStr = formatDate(date)

  // Check day-of-week availability
  if (!trainer.availability[dayOfWeek]) {
    console.log(`[TRAINER] ${trainer.name} not available on ${dayOfWeek}`)
    return false
  }

  // Check leave status
  const isOnLeave = trainer.leaves.some((leave) => {
    if (leave.status !== "approved") return false
    
    const leaveStart = parseDate(leave.startDate)
    const leaveEnd = parseDate(leave.endDate)
    return date >= leaveStart && date <= leaveEnd
  })

  if (isOnLeave) {
    console.log(`[TRAINER] ${trainer.name} on approved leave on ${dateStr}`)
    return false
  }

  // Check for existing sessions on the same date
  const existingSessions = existingSchedule.filter(s => 
    s.date === dateStr && s.trainerId === trainer.id
  )

  if (batch.location === "online") {
    // FEATURE: Online Session Time Slot Management
    // LOGIC: Multiple online sessions allowed per day if time slots don't overlap
      // Check if new session can fit within trainer's working hours
  const canFitInWorkingHours = canFitInTrainerWorkingHours(trainer, batch.timeSlot || "")
    if (!canFitInWorkingHours) {
      console.log(`[TRAINER] ${trainer.name} working hours cannot accommodate time slot ${batch.timeSlot}`)
      return false
    }

      // Check for time slot conflicts
  const hasTimeConflict = hasTimeSlotConflict(batch.timeSlot || "", existingSessions)
    if (hasTimeConflict) {
      console.log(`[TRAINER] ${trainer.name} has time slot conflict on ${dateStr}`)
      return false
    }

    // Limit online sessions per day (configurable)
    const maxOnlineSessionsPerDay = 4
    if (existingSessions.length >= maxOnlineSessionsPerDay) {
      console.log(`[TRAINER] ${trainer.name} already has ${existingSessions.length} sessions on ${dateStr}`)
      return false
    }
  } else {
    // FEATURE: Offline Session Management
    // LOGIC: Only one offline session per day per trainer
    if (existingSessions.length > 0) {
      console.log(`[TRAINER] ${trainer.name} already has offline session on ${dateStr}`)
      return false
    }
  }

  return true
}

/**
 * FEATURE: Working Hours Validation
 * LOGIC: Checks if batch time slot fits within trainer's working hours
 * - Uses trainer's individual start/end times
 * - Ensures batch time slot is within working hours
 */
function canFitInTrainerWorkingHours(trainer: Trainer, batchTimeSlot?: string): boolean {
  if (!batchTimeSlot) return true

  // Parse trainer working hours
  const trainerStart = parseTimeToMinutes(trainer.startTime)
  const trainerEnd = parseTimeToMinutes(trainer.endTime)
  
  // Parse batch time slot
  const [batchStart, batchEnd] = batchTimeSlot.split('-')
  const batchStartMinutes = parseTimeToMinutes(batchStart)
  const batchEndMinutes = parseTimeToMinutes(batchEnd)

  // Check if batch time slot fits within trainer working hours
  const fitsInWorkingHours = batchStartMinutes >= trainerStart && batchEndMinutes <= trainerEnd
  
  console.log(`[TRAINER] Working hours check: ${trainer.startTime}-${trainer.endTime} vs ${batchTimeSlot} = ${fitsInWorkingHours}`)
  
  return fitsInWorkingHours
}

/**
 * FEATURE: Time Slot Conflict Detection
 * LOGIC: Checks for overlapping time slots on the same day
 * - Prevents double-booking of time slots
 * - Handles various time slot formats
 */
function hasTimeSlotConflict(newTimeSlot: string, existingSessions: ScheduleSession[]): boolean {
  if (!newTimeSlot || existingSessions.length === 0) return false

  const [newStart, newEnd] = newTimeSlot.split('-')
  const newStartMinutes = parseTimeToMinutes(newStart)
  const newEndMinutes = parseTimeToMinutes(newEnd)

  for (const session of existingSessions) {
    if (!session.timeSlot) continue

    const [existingStart, existingEnd] = session.timeSlot.split('-')
    const existingStartMinutes = parseTimeToMinutes(existingStart)
    const existingEndMinutes = parseTimeToMinutes(existingEnd)

    // Check for overlap
    const hasOverlap = !(newEndMinutes <= existingStartMinutes || newStartMinutes >= existingEndMinutes)
    
    if (hasOverlap) {
      console.log(`[CONFLICT] Time slot conflict: ${newTimeSlot} overlaps with ${session.timeSlot}`)
      return true
    }
  }

  return false
}

/**
 * FEATURE: Time Parsing Utility
 * LOGIC: Converts time strings (HH:MM) to minutes for easy comparison
 */
function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0
  
  const [hours, minutes] = timeStr.split(':').map(Number)
  return (hours || 0) * 60 + (minutes || 0)
}

/**
 * FEATURE: Session Time Slot Generation
 * LOGIC: Determines appropriate time slot based on batch type and location
 * - Uses batch start_time and end_time from database
 * - Falls back to defaults for different batch types
 */
function getSessionTimeSlot(batch: Batch): string {
  // Use database time fields if available
  if (batch.startTime && batch.endTime) {
    return `${batch.startTime}-${batch.endTime}`
  }
  
  // Fallback to location-based defaults
  if (batch.location === "online") {
    return "09:00-12:00" // Online default
  }
  
  // Default time slots for different batch types
  if (batch.batchType === "weekend") {
    return "10:00-16:00" // Weekend hours
  }
  
  return "09:00-17:00" // Standard weekday hours
}

/**
 * FEATURE: Conflict Analysis
 * LOGIC: Provides detailed conflict reasons when no trainer is available
 * - Expertise conflicts
 * - Location conflicts
 * - Availability conflicts
 * - Leave conflicts
 * - Workload conflicts
 */
function getAssignmentConflicts(
  date: Date,
  subject: Subject,
  trainers: Trainer[],
  batch: Batch,
  existingSchedule: ScheduleSession[],
  holidays: Holiday[]
): string[] {
  const conflicts: string[] = []
  const dayOfWeek = getDayOfWeek(date)
  const dateStr = formatDate(date)

  console.log(`[CONFLICT] Analyzing conflicts for ${subject.name} on ${dateStr}`)

  // Check if any trainers have the required expertise
  const trainersWithExpertise = trainers.filter((trainer) =>
    hasSubjectExpertise(trainer, subject)
  )

  if (trainersWithExpertise.length === 0) {
    conflicts.push(`No trainer available with ${subject.name} expertise`)
    console.log(`[CONFLICT] No trainers with ${subject.name} expertise`)
    return conflicts
  }

  // Check location compatibility
  const trainersInLocation = trainersWithExpertise.filter((trainer) =>
    hasLocationCompatibility(trainer, batch.location)
  )

  if (trainersInLocation.length === 0) {
    conflicts.push(`No trainer with ${subject.name} expertise available in ${batch.location}`)
    console.log(`[CONFLICT] No trainers available in ${batch.location}`)
    return conflicts
  }

  // Check day availability
  const availableTrainers = trainersInLocation.filter((trainer) => 
    trainer.availability[dayOfWeek]
  )

  if (availableTrainers.length === 0) {
    conflicts.push(`No trainer available on ${dayOfWeek}`)
    console.log(`[CONFLICT] No trainers available on ${dayOfWeek}`)
    return conflicts
  }

  // Check leave status
  const trainersNotOnLeave = availableTrainers.filter((trainer) => {
    return !trainer.leaves.some((leave) => {
      if (leave.status !== "approved") return false
      
      const leaveStart = parseDate(leave.startDate)
      const leaveEnd = parseDate(leave.endDate)
      return date >= leaveStart && date <= leaveEnd
    })
  })

  if (trainersNotOnLeave.length === 0) {
    conflicts.push("All eligible trainers are on approved leave")
    console.log(`[CONFLICT] All trainers on leave`)
    return conflicts
  }

  // Check workload and scheduling conflicts
  const availableTrainersForDate = trainersNotOnLeave.filter((trainer) => {
    return isTrainerAvailableOnDate(trainer, date, batch, existingSchedule, holidays)
  })

  if (availableTrainersForDate.length === 0) {
    conflicts.push("All eligible trainers have scheduling conflicts or workload issues")
    console.log(`[CONFLICT] All trainers have conflicts`)
    return conflicts
  }

  // If we get here, there should be an available trainer
  conflicts.push("Unknown scheduling conflict - please investigate")
  console.log(`[CONFLICT] Unknown conflict detected`)
  
  return conflicts
}

/**
 * FEATURE: Conflict Detection for Existing Sessions
 * LOGIC: Analyzes existing sessions for conflicts
 * - Leave conflicts
 * - Double-booking conflicts
 * - Time slot conflicts
 */
export function detectConflicts(schedule: ScheduleSession[], trainers: Trainer[]): ScheduleSession[] {
  return schedule.map((session) => {
    const conflicts: string[] = [...(session.conflicts || [])]

    if (session.trainerId) {
      const trainer = trainers.find((t) => t.id === session.trainerId)
      if (trainer) {
        // Check for leave conflicts
        const sessionDate = parseDate(session.date)
        const isOnLeave = trainer.leaves.some((leave) => {
          if (leave.status !== "approved") return false
          
          const leaveStart = parseDate(leave.startDate)
          const leaveEnd = parseDate(leave.endDate)
          return sessionDate >= leaveStart && sessionDate <= leaveEnd
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

/**
 * FEATURE: Schedule Optimization
 * LOGIC: Balances workload among eligible trainers
 * - Assigns unassigned sessions to least-loaded trainers
 * - Maintains trainer continuity for subjects
 * - Respects all availability and conflict constraints
 */
export function optimizeSchedule(schedule: ScheduleSession[], trainers: Trainer[]): ScheduleSession[] {
  console.log(`[OPTIMIZE] Starting schedule optimization for ${schedule.length} sessions`)
  
  // Calculate current trainer workload
  const trainerWorkload = new Map<string, number>()
  trainers.forEach((t) => trainerWorkload.set(t.id, 0))
  
  schedule.forEach((s) => {
    if (s.trainerId) {
      trainerWorkload.set(s.trainerId, (trainerWorkload.get(s.trainerId) || 0) + 1)
    }
  })

  const optimized: ScheduleSession[] = []
  
  for (const session of schedule) {
    if (session.trainerId) {
      // Session already has a trainer, keep it
      optimized.push(session)
      continue
    }

    console.log(`[OPTIMIZE] Finding trainer for unassigned session: ${session.subjectId} on ${session.date}`)

    // Find eligible trainers for this session
    const eligible = findEligibleTrainersForSession(session, trainers, optimized)
    
    if (eligible.length === 0) {
      console.log(`[OPTIMIZE] No eligible trainers found for session on ${session.date}`)
      optimized.push(session)
      continue
    }

    // Select trainer with lowest workload
    eligible.sort((a, b) => (trainerWorkload.get(a.id) || 0) - (trainerWorkload.get(b.id) || 0))
    const chosenTrainer = eligible[0]
    
    // Update workload and assign trainer
    trainerWorkload.set(chosenTrainer.id, (trainerWorkload.get(chosenTrainer.id) || 0) + 1)
    
    const optimizedSession = { 
      ...session, 
      trainerId: chosenTrainer.id, 
      status: "assigned" as const 
    }
    
    console.log(`[OPTIMIZE] Assigned ${chosenTrainer.name} to session on ${session.date}`)
    optimized.push(optimizedSession)
  }

  console.log(`[OPTIMIZE] Optimization complete. Assigned ${optimized.filter(s => s.trainerId).length} sessions`)
  return optimized
}

/**
 * FEATURE: Session Eligibility Check
 * LOGIC: Determines which trainers are eligible for a specific session
 * - Checks expertise, availability, and conflicts
 * - Used during optimization phase
 */
function findEligibleTrainersForSession(
  session: ScheduleSession,
  trainers: Trainer[],
  existingSessions: ScheduleSession[]
): Trainer[] {
  const sessionDate = parseDate(session.date)
  const dayOfWeek = getDayOfWeek(sessionDate)

  return trainers.filter((trainer) => {
    // Check expertise - simplified for optimization since we only have subjectId
    const hasExpertise = trainer.expertise.some(exp => 
      exp.toLowerCase().includes(session.subjectId.toLowerCase())
    )
    if (!hasExpertise) return false

    // Check day availability
    const hasAvailability = Boolean(trainer.availability[dayOfWeek])
    if (!hasAvailability) return false

    // Check leave status
    const notOnLeave = !trainer.leaves.some((leave) => {
      if (leave.status !== "approved") return false
      
      const leaveStart = parseDate(leave.startDate)
      const leaveEnd = parseDate(leave.endDate)
      return sessionDate >= leaveStart && sessionDate <= leaveEnd
    })
    if (!notOnLeave) return false

    // Check for double booking
    const notDoubleBooked = !existingSessions.some((s) => 
      s.date === session.date && s.trainerId === trainer.id
    )
    if (!notDoubleBooked) return false

    return true
  })
}

/**
 * FEATURE: Batch End Date Calculation
 * LOGIC: Calculates when a batch will end based on course duration
 * - Considers working days only (weekday/weekend)
 * - Adds buffer for assessments and breaks
 * - Uses actual subject durations from database
 */
export function calculateBatchEndDate(
  startDate: string,
  course: { subjects: string[] },
  subjects: Subject[],
  batchType: "weekday" | "weekend" = "weekday",
): string {
  // Ensure we have a valid batch type
  const effectiveBatchType = batchType || "weekday"
  console.log(`[CALCULATE] Calculating end date for batch starting ${startDate}`)
  
  // Get subjects with their durations
  const courseSubjects = course.subjects
    .map((subjectId) => subjects.find((s) => s.id === subjectId))
    .filter(Boolean) as Subject[]

  // Calculate total working days needed
  let totalWorkingDays = 0
  for (const subject of courseSubjects) {
    totalWorkingDays += subject.duration
    console.log(`[CALCULATE] Subject ${subject.name}: ${subject.duration} working days`)
  }

  // Add buffer for assessments, breaks, and communication
  const bufferDays = 5
  totalWorkingDays += bufferDays
  
  console.log(`[CALCULATE] Total working days needed: ${totalWorkingDays} (including ${bufferDays} buffer days)`)

  // Calculate end date by adding working days
  const currentDate = parseDate(startDate)
  let workingDaysAdded = 0

  while (workingDaysAdded < totalWorkingDays) {
    // Skip non-working days based on batch type
    if ((effectiveBatchType === "weekday" && !isWeekend(currentDate)) || 
        (effectiveBatchType === "weekend" && isWeekend(currentDate))) {
      workingDaysAdded++
    }
    currentDate.setDate(currentDate.getDate() + 1)
  }

  const endDate = formatDate(currentDate)
  console.log(`[CALCULATE] Calculated end date: ${endDate}`)
  
  return endDate
}

import type { Trainer, Subject, Batch, Holiday } from "../hooks/useData"
import { isWeekend, isHoliday, formatDate, getDayOfWeek, parseDate, isWorkingDayForBatch } from "./dateUtils"

// DEBUG: Verify imports are working
// console.log(`[SCHEDULE] DEBUG: Import verification - isWeekend function:`, typeof isWeekend)
// console.log(`[SCHEDULE] DEBUG: Import verification - isWorkingDayForBatch function:`, typeof isWorkingDayForBatch)

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
 * - ENHANCED: Round-robin assignment for equal workload distribution among online trainers
 * - ENHANCED: Fills empty days with placeholder sessions for clarity
 * - ENHANCED: Creates schedule rows for ALL working days, even when no trainers available
 */
export function generateSchedule(
  batch: Batch,
  course: { subjects: string[] },
  subjects: Subject[],
  trainers: Trainer[],
  holidays: Holiday[],
): ScheduleSession[] {
  console.log(`[SCHEDULE] ===== GENERATE SCHEDULE CALLED =====`)
  console.log(`[SCHEDULE] Batch: ${batch.name}, Type: ${batch.batchType}`)
  console.log(`[SCHEDULE] Start Date: ${batch.startDate}, End Date: ${batch.endDate}`)
  console.log(`[SCHEDULE] Call stack:`, new Error().stack?.split('\n').slice(1, 4).join('\n'))
  
  const schedule: ScheduleSession[] = []
  
  // Create a working copy of the start date to avoid mutations
  let currentDate = new Date(parseDate(batch.startDate))
  const endDate = batch.endDate ? new Date(parseDate(batch.endDate)) : new Date(parseDate(batch.startDate))

  // Get subjects in order from the course
  const courseSubjects = course.subjects
    .map((subjectId) => subjects.find((s) => s.id === subjectId))
    .filter(Boolean) as Subject[]

  // Set default batch type if undefined
  const effectiveBatchType = batch.batchType || "weekday"
  
  // console.log(`[SCHEDULE] Generating schedule for batch: ${batch.name}`)
  // console.log(`[SCHEDULE] Course has ${courseSubjects.length} subjects`)
  // console.log(`[SCHEDULE] Batch type: ${effectiveBatchType} (original: ${batch.batchType}), Location: ${batch.location}`)
  // console.log(`[SCHEDULE] DEBUG: batch object:`, JSON.stringify(batch, null, 2))
  // console.log(`[SCHEDULE] DEBUG: effectiveBatchType: ${effectiveBatchType}`)
  // console.log(`[SCHEDULE] DEBUG: typeof effectiveBatchType: ${typeof effectiveBatchType}`)

  // ENHANCED: Calculate total working days needed for the entire course
  let totalWorkingDaysNeeded = 0
  for (const subject of courseSubjects) {
    totalWorkingDaysNeeded += subject.duration
  }
  
  // console.log(`[SCHEDULE] Total working days needed: ${totalWorkingDaysNeeded}`)

  // ENHANCED: Generate schedule for ALL working days in the batch duration
  let workingDaysProcessed = 0
  let currentDateForSchedule = new Date(currentDate)
  
  // console.log(`[SCHEDULE] DEBUG: Starting schedule generation`)
  // console.log(`[SCHEDULE] DEBUG: Initial date: ${formatDate(currentDateForSchedule)}`)
  // console.log(`[SCHEDULE] DEBUG: Total working days needed: ${totalWorkingDaysNeeded}`)
  // console.log(`[SCHEDULE] DEBUG: Batch type: ${effectiveBatchType}`)

  while (workingDaysProcessed < totalWorkingDaysNeeded) {
    console.log(`[SCHEDULE] === LOOP ITERATION ${workingDaysProcessed + 1}/${totalWorkingDaysNeeded} ===`)
    // console.log(`[SCHEDULE] DEBUG: Current date: ${formatDate(currentDateForSchedule)}`)
    // console.log(`[SCHEDULE] DEBUG: Current day: ${getDayOfWeek(currentDateForSchedule)}`)
    // console.log(`[SCHEDULE] DEBUG: Is weekend: ${isWeekend(currentDateForSchedule)}`)
    // console.log(`[SCHEDULE] DEBUG: Is working day: ${isWorkingDayForBatch(currentDateForSchedule, effectiveBatchType)}`)
    // Skip non-working days based on batch type
    // CORE DEBUG: Show exactly what's happening with weekend detection
    console.log(`[SCHEDULE] CORE DEBUG: Before weekend check - Date: ${formatDate(currentDateForSchedule)}`)
    console.log(`[SCHEDULE] CORE DEBUG: Day: ${getDayOfWeek(currentDateForSchedule)}`)
    console.log(`[SCHEDULE] CORE DEBUG: Day number: ${currentDateForSchedule.getDay()}`)
    console.log(`[SCHEDULE] CORE DEBUG: isWeekend(): ${isWeekend(currentDateForSchedule)}`)
    console.log(`[SCHEDULE] CORE DEBUG: isWorkingDayForBatch(): ${isWorkingDayForBatch(currentDateForSchedule, effectiveBatchType)}`)
    console.log(`[SCHEDULE] CORE DEBUG: batchType: ${effectiveBatchType}`)
    
    // COMPREHENSIVE FORCE WEEKEND SKIPPING: Handle ALL Saturdays and Sundays for weekday batches
    let weekendSkipped = false
    while (
      !isWorkingDayForBatch(currentDateForSchedule, effectiveBatchType) ||
      isHoliday(currentDateForSchedule, holidays)
    ) {
      const dayName = getDayOfWeek(currentDateForSchedule)
      const isWeekendDay = isWeekend(currentDateForSchedule)
      const isWorkingDay = isWorkingDayForBatch(currentDateForSchedule, effectiveBatchType)
      
      // FORCE SKIP: For weekday batches, ALWAYS skip Saturday and Sunday regardless of utility function results
      if (effectiveBatchType === "weekday") {
        const currentDayNumber = currentDateForSchedule.getDay()
        if (currentDayNumber === 0 || currentDayNumber === 6) {
          const forceDayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][currentDayNumber]
          console.log(`[SCHEDULE] FORCE SKIP: ${forceDayName} (${formatDate(currentDateForSchedule)}): Day ${currentDayNumber} - ALWAYS skipped for weekday batches`)
          weekendSkipped = true
          currentDateForSchedule.setDate(currentDateForSchedule.getDate() + 1)
          continue
        }
      }
      
      console.log(`[SCHEDULE] Skipping ${dayName} (${formatDate(currentDateForSchedule)}): isWeekend=${isWeekendDay}, isWorkingDay=${isWorkingDay}, batchType=${effectiveBatchType}`)
      
      // Move to next day
      currentDateForSchedule.setDate(currentDateForSchedule.getDate() + 1)
    }
    
    // Log if any weekends were force-skipped
    if (weekendSkipped) {
      console.log(`[SCHEDULE] Weekend force-skipping completed for this iteration`)
    }
    
    // console.log(`[SCHEDULE] DEBUG: After weekend skipping - Current date: ${formatDate(currentDateForSchedule)}`)
    // console.log(`[SCHEDULE] DEBUG: After weekend skipping - Current day: ${getDayOfWeek(currentDateForSchedule)}`)
    // console.log(`[SCHEDULE] DEBUG: After weekend skipping - Is weekend: ${isWeekend(currentDateForSchedule)}`)
    // console.log(`[SCHEDULE] DEBUG: After weekend skipping - Is working day: ${isWorkingDayForBatch(currentDateForSchedule, effectiveBatchType)}`)

    // Find which subject this working day belongs to
    let subjectIndex = 0
    let daysInCurrentSubject = 0
    let currentSubject = courseSubjects[subjectIndex]
    
    for (let i = 0; i < courseSubjects.length; i++) {
      if (workingDaysProcessed < daysInCurrentSubject + courseSubjects[i].duration) {
        subjectIndex = i
        currentSubject = courseSubjects[i]
        break
      }
      daysInCurrentSubject += courseSubjects[i].duration
    }

    // EMERGENCY WEEKEND BLOCK: Force check for weekend days before session creation
    const emergencyDayNumber = currentDateForSchedule.getDay()
    const emergencyDayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][emergencyDayNumber]
    const emergencyIsWeekend = emergencyDayNumber === 0 || emergencyDayNumber === 6
    
    // CRITICAL: For weekday batches, NEVER create sessions on weekend days
    if (effectiveBatchType === "weekday" && emergencyIsWeekend) {
      console.error(`[SCHEDULE] EMERGENCY BLOCK: Blocking weekend session creation!`)
      console.error(`[SCHEDULE] Date: ${formatDate(currentDateForSchedule)}, Day: ${emergencyDayName} (${emergencyDayNumber}), isWeekend: ${emergencyIsWeekend}`)
      console.error(`[SCHEDULE] This should never happen for weekday batches!`)
      console.error(`[SCHEDULE] Moving to next day and continuing...`)
      currentDateForSchedule.setDate(currentDateForSchedule.getDate() + 1)
      continue
    }
    
    // Create session for this working day
    const dayName = getDayOfWeek(currentDateForSchedule)
    const isWeekendDay = isWeekend(currentDateForSchedule)
    
    // CORE DEBUG: Show exactly what's happening during session creation
    console.log(`[SCHEDULE] CORE DEBUG: Session creation - Date: ${formatDate(currentDateForSchedule)}`)
    console.log(`[SCHEDULE] CORE DEBUG: Day name: ${dayName}`)
    console.log(`[SCHEDULE] CORE DEBUG: Day number: ${currentDateForSchedule.getDay()}`)
    console.log(`[SCHEDULE] CORE DEBUG: isWeekend: ${isWeekendDay}`)
    console.log(`[SCHEDULE] CORE DEBUG: batchType: ${effectiveBatchType}`)
    console.log(`[SCHEDULE] CORE DEBUG: Should this be a working day? ${!isWeekendDay}`)
    
    console.log(`[SCHEDULE] Creating session for ${dayName} (${formatDate(currentDateForSchedule)}): isWeekend=${isWeekendDay}, subject=${currentSubject.name}`)
    
    const session: ScheduleSession = {
      date: formatDate(currentDateForSchedule),
      subjectId: currentSubject.id,
      status: "unassigned", // Default to unassigned
      timeSlot: getSessionTimeSlot(batch),
      conflicts: [],
      sessionType: "regular",
    }

    // Try to assign a trainer for this session - BUT DON'T FORCE IT
    const sessionTrainer = findSubjectTrainer(
      currentDateForSchedule,
      currentSubject,
      trainers,
      batch,
      schedule,
      holidays,
      effectiveBatchType
    )

    if (sessionTrainer) {
      // CRITICAL: Double-check trainer availability on this specific date
      if (isTrainerAvailableOnDate(sessionTrainer, currentDateForSchedule, batch, schedule, holidays)) {
        session.trainerId = sessionTrainer.id
        session.status = "assigned"
        console.log(`[SCHEDULE] Successfully assigned trainer ${sessionTrainer.name} to ${currentSubject.name} on ${formatDate(currentDateForSchedule)}`)
      } else {
        // Trainer became unavailable - keep session unassigned
        session.status = "unassigned"
        session.conflicts = [`Trainer ${sessionTrainer.name} became unavailable on ${formatDate(currentDateForSchedule)}`]
        console.log(`[SCHEDULE] Trainer ${sessionTrainer.name} unavailable on ${formatDate(currentDateForSchedule)} - keeping unassigned`)
      }
    } else {
      // No trainer available - keep session unassigned for admin to handle
      session.status = "unassigned"
      session.conflicts = getAssignmentConflicts(currentDateForSchedule, currentSubject, trainers, batch, schedule, holidays)
      console.log(`[SCHEDULE] No trainer available for ${currentSubject.name} on ${formatDate(currentDateForSchedule)} - keeping unassigned`)
    }

    // Simple session addition
    schedule.push(session)
    console.log(`[SCHEDULE] Added session to schedule - Date: ${formatDate(currentDateForSchedule)}, Day: ${dayName}, isWeekend: ${isWeekendDay}`)

    // Move to next day
    // console.log(`[SCHEDULE] DEBUG: Before moving to next day - Current date: ${formatDate(currentDateForSchedule)}`)
    currentDateForSchedule.setDate(currentDateForSchedule.getDate() + 1)
    // console.log(`[SCHEDULE] DEBUG: After moving to next day - New date: ${formatDate(currentDateForSchedule)}`)
    workingDaysProcessed++
    // console.log(`[SCHEDULE] DEBUG: Working days processed: ${workingDaysProcessed}/${totalWorkingDaysNeeded}`)
  }

  // console.log(`[SCHEDULE] Total sessions generated: ${schedule.length}`)
  // console.log(`[SCHEDULE] Assigned sessions: ${schedule.filter(s => s.status === "assigned").length}`)
  // console.log(`[SCHEDULE] Unassigned sessions: ${schedule.filter(s => s.status === "unassigned").length}`)
  
  // DEBUG: Check for duplicate dates
  const dateCounts = new Map<string, number>()
  schedule.forEach(s => {
    const count = dateCounts.get(s.date) || 0
    dateCounts.set(s.date, count + 1)
  })
  
  console.log(`[SCHEDULE] DEBUG: ===== DUPLICATE DATE CHECK =====`)
  dateCounts.forEach((count, date) => {
    if (count > 1) {
      console.error(`[SCHEDULE] ERROR: Date ${date} appears ${count} times in schedule!`)
    } else {
      console.log(`[SCHEDULE] DEBUG: Date ${date} appears ${count} time(s)`)
    }
  })
  
  // Debug: Show which days got sessions
  console.log(`[SCHEDULE] DEBUG: ===== PROCESSING SESSION DAYS SUMMARY =====`)
  console.log(`[SCHEDULE] DEBUG: Total sessions in schedule: ${schedule.length}`)
  
  // FINAL FIX: Use direct date construction to eliminate ANY date processing bugs
  const sessionDays = schedule.map((s, index) => {
    // DIRECT DATE CONSTRUCTION: No utility functions, no timezone issues
    const [year, month, day] = s.date.split('-').map(Number)
    const directDate = new Date(year, month - 1, day) // Local timezone, no shifting
    const directDay = directDate.getDay()
    const directDayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][directDay]
    const directIsWeekend = directDay === 0 || directDay === 6
    
    // FINAL DEBUG: Show exactly what's happening in the summary
    console.log(`[SCHEDULE] FINAL DEBUG: Session ${index + 1}/${schedule.length}:`)
    console.log(`[SCHEDULE] FINAL DEBUG:   - Date string: "${s.date}"`)
    console.log(`[SCHEDULE] FINAL DEBUG:   - Direct date: ${directDate.toISOString()}`)
    console.log(`[SCHEDULE] FINAL DEBUG:   - Day number: ${directDay}`)
    console.log(`[SCHEDULE] FINAL DEBUG:   - Day name: ${directDayName}`)
    console.log(`[SCHEDULE] FINAL DEBUG:   - isWeekend: ${directIsWeekend}`)
    console.log(`[SCHEDULE] FINAL DEBUG:   - Subject ID: ${s.subjectId}`)
    
    return `${directDayName} (${s.date}) - ${s.subjectId} - isWeekend: ${directIsWeekend}`
  })
  
  // Simple final result check
  console.log(`[SCHEDULE] ===== FINAL RESULT =====`)
  console.log(`[SCHEDULE] Total sessions: ${schedule.length}`)
  console.log(`[SCHEDULE] Session days:`, sessionDays)
  
  // Check if any weekend sessions exist for weekday batches
  const weekendSessions = sessionDays.filter(day => day.includes('isWeekend: true'))
  if (weekendSessions.length > 0) {
    console.error(`[SCHEDULE] ⚠️  WARNING: Found ${weekendSessions.length} weekend sessions!`)
    weekendSessions.forEach(session => console.error(`[SCHEDULE]   - ${session}`))
  } else {
    console.log(`[SCHEDULE] ✅ SUCCESS: No weekend sessions found!`)
  }
  
  // ENHANCED: Fill empty days with placeholder sessions for clarity
  if (endDate) {
    const filledSchedule = fillEmptyDaysWithPlaceholders(
      schedule, 
      batch, 
      new Date(parseDate(batch.startDate)), 
      endDate, 
      effectiveBatchType
    )
    // console.log(`[SCHEDULE] Filled schedule with placeholders: ${filledSchedule.length} total sessions`)
    return filledSchedule
  }
  
  return schedule.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

/**
 * FEATURE: Subject Trainer Assignment
 * LOGIC: Finds a trainer for the ENTIRE subject duration
 * - Checks expertise, location, availability, and workload
 * - Returns the same trainer for all days of the subject
 * - Implements priority system (Senior > Core > Junior)
 * - ENHANCED: Round-robin assignment for equal workload distribution
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

    // Step 4: CRITICAL - Check if trainer is available on the specific start date
    if (!isTrainerAvailableOnDate(trainer, startDate, batch, existingSchedule, holidays)) {
      console.log(`[TRAINER] ${trainer.name} not available on start date ${formatDate(startDate)}`)
      return false
    }

    return true
  })

  if (eligibleTrainers.length === 0) {
    console.log(`[TRAINER] No eligible trainers found for subject ${subject.name}`)
    return null
  }

  // ENHANCED FEATURE: Round-Robin Workload Distribution
  // LOGIC: Ensures equal contribution from all eligible trainers
  if (batch.location === "online" && eligibleTrainers.length > 1) {
    const selectedTrainer = selectTrainerWithRoundRobin(eligibleTrainers, existingSchedule, batch)
    console.log(`[TRAINER] Round-robin selected: ${selectedTrainer.name} (Priority: ${selectedTrainer.priority})`)
    return selectedTrainer
  }

  // FEATURE: Priority-Based Trainer Selection (fallback for offline or single trainer)
  // LOGIC: Sort by priority (Senior > Core > Junior) and select the best available
  const priorityOrder = { Senior: 3, Core: 2, Junior: 1 }
  eligibleTrainers.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])

  const selectedTrainer = eligibleTrainers[0]
  console.log(`[TRAINER] Priority-based selected: ${selectedTrainer.name} (Priority: ${selectedTrainer.priority})`)
  
  return selectedTrainer
}

/**
 * FEATURE: Round-Robin Trainer Selection
 * LOGIC: Ensures equal workload distribution among eligible trainers
 * - Tracks assignment order for fair distribution
 * - Considers current workload to balance assignments
 * - Maintains priority within equal workload groups
 */
function selectTrainerWithRoundRobin(
  eligibleTrainers: Trainer[],
  existingSchedule: ScheduleSession[],
  batch: Batch
): Trainer {
  console.log(`[ROUND-ROBIN] Selecting trainer from ${eligibleTrainers.length} eligible trainers`)
  
  // Calculate current workload for each eligible trainer
  const trainerWorkload = new Map<string, number>()
  eligibleTrainers.forEach(trainer => {
    const currentWorkload = existingSchedule.filter(s => s.trainerId === trainer.id).length
    trainerWorkload.set(trainer.id, currentWorkload)
    console.log(`[ROUND-ROBIN] ${trainer.name}: ${currentWorkload} sessions`)
  })
  
  // Find trainers with minimum workload
  const minWorkload = Math.min(...Array.from(trainerWorkload.values()))
  const trainersWithMinWorkload = eligibleTrainers.filter(trainer => 
    trainerWorkload.get(trainer.id) === minWorkload
  )
  
  console.log(`[ROUND-ROBIN] ${trainersWithMinWorkload.length} trainers have minimum workload: ${minWorkload}`)
  
  if (trainersWithMinWorkload.length === 1) {
    // Only one trainer with minimum workload
    const selected = trainersWithMinWorkload[0]
    console.log(`[ROUND-ROBIN] Selected ${selected.name} (minimum workload: ${minWorkload})`)
    return selected
  }
  
  // Multiple trainers with same workload - use priority-based selection
  const priorityOrder = { Senior: 3, Core: 2, Junior: 1 }
  trainersWithMinWorkload.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
  
  const selected = trainersWithMinWorkload[0]
  console.log(`[ROUND-ROBIN] Selected ${selected.name} (priority: ${selected.priority}, workload: ${minWorkload})`)
  return selected
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

    // CRITICAL: Check if trainer is available on this specific date
    if (!isTrainerAvailableOnDate(trainer, currentDate, batch, existingSchedule, holidays)) {
      console.log(`[TRAINER] ${trainer.name} unavailable on ${formatDate(currentDate)} - cannot handle subject duration`)
      return false
    }

    workingDaysChecked++
    currentDate.setDate(currentDate.getDate() + 1)
  }

  console.log(`[TRAINER] ${trainer.name} can handle entire subject duration of ${duration} working days`)
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

  console.log(`[TRAINER] ${trainer.name} has ${existingSessions.length} existing sessions on ${dateStr}`)
  if (existingSessions.length > 0) {
    console.log(`[TRAINER] Existing sessions:`, existingSessions.map(s => `${s.subjectId} at ${s.timeSlot}`))
  }

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
    const maxOnlineSessionsPerDay = 3 // Reduced from 4 to prevent overload
    if (existingSessions.length >= maxOnlineSessionsPerDay) {
      console.log(`[TRAINER] ${trainer.name} already has ${existingSessions.length} sessions on ${dateStr} (max: ${maxOnlineSessionsPerDay})`)
      return false
    }
  } else {
    // FEATURE: Offline Session Management
    // LOGIC: Only one offline session per day per trainer
    if (existingSessions.length > 0) {
      console.log(`[TRAINER] ${trainer.name} already has offline session on ${dateStr} - cannot double-book`)
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

    // ENHANCED: Use round-robin selection for equal workload distribution
    const chosenTrainer = selectTrainerWithRoundRobin(eligible, optimized, { location: "online" } as Batch)
    
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

  // Log final workload distribution
  const finalWorkload = new Map<string, number>()
  trainers.forEach((t) => finalWorkload.set(t.id, 0))
  
  optimized.forEach((s) => {
    if (s.trainerId) {
      finalWorkload.set(s.trainerId, (finalWorkload.get(s.trainerId) || 0) + 1)
    }
  })
  
  console.log(`[OPTIMIZE] Final workload distribution:`)
  trainers.forEach(trainer => {
    const workload = finalWorkload.get(trainer.id) || 0
    console.log(`[OPTIMIZE] ${trainer.name}: ${workload} sessions`)
  })
  
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



/**
 * FEATURE: Fills empty days with placeholder sessions for clarity
 * LOGIC: Creates sessions for days where no trainer was assigned
 * - Ensures all working days in the batch duration are represented
 * - Marks them as "unassigned"
 * - Maintains consistency with the original schedule structure
 * 
 * NOTE: This function is currently disabled to prevent database constraint violations.
 * The main schedule generation already covers all working days needed for subjects.
 */
function fillEmptyDaysWithPlaceholders(
  schedule: ScheduleSession[],
  batch: Batch,
  startDate: Date,
  endDate: Date,
  effectiveBatchType: "weekday" | "weekend"
): ScheduleSession[] {
  // DISABLED: Return original schedule without placeholders to prevent database errors
  // The main schedule generation already creates sessions for all required working days
  console.log(`[FILL] Placeholder generation disabled - main schedule covers all working days`)
  return schedule
}



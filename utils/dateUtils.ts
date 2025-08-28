export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6 // Sunday or Saturday
}

export function isHoliday(date: Date, holidays: Array<{ date: string; name: string }>): boolean {
  const dateStr = date.toISOString().split("T")[0]
  return holidays.some((holiday) => holiday.date === dateStr)
}

export function addBusinessDays(startDate: Date, days: number, holidays: Array<{ date: string; name: string }>): Date {
  const currentDate = new Date(startDate)
  let addedDays = 0

  while (addedDays < days) {
    currentDate.setDate(currentDate.getDate() + 1)

    if (!isWeekend(currentDate) && !isHoliday(currentDate, holidays)) {
      addedDays++
    }
  }

  return currentDate
}

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]
}

export function parseDate(dateStr: string): Date {
  // CRITICAL FIX: Use local timezone to prevent date shifting
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day) // month - 1 because Date constructor uses 0-based months
}

export function getWeekDays(): string[] {
  return ["monday", "tuesday", "wednesday", "thursday", "friday"]
}

export function getDayOfWeek(date: Date): string {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
  return days[date.getDay()]
}

/**
 * FEATURE: Working Day Check for Batch Type
 * LOGIC: Determines if a specific day should have sessions based on batch type
 * - Weekday batches: Monday-Friday are working days
 * - Weekend batches: Saturday-Sunday are working days
 * - Useful for schedule generation and validation
 */
export function isWorkingDayForBatch(date: Date, batchType: "weekday" | "weekend"): boolean {
  if (batchType === "weekday") {
    return !isWeekend(date) // Monday-Friday
  } else if (batchType === "weekend") {
    return isWeekend(date) // Saturday-Sunday
  }
  // Default to weekday behavior
  return !isWeekend(date)
}

/**
 * FEATURE: Get Working Days for Batch Type
 * LOGIC: Returns array of working day names based on batch type
 * - Weekday batches: ["monday", "tuesday", "wednesday", "thursday", "friday"]
 * - Weekend batches: ["saturday", "sunday"]
 */
export function getWorkingDaysForBatch(batchType: "weekday" | "weekend"): string[] {
  if (batchType === "weekend") {
    return ["saturday", "sunday"]
  }
  // Default to weekday
  return ["monday", "tuesday", "wednesday", "thursday", "friday"]
}

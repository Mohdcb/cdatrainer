// CRITICAL FIX: Use only JavaScript's built-in date functionality

export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  console.log(`[DATE_UTIL] isWeekend check: ${date.toISOString().split('T')[0]} = day ${day} = ${day === 0 || day === 6}`)
  return day === 0 || day === 6 // Sunday (0) or Saturday (6)
}

export function isHoliday(date: Date, holidays: Array<{ date: string; name: string }>): boolean {
  const dateStr = formatDate(date)
  return holidays.some((holiday) => holiday.date === dateStr)
}

export function formatDate(date: Date): string {
  // CRITICAL: Use local date to prevent timezone shifts
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDate(dateStr: string): Date {
  // CRITICAL FIX: Parse manually to prevent timezone issues
  const [year, month, day] = dateStr.split('-').map(Number)
  const parsedDate = new Date(year, month - 1, day)
  console.log(`[DATE_UTIL] parseDate: "${dateStr}" -> ${parsedDate.toDateString()} (day ${parsedDate.getDay()})`)
  return parsedDate
}

export function getDayOfWeek(date: Date): string {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
  const dayIndex = date.getDay()
  const dayName = days[dayIndex]
  console.log(`[DATE_UTIL] getDayOfWeek: ${date.toDateString()} = day ${dayIndex} = ${dayName}`)
  return dayName
}

export function isWorkingDayForBatch(date: Date, batchType: "weekday" | "weekend"): boolean {
  const isWeekendDay = isWeekend(date)
  
  if (batchType === "weekday") {
    return !isWeekendDay // Monday-Friday are working days
  } else if (batchType === "weekend") {
    return isWeekendDay // Saturday-Sunday are working days
  }
  
  // Default to weekday behavior
  return !isWeekendDay
}

export function getWorkingDaysForBatch(batchType: "weekday" | "weekend"): string[] {
  if (batchType === "weekend") {
    return ["saturday", "sunday"]
  }
  return ["monday", "tuesday", "wednesday", "thursday", "friday"]
}

// Debug function to verify day calculation
export function debugDate(dateStr: string): void {
  console.log(`=== DEBUG DATE: ${dateStr} ===`)
  
  // Method 1: Direct Date constructor
  const date1 = new Date(dateStr)
  console.log(`Direct Date(${dateStr}):`, {
    date: date1.toISOString(),
    day: date1.getDay(),
    dayName: getDayOfWeek(date1),
    isWeekend: isWeekend(date1)
  })
  
  // Method 2: With T00:00:00
  const date2 = new Date(dateStr + "T00:00:00")
  console.log(`Date(${dateStr}T00:00:00):`, {
    date: date2.toISOString(),
    day: date2.getDay(),
    dayName: getDayOfWeek(date2),
    isWeekend: isWeekend(date2)
  })
  
  // Method 3: Manual parsing
  const [year, month, day] = dateStr.split('-').map(Number)
  const date3 = new Date(year, month - 1, day)
  console.log(`Manual parse new Date(${year}, ${month-1}, ${day}):`, {
    date: date3.toISOString(),
    day: date3.getDay(),
    dayName: getDayOfWeek(date3),
    isWeekend: isWeekend(date3)
  })
}

// Test function to verify weekend detection
export function testWeekendDetection(): void {
  const testDates = [
    "2025-08-30", // Saturday
    "2025-08-31", // Sunday  
    "2025-09-01", // Monday
    "2025-09-02", // Tuesday
    "2025-09-05", // Friday
    "2025-09-06", // Saturday
    "2025-09-07"  // Sunday
  ]
  
  console.log("=== WEEKEND DETECTION TEST ===")
  testDates.forEach(dateStr => {
    const date = new Date(dateStr + "T00:00:00")
    const dayNum = date.getDay()
    const dayName = getDayOfWeek(date)
    const isWeekendDay = isWeekend(date)
    
    console.log(`${dateStr} (${dayName}): day=${dayNum}, isWeekend=${isWeekendDay}`)
  })
}
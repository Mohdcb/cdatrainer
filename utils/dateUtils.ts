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
  return new Date(dateStr + "T00:00:00")
}

export function getWeekDays(): string[] {
  return ["monday", "tuesday", "wednesday", "thursday", "friday"]
}

export function getDayOfWeek(date: Date): string {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
  return days[date.getDay()]
}

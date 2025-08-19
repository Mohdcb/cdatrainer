"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import type { Trainer, Holiday } from "../../hooks/useData"

interface LeaveCalendarProps {
  trainers: Trainer[]
  holidays: Holiday[]
}

export function LeaveCalendar({ trainers, holidays }: LeaveCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const getCalendarDays = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())

    const days = []
    const current = new Date(startDate)

    for (let i = 0; i < 42; i++) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }

    return days
  }

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0]
    const events: Array<{ type: "holiday" | "leave"; name: string; trainer?: string }> = []

    // Check holidays
    const holiday = holidays.find((h) => h.date === dateStr)
    if (holiday) {
      events.push({ type: "holiday", name: holiday.name })
    }

    // Check trainer leaves
    trainers.forEach((trainer) => {
      trainer.leaves.forEach((leave) => {
        if (leave.status === "approved") {
          const leaveStart = new Date(leave.startDate)
          const leaveEnd = new Date(leave.endDate)
          if (date >= leaveStart && date <= leaveEnd) {
            events.push({
              type: "leave",
              name: leave.reason,
              trainer: trainer.name,
            })
          }
        }
      })
    })

    return events
  }

  const navigatePrevious = () => {
    const newDate = new Date(currentDate)
    newDate.setMonth(newDate.getMonth() - 1)
    setCurrentDate(newDate)
  }

  const navigateNext = () => {
    const newDate = new Date(currentDate)
    newDate.setMonth(newDate.getMonth() + 1)
    setCurrentDate(newDate)
  }

  const navigateToday = () => {
    setCurrentDate(new Date())
  }

  const calendarDays = getCalendarDays()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Leave Calendar - {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </span>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={navigateToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={navigatePrevious}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={navigateNext}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {/* Day Headers */}
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="p-2 text-center text-sm font-medium text-gray-500 border-b">
              {day}
            </div>
          ))}

          {/* Calendar Days */}
          {calendarDays.map((day, index) => {
            const events = getEventsForDate(day)
            const isCurrentMonth = day.getMonth() === currentDate.getMonth()
            const isToday = day.toDateString() === new Date().toDateString()
            const isWeekend = day.getDay() === 0 || day.getDay() === 6

            return (
              <div
                key={index}
                className={`min-h-24 p-2 border border-gray-100 ${
                  !isCurrentMonth ? "bg-gray-50 text-gray-400" : "bg-white"
                } ${isToday ? "bg-blue-50 border-blue-200" : ""} ${isWeekend ? "bg-gray-50" : ""}`}
              >
                <div className="text-sm font-medium mb-1">{day.getDate()}</div>
                <div className="space-y-1">
                  {events.slice(0, 2).map((event, eventIndex) => (
                    <div
                      key={eventIndex}
                      className={`text-xs p-1 rounded truncate ${
                        event.type === "holiday" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"
                      }`}
                      title={event.trainer ? `${event.trainer} - ${event.name}` : event.name}
                    >
                      {event.type === "holiday" ? event.name : `${event.trainer?.split(" ")[0]} - ${event.name}`}
                    </div>
                  ))}
                  {events.length > 2 && <div className="text-xs text-gray-500">+{events.length - 2} more</div>}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center space-x-6 mt-4 pt-4 border-t">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
            <span className="text-sm text-muted-foreground">Company Holiday</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-orange-100 border border-orange-200 rounded"></div>
            <span className="text-sm text-muted-foreground">Trainer Leave</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

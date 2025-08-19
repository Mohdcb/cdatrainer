"use client"

import type React from "react"

import { useState } from "react"
import { DraggableSession } from "./draggable-session"
import type { ScheduleSession } from "../../utils/schedulingUtils"

interface DroppableDayProps {
  day: Date
  sessions: (ScheduleSession & { batchId: string; batchName: string })[]
  subjects: any[]
  trainers: any[]
  batches: any[]
  isCurrentMonth: boolean
  isToday: boolean
  isWeekend: boolean
  viewMode: "month" | "week"
  draggedSession: (ScheduleSession & { batchId: string; batchName: string }) | null
  onDrop: (targetDate: string, session: ScheduleSession & { batchId: string; batchName: string }) => void
  onDragStart: (session: ScheduleSession & { batchId: string; batchName: string }) => void
  onDragEnd: () => void
}

export function DroppableDay({
  day,
  sessions,
  subjects,
  trainers,
  batches,
  isCurrentMonth,
  isToday,
  isWeekend,
  viewMode,
  draggedSession,
  onDrop,
  onDragStart,
  onDragEnd,
}: DroppableDayProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isValidDrop, setIsValidDrop] = useState(true)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"

    if (!isDragOver) {
      setIsDragOver(true)

      // Check if this is a valid drop zone
      if (draggedSession) {
        const targetDateStr = day.toISOString().split("T")[0]
        const isWeekendDrop = day.getDay() === 0 || day.getDay() === 6
        const isPastDate = day < new Date(new Date().toDateString())

        // Basic validation - can be enhanced with more complex rules
        const valid = !isWeekendDrop && !isPastDate && targetDateStr !== draggedSession.date
        setIsValidDrop(valid)
      }
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only hide drag over if we're actually leaving the element
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
      setIsValidDrop(true)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    setIsValidDrop(true)

    if (draggedSession && isValidDrop) {
      const targetDateStr = day.toISOString().split("T")[0]
      onDrop(targetDateStr, draggedSession)
    }
  }

  const maxDisplaySessions = viewMode === "month" ? 2 : 5

  return (
    <div
      className={`min-h-24 p-2 border border-gray-100 transition-all ${
        !isCurrentMonth ? "bg-gray-50 text-gray-400" : "bg-white"
      } ${isToday ? "bg-blue-50 border-blue-200" : ""} ${isWeekend ? "bg-gray-50" : ""} ${
        isDragOver ? (isValidDrop ? "bg-primary/10 border-primary/30 border-2" : "bg-red-50 border-red-300 border-2") : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="text-sm font-medium mb-1">{day.getDate()}</div>
      <div className="space-y-1">
        {sessions.slice(0, maxDisplaySessions).map((session, sessionIndex) => {
          const subject = subjects.find((s) => s.id === session.subjectId)
          const trainer = trainers.find((t) => t.id === session.trainerId)
          const batch = batches.find((b) => b.id === session.batchId)

          return (
            <DraggableSession
              key={sessionIndex}
              session={session}
              subject={subject}
              trainer={trainer}
              batch={batch}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          )
        })}
        {sessions.length > maxDisplaySessions && (
          <div className="text-xs text-gray-500">+{sessions.length - maxDisplaySessions} more</div>
        )}
        {isDragOver && isValidDrop && <div className="text-xs text-primary font-medium">Drop here to reschedule</div>}
        {isDragOver && !isValidDrop && <div className="text-xs text-red-600 font-medium">Invalid drop zone</div>}
      </div>
    </div>
  )
}

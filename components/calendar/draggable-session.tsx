"use client"

import type React from "react"

import { useState } from "react"
import type { ScheduleSession } from "../../utils/schedulingUtils"

interface DraggableSessionProps {
  session: ScheduleSession & { batchId: string; batchName: string }
  subject: { name: string } | undefined
  trainer: { name: string } | undefined
  batch: { name: string; location: string } | undefined
  onDragStart: (session: ScheduleSession & { batchId: string; batchName: string }) => void
  onDragEnd: () => void
}

export function DraggableSession({ session, subject, trainer, batch, onDragStart, onDragEnd }: DraggableSessionProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true)
    onDragStart(session)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", session.id)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    onDragEnd()
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`text-xs p-1 rounded truncate cursor-move transition-all ${isDragging ? "opacity-50 scale-95" : ""} ${
        session.status === "assigned"
          ? "bg-primary/10 text-primary hover:bg-primary/20"
          : "bg-orange-100 text-orange-800 hover:bg-orange-200"
      }`}
      title={`${subject?.name} - ${batch?.name} - ${trainer?.name || "Unassigned"} (Drag to reschedule)`}
    >
      <div className="font-medium truncate">{subject?.name}</div>
      
      {/* Show batch name for ALL sessions */}
      <div className={`text-xs opacity-75 truncate ${
        batch?.location === "online" ? "text-blue-600" : "text-gray-600"
      }`}>
        📍 {batch?.name}
        {batch?.location !== "online" && <span className="text-xs opacity-50"> (Offline)</span>}
      </div>
      
      {/* Show time slot ONLY for online sessions */}
      {batch?.location === "online" && session.timeSlot && (
        <div className="text-xs opacity-75 text-gray-600 truncate">
          ⏰ {session.timeSlot}
        </div>
      )}
      
      {/* Show trainer name */}
      {trainer && (
        <div className="text-xs opacity-75 truncate">
          👤 {trainer.name.split(" ")[0]}
        </div>
      )}
    </div>
  )
}

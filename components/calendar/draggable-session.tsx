"use client"

import type React from "react"

import { useState } from "react"
import type { ScheduleSession } from "../../utils/schedulingUtils"

interface DraggableSessionProps {
  session: ScheduleSession & { batchId: string; batchName: string }
  subject: { name: string } | undefined
  trainer: { name: string } | undefined
  batch: { name: string } | undefined
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
      {subject?.name}
      {trainer && <div className="text-xs opacity-75">{trainer.name.split(" ")[0]}</div>}
    </div>
  )
}

"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Badge } from "../ui/badge"
import { StatusBadge } from "../ui/status-badge"
import { AlertTriangle, Calendar, Clock, User } from "lucide-react"
import { generateSchedule, detectConflicts } from "../../utils/schedulingUtils"
import type { Batch, Course, Subject, Trainer, Holiday } from "../../hooks/useData"
import type { ScheduleSession } from "../../utils/schedulingUtils"

interface ScheduleGeneratorProps {
  batch: Batch
  course: Course
  subjects: Subject[]
  trainers: Trainer[]
  holidays: Holiday[]
  onScheduleGenerated: (batchId: string, schedule: ScheduleSession[]) => void
}

export function ScheduleGenerator({
  batch,
  course,
  subjects,
  trainers,
  holidays,
  onScheduleGenerated,
}: ScheduleGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedSchedule, setGeneratedSchedule] = useState<ScheduleSession[]>([])
  const [selectedTrainerFilter, setSelectedTrainerFilter] = useState<string>("all")

  const handleGenerateSchedule = async () => {
    setIsGenerating(true)

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const schedule = generateSchedule(batch, course, subjects, trainers, holidays)
    const scheduleWithConflicts = detectConflicts(schedule, trainers)

    setGeneratedSchedule(scheduleWithConflicts)
    onScheduleGenerated(batch.id, scheduleWithConflicts)
    setIsGenerating(false)
  }

  const handleRegenerateSchedule = () => {
    handleGenerateSchedule()
  }

  const getScheduleStats = () => {
    const assigned = generatedSchedule.filter((s) => s.status === "assigned").length
    const unassigned = generatedSchedule.filter((s) => s.status === "unassigned").length
    const conflicts = generatedSchedule.filter((s) => s.conflicts && s.conflicts.length > 0).length

    return { assigned, unassigned, conflicts, total: generatedSchedule.length }
  }

  const filteredSchedule =
    selectedTrainerFilter === "all"
      ? generatedSchedule
      : generatedSchedule.filter((s) => s.trainerId === selectedTrainerFilter)

  const stats = getScheduleStats()

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Schedule for {batch.name}
            </span>
            <div className="flex items-center space-x-2">
              {generatedSchedule.length > 0 && (
                <Button variant="outline" onClick={handleRegenerateSchedule} disabled={isGenerating}>
                  Regenerate
                </Button>
              )}
              <Button
                onClick={handleGenerateSchedule}
                disabled={isGenerating}
                className="bg-primary-gradient hover:opacity-90"
              >
                {isGenerating
                  ? "Generating..."
                  : generatedSchedule.length > 0
                    ? "Update Schedule"
                    : "Generate Schedule"}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
                              <div className="text-2xl font-bold text-primary">{stats.assigned}</div>
              <div className="text-sm text-muted-foreground">Assigned</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.unassigned}</div>
              <div className="text-sm text-muted-foreground">Unassigned</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.conflicts}</div>
              <div className="text-sm text-muted-foreground">Conflicts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total Sessions</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Details */}
      {generatedSchedule.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Schedule Details</span>
              <Select value={selectedTrainerFilter} onValueChange={setSelectedTrainerFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by trainer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Trainers</SelectItem>
                  {trainers.map((trainer) => (
                    <SelectItem key={trainer.id} value={trainer.id}>
                      {trainer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredSchedule.map((session, index) => {
                const subject = subjects.find((s) => s.id === session.subjectId)
                const trainer = trainers.find((t) => t.id === session.trainerId)
                const hasConflicts = session.conflicts && session.conflicts.length > 0

                return (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      hasConflicts ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div>
                            <h4 className="font-medium">{subject?.name}</h4>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                              <span className="flex items-center">
                                <Calendar className="w-4 h-4 mr-1" />
                                {session.date}
                              </span>
                              <span className="flex items-center">
                                <Clock className="w-4 h-4 mr-1" />
                                {session.timeSlot}
                              </span>
                              {trainer && (
                                <span className="flex items-center">
                                  <User className="w-4 h-4 mr-1" />
                                  {trainer.name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {hasConflicts && (
                          <div className="mt-2 flex items-center space-x-2">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            <div className="text-sm text-red-600">
                              {session.conflicts?.map((conflict, i) => (
                                <div key={i}>{conflict}</div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <StatusBadge status={session.status} />
                        {trainer && (
                          <Badge variant="outline" className="text-xs">
                            {trainer.priority}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scheduling Rules Info */}
      <Card>
        <CardHeader>
          <CardTitle>Scheduling Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Automatic Assignment</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Skips weekends and public holidays</li>
                <li>• Matches trainer expertise with subject requirements</li>
                <li>• Considers trainer location and batch location</li>
                <li>• Respects trainer availability hours</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Priority System</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Senior trainers get first priority</li>
                <li>• Core trainers get second priority</li>
                <li>• Junior trainers get third priority</li>
                <li>• Checks for approved leave conflicts</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

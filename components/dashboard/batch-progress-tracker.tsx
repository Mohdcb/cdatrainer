"use client"

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { StatusBadge } from "../ui/status-badge"
import { Progress } from "../ui/progress"
import type { Batch, Course, Subject } from "../../hooks/useData"

interface BatchProgressTrackerProps {
  batches: Batch[]
  courses: Course[]
  subjects: Subject[]
}

export function BatchProgressTracker({ batches, courses, subjects }: BatchProgressTrackerProps) {
  const getBatchProgress = (batch: Batch) => {
    const course = courses.find((c) => c.id === batch.courseId)
    if (!course) return { completed: 0, total: 0, percentage: 0 }

    const totalSessions = course.subjects.reduce((acc, subjectId) => {
      const subject = subjects.find((s) => s.id === subjectId)
      return acc + (subject?.duration || 0)
    }, 0)

    // Mock completed sessions - in real app this would come from actual schedule data
    const completedSessions = Math.floor(totalSessions * (Math.random() * 0.8))

    return {
      completed: completedSessions,
      total: totalSessions,
      percentage: totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0,
    }
  }

  const activeBatches = batches.filter((batch) => batch.status === "active" || batch.status === "scheduled")

  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activeBatches.map((batch) => {
            const course = courses.find((c) => c.id === batch.courseId)
            const progress = getBatchProgress(batch)

            return (
              <div key={batch.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium">{batch.name}</h4>
                    <p className="text-xs text-muted-foreground">{course?.name}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <StatusBadge status={batch.status} />
                    <span className="text-sm font-medium">{progress.percentage}%</span>
                  </div>
                </div>
                <Progress value={progress.percentage} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {progress.completed} of {progress.total} sessions completed
                  </span>
                  <span>{batch.currentStudents} students</span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

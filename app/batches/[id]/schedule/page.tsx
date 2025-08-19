"use client"

import { useParams } from "next/navigation"
import { useData } from "../../../../hooks/useData"
import { MainLayout } from "../../../../components/layout/main-layout"
import { ScheduleGenerator } from "../../../../components/scheduling/schedule-generator"
import { Button } from "../../../../components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import type { ScheduleSession } from "../../../../utils/schedulingUtils"

export default function BatchSchedulePage() {
  const params = useParams()
  const batchId = params.id as string
  const { batches, courses, subjects, trainers, holidays, schedules, loading } = useData()

  const batch = batches.find((b) => b.id === batchId)
  const course = batch ? courses.find((c) => c.id === batch.courseId) : null

  const handleScheduleGenerated = (_batchId: string, _schedule: ScheduleSession[]) => {
    // With centralized schedules.json, generation is not persisted here.
    // Future enhancement: push generated entries into schedules state/store.
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg">Loading...</div>
        </div>
      </MainLayout>
    )
  }

  if (!batch || !course) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg">Batch not found</div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <Link href="/batches">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Batches
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Schedule Generator</h1>
            <p className="text-gray-600">Generate and manage schedule for {batch.name}</p>
          </div>
        </div>
      </div>

      {/* Schedule Generator */}
      <ScheduleGenerator
        batch={batch}
        course={course}
        subjects={subjects}
        trainers={trainers}
        holidays={holidays}
        onScheduleGenerated={handleScheduleGenerated}
      />
    </MainLayout>
  )
}

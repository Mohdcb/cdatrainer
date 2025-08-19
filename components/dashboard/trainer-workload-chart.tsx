"use client"

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { ProgressRing } from "../ui/progress-ring"
import type { Trainer } from "../../hooks/useData"

interface TrainerWorkloadChartProps {
  trainers: Trainer[]
}

export function TrainerWorkloadChart({ trainers }: TrainerWorkloadChartProps) {
  // Mock workload data - in real app this would come from scheduling data
  const workloadData = trainers.map((trainer) => ({
    id: trainer.id,
    name: trainer.name,
    workload: Math.floor(Math.random() * 100), // Mock percentage
    sessionsThisWeek: Math.floor(Math.random() * 15) + 1,
    priority: trainer.priority,
  }))

  const sortedTrainers = workloadData.sort((a, b) => b.workload - a.workload)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trainer Workload</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Top 3 trainers with progress rings */}
          <div className="grid grid-cols-3 gap-4">
            {sortedTrainers.slice(0, 3).map((trainer) => (
              <div key={trainer.id} className="text-center">
                <ProgressRing progress={trainer.workload} size={80} strokeWidth={6}>
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{trainer.workload}%</div>
                  </div>
                </ProgressRing>
                <div className="mt-2">
                  <p className="text-sm font-medium text-gray-900">{trainer.name.split(" ")[0]}</p>
                  <p className="text-xs text-muted-foreground">{trainer.sessionsThisWeek} sessions</p>
                </div>
              </div>
            ))}
          </div>

          {/* All trainers list */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-900">All Trainers</h4>
            {sortedTrainers.map((trainer) => (
              <div key={trainer.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium">{trainer.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{trainer.name}</p>
                    <p className="text-xs text-muted-foreground">{trainer.priority}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${trainer.workload}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-10 text-right">{trainer.workload}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

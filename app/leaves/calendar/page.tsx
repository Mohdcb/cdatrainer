"use client"

import { useData } from "../../../hooks/useData"
import { MainLayout } from "../../../components/layout/main-layout"
import { LeaveCalendar } from "../../../components/leave/leave-calendar"
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card"
import { Button } from "../../../components/ui/button"
import { ArrowLeft, Calendar, Users, Clock } from "lucide-react"
import Link from "next/link"

export default function LeaveCalendarPage() {
  const { trainers, holidays, loading } = useData()

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg">Loading...</div>
        </div>
      </MainLayout>
    )
  }

  const totalLeaves = trainers.reduce((acc, trainer) => acc + trainer.leaves.length, 0)
  const approvedLeaves = trainers.reduce(
    (acc, trainer) => acc + trainer.leaves.filter((leave) => leave.status === "approved").length,
    0,
  )

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <Link href="/leaves">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Leaves
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leave Calendar</h1>
            <p className="text-gray-600">Visual overview of all leaves and holidays</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Company Holidays</p>
                <p className="text-2xl font-bold text-blue-600">{holidays.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved Leaves</p>
                <p className="text-2xl font-bold text-primary">{approvedLeaves}</p>
              </div>
                              <Clock className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Trainers</p>
                <p className="text-2xl font-bold">{trainers.length}</p>
              </div>
              <Users className="w-8 h-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      <LeaveCalendar trainers={trainers} holidays={holidays} />

      {/* Upcoming Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Holidays</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {holidays
                .filter((holiday) => new Date(holiday.date) >= new Date())
                .slice(0, 5)
                .map((holiday) => (
                  <div key={holiday.date} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{holiday.name}</div>
                      <div className="text-sm text-muted-foreground">{holiday.date}</div>
                    </div>
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Leaves</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {trainers
                .flatMap((trainer) =>
                  trainer.leaves
                    .filter((leave) => leave.status === "approved" && new Date(leave.startDate) >= new Date())
                    .map((leave) => ({ ...leave, trainerName: trainer.name })),
                )
                .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                .slice(0, 5)
                .map((leave, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{leave.trainerName}</div>
                      <div className="text-sm text-muted-foreground">
                        {leave.startDate} to {leave.endDate} - {leave.reason}
                      </div>
                    </div>
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}

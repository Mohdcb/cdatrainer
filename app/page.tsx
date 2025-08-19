"use client"

import { useData } from "../hooks/useData"
import { useAlerts } from "../hooks/useAlerts"
import { MainLayout } from "../components/layout/main-layout"
import { MetricCard } from "../components/ui/metric-card"
import { AlertItem } from "../components/ui/alert-item"
import { TrainerWorkloadChart } from "../components/dashboard/trainer-workload-chart"
import { BatchProgressTracker } from "../components/dashboard/batch-progress-tracker"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Calendar, Users, BookOpen, AlertTriangle, BarChart3, Plus, TrendingUp, Clock } from "lucide-react"

export default function Dashboard() {
  const { trainers, courses, subjects, batches, loading } = useData()
  const { alerts, resolveAlert, dismissAlert, getAlertsBySeverity } = useAlerts()

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg">Loading...</div>
        </div>
      </MainLayout>
    )
  }

  const activeTrainers = trainers.length
  const activeBatches = batches.filter((b) => b.status === "active").length
  const totalCourses = courses.length
  const highPriorityAlerts = getAlertsBySeverity("high").length
  const totalStudents = batches.reduce((acc, batch) => acc + batch.currentStudents, 0)

  // Calculate utilization rate (mock data)
  const utilizationRate = Math.round((activeBatches / totalCourses) * 100)

  return (
    <MainLayout>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's what's happening with your training programs.</p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <MetricCard
          title="Active Trainers"
          value={activeTrainers}
          description="Available for scheduling"
          icon={Users}
          trend={{ value: 12, isPositive: true }}
        />
        <MetricCard
          title="Active Batches"
          value={activeBatches}
          description="Currently running"
          icon={BookOpen}
          trend={{ value: 8, isPositive: true }}
        />
        <MetricCard
          title="Total Students"
          value={totalStudents}
          description="Enrolled across all batches"
          icon={BarChart3}
          trend={{ value: 15, isPositive: true }}
        />
        <MetricCard
          title="Utilization Rate"
          value={`${utilizationRate}%`}
          description="Course capacity usage"
          icon={TrendingUp}
          trend={{ value: 5, isPositive: true }}
        />
        <MetricCard
          title="Critical Alerts"
          value={highPriorityAlerts}
          description="Require immediate attention"
          icon={AlertTriangle}
          className="border-red-200 bg-red-50"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Quick Actions & Alerts */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start bg-primary-gradient hover:opacity-90">
                <Plus className="w-4 h-4 mr-2" />
                Create New Batch
              </Button>
              <Button className="w-full justify-start bg-transparent" variant="outline">
                <Calendar className="w-4 h-4 mr-2" />
                View Master Calendar
              </Button>
              <Button className="w-full justify-start bg-transparent" variant="outline">
                <Users className="w-4 h-4 mr-2" />
                Manage Trainers
              </Button>
              <Button className="w-full justify-start bg-transparent" variant="outline">
                <Clock className="w-4 h-4 mr-2" />
                Generate Schedules
              </Button>
            </CardContent>
          </Card>

          {/* Critical Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2 text-red-500" />
                  Critical Alerts
                </span>
                <Button variant="ghost" size="sm" className="text-xs">
                  View All
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getAlertsBySeverity("high")
                  .slice(0, 3)
                  .map((alert) => (
                    <AlertItem key={alert.id} alert={alert} onResolve={resolveAlert} onDismiss={dismissAlert} />
                  ))}
                {getAlertsBySeverity("high").length === 0 && (
                  <div className="text-center py-4 text-muted-foreground">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-primary" />
                    <p className="text-sm">No critical alerts</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Middle Column - Charts */}
        <div className="lg:col-span-4 space-y-6">
          <TrainerWorkloadChart trainers={trainers} />
        </div>

        {/* Right Column - Progress & Activity */}
        <div className="lg:col-span-4 space-y-6">
          <BatchProgressTracker batches={batches} courses={courses} subjects={subjects} />

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Schedule generated</p>
                    <p className="text-xs text-muted-foreground">UIUX-2024-Q1 batch - 15 sessions scheduled</p>
                    <p className="text-xs text-muted-foreground">2 hours ago</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">New trainer onboarded</p>
                    <p className="text-xs text-muted-foreground">Lisa Thompson - Digital Marketing specialist</p>
                    <p className="text-xs text-muted-foreground">1 day ago</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Batch completed successfully</p>
                    <p className="text-xs text-muted-foreground">DS-ML-2023-Q4 - 18 students graduated</p>
                    <p className="text-xs text-muted-foreground">3 days ago</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Leave approved</p>
                    <p className="text-xs text-muted-foreground">Sarah Johnson - Vacation leave Feb 10-14</p>
                    <p className="text-xs text-muted-foreground">5 days ago</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  )
}

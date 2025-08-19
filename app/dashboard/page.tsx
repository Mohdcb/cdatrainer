"use client"

import { MainLayout } from "../../components/layout/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { useData } from "../../hooks/useData"
import { useAlerts } from "../../hooks/useAlerts"
import { MetricCard } from "../../components/ui/metric-card"
import { AlertItem } from "../../components/ui/alert-item"
import { TrainerWorkloadChart } from "../../components/dashboard/trainer-workload-chart"
import { BatchProgressTracker } from "../../components/dashboard/batch-progress-tracker"
import { Users, BookOpen, Calendar, AlertTriangle, TrendingUp, Clock, MapPin, FileText } from "lucide-react"

export default function DashboardPage() {
  const { trainers, courses, batches, subjects, loading } = useData()
  const { alerts, dismissAlert, resolveAlert } = useAlerts()

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg">Loading...</div>
        </div>
      </MainLayout>
    )
  }

  // Calculate metrics
  const activeTrainers = trainers.filter((t) => t.status === "active").length
  const activeBatches = batches.filter((b) => b.status === "active").length
  const totalStudents = batches.reduce((acc, batch) => acc + batch.currentStudents, 0)
  const utilizationRate = Math.round((activeBatches / trainers.length) * 100)

  const criticalAlerts = alerts.filter((a) => a.priority === "high")
  const pendingSchedules = batches.filter((b) => b.status === "draft").length

  return (
    <MainLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Training management overview and system alerts</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <FileText className="w-4 h-4 mr-2" />
            Export Reports
          </Button>
          <Button className="bg-primary-gradient hover:opacity-90">
            <Calendar className="w-4 h-4 mr-2" />
            View Calendar
          </Button>
        </div>
      </div>

      {/* Critical Alerts */}
      {criticalAlerts.length > 0 && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Critical Alerts ({criticalAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {criticalAlerts.slice(0, 3).map((alert) => (
              <AlertItem key={alert.id} alert={alert} onDismiss={dismissAlert} onResolve={resolveAlert} />
            ))}
            {criticalAlerts.length > 3 && (
              <p className="text-sm text-red-600">+{criticalAlerts.length - 3} more critical alerts</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Active Trainers"
          value={activeTrainers}
          total={trainers.length}
          icon={Users}
          trend="+2 this month"
          color="green"
        />
        <MetricCard
          title="Active Batches"
          value={activeBatches}
          total={batches.length}
          icon={BookOpen}
          trend="+3 this week"
          color="blue"
        />
        <MetricCard
          title="Total Students"
          value={totalStudents}
          icon={TrendingUp}
          trend="+15 this month"
          color="purple"
        />
        <MetricCard
          title="Utilization Rate"
          value={`${utilizationRate}%`}
          icon={Clock}
          trend="Optimal range"
          color="orange"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Trainer Workload */}
        <TrainerWorkloadChart trainers={trainers} batches={batches} />

        {/* Batch Progress */}
        <BatchProgressTracker batches={batches} />
      </div>

      {/* Quick Actions & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start bg-transparent">
              <Users className="w-4 h-4 mr-2" />
              Add New Trainer
            </Button>
            <Button variant="outline" className="w-full justify-start bg-transparent">
              <BookOpen className="w-4 h-4 mr-2" />
              Create New Batch
            </Button>
            <Button variant="outline" className="w-full justify-start bg-transparent">
              <Calendar className="w-4 h-4 mr-2" />
              Generate Schedule
            </Button>
            <Button variant="outline" className="w-full justify-start bg-transparent">
              <MapPin className="w-4 h-4 mr-2" />
              Manage Locations
            </Button>
            {pendingSchedules > 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-800">
                  <strong>{pendingSchedules}</strong> batch schedules pending approval
                </p>
                <Button size="sm" className="mt-2 bg-yellow-600 hover:bg-yellow-700">
                  Review Schedules
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.slice(0, 5).map((alert) => (
              <AlertItem key={alert.id} alert={alert} onDismiss={dismissAlert} onResolve={resolveAlert} compact />
            ))}
            {alerts.length === 0 && <p className="text-sm text-muted-foreground">No active alerts</p>}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}

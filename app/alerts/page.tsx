import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, CheckCircle, Clock } from "lucide-react"

export default function AlertsPage() {
  const alerts = [
    {
      id: 1,
      type: "critical",
      title: "Trainer Unavailable",
      message: "John Doe is on leave but assigned to React Fundamentals batch starting tomorrow",
      action: "Reassign Trainer",
      timestamp: "2 hours ago",
    },
    {
      id: 2,
      type: "warning",
      title: "Schedule Conflict",
      message: "Sarah Wilson has overlapping sessions on March 15th",
      action: "Resolve Conflict",
      timestamp: "4 hours ago",
    },
    {
      id: 3,
      type: "info",
      title: "Batch Completion",
      message: "Full Stack Development batch completed successfully",
      action: "View Report",
      timestamp: "1 day ago",
    },
  ]

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "critical":
        return <AlertTriangle className="h-5 w-5 text-red-500" />
      case "warning":
        return <Clock className="h-5 w-5 text-yellow-500" />
      case "info":
        return <CheckCircle className="h-5 w-5 text-blue-500" />
      default:
        return <AlertTriangle className="h-5 w-5" />
    }
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Alerts & Notifications</h1>
          <p className="text-muted-foreground">Manage system alerts and notifications</p>
        </div>

        <div className="grid gap-4">
          {alerts.map((alert) => (
            <Card key={alert.id} className="border-l-4 border-l-primary">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getAlertIcon(alert.type)}
                    <CardTitle className="text-lg">{alert.title}</CardTitle>
                  </div>
                  <span className="text-sm text-muted-foreground">{alert.timestamp}</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">{alert.message}</p>
                <Button variant="outline" size="sm">
                  {alert.action}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  )
}

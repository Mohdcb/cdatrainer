"use client"

import { Card, CardContent } from "./card"
import { Button } from "./button"
import { Badge } from "./badge"
import { AlertTriangle, Clock, User, Calendar, CheckCircle, X } from "lucide-react"
import { cn } from "../../lib/utils"

export interface Alert {
  id: string
  type: "conflict" | "unassigned" | "leave_request" | "schedule_issue"
  title: string
  description: string
  severity: "high" | "medium" | "low"
  timestamp: string
  actionable: boolean
  batchId?: string
  trainerId?: string
}

interface AlertItemProps {
  alert: Alert
  onResolve?: (alertId: string) => void
  onDismiss?: (alertId: string) => void
}

export function AlertItem({ alert, onResolve, onDismiss }: AlertItemProps) {
  const severityColors = {
    high: "border-red-200 bg-red-50",
    medium: "border-orange-200 bg-orange-50",
    low: "border-yellow-200 bg-yellow-50",
  }

  const severityTextColors = {
    high: "text-red-800",
    medium: "text-orange-800",
    low: "text-yellow-800",
  }

  const getIcon = () => {
    switch (alert.type) {
      case "conflict":
        return <AlertTriangle className="h-4 w-4" />
      case "unassigned":
        return <User className="h-4 w-4" />
      case "leave_request":
        return <Clock className="h-4 w-4" />
      case "schedule_issue":
        return <Calendar className="h-4 w-4" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  return (
    <Card className={cn("border", severityColors[alert.severity])}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className={cn("mt-0.5", severityTextColors[alert.severity])}>{getIcon()}</div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h4 className={cn("text-sm font-medium", severityTextColors[alert.severity])}>{alert.title}</h4>
                <Badge variant="outline" className={cn("text-xs", severityTextColors[alert.severity])}>
                  {alert.severity}
                </Badge>
              </div>
              <p className={cn("text-xs", severityTextColors[alert.severity].replace("800", "600"))}>
                {alert.description}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{alert.timestamp}</p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            {alert.actionable && onResolve && (
              <Button size="sm" variant="ghost" onClick={() => onResolve(alert.id)} className="h-6 w-6 p-0">
                <CheckCircle className="h-3 w-3" />
              </Button>
            )}
            {onDismiss && (
              <Button size="sm" variant="ghost" onClick={() => onDismiss(alert.id)} className="h-6 w-6 p-0">
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        {alert.actionable && (
          <div className="mt-3 flex space-x-2">
            <Button size="sm" className="h-7 text-xs">
              Resolve
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs bg-transparent">
              View Details
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

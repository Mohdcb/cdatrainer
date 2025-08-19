"use client"

import { useState, useEffect } from "react"
import type { Alert } from "../components/ui/alert-item"

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])

  useEffect(() => {
    // Mock alerts data - in real app this would come from API
    const mockAlerts: Alert[] = [
      {
        id: "1",
        type: "unassigned",
        title: "No trainer available",
        description: "SEO session in FSWD-2024-Q1 needs assignment - no trainer with required expertise available",
        severity: "high",
        timestamp: "2 minutes ago",
        actionable: true,
        batchId: "b1",
      },
      {
        id: "2",
        type: "conflict",
        title: "Schedule conflict detected",
        description: "Sarah Johnson has overlapping sessions on January 15th",
        severity: "high",
        timestamp: "15 minutes ago",
        actionable: true,
        trainerId: "t1",
      },
      {
        id: "3",
        type: "leave_request",
        title: "Leave request pending approval",
        description: "Michael Chen requested leave for February 5-9, 2024",
        severity: "medium",
        timestamp: "1 hour ago",
        actionable: true,
        trainerId: "t2",
      },
      {
        id: "4",
        type: "schedule_issue",
        title: "Batch start date approaching",
        description: "UIUX-2024-Q1 starts in 3 days but schedule not finalized",
        severity: "medium",
        timestamp: "2 hours ago",
        actionable: true,
        batchId: "b3",
      },
      {
        id: "5",
        type: "unassigned",
        title: "Multiple sessions unassigned",
        description: "5 sessions in DS-ML-2024-Q1 still need trainer assignment",
        severity: "low",
        timestamp: "4 hours ago",
        actionable: true,
        batchId: "b2",
      },
    ]

    setAlerts(mockAlerts)
  }, [])

  const resolveAlert = (alertId: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== alertId))
  }

  const dismissAlert = (alertId: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== alertId))
  }

  const getAlertsByType = (type: Alert["type"]) => {
    return alerts.filter((alert) => alert.type === type)
  }

  const getAlertsBySeverity = (severity: Alert["severity"]) => {
    return alerts.filter((alert) => alert.severity === severity)
  }

  return {
    alerts,
    resolveAlert,
    dismissAlert,
    getAlertsByType,
    getAlertsBySeverity,
  }
}

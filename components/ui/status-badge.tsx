import { cn } from "../../lib/utils"
import { Badge } from "./badge"

interface StatusBadgeProps {
  status: "active" | "scheduled" | "completed" | "pending" | "approved" | "rejected" | "assigned" | "unassigned"
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variants = {
    active: "bg-primary/10 text-primary border-primary/20",
    scheduled: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-gray-100 text-gray-800 border-gray-200",
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    approved: "bg-primary/10 text-primary border-primary/20",
    rejected: "bg-red-100 text-red-800 border-red-200",
    assigned: "bg-primary/10 text-primary border-primary/20",
    unassigned: "bg-orange-100 text-orange-800 border-orange-200",
  }

  return (
    <Badge variant="outline" className={cn(variants[status], "capitalize", className)}>
      {status}
    </Badge>
  )
}

import { cn } from "../../lib/utils"
import { Badge } from "./badge"

interface PriorityBadgeProps {
  priority: "Senior" | "Core" | "Junior"
  className?: string
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const variants = {
    Senior: "bg-purple-100 text-purple-800 border-purple-200",
    Core: "bg-blue-100 text-blue-800 border-blue-200",
    Junior: "bg-gray-100 text-gray-800 border-gray-200",
  }

  return (
    <Badge variant="outline" className={cn(variants[priority], className)}>
      {priority}
    </Badge>
  )
}

import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Clock } from "lucide-react"

import { ModeToggle } from "./mode-toggle"
import UserMenu from "./user-menu"
import { Badge } from "./ui/badge"
import { trpc } from "@/utils/trpc"

/**
 * T083: Add authentication guards to protected routes
 * Header component with navigation to all major routes
 * Links are visible to all, but routes themselves have auth guards
 *
 * T129: Display active shift indicator in header
 * UI: Badge in header showing "Shift: Lunch (3h 24m)" for staff awareness
 * Click: Navigate to shifts page
 */

export default function Header() {
  const links = [
    { to: "/", label: "Home" },
    { to: "/dashboard", label: "Dashboard" },
    { to: "/staff-order", label: "Staff Order" },
    { to: "/kitchen", label: "Kitchen" },
    { to: "/serving", label: "Serving" },
    { to: "/inventory", label: "Inventory" },
    { to: "/menu-management", label: "Menu" },
    { to: "/shifts", label: "Shifts" },
  ] as const

  // Query active shifts for indicator (T129)
  const { data: activeShifts } = useQuery({
    ...trpc.shifts.listActive.queryOptions(),
    refetchInterval: 30000, // Poll every 30 seconds
  })

  const activeShift = activeShifts?.[0] || null

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  return (
    <div>
      <div className="flex flex-row items-center justify-between px-2 py-1">
        <nav className="flex gap-4 text-lg">
          {links.map(({ to, label }) => {
            return (
              <Link key={to} to={to}>
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="flex items-center gap-2">
          {/* T129: Active Shift Indicator */}
          {activeShift && (
            <Link to="/shifts">
              <Badge variant="default" className="cursor-pointer hover:opacity-80">
                <Clock className="h-3 w-3 mr-1" />
                Shift: {activeShift.shiftType} ({formatDuration(activeShift.duration)})
              </Badge>
            </Link>
          )}
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
      <hr />
    </div>
  )
}

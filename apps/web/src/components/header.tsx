import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Clock, Menu, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import type { ActiveShift } from "@/types/shifts"
import { trpc } from "@/utils/trpc"

import { LanguageToggle } from "./language-toggle"
import { ModeToggle } from "./mode-toggle"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import UserMenu from "./user-menu"

/**
 * T083: Add authentication guards to protected routes
 * Header component with navigation to all major routes
 * Links are visible to all, but routes themselves have auth guards
 *
 * T129: Display active shift indicator in header
 * UI: Badge in header showing "Shift: Lunch (3h 24m)" for staff awareness
 * Click: Navigate to shifts page
 *
 * T133: Update main menu navigation
 * Add responsive mobile menu with proper organization
 * Links: Categories, Modifiers (in Menu Management), Reservations (future), Shifts (manager/staff only)
 */

export default function Header() {
  const { t } = useTranslation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const links = [
    { to: "/", label: t("navigation.home") },
    { to: "/dashboard", label: t("navigation.dashboard") },
    { to: "/staff-order", label: t("navigation.staffOrder") },
    { to: "/kitchen", label: t("navigation.kitchen") },
    { to: "/serving", label: t("navigation.serving") },
    { to: "/inventory", label: t("navigation.inventory") },
    { to: "/menu-management", label: t("navigation.menu") },
    { to: "/shifts", label: t("navigation.shifts") },
  ] as const

  // Query active shifts for indicator (T129)
  const { data: activeShifts } = useQuery({
    ...trpc.shifts.listActive.queryOptions(),
    refetchInterval: 30000, // Poll every 30 seconds
  })

  const activeShift: ActiveShift | null = (activeShifts?.[0] as unknown as ActiveShift) || null

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  return (
    <div>
      <div className="flex flex-row items-center justify-between px-2 py-1">
        {/* Desktop Navigation - Hidden on mobile */}
        <nav className="hidden md:flex gap-4 text-lg">
          {links.map(({ to, label }) => {
            return (
              <Link key={to} to={to} className="hover:underline">
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Mobile Menu Button - Visible only on mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        <div className="flex items-center gap-2">
          {/* T129: Active Shift Indicator */}
          {activeShift && (
            <Link to="/shifts">
              <Badge variant="default" className="cursor-pointer hover:opacity-80">
                <Clock className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">
                  {t("header.shift")}: {activeShift.shiftType} ({formatDuration(activeShift.duration)})
                </span>
                <span className="sm:hidden">{activeShift.shiftType}</span>
              </Badge>
            </Link>
          )}
          <LanguageToggle />
          <ModeToggle />
          <UserMenu />
        </div>
      </div>

      {/* Mobile Navigation Menu - Slides down when open */}
      {isMobileMenuOpen && (
        <nav className="md:hidden flex flex-col gap-2 px-4 py-3 bg-muted/50">
          {links.map(({ to, label }) => {
            return (
              <Link
                key={to}
                to={to}
                className="px-3 py-2 rounded hover:bg-muted text-lg"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {label}
              </Link>
            )
          })}
        </nav>
      )}

      <hr />
    </div>
  )
}

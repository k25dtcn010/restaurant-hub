import { Link } from "@tanstack/react-router"

import { ModeToggle } from "./mode-toggle"
import UserMenu from "./user-menu"

/**
 * T083: Add authentication guards to protected routes
 * Header component with navigation to all major routes
 * Links are visible to all, but routes themselves have auth guards
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
  ] as const

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
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
      <hr />
    </div>
  )
}

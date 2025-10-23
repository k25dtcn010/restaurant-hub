import { z } from "zod"

import { user } from "@/db"

import { managerOnlyProcedure, router } from "../index"

/**
 * Users Router
 * Handles user management and listing
 */

export const usersRouter = router({
  /**
   * users.list - List all users for staff assignment
   * Auth: Manager only
   * Returns: Array of users with id, name, and email
   */
  list: managerOnlyProcedure.query(async ({ ctx }) => {
    const users = await ctx.db.query.user.findMany({
      columns: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: (user, { asc }) => asc(user.name),
    })

    return users
  }),
})

/**
 * tRPC Client Configuration with React Query Integration
 * Reference: research.md Section 8 - Performance Optimization Strategies
 *
 * Features:
 * - HTTP batch link for combining multiple requests into one (reduces network overhead)
 * - Automatic error handling with toast notifications
 * - Credentials included for Better-Auth session cookies
 * - Type-safe API calls from AppRouter
 */

import { QueryCache, QueryClient } from "@tanstack/react-query"
import { createTRPCClient, httpBatchLink } from "@trpc/client"
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query"
import { toast } from "sonner"
import type { AppRouter } from "@learn-bettert/api/routers/index"

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      toast.error(error.message, {
        action: {
          label: "retry",
          onClick: () => {
            queryClient.invalidateQueries()
          },
        },
      })
    },
  }),
  defaultOptions: {
    queries: {
      // Stale time for caching (5 minutes)
      staleTime: 5 * 60 * 1000,
      // Retry failed requests once
      retry: 1,
    },
  },
})

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    // HTTP batch link combines multiple tRPC calls into single HTTP request
    httpBatchLink({
      url: `${import.meta.env.VITE_SERVER_URL}/trpc`,
      fetch(url, options) {
        return fetch(url, {
          ...options,
          // Include credentials for Better-Auth session cookies
          credentials: "include",
        })
      },
    }),
  ],
})

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
})

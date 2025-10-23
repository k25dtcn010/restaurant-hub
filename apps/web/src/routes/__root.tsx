import type { QueryClient } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import {
  createRootRouteWithContext,
  ErrorComponent,
  HeadContent,
  Outlet,
  useLocation,
  useRouterState,
} from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import { Component, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import Header from "@/components/header"
import Loader from "@/components/loader"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import type { trpc } from "@/utils/trpc"

import "../index.css"

/**
 * T133: Error Boundary Component
 * Reference: research.md Section 9 - Error Handling and Validation
 *
 * T135: Enhanced error boundary for all routes
 * Catches React errors and displays user-friendly messages
 * Provides actionable guidance without exposing stack traces
 */
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: unknown) {
    console.error("[Error Boundary]", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return <ErrorBoundaryContent error={this.state.error} />
    }

    return this.props.children
  }
}

function ErrorBoundaryContent({ error }: { error: Error | null }) {
  const { t } = useTranslation()
  const errorMessage = error?.message || "An unexpected error occurred"
  const isNetworkError =
    errorMessage.toLowerCase().includes("network") || errorMessage.toLowerCase().includes("fetch")
  const isAuthError =
    errorMessage.toLowerCase().includes("unauthorized") ||
    errorMessage.toLowerCase().includes("authentication")

  return (
    <div className="flex items-center justify-center min-h-screen p-6 bg-background">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-3xl font-bold">{t("errorBoundary.title")}</h1>
        <div className="space-y-2">
          <p className="text-muted-foreground">
            {isNetworkError && t("errorBoundary.networkError")}
            {isAuthError && t("errorBoundary.authError")}
            {!isNetworkError && !isAuthError && t("errorBoundary.genericError")}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium"
          >
            {t("errorBoundary.refreshPage")}
          </button>
          {isAuthError && (
            <button
              type="button"
              onClick={() => (window.location.href = "/login")}
              className="px-6 py-3 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 font-medium"
            >
              {t("errorBoundary.goToLogin")}
            </button>
          )}
          <button
            type="button"
            onClick={() => window.history.back()}
            className="px-6 py-3 border border-border rounded-md hover:bg-accent font-medium"
          >
            {t("errorBoundary.goBack")}
          </button>
        </div>
        {process.env.NODE_ENV === "development" && error && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              {t("errorBoundary.errorDetails")}
            </summary>
            <pre className="mt-2 p-4 bg-muted rounded text-xs overflow-auto max-h-40">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}

export interface RouterAppContext {
  trpc: typeof trpc
  queryClient: QueryClient
}

function RouteErrorComponent({ error }: { error: Error }) {
  const { t } = useTranslation()
  const errorMessage = error.message || "An error occurred while loading this page"
  const isNotFound =
    errorMessage.toLowerCase().includes("not found") || errorMessage.toLowerCase().includes("404")
  const isUnauthorized =
    errorMessage.toLowerCase().includes("unauthorized") || errorMessage.toLowerCase().includes("403")

  return (
    <div className="flex items-center justify-center min-h-screen p-6 bg-background">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-6xl mb-4">{isNotFound ? "🔍" : isUnauthorized ? "🔒" : "⚠️"}</div>
        <h1 className="text-3xl font-bold">
          {isNotFound
            ? t("pageError.notFound")
            : isUnauthorized
              ? t("pageError.accessDenied")
              : t("pageError.pageError")}
        </h1>
        <p className="text-muted-foreground">
          {isNotFound && t("pageError.notFoundMessage")}
          {isUnauthorized && t("pageError.accessDeniedMessage")}
          {!isNotFound && !isUnauthorized && errorMessage}
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => (window.location.href = "/")}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium"
          >
            {t("pageError.goToHome")}
          </button>
          {isUnauthorized && (
            <button
              type="button"
              onClick={() => (window.location.href = "/login")}
              className="px-6 py-3 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 font-medium"
            >
              {t("pageError.signIn")}
            </button>
          )}
          <button
            type="button"
            onClick={() => window.history.back()}
            className="px-6 py-3 border border-border rounded-md hover:bg-accent font-medium"
          >
            {t("errorBoundary.goBack")}
          </button>
        </div>
        {process.env.NODE_ENV === "development" && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              {t("errorBoundary.errorDetails")}
            </summary>
            <pre className="mt-2 p-4 bg-muted rounded text-xs overflow-auto max-h-40">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  errorComponent: RouteErrorComponent,
  head: () => ({
    meta: [
      {
        title: "restaurant-hub",
      },
      {
        name: "description",
        content: "restaurant-hub is a web application",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
      },
    ],
  }),
})

function RootComponent() {
  const isFetching = useRouterState({
    select: (s) => s.isLoading,
  })
  const location = useLocation()
  
  // Hide header on home page (root path)
  const showHeader = location.pathname !== "/"

  return (
    <ErrorBoundary>
      <HeadContent />
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        disableTransitionOnChange
        storageKey="vite-ui-theme"
      >
        <div className="grid grid-rows-[auto_1fr] h-svh">
          {showHeader && <Header />}
          {isFetching ? <Loader /> : <Outlet />}
        </div>
        <Toaster richColors />
      </ThemeProvider>
      <TanStackRouterDevtools position="bottom-left" />
      <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
    </ErrorBoundary>
  )
}

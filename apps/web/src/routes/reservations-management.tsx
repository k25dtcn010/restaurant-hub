import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { Calendar, ChevronDown, Clock, Filter, Plus, RefreshCw, Users } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { trpc, trpcClient } from "@/utils/trpc"

export const Route = createFileRoute("/reservations-management")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession()
    if (!session.data) {
      redirect({
        to: "/login",
        throw: true,
      })
    }
    return { session }
  },
})

type StatusFilter =
  | "all"
  | "Pending"
  | "Confirmed"
  | "Seated"
  | "Cancelled"
  | "No-Show"
  | "Declined"

function RouteComponent() {
  const [showForm, setShowForm] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [searchCustomer, setSearchCustomer] = useState("")
  const [dateFilter, setDateFilter] = useState<string>("")

  // Get all reservations
  const {
    data: reservations,
    isLoading,
    refetch,
  } = useQuery(trpc.reservations.list.queryOptions({}))

  // Filter reservations based on status, customer search, and date
  const filteredReservations =
    reservations?.filter((res: any) => {
      const statusMatch = statusFilter === "all" || res.status === statusFilter
      const customerMatch =
        searchCustomer === "" ||
        res.customerName.toLowerCase().includes(searchCustomer.toLowerCase()) ||
        res.customerPhone?.includes(searchCustomer)
      const dateMatch = dateFilter === "" || res.date === dateFilter
      return statusMatch && customerMatch && dateMatch
    }) || []

  // Count reservations by status
  const statusCounts = {
    all: reservations?.length || 0,
    Pending: reservations?.filter((r: any) => r.status === "Pending").length || 0,
    Confirmed: reservations?.filter((r: any) => r.status === "Confirmed").length || 0,
    Seated: reservations?.filter((r: any) => r.status === "Seated").length || 0,
    Cancelled: reservations?.filter((r: any) => r.status === "Cancelled").length || 0,
    "No-Show": reservations?.filter((r: any) => r.status === "No-Show").length || 0,
    Declined: reservations?.filter((r: any) => r.status === "Declined").length || 0,
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      case "Confirmed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "Seated":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "Cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      case "No-Show":
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
      case "Declined":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
    }
  }

  return (
    <div className="container mx-auto p-8 max-w-7xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reservations Management</h1>
          <p className="text-muted-foreground mt-1">Manage table reservations and availability</p>
        </div>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="mr-2 h-4 w-4" />
              New Reservation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Reservation</DialogTitle>
            </DialogHeader>
            <ReservationFormDialog
              onSuccess={() => {
                setShowForm(false)
                refetch()
                toast.success("Reservation created successfully")
              }}
              onCancel={() => setShowForm(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Status Filter Tabs */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2 flex-wrap">
            {(
              ["all", "Pending", "Confirmed", "Seated", "Cancelled", "No-Show", "Declined"] as const
            ).map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                onClick={() => setStatusFilter(status)}
                size="sm"
              >
                <Filter className="mr-2 h-3 w-3" />
                {status === "all" ? "All" : status}
                <Badge variant="secondary" className="ml-2">
                  {statusCounts[status]}
                </Badge>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search and Date Filter */}
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          placeholder="Search by customer name or phone..."
          value={searchCustomer}
          onChange={(e) => setSearchCustomer(e.target.value)}
        />
        <Input
          type="date"
          placeholder="Filter by date..."
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Reservations</p>
                <p className="text-2xl font-bold">{statusCounts.all}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{statusCounts.Pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Confirmed</p>
                <p className="text-2xl font-bold text-blue-600">{statusCounts.Confirmed}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Seated</p>
                <p className="text-2xl font-bold text-green-600">{statusCounts.Seated}</p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reservations List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {statusFilter === "all" ? "All Reservations" : `${statusFilter} Reservations`}
              </CardTitle>
              <CardDescription>
                Showing {filteredReservations.length} of {statusCounts.all} reservations
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading reservations...</p>
            </div>
          ) : filteredReservations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No reservations found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReservations.map((res: any) => (
                <ReservationRow
                  key={res.id}
                  reservation={res}
                  onRefresh={() => refetch()}
                  getStatusColor={getStatusColor}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ReservationFormDialog({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    date: new Date().toISOString().split("T")[0],
    time: "18:00",
    partySize: 2,
    notes: "",
  })

  const [availability, setAvailability] = useState<any>(null)
  const [loadingAvailability, setLoadingAvailability] = useState(false)

  const createMutation = useMutation({
    mutationFn: async () => {
      const result = await (trpcClient.reservations as any).create.mutate({
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        date: formData.date,
        time: formData.time,
        partySize: formData.partySize,
        notes: formData.notes || undefined,
      })
      return result
    },
  })

  const handleCheckAvailability = async () => {
    setLoadingAvailability(true)
    try {
      const result = await (trpcClient.reservations as any).checkAvailability.query({
        date: formData.date,
        time: formData.time,
        partySize: formData.partySize,
      })
      setAvailability(result)
    } catch (error: any) {
      toast.error(error.message || "Failed to check availability")
    } finally {
      setLoadingAvailability(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.customerName || !formData.customerPhone) {
      toast.error("Please fill in all required fields")
      return
    }

    try {
      await createMutation.mutateAsync()
      onSuccess()
    } catch (error: any) {
      toast.error(error.message || "Failed to create reservation")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Customer Name *</label>
        <Input
          value={formData.customerName}
          onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
          placeholder="John Doe"
          required
        />
      </div>

      <div>
        <label className="text-sm font-medium">Phone Number *</label>
        <Input
          value={formData.customerPhone}
          onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
          placeholder="+1 (555) 123-4567"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Date *</label>
          <Input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">Time *</label>
          <Input
            type="time"
            value={formData.time}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            required
            step="1800"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Party Size *</label>
        <Input
          type="number"
          min="1"
          max="20"
          value={formData.partySize}
          onChange={(e) => setFormData({ ...formData, partySize: parseInt(e.target.value) })}
          required
        />
      </div>

      <div>
        <label className="text-sm font-medium">Notes (Optional)</label>
        <Input
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Special requests, dietary restrictions..."
        />
      </div>

      {availability && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-3">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            ✓ {availability.availableTables?.length || 0} tables available
          </p>
          {availability.tablesCombinations?.length > 0 && (
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              {availability.tablesCombinations.length} table combinations available
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleCheckAvailability}
          disabled={loadingAvailability || !formData.date || !formData.time}
          className="flex-1"
        >
          {loadingAvailability ? "Checking..." : "Check Availability"}
        </Button>
        <Button type="submit" disabled={createMutation.isPending} className="flex-1">
          {createMutation.isPending ? "Creating..." : "Create"}
        </Button>
      </div>

      <Button type="button" variant="ghost" onClick={onCancel} className="w-full">
        Cancel
      </Button>
    </form>
  )
}

function ReservationRow({
  reservation,
  onRefresh,
  getStatusColor,
}: {
  reservation: any
  onRefresh: () => void
  getStatusColor: (status: string) => string
}) {
  const [expanded, setExpanded] = useState(false)

  const confirmMutation = useMutation({
    mutationFn: async () => {
      await (trpcClient.reservations as any).confirm.mutate({
        id: reservation.id,
        assignedTableIds: [],
      })
    },
    onSuccess: () => {
      toast.success("Reservation confirmed")
      onRefresh()
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to confirm")
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await (trpcClient.reservations as any).cancel.mutate({
        id: reservation.id,
      })
    },
    onSuccess: () => {
      toast.success("Reservation cancelled")
      onRefresh()
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to cancel")
    },
  })

  const markSeatedMutation = useMutation({
    mutationFn: async () => {
      await (trpcClient.reservations as any).markSeated.mutate({
        id: reservation.id,
      })
    },
    onSuccess: () => {
      toast.success("Reservation marked as seated")
      onRefresh()
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to mark seated")
    },
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Pending":
        return "⏳"
      case "Confirmed":
        return "✓"
      case "Seated":
        return "👥"
      case "Cancelled":
        return "✕"
      case "No-Show":
        return "⚠"
      case "Declined":
        return "✕"
      default:
        return "●"
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="font-semibold text-lg">{reservation.customerName}</h3>
            <Badge className={getStatusColor(reservation.status)}>
              {getStatusIcon(reservation.status)} {reservation.status}
            </Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
            <div>
              <p className="font-medium">📅 {new Date(reservation.date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="font-medium">🕐 {reservation.time}</p>
            </div>
            <div>
              <p>👥 {reservation.partySize} people</p>
            </div>
            <div>
              <p>📞 {reservation.customerPhone}</p>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="flex-shrink-0"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </Button>
      </div>

      {expanded && (
        <div className="border-t pt-4 space-y-3">
          {reservation.notes && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Notes</p>
              <p className="text-sm">{reservation.notes}</p>
            </div>
          )}

          {reservation.assignedTableIds && reservation.assignedTableIds.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Assigned Tables</p>
              <p className="text-sm">Table {reservation.assignedTableIds.join(", ")}</p>
            </div>
          )}

          <div className="flex gap-2 flex-wrap pt-2">
            {reservation.status === "Pending" && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => confirmMutation.mutateAsync()}
                  disabled={confirmMutation.isPending}
                >
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => cancelMutation.mutateAsync()}
                  disabled={cancelMutation.isPending}
                >
                  Delete
                </Button>
              </>
            )}
            {reservation.status === "Confirmed" && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => markSeatedMutation.mutateAsync()}
                  disabled={markSeatedMutation.isPending}
                >
                  Mark Seated
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => cancelMutation.mutateAsync()}
                  disabled={cancelMutation.isPending}
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

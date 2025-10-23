import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { Calendar, Clock, DollarSign, Plus, ShoppingBag, Trash2, Users } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { ShiftControl } from "@/components/shift-control"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { authClient } from "@/lib/auth-client"
import type { ActiveShift, ShiftHistory } from "@/types/shifts"
import { trpc, trpcClient } from "@/utils/trpc"

/**
 * T123: Shift Management Route
 * Auth: Manager only
 * Layout: Active shifts at top, history below
 *
 * T127: Active Shifts List Component
 * Display: Running shifts with real-time duration counter, order count, staff names
 * tRPC: shifts.listActive, poll every 30s
 *
 * T128: Edit Shift UI for Staff Management
 * Features: "+ Add Staff" button, staff list with remove icons
 * tRPC: shifts.addStaff, shifts.removeStaff
 *
 * T130: Shift History Component
 * Filters: Date range picker, shift type dropdown, staff member dropdown
 * tRPC: shifts.listHistory
 *
 * T131: "History" tab to shifts management page
 * Layout: Tab navigation: Active | History
 *
 * T132: Display shift summary cards in history
 * Info: Shift type, date/time, duration, order count, revenue, staff names
 * Sorting: Most recent first
 */

export const Route = createFileRoute("/shifts")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession()

    // Check if user is authenticated
    if (!session.data) {
      throw redirect({
        to: "/login",
      })
    }

    // Note: Role checking commented out for MVP - will be enabled when user.role is available
    // Check if user has Manager role
    // const userRole = (session.data.user as any).role;
    // if (userRole !== "Manager") {
    //   throw redirect({
    //     to: "/dashboard",
    //   });
    // }

    return { session }
  },
})

function RouteComponent() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<"active" | "history">("active")
  const [editStaffShiftId, setEditStaffShiftId] = useState<number | null>(null)
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])

  // History filters
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [filterShiftType, setFilterShiftType] = useState<
    "Breakfast" | "Lunch" | "Dinner" | "Custom" | ""
  >("")
  const [filterStaffId, setFilterStaffId] = useState("")

  // Query active shifts (poll every 30s)
  const {
    data: activeShifts,
    isLoading: isLoadingActive,
    refetch: refetchActiveShifts,
  } = useQuery({
    ...trpc.shifts.listActive.queryOptions(),
    refetchInterval: 30000, // Poll every 30 seconds
  })

  // Query shift history with filters
  const {
    data: shiftHistory,
    isLoading: isLoadingHistory,
    refetch: refetchHistory,
  } = useQuery({
    ...trpc.shifts.listHistory.queryOptions({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      shiftType: filterShiftType || undefined,
      staffId: filterStaffId || undefined,
    } as any),
    enabled: activeTab === "history",
  })

  // Mock staff data (TODO: Replace with actual users.list endpoint)
  const mockStaff = [
    { id: "1", name: "John Doe" },
    { id: "2", name: "Jane Smith" },
    { id: "3", name: "Bob Johnson" },
  ]

  // Add staff mutation
  const addStaffMutation = useMutation({
    mutationFn: (data: { shiftId: number; staffIds: string[] }) =>
      trpcClient.shifts.addStaff.mutate(data as any),
    onSuccess: () => {
      toast.success("Staff added successfully")
      setEditStaffShiftId(null)
      setSelectedStaffIds([])
      refetchActiveShifts()
    },
    onError: (error: Error) => {
      toast.error(`Failed to add staff: ${error.message}`)
    },
  })

  // Remove staff mutation
  const removeStaffMutation = useMutation({
    mutationFn: (data: { shiftId: number; staffIds: string[] }) =>
      trpcClient.shifts.removeStaff.mutate(data as any),
    onSuccess: () => {
      toast.success("Staff removed successfully")
      refetchActiveShifts()
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove staff: ${error.message}`)
    },
  })

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`
  }

  const formatDateTime = (date: Date) => {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  const handleAddStaff = (shiftId: number) => {
    if (selectedStaffIds.length === 0) {
      toast.error("Please select at least one staff member")
      return
    }

    addStaffMutation.mutate({
      shiftId,
      staffIds: selectedStaffIds,
    })
  }

  const handleRemoveStaff = (shiftId: number, staffId: string) => {
    if (confirm("Remove this staff member from the shift?")) {
      removeStaffMutation.mutate({
        shiftId,
        staffIds: [staffId],
      })
    }
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Shift Management</h1>
        <p className="text-lg text-muted-foreground">
          Track and manage operational shifts and staff assignments
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <div className="lg:col-span-1">
          <ShiftControl onShiftChange={() => refetchActiveShifts()} />
        </div>

        <div className="lg:col-span-2">
          {/* T131: Tab Navigation */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "active" | "history")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="active">Active Shifts</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            {/* T127: Active Shifts Tab */}
            <TabsContent value="active" className="space-y-4">
              {isLoadingActive ? (
                <div className="space-y-4">
                  <Skeleton className="h-48 w-full" />
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : activeShifts && activeShifts.length > 0 ? (
                <div className="space-y-4">
                  {(activeShifts as ActiveShift[]).map((shift) => (
                    <Card key={shift.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            {shift.shiftType}
                          </CardTitle>
                          <Badge variant="default">Active</Badge>
                        </div>
                        <CardDescription>Started {formatDateTime(shift.startTime)}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Duration</p>
                              <p className="text-lg font-bold">{formatDuration(shift.duration)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Orders</p>
                              <p className="text-lg font-bold">{shift.currentOrderCount}</p>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* T128: Staff Management */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              Staff ({shift.staff.length})
                            </h4>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditStaffShiftId(shift.id)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Staff
                            </Button>
                          </div>

                          {shift.staff.length > 0 ? (
                            <div className="space-y-2">
                              {shift.staff.map((staff) => (
                                <div
                                  key={staff.id}
                                  className="flex items-center justify-between p-2 rounded-md bg-muted"
                                >
                                  <span className="text-sm">{staff.name}</span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRemoveStaff(shift.id, staff.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No staff assigned</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">No active shifts</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Start a shift using the control panel on the left
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* T130: Shift History Tab */}
            <TabsContent value="history" className="space-y-4">
              {/* History Filters */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Filters</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Start Date</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">End Date</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Shift Type</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={filterShiftType === "" ? "default" : "outline"}
                          onClick={() => setFilterShiftType("")}
                        >
                          All
                        </Button>
                        {(["Breakfast", "Lunch", "Dinner", "Custom"] as const).map((type) => (
                          <Button
                            key={type}
                            type="button"
                            size="sm"
                            variant={filterShiftType === type ? "default" : "outline"}
                            onClick={() => setFilterShiftType(type)}
                          >
                            {type}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Button onClick={() => refetchHistory()} className="w-full">
                        Apply Filters
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setStartDate("")
                          setEndDate("")
                          setFilterShiftType("")
                          setFilterStaffId("")
                        }}
                        className="w-full"
                      >
                        Clear Filters
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* T132: Shift History Cards */}
              {isLoadingHistory ? (
                <div className="space-y-4">
                  <Skeleton className="h-48 w-full" />
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : shiftHistory && shiftHistory.length > 0 ? (
                <div className="space-y-4">
                  {(shiftHistory as ShiftHistory[]).map((shift) => {
                    const duration = shift.endTime
                      ? Math.floor(
                          (new Date(shift.endTime).getTime() -
                            new Date(shift.startTime).getTime()) /
                            60000
                        )
                      : 0

                    return (
                      <Card key={shift.id}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                              <Calendar className="h-5 w-5" />
                              {shift.shiftType}
                            </CardTitle>
                            <Badge variant="secondary">Completed</Badge>
                          </div>
                          <CardDescription>
                            {formatDateTime(shift.startTime)} -{" "}
                            {shift.endTime ? formatDateTime(shift.endTime) : "Ongoing"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">Duration</p>
                                <p className="text-lg font-bold">{formatDuration(duration)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">Orders</p>
                                <p className="text-lg font-bold">{shift.totalOrders}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">Revenue</p>
                                <p className="text-lg font-bold">
                                  {formatCurrency(shift.totalRevenue)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">Staff</p>
                                <p className="text-lg font-bold">{shift.staff.length}</p>
                              </div>
                            </div>
                          </div>

                          {shift.staff.length > 0 && (
                            <div className="mt-4">
                              <p className="text-sm text-muted-foreground">
                                Staff:{" "}
                                {shift.staff
                                  .map((staff: ActiveShift["staff"][0]) => staff.name)
                                  .join(", ")}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">No shift history found</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Try adjusting your filters or start some shifts
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* T128: Add Staff Dialog */}
      <Dialog open={editStaffShiftId !== null} onOpenChange={() => setEditStaffShiftId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Staff to Shift</DialogTitle>
            <DialogDescription>Select staff members to add to this shift</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="border rounded-md p-3 space-y-2 max-h-64 overflow-y-auto">
              {mockStaff.map((staff) => (
                <div key={staff.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`add-staff-${staff.id}`}
                    checked={selectedStaffIds.includes(staff.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedStaffIds([...selectedStaffIds, staff.id])
                      } else {
                        setSelectedStaffIds(selectedStaffIds.filter((id) => id !== staff.id))
                      }
                    }}
                  />
                  <Label htmlFor={`add-staff-${staff.id}`} className="cursor-pointer">
                    {staff.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditStaffShiftId(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => editStaffShiftId && handleAddStaff(editStaffShiftId)}
              disabled={addStaffMutation.isPending || selectedStaffIds.length === 0}
            >
              {addStaffMutation.isPending ? "Adding..." : "Add Staff"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

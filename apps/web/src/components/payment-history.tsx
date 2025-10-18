import { useQuery } from "@tanstack/react-query"
import { Calendar, DollarSign, Filter, RefreshCw, Table2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { trpc } from "@/utils/trpc"

import Loader from "./loader"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

/**
 * T124: PaymentHistory Component
 * Displays payment history with filtering capabilities
 *
 * Contract: payments-router.md getHistory
 * Acceptance: spec.md US6 Scenario 4
 * - View all completed and paid orders
 * - Filter by date range
 * - Filter by table number
 * - Display payment timestamps and amounts
 * - Show total revenue for filtered results
 */

interface PaymentRecord {
  id: number
  orderId: number
  tableNumber: number
  amount: number
  method: "Cash"
  paidAt: Date
}

export function PaymentHistory() {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [tableFilter, setTableFilter] = useState("")

  // Format currency (amount in cents to dollars)
  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`
  }

  // Build query parameters
  const queryParams = {
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    tableId: tableFilter ? Number(tableFilter) : undefined,
    limit: 50,
    offset: 0,
  }

  // Query payment history
  const { data, isLoading, error, refetch } = useQuery({
    ...trpc.payments.getHistory.queryOptions(queryParams),
  })

  const handleClearFilters = () => {
    setStartDate("")
    setEndDate("")
    setTableFilter("")
  }

  const handleApplyFilters = () => {
    refetch()
    toast.success("Filters applied")
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Error Loading Payment History</CardTitle>
          <CardDescription>{error.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => refetch()} variant="outline">
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment History</CardTitle>
        <CardDescription>
          View all completed transactions and filter by date or table
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="bg-muted p-4 rounded-lg space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="h-4 w-4" />
            <h3 className="font-semibold">Filters</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="startDate">From Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label htmlFor="endDate">To Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {/* Table Filter */}
            <div className="space-y-2">
              <Label htmlFor="tableFilter">Table Number</Label>
              <Input
                id="tableFilter"
                type="number"
                placeholder="All tables"
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                min="1"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClearFilters} size="sm">
              Clear
            </Button>
            <Button onClick={handleApplyFilters} size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Apply Filters
            </Button>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Payments</p>
                  <p className="text-2xl font-bold">{data?.total || 0}</p>
                </div>
                <DollarSign className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(data?.totalRevenue || 0)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg. Payment</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(data?.total ? Math.round(data.totalRevenue / data.total) : 0)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Records Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Recent Payments</h3>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {data?.payments && data.payments.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">Date & Time</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Table</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Order ID</th>
                      <th className="px-4 py-3 text-right text-sm font-medium">Amount</th>
                      <th className="px-4 py-3 text-center text-sm font-medium">Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.payments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-muted/50">
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {new Date(payment.paidAt).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Table2 className="h-4 w-4 text-muted-foreground" />
                            Table {payment.tableNumber}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono">#{payment.orderId}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-right">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <Badge variant="outline">{payment.method}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No payment records found</p>
              <p className="text-sm mt-2">Try adjusting your filters or check back later</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

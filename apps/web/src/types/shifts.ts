/**
 * Shared type definitions for shifts
 * Used to fix TypeScript inference issues with complex tRPC return types
 */

export interface ActiveShiftStaff {
  id: string
  name: string | null
}

export interface ActiveShift {
  id: number
  shiftType: string
  startTime: Date
  duration: number
  currentOrderCount: number
  staff: ActiveShiftStaff[]
}

export interface ShiftHistoryStaff {
  id: string
  name: string | null
  role: string
}

export interface ShiftHistory {
  id: number
  shiftType: string
  startTime: Date
  endTime: Date | null
  duration: number
  totalOrders: number
  totalRevenue: number
  notes: string | null
  staff: ShiftHistoryStaff[]
}

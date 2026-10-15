import type { UserTournamentItem } from '@sportcomplex/features-tournament'
import type { CartItem } from '@sportcomplex/features-booking'
import type {
  PortalTicket,
  AccessWindowStatus,
  ApiBookingHistoryItem,
  ReceiptApiResponse,
} from '../utils/portal-utils'
import type {
  PlanMembresiaDTO,
  MembresiaActivaDTO,
  PlanDisplayBreakdown,
  PurchaseAccessValidation,
} from '../utils/membership-utils'

export type TabType = 'activas' | 'historial' | 'canceladas' | 'torneos'
export type ToastKind = 'success' | 'error' | 'info'

export type {
  UserTournamentItem,
  CartItem,
  PortalTicket,
  AccessWindowStatus,
  ApiBookingHistoryItem,
  ReceiptApiResponse,
  PlanMembresiaDTO,
  MembresiaActivaDTO,
  PlanDisplayBreakdown,
  PurchaseAccessValidation,
}

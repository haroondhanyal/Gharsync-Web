import { Prisma } from "../generated/prisma/client.js";
import { BookingStatus, InvoiceStatus } from "../generated/prisma/enums.js";

export const BOOKING_TRANSITIONS: Partial<Record<BookingStatus, BookingStatus[]>> = {
  REQUESTED: [BookingStatus.UNDER_REVIEW, BookingStatus.CANCELLED],
  UNDER_REVIEW: [BookingStatus.CANCELLED],
  QUOTED: [BookingStatus.CANCELLED],
  AWAITING_APPROVAL: [BookingStatus.CANCELLED],
  APPROVED: [BookingStatus.SCHEDULED, BookingStatus.CANCELLED],
  SCHEDULED: [BookingStatus.ASSIGNED, BookingStatus.CANCELLED],
  ASSIGNED: [BookingStatus.TECHNICIAN_EN_ROUTE, BookingStatus.SCHEDULED, BookingStatus.CANCELLED],
  TECHNICIAN_EN_ROUTE: [BookingStatus.IN_PROGRESS, BookingStatus.ASSIGNED, BookingStatus.CANCELLED],
  IN_PROGRESS: [BookingStatus.COMPLETED, BookingStatus.DISPUTED],
  DISPUTED: [BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED, BookingStatus.CANCELLED],
};

export function canTransitionBooking(from: BookingStatus, to: BookingStatus) {
  return BOOKING_TRANSITIONS[from]?.includes(to) ?? false;
}

export function calculateQuoteTotals(items: { quantity: number; unitPrice: number }[], discount: number, tax: number) {
  const subtotal = items.reduce((sum, item) => sum.add(new Prisma.Decimal(item.quantity).mul(item.unitPrice).toDecimalPlaces(2)), new Prisma.Decimal(0)).toDecimalPlaces(2);
  const discountAmount = new Prisma.Decimal(discount);
  const taxAmount = new Prisma.Decimal(tax);
  if (discountAmount.gt(subtotal)) throw new RangeError("Discount cannot exceed the quote subtotal.");
  const total = subtotal.sub(discountAmount).add(taxAmount).toDecimalPlaces(2);
  if (!total.gt(0)) throw new RangeError("Quote total must be greater than zero.");
  return { subtotal, discount: discountAmount, tax: taxAmount, total };
}

export function invoiceOutstanding(total: Prisma.Decimal | string | number, verified: Prisma.Decimal | string | number, refunded: Prisma.Decimal | string | number) {
  const balance = new Prisma.Decimal(total).sub(verified).add(refunded).toDecimalPlaces(2);
  return balance.lt(0) ? new Prisma.Decimal(0) : balance;
}

export function invoiceStatusFromLedger(total: Prisma.Decimal | string | number, verified: Prisma.Decimal | string | number, refunded: Prisma.Decimal | string | number): InvoiceStatus {
  const net = new Prisma.Decimal(verified).sub(refunded);
  if (!net.gt(0)) return InvoiceStatus.ISSUED;
  return net.gte(total) ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;
}

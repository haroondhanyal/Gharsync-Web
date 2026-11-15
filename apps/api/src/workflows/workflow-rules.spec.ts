import assert from "node:assert/strict";
import test from "node:test";
import { BookingStatus, InvoiceStatus } from "../generated/prisma/enums.js";
import { assetCreateSchema, bookingCreateSchema, documentTargetSchema, paymentCreateSchema } from "@gharsync/validation";
import { calculateQuoteTotals, canTransitionBooking, invoiceOutstanding, invoiceStatusFromLedger } from "./workflow-rules.js";

test("booking workflow allows the intended path and rejects skipping approval", () => {
  assert.equal(canTransitionBooking(BookingStatus.REQUESTED, BookingStatus.UNDER_REVIEW), true);
  assert.equal(canTransitionBooking(BookingStatus.APPROVED, BookingStatus.SCHEDULED), true);
  assert.equal(canTransitionBooking(BookingStatus.REQUESTED, BookingStatus.COMPLETED), false);
  assert.equal(canTransitionBooking(BookingStatus.COMPLETED, BookingStatus.ASSIGNED), false);
});

test("quote totals use decimal arithmetic and reject excess discount", () => {
  const totals = calculateQuoteTotals([{ quantity: 3, unitPrice: 0.1 }, { quantity: 1, unitPrice: 10 }], 1, 0.5);
  assert.equal(totals.subtotal.toFixed(2), "10.30");
  assert.equal(totals.total.toFixed(2), "9.80");
  assert.throws(() => calculateQuoteTotals([{ quantity: 1, unitPrice: 100 }], 101, 0), /Discount cannot exceed/);
  assert.throws(() => calculateQuoteTotals([{ quantity: 1, unitPrice: 100 }], 100, 0), /greater than zero/);
});

test("invoice ledger counts verified receipts, tracks refunds and prevents negative balance", () => {
  assert.equal(invoiceOutstanding("100", "60", "10").toFixed(2), "50.00");
  assert.equal(invoiceOutstanding("100", "120", "0").toFixed(2), "0.00");
  assert.equal(invoiceStatusFromLedger("100", "100", "0"), InvoiceStatus.PAID);
  assert.equal(invoiceStatusFromLedger("100", "100", "25"), InvoiceStatus.PARTIALLY_PAID);
  assert.equal(invoiceStatusFromLedger("100", "40", "40"), InvoiceStatus.ISSUED);
});

test("booking validation rejects cross-tenant identifiers supplied as extra fields", () => {
  const parsed = bookingCreateSchema.safeParse({ customerId: "0a1b2c3d-4e5f-4a1b-8c9d-0e1f2a3b4c5d", description: "AC is making a loud sound", organizationId: "0a1b2c3d-4e5f-4a1b-8c9d-0e1f2a3b4c5d" });
  assert.equal(parsed.success, false);
});

test("document uploads must target one record and asset dates/prices are validated", () => {
  assert.equal(documentTargetSchema.safeParse({ propertyId: "0a1b2c3d-4e5f-4a1b-8c9d-0e1f2a3b4c5d", assetId: "0a1b2c3d-4e5f-4a1b-8c9d-0e1f2a3b4c5d" }).success, false);
  assert.equal(assetCreateSchema.safeParse({ propertyId: "0a1b2c3d-4e5f-4a1b-8c9d-0e1f2a3b4c5d", category: "Air conditioner", purchasePrice: -1 }).success, false);
});

test("payment requests require a positive amount and idempotency key", () => {
  assert.equal(paymentCreateSchema.safeParse({ amount: 0, method: "CASH", idempotencyKey: "request-0001" }).success, false);
  assert.equal(paymentCreateSchema.safeParse({ amount: 25, method: "CASH", idempotencyKey: "request-0001" }).success, true);
});

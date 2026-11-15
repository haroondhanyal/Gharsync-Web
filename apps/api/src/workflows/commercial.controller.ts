import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import PDFDocument from "pdfkit";
import type { Response } from "express";
import { z } from "zod";
import { invoiceCreateSchema, invoiceVoidSchema, paymentCreateSchema, paymentDecisionSchema, refundCreateSchema } from "@gharsync/validation";
import { CurrentAuth, RequirePermission, type AuthContext } from "../auth/auth-context.js";
import { OrganizationAccessGuard } from "../auth/organization-access.guard.js";
import { WorkflowsService } from "./workflows.service.js";

@Controller("invoices")
@UseGuards(OrganizationAccessGuard)
export class CommercialController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Get()
  @RequirePermission("invoices.read")
  invoices(@CurrentAuth() auth: AuthContext, @Query("status") status?: string) { return this.workflows.listInvoices(auth, status); }

  @Get(":invoiceId/pdf")
  @RequirePermission("invoices.read")
  async invoicePdf(@CurrentAuth() auth: AuthContext, @Param("invoiceId", { schema: z.uuid() }) id: string, @Res() response: Response) {
    const invoice = await this.workflows.getInvoice(auth, id);
    const pdf = new PDFDocument({ size: "A4", margin: 48, info: { Title: `GharSync invoice ${invoice.invoiceNumber}`, Author: invoice.organization.name } });
    const chunks: Buffer[] = [];
    const buffer = new Promise<Buffer>((resolve, reject) => { pdf.on("data", (chunk: Buffer) => chunks.push(chunk)); pdf.on("end", () => resolve(Buffer.concat(chunks))); pdf.on("error", reject); });
    const text = (value: unknown) => String(value ?? "").replace(/[^\x20-\xFF]/g, "?");
    const money = (value: unknown) => `${invoice.currency} ${Number(value).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    pdf.fillColor("#173f35").fontSize(22).font("Helvetica-Bold").text(text(invoice.organization.name));
    pdf.moveDown(0.4).fontSize(10).font("Helvetica").fillColor("#64756b").text("INVOICE", { characterSpacing: 1.5 });
    pdf.moveDown(0.8).fontSize(11).fillColor("#203c31").text(`Invoice: ${text(invoice.invoiceNumber)}`).text(`Status: ${text(invoice.status.replaceAll("_", " "))}`).text(`Issued: ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(invoice.createdAt))}`);
    if (invoice.dueAt) pdf.text(`Due: ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(invoice.dueAt))}`);
    pdf.moveDown(1).font("Helvetica-Bold").text("BILL TO").font("Helvetica").text(text(invoice.booking.customer.fullName)).text(text(invoice.booking.customer.phone));
    if (invoice.booking.customer.email) pdf.text(text(invoice.booking.customer.email));
    if (invoice.booking.property) pdf.text(`${text(invoice.booking.property.name)} · ${text(invoice.booking.property.address)}, ${text(invoice.booking.property.city)}`);
    pdf.moveDown(1.5);
    const pageWidth = 500; const itemX = 48; const qtyX = 360; const rateX = 410; const amountX = 495;
    const tableY = pdf.y;
    pdf.fillColor("#edf2eb").rect(itemX, tableY, pageWidth, 24).fill();
    pdf.fillColor("#315541").font("Helvetica-Bold").fontSize(9).text("DESCRIPTION", itemX + 8, tableY + 8, { continued: false });
    pdf.text("QTY", qtyX, tableY + 8).text("RATE", rateX, tableY + 8).text("AMOUNT", amountX - 55, tableY + 8, { width: 55, align: "right" });
    pdf.y = tableY + 30;
    for (const item of invoice.items) {
      const y = pdf.y;
      pdf.fillColor("#354d3f").font("Helvetica").fontSize(9).text(text(item.description), itemX + 8, y, { width: 285 });
      pdf.text(Number(item.quantity).toLocaleString("en-PK"), qtyX, y, { width: 35, align: "right" });
      pdf.text(Number(item.unitPrice).toFixed(2), rateX, y, { width: 55, align: "right" });
      pdf.text(Number(item.lineTotal).toFixed(2), amountX - 55, y, { width: 55, align: "right" });
      pdf.y = y + Math.max(18, pdf.heightOfString(text(item.description), { width: 285 }));
      pdf.moveTo(itemX, pdf.y).lineTo(itemX + pageWidth, pdf.y).strokeColor("#e9ede6").stroke();
      pdf.moveDown(0.45);
    }
    pdf.moveDown(0.7);
    const row = (label: string, value: unknown, bold = false) => { const y = pdf.y; pdf.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10).fillColor("#354d3f").text(label, 340, y, { width: 95 }); pdf.text(money(value), 435, y, { width: 105, align: "right" }); pdf.y = y + 17; };
    row("Subtotal", invoice.subtotal); row("Discount", invoice.discount); row("Tax", invoice.tax); row("Invoice total", invoice.total, true); row("Paid", invoice.paidAmount); row("Outstanding", invoice.outstandingAmount, true);
    if (invoice.payments.length) {
      pdf.moveDown(0.8).font("Helvetica-Bold").fontSize(10).text("PAYMENT ACTIVITY").moveDown(0.4);
      for (const payment of invoice.payments) pdf.font("Helvetica").fontSize(8).fillColor("#56685d").text(`${payment.status.replaceAll("_", " ")} · ${payment.method.replaceAll("_", " ")} · ${money(payment.amount)} · ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(payment.createdAt))}`);
    }
    pdf.moveDown(1.5).fontSize(8).fillColor("#7a887f").text("Thank you for choosing this service team. A payment is counted only after verification.");
    pdf.end();
    const data = await buffer;
    response.setHeader("Content-Type", "application/pdf"); response.setHeader("Content-Length", data.length); response.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`); response.setHeader("Cache-Control", "private, no-store"); response.end(data);
  }

  @Post("booking/:bookingId")
  @RequirePermission("invoices.manage")
  createInvoice(@CurrentAuth() auth: AuthContext, @Param("bookingId", { schema: z.uuid() }) bookingId: string, @Body({ schema: invoiceCreateSchema }) body: z.infer<typeof invoiceCreateSchema>) { return this.workflows.createInvoice(auth, bookingId, body); }

  @Get(":invoiceId")
  @RequirePermission("invoices.read")
  invoice(@CurrentAuth() auth: AuthContext, @Param("invoiceId", { schema: z.uuid() }) invoiceId: string) { return this.workflows.getInvoice(auth, invoiceId); }

  @Post(":invoiceId/payments")
  @RequirePermission("payments.record")
  payment(@CurrentAuth() auth: AuthContext, @Param("invoiceId", { schema: z.uuid() }) invoiceId: string, @Body({ schema: paymentCreateSchema }) body: z.infer<typeof paymentCreateSchema>) { return this.workflows.recordPayment(auth, invoiceId, body); }

  @Post("payments/:paymentId/decision")
  @RequirePermission("payments.verify")
  paymentDecision(@CurrentAuth() auth: AuthContext, @Param("paymentId", { schema: z.uuid() }) paymentId: string, @Body({ schema: paymentDecisionSchema }) body: z.infer<typeof paymentDecisionSchema>) { return this.workflows.decidePayment(auth, paymentId, body); }

  @Post("refunds")
  @RequirePermission("payments.refund")
  refund(@CurrentAuth() auth: AuthContext, @Body({ schema: refundCreateSchema }) body: z.infer<typeof refundCreateSchema>) { return this.workflows.refundPayment(auth, body); }

  @Post(":invoiceId/void")
  @RequirePermission("invoices.manage")
  void(@CurrentAuth() auth: AuthContext, @Param("invoiceId", { schema: z.uuid() }) id: string, @Body({ schema: invoiceVoidSchema }) body: z.infer<typeof invoiceVoidSchema>) { return this.workflows.voidInvoice(auth, id, body.reason); }
}

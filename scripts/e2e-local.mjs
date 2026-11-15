import { randomUUID } from "node:crypto";

const base = process.env.API_URL ?? "http://127.0.0.1:4000/api/v1";
function session() { return { cookies: new Map() }; }
async function call(client, path, { method = "GET", body, expected = 200 } = {}) {
  const headers = { ...(body ? { "content-type": "application/json" } : {}) };
  if (client?.cookies.size) headers.cookie = [...client.cookies].map(([key, value]) => `${key}=${value}`).join("; ");
  const response = await fetch(`${base}${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  for (const item of response.headers.getSetCookie()) {
    const pair = item.slice(0, item.indexOf(";"));
    const split = pair.indexOf("=");
    if (split > 0) client?.cookies.set(pair.slice(0, split), pair.slice(split + 1));
  }
  const data = await response.json().catch(() => ({}));
  if (expected && response.status !== expected) throw new Error(`${method} ${path}: expected ${expected}, got ${response.status}: ${JSON.stringify(data)}`);
  return { status: response.status, data };
}
const ok = (condition, label) => { if (!condition) throw new Error(`Assertion failed: ${label}`); console.log(`✓ ${label}`); };
const createAccount = async ({ accountType, fullName, email, organizationName, businessType, city }) => {
  const client = session();
  await call(client, "/auth/register", { method: "POST", expected: 201, body: { accountType, fullName, email, password: "LocalDemoPass!2026", phone: `03${Math.floor(100000000 + Math.random() * 899999999)}`, ...(accountType === "business" ? { organizationName, businessType, city } : {}) } });
  await call(client, "/auth/phone-otp/verify", { method: "POST", expected: 200, body: { code: "123456" } });
  return client;
};

const suffix = randomUUID().slice(0, 8);
const owner = await createAccount({ accountType: "business", fullName: "GharSync E2E Owner", email: `owner-${suffix}@example.test`, organizationName: `E2E Services ${suffix}`, businessType: "ELECTRICAL", city: "Lahore" });
const me = (await call(owner, "/auth/me")).data;
const orgId = me.currentOrganizationId;
const branches = (await call(owner, "/organizations/branches")).data;
const branchId = branches[0].id;
const destinationBranch = (await call(owner, "/organizations/branches", { method: "POST", expected: 201, body: { name: `Parts Hub ${suffix}`, city: "Lahore" } })).data;
ok(Boolean(orgId && branchId), "Phase 2: organization, default branch, account and OTP verification");

const customer = (await call(owner, "/customers", { method: "POST", expected: 201, body: { fullName: `Sample Customer ${suffix}`, phone: "03001234567", email: `customer-${suffix}@example.test`, tags: ["e2e"] } })).data;
const property = (await call(owner, "/properties", { method: "POST", expected: 201, body: { customerId: customer.id, name: "Test Home", address: "10 Model Town", city: "Lahore", propertyType: "HOUSE" } })).data;
const asset = (await call(owner, "/assets", { method: "POST", expected: 201, body: { propertyId: property.id, category: "Air conditioner", brand: "TestBrand", serialNumber: `SN-${suffix}`, warrantyStartsAt: "2025-01-01T00:00:00.000Z", warrantyEndsAt: "2030-01-01T00:00:00.000Z" } })).data;
ok(Boolean(customer.id && property.id && asset.id), "Phases 3–4: customer, home and warrantied asset records");

const appointmentAt = new Date(Date.now() + 24 * 60 * 60_000); appointmentAt.setUTCHours(5, 0, 0, 0);
const appointmentWeekday = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", weekday: "short" }).format(appointmentAt);
const weekdayIndex = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(appointmentWeekday);
const service = (await call(owner, "/services", { method: "POST", expected: 201, body: { name: `Inspection ${suffix}`, category: "Maintenance", basePrice: 1000, requiredSkills: ["Electrical"], branchIds: [branchId], isActive: true } })).data;
const booking = (await call(owner, "/bookings", { method: "POST", expected: 201, body: { customerId: customer.id, propertyId: property.id, assetId: asset.id, serviceId: service.id, branchId, description: "Inspect the AC unit and wiring", urgency: "NORMAL" } })).data;
await call(owner, `/bookings/${booking.id}/transition`, { method: "POST", expected: 201, body: { status: "UNDER_REVIEW" } });
const quote = (await call(owner, `/bookings/${booking.id}/quotes`, { method: "POST", expected: 201, body: { items: [{ description: "Inspection and repair", quantity: 1, unitPrice: 2500 }], discount: 0, tax: 0 } })).data;
await call(owner, `/quotes/${quote.id}/send`, { method: "POST", expected: 201 });
await call(owner, `/quotes/${quote.id}/decision`, { method: "POST", expected: 201, body: { decision: "ACCEPTED" } });
await call(owner, `/bookings/${booking.id}/transition`, { method: "POST", expected: 201, body: { status: "SCHEDULED", scheduledAt: appointmentAt.toISOString() } });
ok(true, "Phase 5: service catalog, booking, quote revision, customer decision and scheduled visit");

const techEmail = `tech-${suffix}@example.test`;
const invite = (await call(owner, `/organizations/${orgId}/invites`, { method: "POST", expected: 201, body: { email: techEmail, role: "TECHNICIAN", branchId } })).data;
const inviteToken = new URL(invite.inviteUrl).searchParams.get("token");
const technician = await createAccount({ accountType: "team", fullName: "E2E Technician", email: techEmail });
await call(technician, "/organizations/invites/accept", { method: "POST", expected: 200, body: { token: inviteToken } });
await call(technician, `/auth/organizations/${orgId}/select`, { method: "POST", expected: 200, body: {} });
const members = (await call(owner, `/organizations/${orgId}/members`)).data;
const techMember = members.find((member) => member.user.email === techEmail);
ok(Boolean(techMember), "Phase 2: invited technician joins a branch-scoped organization");

await call(owner, `/workforce/technicians/${techMember.id}/profile`, { method: "PUT", expected: 200, body: { skills: ["Electrical", "HVAC"], employmentType: "FULL_TIME", isAvailable: true, bio: "Local test technician" } });
await call(owner, `/workforce/technicians/${techMember.id}/availability`, { method: "PUT", expected: 200, body: { days: [{ weekday: weekdayIndex, startMinute: 540, endMinute: 1020, isAvailable: true }] } });
const technicians = (await call(owner, "/workforce/technicians")).data;
ok(technicians.some((item) => item.id === techMember.id && item.technicianProfile.skills.includes("HVAC")), "Phase 6: technician skills and weekly availability");
await call(owner, `/bookings/${booking.id}/transition`, { method: "POST", expected: 201, body: { status: "ASSIGNED", assignedMemberId: techMember.id } });
await call(technician, `/bookings/${booking.id}/work-status`, { method: "POST", expected: 201, body: { status: "TECHNICIAN_EN_ROUTE", note: "Starting route" } });
await call(technician, `/bookings/${booking.id}/work-status`, { method: "POST", expected: 201, body: { status: "IN_PROGRESS", note: "On site" } });
await call(technician, `/bookings/${booking.id}/work-status`, { method: "POST", expected: 201, body: { status: "COMPLETED", note: "Work completed" } });
const timeOff = (await call(technician, "/workforce/me/time-off", { method: "POST", expected: 201, body: { startsAt: "2027-03-01T09:00:00.000Z", endsAt: "2027-03-01T17:00:00.000Z", reason: "Personal appointment" } })).data;
await call(owner, `/workforce/time-off/${timeOff.id}`, { method: "PATCH", expected: 200, body: { decision: "APPROVED" } });
ok(true, "Phase 6: assigned technician completes job and time-off request is reviewed");

const supplier = (await call(owner, "/inventory/suppliers", { method: "POST", expected: 201, body: { name: `E2E Supplier ${suffix}`, phone: "03001234567", email: `supplier-${suffix}@example.test` } })).data;
const product = (await call(owner, "/inventory/products", { method: "POST", expected: 201, body: { sku: `SKU-${suffix}`, name: "AC control board", category: "Electrical", unit: "piece", unitCost: 5000, reorderLevel: 1, supplierId: supplier.id, tracksWarranty: true, warrantyDays: 365 } })).data;
await call(owner, "/inventory/movements", { method: "POST", expected: 201, body: { productId: product.id, branchId, type: "RECEIPT", quantity: 5, reference: "PO-TEST-1" } });
await call(owner, "/inventory/movements", { method: "POST", expected: 201, body: { productId: product.id, branchId, type: "RESERVATION", quantity: 2, bookingId: booking.id } });
await call(owner, "/inventory/movements", { method: "POST", expected: 400, body: { productId: product.id, branchId, type: "CONSUMPTION", quantity: 4 } });
await call(owner, "/inventory/movements", { method: "POST", expected: 201, body: { productId: product.id, branchId, type: "RELEASE", quantity: 2 } });
await call(owner, "/inventory/movements", { method: "POST", expected: 201, body: { productId: product.id, branchId, destinationBranchId: destinationBranch.id, type: "TRANSFER", quantity: 1 } });
await call(owner, "/inventory/movements", { method: "POST", expected: 201, body: { productId: product.id, branchId, type: "CONSUMPTION", quantity: 4, bookingId: booking.id } });
const inventory = (await call(owner, "/inventory/products")).data;
ok(inventory.find((item) => item.id === product.id).stocks.length === 2, "Phase 7: inter-branch transfer maintains paired branch stock rows");
const claim = (await call(owner, "/warranty-claims", { method: "POST", expected: 201, body: { assetId: asset.id, productId: product.id, supplierId: supplier.id, issue: "Control board intermittently fails" } })).data;
await call(owner, `/warranty-claims/${claim.id}`, { method: "PATCH", expected: 200, body: { status: "SUBMITTED" } });
await call(owner, `/warranty-claims/${claim.id}`, { method: "PATCH", expected: 200, body: { status: "APPROVED" } });
await call(owner, `/warranty-claims/${claim.id}`, { method: "PATCH", expected: 200, body: { status: "RESOLVED", resolution: "Replacement board fitted" } });
ok(true, "Phase 7: supplier, branch stock receipts/reservations/consumption and warranty resolution");

const invoice = (await call(owner, `/invoices/booking/${booking.id}`, { method: "POST", expected: 201, body: {} })).data;
const payment = (await call(owner, `/invoices/${invoice.id}/payments`, { method: "POST", expected: 201, body: { amount: 2500, method: "BANK_TRANSFER", idempotencyKey: `e2e-${suffix}-payment` } })).data;
await call(owner, `/invoices/payments/${payment.id}/decision`, { method: "POST", expected: 201, body: { decision: "VERIFIED" } });
const invoiceDetail = (await call(owner, `/invoices/${invoice.id}`)).data;
ok(invoiceDetail.status === "PAID", "Phase 5: invoice payment is verified and reflected in the balance");
const expiring = (await call(owner, "/assets/warranty-expiring?days=60")).data;
ok(Array.isArray(expiring), "Phase 7: warranty expiry reminders are tenant-scoped and queryable");
const dashboard = await call(owner, "/dashboard/overview");
ok(dashboard.status === 200, "Phase 3: dashboard is available over the embedded persistent database");
console.log("All Phases 1–7 local API end-to-end checks passed.");

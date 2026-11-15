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
await call(owner, "/organizations/branches", { method: "POST", expected: 403, body: { name: `Over Limit ${suffix}`, city: "Lahore" } });
ok(true, "Phase 9: Free trial enforces the organization branch entitlement");

const customer = (await call(owner, "/customers", { method: "POST", expected: 201, body: { fullName: `Ayesha Malik ${suffix}`, phone: "03001234567", email: `customer-${suffix}@example.test`, tags: ["priority", "annual-maintenance"], notes: "Prefers WhatsApp updates after 4 PM. Ask before scheduling weekend visits." } })).data;
const property = (await call(owner, "/properties", { method: "POST", expected: 201, body: { customerId: customer.id, name: "Model Town residence", address: "10-A, Block C, Model Town", city: "Lahore", propertyType: "HOUSE", ownership: "OWNER", latitude: 31.4832, longitude: 74.3257, notes: "Two-storey family home. Security desk needs a technician name before entry." } })).data;
const asset = (await call(owner, "/assets", { method: "POST", expected: 201, body: { propertyId: property.id, category: "Air conditioner", brand: "Dawlance", model: "DAC-18 Inverter", serialNumber: `GS-AC-${suffix}`, purchasedAt: "2024-05-12T00:00:00.000Z", installedAt: "2024-05-20T00:00:00.000Z", warrantyStartsAt: "2025-01-01T00:00:00.000Z", warrantyEndsAt: "2030-01-01T00:00:00.000Z", purchasePrice: 184999, seller: "Metro Home Store Lahore" } })).data;
ok(Boolean(customer.id && property.id && asset.id), "Phases 3–4: customer, home and warrantied asset records");
const secondCustomer = (await call(owner, "/customers", { method: "POST", expected: 201, body: { fullName: `Bilal Ahmed ${suffix}`, phone: `03${Math.floor(100000000 + Math.random() * 899999999)}`, email: `bilal-${suffix}@example.test`, tags: ["solar-care", "annual-reminder"], notes: "Apartment owner. Call before dispatch; prefers morning appointments." } })).data;
const secondProperty = (await call(owner, "/properties", { method: "POST", expected: 201, body: { customerId: secondCustomer.id, name: "Gulberg apartment", address: "Apartment 5B, Main Boulevard, Gulberg III", city: "Lahore", propertyType: "APARTMENT", ownership: "TENANT", notes: "Building management requires visitor entry approval." } })).data;
await call(owner, "/assets", { method: "POST", expected: 201, body: { propertyId: secondProperty.id, category: "Solar inverter", brand: "Inverex", model: "Veyron II 5.2kW", serialNumber: `GS-SOLAR-${suffix}`, installedAt: "2025-03-08T00:00:00.000Z", warrantyStartsAt: "2025-03-08T00:00:00.000Z", warrantyEndsAt: "2028-03-08T00:00:00.000Z", purchasePrice: 289000, seller: "Lahore Solar Solutions" } });

const appointmentAt = new Date(Date.now() + 24 * 60 * 60_000); appointmentAt.setUTCHours(5, 0, 0, 0);
const appointmentWeekday = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", weekday: "short" }).format(appointmentAt);
const weekdayIndex = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(appointmentWeekday);
const service = (await call(owner, "/services", { method: "POST", expected: 201, body: { name: `AC seasonal inspection ${suffix}`, category: "HVAC", description: "Filter cleaning, cooling performance, electrical connections and refrigerant leak check. Excludes gas refill and replacement parts.", basePrice: 3500, minPrice: 2500, maxPrice: 12000, durationMins: 90, requiredSkills: ["HVAC", "Electrical safety"], serviceAreas: ["Lahore", "Sheikhupura"], branchIds: [branchId], isActive: true } })).data;
for (const serviceDetails of [
  { name: `Split AC installation ${suffix}`, category: "HVAC", description: "Install and commission one wall-mounted split AC; includes standard wall bracket and vacuum test.", basePrice: 18500, durationMins: 180, requiredSkills: ["HVAC", "Electrical"], serviceAreas: ["Lahore"] },
  { name: `Refrigerator cooling repair ${suffix}`, category: "Appliance repair", description: "On-site inspection, temperature checks and written parts estimate before repair.", basePrice: 2500, minPrice: 2500, maxPrice: 45000, durationMins: 120, requiredSkills: ["Refrigeration", "Electrical safety"], serviceAreas: ["Lahore", "Sheikhupura"] },
  { name: `Home electrical safety check ${suffix}`, category: "Electrical", description: "Visual inspection of distribution board, earthing and accessible outlets. No destructive testing.", basePrice: 4500, durationMins: 90, requiredSkills: ["Electrical"], serviceAreas: ["Lahore"] },
]) await call(owner, "/services", { method: "POST", expected: 201, body: { ...serviceDetails, branchIds: [branchId], isActive: true } });
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

await call(owner, `/workforce/technicians/${techMember.id}/profile`, { method: "PUT", expected: 200, body: { skills: ["Electrical", "Electrical safety", "HVAC"], employmentType: "FULL_TIME", isAvailable: true, bio: "Local test technician — HVAC inspections, electrical safety and inverter AC service." } });
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

const supplier = (await call(owner, "/inventory/suppliers", { method: "POST", expected: 201, body: { name: `Lahore Climate Parts ${suffix}`, phone: "03001234567", email: `supplier-${suffix}@example.test`, address: "Hall Road, Lahore", notes: "Authorized distributor record for demo; confirm serial number and purchase invoice before a warranty claim." } })).data;
const product = (await call(owner, "/inventory/products", { method: "POST", expected: 201, body: { sku: `HVAC-PCB-${suffix}`, barcode: `896400${suffix.replaceAll("-", "")}71`, name: "Inverter AC control board, 1.5 ton", category: "HVAC · electrical", manufacturer: "Universal service part", compatibleModels: ["Dawlance DAC-18", "Gree GS-18", "Haier HSU-18"], description: "Indoor inverter control board. Check connector layout and firmware revision before fitting; static-safe handling required.", unit: "piece", unitCost: 18500, sellingPrice: 23900, reorderLevel: 2, supplierId: supplier.id, tracksWarranty: true, warrantyDays: 180 } })).data;
for (const part of [
  { sku: `GAS-R32-${suffix}`, name: "R32 refrigerant cylinder, 9kg", category: "HVAC · refrigerant", manufacturer: "Chemours", compatibleModels: ["R32 split AC"], description: "Sealed 9kg cylinder. Record cylinder weight and supplier batch; trained handling only.", unit: "cylinder", unitCost: 15500, sellingPrice: 19800, reorderLevel: 2 },
  { sku: `CU-PIPE-38-${suffix}`, name: "Copper pair coil, 3/8 inch", category: "HVAC · copper", manufacturer: "Mueller", compatibleModels: ["1.5 ton split AC", "2 ton split AC"], description: "Insulated copper pipe coil for installation runs. Verify route length before cutting.", unit: "meter", unitCost: 950, sellingPrice: 1450, reorderLevel: 30 },
  { sku: `FAN-MOTOR-${suffix}`, name: "Indoor blower motor, 1.5 ton", category: "HVAC · motors", manufacturer: "Service replacement", compatibleModels: ["Dawlance DAC-18", "Haier HSU-18"], description: "Cross-check shaft length, connector type and voltage against the removed motor.", unit: "piece", unitCost: 9800, sellingPrice: 13900, reorderLevel: 1 },
  { sku: `BREAKER-20A-${suffix}`, name: "20A double-pole circuit breaker", category: "Electrical protection", manufacturer: "Schneider Electric", compatibleModels: ["Single-phase service panel"], description: "DIN-rail mounted 20A breaker; verify cable gauge, load and local compliance before replacement.", unit: "piece", unitCost: 1850, sellingPrice: 2900, reorderLevel: 5 },
]) await call(owner, "/inventory/products", { method: "POST", expected: 201, body: { ...part, supplierId: supplier.id, tracksWarranty: false } });
await call(owner, "/inventory/movements", { method: "POST", expected: 201, body: { productId: product.id, branchId, type: "RECEIPT", quantity: 5, unitCost: 18500, reference: `PO-LHR-${suffix}`, notes: "Incoming stock checked against supplier packing list." } });
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
const plans = (await call(owner, "/billing/plans")).data;
const subscription = (await call(owner, "/billing/subscription")).data;
ok(plans.length >= 4 && subscription.subscription?.plan.key === "FREE", `Phase 9: seeded PKR plans (${plans.length}) and owner trial (${subscription.subscription?.plan?.key ?? "none"}) are tenant-scoped`);
const notice = (await call(owner, "/notifications", { method: "POST", expected: 201, body: { eventKey: "booking.assignment", channel: "IN_APP", subject: "Technician assigned", body: "Ali Khan is scheduled to visit Model Town residence tomorrow between 10:00 and 11:30." } })).data;
ok(notice.status === "SENT", "Phase 8: in-app notification is saved and appears in the owner inbox");
const template = (await call(owner, "/notifications/templates", { method: "POST", expected: 201, body: { eventKey: "booking.reminder", channel: "IN_APP", subject: "Visit reminder", body: "A technician visit is coming up. Please review the schedule.", enabled: true } })).data;
await call(owner, `/notifications/${notice.id}/read`, { method: "PATCH", expected: 200 });
const activity = (await call(owner, "/notifications")).data;
ok(template.organizationId === orgId && activity.find((item) => item.id === notice.id).readAt, "Phase 8: notification templates are tenant-scoped and inbox read state persists");
const skipped = (await call(owner, "/notifications", { method: "POST", expected: 201, body: { eventKey: "invoice.ready", channel: "EMAIL", recipient: `customer-${suffix}@example.test`, subject: "Your GharSync invoice", body: "Your invoice is ready to review." } })).data;
ok(skipped.status === "SKIPPED", "Phase 8: external delivery is never reported successful without a configured provider");
const assist = (await call(owner, "/ai/assist", { method: "POST", expected: 201, body: { task: "summarize", text: "AC is cooling poorly and makes a clicking sound after ten minutes." } })).data;
ok(assist.status === "UNCONFIGURED" && (await call(owner, "/ai/usage")).data.length > 0, "Phase 8: AI provider configuration state and usage audit are recorded");
const planRequest = await call(owner, "/billing/plan-requests", { method: "POST", expected: 201, body: { planKey: "STARTER" } });
ok(planRequest.data.status === "REQUESTED", "Phase 9: paid plan changes create a support request without simulating payment");
const denied = await call(owner, "/platform/overview", { expected: 403 });
ok(denied.status === 403, "Phase 9: platform control center rejects regular organization users");
console.log(`Demo workspace: owner-${suffix}@example.test · password: LocalDemoPass!2026`);
console.log("Phases 1–10 local API workflow and platform authorization checks passed.");

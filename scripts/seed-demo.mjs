try { process.loadEnvFile(".env"); } catch (error) { if (error?.code !== "ENOENT") throw error; }
const { default: sharp } = await import("sharp");

const api = new URL(process.env.API_URL ?? "http://127.0.0.1:4000/api/v1");
if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "::1"].includes(api.hostname)) {
  throw new Error("Demo records are only allowed against a local development API. Set API_URL to localhost and NODE_ENV=development.");
}
const health = await fetch(new URL("health", `${api.href.replace(/\/$/, "")}/`));
if (!health.ok) throw new Error("Start the local API first with npm run dev:all.");

const password = process.env.DEMO_PASSWORD ?? "GharSyncDemo!2026";
const suffix = process.env.DEMO_SUFFIX ?? new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
console.log(`Demo dataset suffix: ${suffix}`);
function session() { return { cookies: new Map() }; }
async function call(client, path, { method = "GET", body, expected = 200, attempt = 0 } = {}) {
  const headers = { ...(body ? { "content-type": "application/json" } : {}) };
  if (client?.cookies.size) headers.cookie = [...client.cookies].map(([key, value]) => `${key}=${value}`).join("; ");
  const response = await fetch(`${api.href.replace(/\/$/, "")}${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (response.status === 429 && attempt < 4) {
    const retryAfter = Number(response.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 61_000;
    console.log(`Local API rate limit reached; retrying ${method} ${path} in ${Math.ceil(waitMs / 1000)} seconds.`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return call(client, path, { method, body, expected, attempt: attempt + 1 });
  }
  for (const item of response.headers.getSetCookie()) {
    const pair = item.slice(0, item.indexOf(";"));
    const split = pair.indexOf("=");
    if (split > 0) client?.cookies.set(pair.slice(0, split), pair.slice(split + 1));
  }
  const data = await response.json().catch(() => ({}));
  if (expected && response.status !== expected) throw new Error(`${method} ${path}: expected ${expected}, got ${response.status}: ${JSON.stringify(data)}`);
  return { status: response.status, data };
}

async function uploadImage(client, targetKey, targetId, fileName, imageBytes, attempt = 0) {
  const form = new FormData();
  form.set("file", new Blob([imageBytes], { type: "image/png" }), fileName);
  form.set(targetKey, targetId);
  const headers = client?.cookies.size ? { cookie: [...client.cookies].map(([key, value]) => `${key}=${value}`).join("; ") } : {};
  const response = await fetch(`${api.href.replace(/\/$/, "")}/documents`, { method: "POST", headers, body: form });
  if (response.status === 429 && attempt < 4) {
    const retryAfter = Number(response.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 61_000;
    console.log(`Local API rate limit reached; retrying image ${fileName} in ${Math.ceil(waitMs / 1000)} seconds.`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return uploadImage(client, targetKey, targetId, fileName, imageBytes, attempt + 1);
  }
  const data = await response.json().catch(() => ({}));
  if (response.status !== 201) throw new Error(`Upload ${fileName}: expected 201, got ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

async function demoImage(label, index) {
  const hue = (index * 37 + 106) % 360;
  const safe = label.replace(/[&<>]/g, "");
  const productVisuals = [
    `<rect x="220" y="267" width="192" height="130" rx="15" fill="url(#unit)" stroke="#bac8b8" stroke-width="8"/><path d="M244 289h144M244 306h144M244 323h144" stroke="#d3ded1" stroke-width="5" stroke-linecap="round"/><circle cx="382" cy="350" r="7" fill="#6f9275"/>`,
    `<rect x="262" y="240" width="132" height="166" rx="15" fill="url(#unit)" stroke="#bac8b8" stroke-width="8"/><path d="M270 322h116" stroke="#bac8b8" stroke-width="6"/><path d="M374 278v28M374 343v31" stroke="#7e9a82" stroke-width="7" stroke-linecap="round"/>`,
    `<rect x="222" y="278" width="190" height="122" rx="8" fill="#456c5c" stroke="#315642" stroke-width="8"/><path d="M258 282v114M296 282v114M334 282v114M372 282v114M225 318h184M225 358h184" stroke="#c4dbca" stroke-width="4"/><path d="M244 407h146" stroke="#748d78" stroke-width="9" stroke-linecap="round"/>`,
    `<path d="M283 247h80l26 34v111h-132V281Z" fill="url(#unit)" stroke="#bac8b8" stroke-width="8"/><circle cx="323" cy="327" r="30" fill="#dce7da" stroke="#91a891" stroke-width="7"/><path d="M323 296v62M292 327h62" stroke="#6d8971" stroke-width="6"/>`,
    `<rect x="243" y="249" width="154" height="155" rx="20" fill="url(#unit)" stroke="#bac8b8" stroke-width="8"/><circle cx="320" cy="326" r="48" fill="#d5e2d4" stroke="#83a087" stroke-width="9"/><circle cx="320" cy="326" r="27" fill="#f8faf6" stroke="#aebfae" stroke-width="5"/><circle cx="275" cy="271" r="5" fill="#769279"/>`,
    `<rect x="247" y="250" width="147" height="152" rx="16" fill="url(#unit)" stroke="#bac8b8" stroke-width="8"/><rect x="269" y="273" width="103" height="78" rx="10" fill="#c9d9ca" stroke="#92aa94" stroke-width="6"/><path d="M283 365h73" stroke="#93a994" stroke-width="6" stroke-linecap="round"/><circle cx="368" cy="369" r="6" fill="#78957b"/>`,
    `<rect x="276" y="232" width="92" height="170" rx="30" fill="url(#unit)" stroke="#bac8b8" stroke-width="8"/><path d="M292 272h60M292 296h60M292 320h60M292 344h60" stroke="#b4c5b2" stroke-width="6" stroke-linecap="round"/><circle cx="322" cy="374" r="8" fill="#6f9275"/>`,
    `<rect x="242" y="267" width="158" height="132" rx="18" fill="url(#unit)" stroke="#bac8b8" stroke-width="8"/><path d="M264 291h116" stroke="#a9bba9" stroke-width="6"/><path d="M269 316v58M289 316v58M309 316v58M329 316v58M349 316v58M369 316v58" stroke="#c3d0c1" stroke-width="6"/><circle cx="376" cy="291" r="6" fill="#77947a"/>`,
    `<path d="M320 251v77" stroke="#79927c" stroke-width="12" stroke-linecap="round"/><path d="M320 328c-62-49-87-21-63 4 19 18 46 12 63-4ZM320 328c62-49 87-21 63 4-19 18-46 12-63-4ZM320 328c-49 63-21 87 4 63 18-19 12-46-4-63ZM320 328c49 63 21 87-4 63-18-19-12-46 4-63Z" fill="#90ad91" stroke="#69876d" stroke-width="5"/><circle cx="320" cy="328" r="13" fill="#52795a"/>`,
    `<rect x="276" y="239" width="92" height="165" rx="27" fill="url(#unit)" stroke="#bac8b8" stroke-width="8"/><path d="M292 265h60M292 292h60" stroke="#c5d2c3" stroke-width="6" stroke-linecap="round"/><path d="M289 349h66" stroke="#739076" stroke-width="8" stroke-linecap="round"/><circle cx="322" cy="376" r="7" fill="#6f9275"/>`,
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520" viewBox="0 0 800 520"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#f4f6ef"/><stop offset="1" stop-color="hsl(${hue} 28% 86%)"/></linearGradient><linearGradient id="unit" x2="0" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#e8eee7"/></linearGradient></defs><rect width="800" height="520" rx="32" fill="url(#bg)"/><circle cx="676" cy="122" r="74" fill="#fff" opacity=".55"/><path d="M0 404 142 287l101 83 144-137 130 119 104-68 179 141v95H0Z" fill="#d5e0d3" opacity=".75"/><path d="M170 397V232l146-115 146 115v165" fill="#f9faf6" stroke="#8da28e" stroke-width="12" stroke-linejoin="round"/>${productVisuals[index % productVisuals.length]}<path d="M160 412h322" stroke="#748d78" stroke-width="12" stroke-linecap="round"/><rect x="64" y="54" width="206" height="38" rx="19" fill="#fff" opacity=".8"/><text x="84" y="80" font-family="Arial,sans-serif" font-size="17" font-weight="700" fill="#4f7057">GHARSYNC HOME CARE</text><text x="64" y="478" font-family="Arial,sans-serif" font-size="24" font-weight="700" fill="#345840">${safe}</text><text x="64" y="502" font-family="Arial,sans-serif" font-size="13" fill="#67806c">Demo illustration · ${String(index + 1).padStart(2,"0")}</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function account({ email, fullName, accountType = "team", organizationName, businessType, city }) {
  const client = session();
  const registered = await call(client, "/auth/register", { method: "POST", expected: 0, body: {
    accountType, fullName, email, password, phone: "03001234567",
    ...(accountType === "business" ? { organizationName, businessType, city } : {}),
  } });
  if (registered.status === 409) {
    const signedIn = await call(client, "/auth/sign-in", { method: "POST", expected: 200, body: { email, password } });
    if (signedIn.data.phoneVerificationRequired) await call(client, "/auth/phone-otp/verify", { method: "POST", expected: 200, body: { code: "123456" } });
    await new Promise((resolve) => setTimeout(resolve, 12_000));
    return client;
  }
  if (registered.status !== 201) throw new Error(`Could not create ${email}: ${JSON.stringify(registered.data)}`);
  await call(client, "/auth/phone-otp/verify", { method: "POST", expected: 200, body: { code: "123456" } });
  await new Promise((resolve) => setTimeout(resolve, 12_000));
  return client;
}

const businesses = [
  { key: "lahore-hvac", name: "Lahore Climate Care", type: "AC_REPAIR", city: "Lahore", owner: "Ayesha Malik" },
  { key: "karachi-electric", name: "Karachi Bright Electrical", type: "ELECTRICAL", city: "Karachi", owner: "Bilal Ahmed" },
  { key: "islamabad-home", name: "Capital Home Services", type: "APPLIANCE_REPAIR", city: "Islamabad", owner: "Hira Siddiqui" },
  { key: "multan-solar", name: "Multan Solar & Power", type: "SOLAR", city: "Multan", owner: "Usman Raza" },
];
const team = [
  { role: "ADMIN", title: "Operations Admin" },
  { role: "TECHNICIAN", title: "Field Technician" },
];
const people = [
  ["Sara Khan", "03001112221", "sara"], ["Hamza Iqbal", "03002223332", "hamza"], ["Noor Fatima", "03003334443", "noor"], ["Danish Ali", "03004445554", "danish"],
  ["Mahnoor Javed", "03005556665", "mahnoor"], ["Zain Abbas", "03006667776", "zain"], ["Iqra Yousaf", "03007778887", "iqra"], ["Rafay Shah", "03008889998", "rafay"],
  ["Mariam Tariq", "03009990009", "mariam"], ["Adeel Hussain", "03001010101", "adeel"],
];
const createdLogins = [];

for (const [businessIndex, business] of businesses.entries()) {
  const ownerEmail = `owner.${business.key}.${suffix}@gharsync.demo`;
  const owner = await account({ email: ownerEmail, fullName: business.owner, accountType: "business", organizationName: `${business.name} ${suffix}`, businessType: business.type, city: business.city });
  const identity = (await call(owner, "/auth/me")).data;
  const orgId = identity.currentOrganizationId;
  if (!orgId) throw new Error(`Business owner ${ownerEmail} has no workspace. Use a fresh DEMO_SUFFIX when changing demo data.`);
  const branches = (await call(owner, "/organizations/branches")).data;
  const branchId = branches[0].id;
  createdLogins.push({ email: ownerEmail, role: "OWNER", organization: business.name });
  let technicianMemberId;
  let technicianClient;

  for (const [index, role] of team.entries()) {
    const email = `${role.role.toLowerCase()}.${business.key}.${suffix}@gharsync.demo`;
    const invite = (await call(owner, `/organizations/${orgId}/invites`, { method: "POST", expected: 201, body: { email, role: role.role, branchId } })).data;
    const memberClient = await account({ email, fullName: `${people[businessIndex][0]} ${role.title}` });
    const inviteToken = new URL(invite.inviteUrl).searchParams.get("token");
    await call(memberClient, "/organizations/invites/accept", { method: "POST", expected: 200, body: { token: inviteToken } });
    await call(memberClient, `/auth/organizations/${orgId}/select`, { method: "POST", expected: 200, body: {} });
    createdLogins.push({ email, role: role.role, organization: business.name });
    if (role.role === "TECHNICIAN") {
      const members = (await call(owner, `/organizations/${orgId}/members`)).data;
      const member = members.find((item) => item.user.email === email);
      if (member) {
        technicianMemberId = member.id;
        technicianClient = memberClient;
        await call(owner, `/workforce/technicians/${member.id}/profile`, { method: "PUT", expected: 200, body: { skills: [business.type, "Customer service", "Safety inspection"], employmentType: "FULL_TIME", hourlyRate: 850, isAvailable: true, bio: `Experienced ${business.type.toLowerCase()} technician serving ${business.city}.` } });
        await call(owner, `/workforce/technicians/${member.id}/availability`, { method: "PUT", expected: 200, body: { days: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: 540, endMinute: 1020, isAvailable: true })) } });
      }
    }
  }

  const serviceDetails = [
    [`${business.type} safety inspection`, business.type, 3500, 90, "Detailed system check with written findings and safety checklist."],
    ["Repair and maintenance visit", "Maintenance", 5000, 120, "Diagnosis, customer-approved estimate and verified repair record."],
    ["Seasonal preventive service", "Preventive care", 4200, 90, "Clean, inspect and tune equipment before seasonal peak demand."],
    ["Installation and commissioning", "Installation", 12500, 180, "Professional installation, commissioning and handover checklist."],
    ["Electrical load assessment", "Electrical", 4500, 75, "Inspect distribution board, circuit load and protective devices."],
    ["Emergency callout", "Emergency repair", 8000, 90, "Priority technician visit and safe isolation of urgent faults."],
    ["Indoor unit deep cleaning", "Cleaning", 3000, 75, "Protective wash, filter cleaning and condensate drain inspection."],
    ["System performance test", "Diagnostics", 2500, 60, "Measure operating performance and share a clear condition report."],
    ["Warranty inspection visit", "Warranty", 2000, 60, "Document symptoms, serial details and evidence for warranty review."],
    ["Annual home care plan visit", "Maintenance plan", 6500, 120, "Comprehensive annual home equipment inspection and service summary."],
  ];
  const services = [];
  for (const [index, [name, category, basePrice, durationMins, description]] of serviceDetails.entries()) {
    services.push((await call(owner, "/services", { method: "POST", expected: 201, body: { name, category, description, basePrice: basePrice + businessIndex * 250, minPrice: Math.round(basePrice * 0.65), maxPrice: basePrice * 5, durationMins, requiredSkills: [business.type, ...(index === 0 ? ["Safety inspection"] : [])], serviceAreas: [business.city], branchIds: [branchId], isActive: true } })).data);
  }

  const customers = [];
  const properties = [];
  const assets = [];
  for (const [customerIndex, person] of people.entries()) {
    const [name, phone, handle] = person;
    const customer = (await call(owner, "/customers", { method: "POST", expected: 201, body: {
      fullName: `${name} ${suffix}`, phone, email: `${handle}.${business.key}.${suffix}@example.test`,
      tags: customerIndex === 0 ? ["priority", "annual-maintenance"] : ["residential", "demo"],
      notes: `Demo customer ${customerIndex + 1}. ${customerIndex % 2 ? "Prefers morning visits; call before dispatch." : "Prefers WhatsApp updates and a written estimate."}`,
    } })).data;
    customers.push(customer);
    const property = (await call(owner, "/properties", { method: "POST", expected: 201, body: {
      customerId: customer.id, name: `${business.city} ${["family home", "apartment", "shop", "office", "townhouse", "clinic", "studio", "warehouse", "guest house", "duplex"][customerIndex]}`,
      address: `${12 + customerIndex}-A, ${["Model Town", "Gulberg", "F-10", "Cantt", "DHA Phase 5", "Johar Town", "Bahria Town", "Satellite Town", "Garden", "Clifton"][customerIndex]}, ${business.city}`,
      city: business.city, propertyType: ["HOUSE", "APARTMENT", "COMMERCIAL", "OTHER"][customerIndex % 4],
      ownership: customerIndex % 2 ? "TENANT" : "OWNER", notes: "Gate access details confirmed by customer. Ask before entering service areas.",
    } })).data;
    properties.push(property);
    const assetDetails = [
      ["Air conditioner", "Dawlance", "Inverter 1.5 ton"], ["Refrigerator", "Haier", "No Frost 14 cu ft"], ["Solar inverter", "Inverex", "5.2kW Hybrid"], ["Water pump", "PEL", "1HP Booster"],
      ["Washing machine", "Samsung", "EcoBubble 8kg"], ["Microwave oven", "Kenwood", "MWL-28"], ["Water purifier", "Aquafresh", "RO-7 Stage"], ["Standby generator", "Jasco", "5.5kVA Silent"], ["Ceiling fan", "Pak Fan", "Energy Saver 56 inch"], ["Instant water heater", "Super Asia", "10L Gas Geyser"],
    ][customerIndex];
    const asset = (await call(owner, "/assets", { method: "POST", expected: 201, body: {
      propertyId: property.id, category: assetDetails[0], brand: assetDetails[1], model: assetDetails[2],
      serialNumber: `GS-${business.key}-${customerIndex + 1}-${suffix}`, installedAt: "2025-01-15T00:00:00.000Z",
      warrantyStartsAt: "2025-01-15T00:00:00.000Z", warrantyEndsAt: "2028-01-15T00:00:00.000Z", purchasePrice: 85000 + customerIndex * 22000,
      seller: `${business.city} Home Appliances`,
    } })).data;
    assets.push(asset);
    const imageBytes = await demoImage(assetDetails[0], customerIndex + businessIndex * 10);
    await uploadImage(owner, "customerId", customer.id, `${handle}-customer-profile.png`, imageBytes);
    await uploadImage(owner, "propertyId", property.id, `${handle}-property-cover.png`, imageBytes);
    await uploadImage(owner, "assetId", asset.id, `${handle}-${assetDetails[0].toLowerCase().replaceAll(" ", "-")}.png`, imageBytes);
  }

  const supplier = (await call(owner, "/inventory/suppliers", { method: "POST", expected: 201, body: { name: `${business.city} Home Parts Supply`, phone: "03001234567", email: `supply.${business.key}.${suffix}@example.test`, address: `Industrial Estate, ${business.city}`, notes: "Demo supplier. Verify invoice and part serial before making warranty claims." } })).data;
  const products = [];
  const parts = [
    ["AC-CTRL", "Inverter AC control board", "Electrical parts", "Universal", "piece", 16500, 22500, 2],
    ["R32-GAS", "R32 refrigerant cylinder 9kg", "Refrigerant", "Chemours", "cylinder", 14500, 18500, 1],
    ["CU-PIPE", "Insulated copper pair coil", "Copper and fittings", "Mueller", "meter", 850, 1300, 20],
    ["FAN-MOTOR", "Indoor blower motor 1.5 ton", "Motors", "Dawlance compatible", "piece", 8900, 13200, 2],
    ["CAP-45UF", "45uF compressor capacitor", "Electrical parts", "Ducati Energia", "piece", 950, 1600, 5],
    ["BREAKER-20", "20A double-pole breaker", "Electrical protection", "Schneider Electric", "piece", 1700, 2600, 4],
    ["FILTER-AC", "Washable split AC filter set", "Air filtration", "Universal", "set", 650, 1100, 8],
    ["PUMP-1HP", "1HP booster pump seal kit", "Pump spares", "PEL compatible", "set", 2200, 3400, 3],
    ["RO-MEMBRANE", "RO membrane 75GPD", "Water filtration", "AquaPro", "piece", 3800, 5500, 4],
    ["THERMOSTAT", "Digital room thermostat", "Controls", "Honeywell compatible", "piece", 4900, 7200, 2],
  ];
  for (const [index, [sku, name, category, manufacturer, unit, unitCost, sellingPrice, reorderLevel]] of parts.entries()) {
    const product = (await call(owner, "/inventory/products", { method: "POST", expected: 201, body: { sku: `${sku}-${business.key}-${suffix}`, name, category, manufacturer, compatibleModels: ["Residential service equipment", "Inverter systems"], description: `${name}. Match model and rating before installation; record the part used on the job card.`, unit, unitCost, sellingPrice, reorderLevel, supplierId: supplier.id, tracksWarranty: index === 0 || index === 3, warrantyDays: index === 0 || index === 3 ? 180 : undefined } })).data;
    products.push(product);
    await call(owner, "/inventory/movements", { method: "POST", expected: 201, body: { productId: product.id, branchId, type: "RECEIPT", quantity: 10 + index, unitCost, reference: `PO-${business.key}-${index + 1}-${suffix}`, notes: "Received and checked against supplier delivery note." } });
  }

  for (const [index, asset] of assets.entries()) {
    const claim = (await call(owner, "/warranty-claims", { method: "POST", expected: 201, body: { assetId: asset.id, productId: products[index].id, supplierId: supplier.id, issue: `${asset.category} shows intermittent performance faults; inspection notes and serial number recorded.` } })).data;
    await call(owner, `/warranty-claims/${claim.id}`, { method: "PATCH", expected: 200, body: { status: "SUBMITTED" } });
    await call(owner, `/warranty-claims/${claim.id}`, { method: "PATCH", expected: 200, body: { status: "APPROVED" } });
    await call(owner, `/warranty-claims/${claim.id}`, { method: "PATCH", expected: 200, body: { status: "RESOLVED", resolution: "Supplier inspection completed; replacement part approved and logged." } });
  }

  for (let index = 0; index < 10; index += 1) {
    const customer = customers[index];
    const service = services[index];
    const booking = (await call(owner, "/bookings", { method: "POST", expected: 201, body: { customerId: customer.id, propertyId: properties[index].id, assetId: assets[index].id, serviceId: service.id, branchId, urgency: ["NORMAL", "LOW", "HIGH", "NORMAL", "EMERGENCY"][index % 5], preferredAt: new Date(Date.now() + (index + 2) * 86_400_000).toISOString(), description: `${service.name} for ${assets[index].category}. Customer has confirmed access and requests a written service summary.` } })).data;
    const photo = await demoImage(assets[index].category, index + businessIndex * 10);
    await uploadImage(owner, "bookingId", booking.id, `visit-${index + 1}-site-photo.png`, photo);
    await call(owner, `/bookings/${booking.id}/transition`, { method: "POST", expected: 201, body: { status: "UNDER_REVIEW", note: "Customer details and property access reviewed." } });
    const quote = (await call(owner, `/bookings/${booking.id}/quotes`, { method: "POST", expected: 201, body: { items: [{ description: service.name, quantity: 1, unitPrice: Number(service.basePrice) }], discount: 0, tax: 0, notes: "Includes diagnosis and standard labor. Replacement parts require customer approval." } })).data;
    await call(owner, `/quotes/${quote.id}/send`, { method: "POST", expected: 201 });
    await call(owner, `/quotes/${quote.id}/decision`, { method: "POST", expected: 201, body: { decision: "ACCEPTED", note: "Customer approved the written estimate." } });
    const appointment = new Date(Date.now() + (index + 2) * 86_400_000);
    appointment.setUTCHours(5, 0, 0, 0);
    await call(owner, `/bookings/${booking.id}/transition`, { method: "POST", expected: 201, body: { status: "SCHEDULED", scheduledAt: appointment.toISOString() } });
    await call(owner, `/bookings/${booking.id}/transition`, { method: "POST", expected: 201, body: { status: "ASSIGNED", scheduledAt: appointment.toISOString(), assignedMemberId: technicianMemberId } });
    await call(technicianClient, `/bookings/${booking.id}/work-status`, { method: "POST", expected: 201, body: { status: "TECHNICIAN_EN_ROUTE", note: "Technician is on the way." } });
    await call(technicianClient, `/bookings/${booking.id}/work-status`, { method: "POST", expected: 201, body: { status: "IN_PROGRESS", note: "Arrival confirmed; inspection checklist started." } });
    await call(technicianClient, `/bookings/${booking.id}/work-status`, { method: "POST", expected: 201, body: { status: "COMPLETED", note: "Service complete; work area cleaned and customer briefed." } });
    const invoice = (await call(owner, `/invoices/booking/${booking.id}`, { method: "POST", expected: 201, body: { dueAt: new Date(Date.now() + 14 * 86_400_000).toISOString() } })).data;
    const payment = (await call(owner, `/invoices/${invoice.id}/payments`, { method: "POST", expected: 201, body: { amount: Number(service.basePrice), method: "BANK_TRANSFER", reference: `DEMO-${business.key}-${index + 1}`, idempotencyKey: `demo-${business.key}-${suffix}-${index + 1}`, note: "Demo payment record. No real funds were moved." } })).data;
    await call(owner, `/invoices/payments/${payment.id}/decision`, { method: "POST", expected: 201, body: { decision: "VERIFIED", note: "Demo bank transfer reviewed." } });
    await call(owner, "/notifications", { method: "POST", expected: 201, body: { eventKey: `demo.booking.${index + 1}`, channel: "IN_APP", subject: `Service visit ${index + 1} complete`, body: `${service.name} at ${properties[index].name} has been completed. Invoice ${invoice.invoiceNumber} is ready.` } });
  }

  await call(owner, "/notifications/templates", { method: "POST", expected: 201, body: { eventKey: "demo.service.followup", channel: "IN_APP", subject: "How did the visit go?", body: "Thank you for choosing our team. Reply to this message if you need a follow-up visit.", enabled: true } });
  await call(owner, "/billing/plan-requests", { method: "POST", expected: 201, body: { planKey: "STARTER" } });

  console.log(`Seeded ${business.name}: 10 customers, homes/assets with photos, 10 services, 10 completed bookings, quotes/invoices/payments, 10 stocked parts, 10 warranty claims and 10 notifications.`);
}

console.log(`\nDemo password for every account: ${password}`);
console.log("Demo accounts:");
for (const login of createdLogins) console.log(`${login.email} | ${login.role} | ${login.organization}`);
console.log("All accounts are local demo identities. Set DEMO_SUFFIX to a new value to create a separate dataset.");

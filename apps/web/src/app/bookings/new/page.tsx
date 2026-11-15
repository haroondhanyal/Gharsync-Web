import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { BookingForm } from "@/components/booking-form";
import { serverApi } from "@/lib/server-api";
import { redirect } from "next/navigation";

type Me = { fullName: string; email: string; currentOrganizationId: string; memberships: { role: string; branchId: string | null; organization: { id: string; name: string } }[] };
type Customer = { id: string; fullName: string; phone: string };
type Property = { id: string; customerId: string; name: string; address: string; city: string };
type Asset = { id: string; propertyId: string; category: string; brand: string | null; model: string | null };
type Service = { id: string; name: string; category: string; branchLinks: { branchId: string }[] };
type Branch = { id: string; name: string };
export default async function NewBookingPage() { const user = await serverApi<Me>("/auth/me"); const membership = user.memberships.find((item) => item.organization.id === user.currentOrganizationId); if (!["OWNER", "ADMIN", "MANAGER", "STAFF"].includes(membership?.role ?? "")) redirect("/bookings"); const [customers, properties, assets, services, branches] = await Promise.all([serverApi<{ data: Customer[] }>("/customers?page=1&pageSize=100"), serverApi<Property[]>("/properties"), serverApi<Asset[]>("/assets"), serverApi<Service[]>("/services"), serverApi<Branch[]>("/organizations/branches")]); return <AppFrame user={user} organizationId={user.currentOrganizationId} active="/bookings"><div className="page-heading"><div><Link href="/bookings" className="back-link-inline"><ArrowLeft size={14}/> Bookings</Link><h1>Create a service booking</h1><p>Start a trackable request for a customer, property or asset.</p></div></div><section className="panel customer-editor"><BookingForm customers={customers.data} properties={properties} assets={assets} services={services} branches={branches} branchId={membership?.branchId ?? undefined}/></section></AppFrame>; }

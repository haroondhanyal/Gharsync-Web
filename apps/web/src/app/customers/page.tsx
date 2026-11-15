import Link from "next/link";
import { ArrowLeft, ArrowRight, ContactRound, Plus, Search, UsersRound } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { serverApi } from "@/lib/server-api";
import { redirect } from "next/navigation";

type Me = { fullName: string; email: string; currentOrganizationId: string; memberships: { role: string; organization: { id: string; name: string } }[] };
type CustomerRow = { id: string; fullName: string; phone: string; email: string | null; tags: string[]; isActive: boolean; createdAt: string; addresses: { address: string; city: string }[]; _count: { bookings: number } };
type CustomerResult = { data: CustomerRow[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };
type SearchParams = Promise<{ q?: string; page?: string; status?: string }>;

export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = params.status === "archived" || params.status === "all" ? params.status : "active";
  const page = Math.max(1, Number(params.page) || 1);
  const query = new URLSearchParams({ status, page: String(page), pageSize: "25" });
  if (q) query.set("q", q);
  const user = await serverApi<Me>("/auth/me");
  const role = user.memberships.find((item) => item.organization.id === user.currentOrganizationId)?.role;
  if (!["OWNER", "ADMIN", "MANAGER", "STAFF"].includes(role ?? "")) redirect("/dashboard");
  const canCreate = ["OWNER", "ADMIN", "MANAGER"].includes(role ?? "");
  const result = await serverApi<CustomerResult>(`/customers?${query.toString()}`);
  const pageLink = (next: number) => `/customers?${new URLSearchParams({ ...(q ? { q } : {}), status, page: String(next) }).toString()}`;
  return <AppFrame user={user} organizationId={user.currentOrganizationId} active="/customers">
    <div className="page-heading"><div><div className="eyebrow">CUSTOMER RELATIONSHIPS</div><h1>Customers</h1><p>Keep customer details and service history close to your team.</p></div>{canCreate && <Link href="/customers/new" className="button button-dark"><Plus size={16}/> Add customer</Link>}</div>
    <section className="directory-panel panel">
      <div className="directory-toolbar"><div className="directory-count"><span className="directory-icon"><ContactRound size={17}/></span><div><b>{result.pagination.total.toLocaleString()} {status === "archived" ? "archived" : "active"} {result.pagination.total === 1 ? "customer" : "customers"}</b><small>Records in this organization</small></div></div><form className="customer-search" action="/customers"><input type="hidden" name="status" value={status}/><Search size={16}/><input name="q" defaultValue={q} placeholder="Search name, phone or email" aria-label="Search customers"/><button type="submit">Search</button></form></div>
      <div className="directory-tabs"><Link className={status === "active" ? "selected" : ""} href={`/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`}>Active</Link><Link className={status === "archived" ? "selected" : ""} href={`/customers?status=archived${q ? `&q=${encodeURIComponent(q)}` : ""}`}>Archived</Link><Link className={status === "all" ? "selected" : ""} href={`/customers?status=all${q ? `&q=${encodeURIComponent(q)}` : ""}`}>All</Link></div>
      {result.data.length ? <>
        <div className="customer-table-wrap"><table className="customer-table"><thead><tr><th>Customer</th><th>Phone</th><th>Location</th><th>Service visits</th><th>Added</th><th><span className="sr-only">Open record</span></th></tr></thead><tbody>{result.data.map((customer) => <tr key={customer.id}><td><Link className="table-customer" href={`/customers/${customer.id}`}><span className="customer-avatar">{customer.fullName.slice(0,1).toUpperCase()}</span><span><b>{customer.fullName}</b><small>{customer.email || customer.tags.slice(0,2).join(" · ") || "Customer profile"}</small></span></Link></td><td>{customer.phone}</td><td>{customer.addresses[0] ? <span>{customer.addresses[0].city}<small className="table-subline">{customer.addresses[0].address}</small></span> : <span className="muted-value">Not added</span>}</td><td><span className="visit-count">{customer._count.bookings}</span></td><td>{new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(customer.createdAt))}</td><td><Link className="table-open" href={`/customers/${customer.id}`} aria-label={`Open ${customer.fullName}`}><ArrowRight size={15}/></Link></td></tr>)}</tbody></table></div>
        <div className="pagination-bar"><span>Showing {(result.pagination.page - 1) * result.pagination.pageSize + 1}–{Math.min(result.pagination.page * result.pagination.pageSize, result.pagination.total)} of {result.pagination.total}</span><div>{result.pagination.page > 1 && <Link className="page-button" href={pageLink(result.pagination.page - 1)}><ArrowLeft size={14}/> Previous</Link>}{result.pagination.page < result.pagination.totalPages && <Link className="page-button" href={pageLink(result.pagination.page + 1)}>Next <ArrowRight size={14}/></Link>}</div></div>
      </> : <div className="directory-empty"><span><UsersRound size={22}/></span><b>{q ? "No matching customers" : status === "archived" ? "No archived customers" : "Your customer list starts here"}</b><p>{q ? "Try another name, phone number or email address." : "Add your first customer to keep their details and service history organized."}</p>{!q && status !== "archived" && canCreate && <Link href="/customers/new" className="button button-dark"><Plus size={15}/> Add first customer</Link>}</div>}
    </section>
  </AppFrame>;
}

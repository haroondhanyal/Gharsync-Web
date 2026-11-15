import Link from "next/link";
import { ArrowDownRight, ArrowRight, CalendarDays, CircleDollarSign, ContactRound, ListTodo, Plus, Repeat2, Wrench } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { serverApi } from "@/lib/server-api";

type User = { id: string; fullName: string; email: string; memberships: { role: string; organization: { id: string; name: string } }[] };
type Overview = {
  organization: { id: string; name: string; currency: string; timezone: string };
  generatedAt: string;
  metrics: {
    totalCustomers: number; newCustomersThisMonth: number; repeatCustomers: number; totalBookings: number;
    activeRequests: number; pendingBookings: number; inProgressBookings: number; completedBookings: number;
    cancelledBookings: number; disputedBookings: number; todaysBookings: number;
    revenue: number | null; outstandingBalance: number | null; technicianPerformance: number | null;
    customerSatisfaction: number | null; warrantyCases: number | null; inventoryAlerts: number | null;
  };
  bookingStatusCounts: { status: string; count: number }[];
  recentCustomers: { id: string; fullName: string; phone: string; createdAt: string }[];
  recentBookings: { id: string; status: string; createdAt: string; scheduledAt: string | null; customer: { id: string; fullName: string }; service: { name: string } | null }[];
};

function metricIcon(icon: "customers" | "jobs" | "today" | "repeat") {
  if (icon === "customers") return <ContactRound size={17}/>;
  if (icon === "jobs") return <ListTodo size={17}/>;
  if (icon === "today") return <CalendarDays size={17}/>;
  return <Repeat2 size={17}/>;
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function DashboardPage() {
  const [user, overview] = await Promise.all([serverApi<User>("/auth/me"), serverApi<Overview>("/dashboard/overview")]);
  const activeOrg = overview.organization.id;
  const stats = [
    { title: "Total customers", value: overview.metrics.totalCustomers.toLocaleString(), sub: `+${overview.metrics.newCustomersThisMonth} this month`, icon: "customers" as const, tone: "mint" },
    { title: "Active requests", value: overview.metrics.activeRequests.toLocaleString(), sub: `${overview.metrics.pendingBookings} waiting · ${overview.metrics.inProgressBookings} in progress`, icon: "jobs" as const, tone: "blue" },
    { title: "Today's bookings", value: overview.metrics.todaysBookings.toLocaleString(), sub: "Scheduled for today", icon: "today" as const, tone: "sand" },
    { title: "Repeat customers", value: overview.metrics.repeatCustomers.toLocaleString(), sub: "More than one booking", icon: "repeat" as const, tone: "lavender" },
  ];
  const maxStatusCount = Math.max(1, ...overview.bookingStatusCounts.map((item) => item.count));
  return <AppFrame user={user} organizationId={activeOrg ?? ""} active="/dashboard">
    <div className="dashboard-heading"><div><div className="eyebrow">YOUR BUSINESS AT A GLANCE</div><h1>Good day, {user.fullName.split(" ")[0]}.</h1><p>Here's what's happening across {overview.organization.name}.</p></div><div className="quick-actions"><Link className="button button-outline" href="/customers"><ContactRound size={15}/> View customers</Link><Link className="button button-dark" href="/customers/new"><Plus size={16}/> Add customer</Link></div></div>
    <section className="stat-grid" aria-label="Business metrics">{stats.map((stat) => <article className="stat-card" key={stat.title}><div className={`stat-icon ${stat.tone}`}>{metricIcon(stat.icon)}</div><span className="stat-title">{stat.title}</span><strong>{stat.value}</strong><small>{stat.sub}</small></article>)}</section>
    <section className="dashboard-columns">
      <article className="panel booking-panel"><div className="panel-heading"><div><span className="panel-kicker">SERVICE OPERATIONS</span><h2>Booking activity</h2></div><Link href="/customers" className="subtle-link">Customer directory <ArrowRight size={14}/></Link></div><p className="panel-description">Live booking counts for your selected organization and branch.</p>
        {overview.bookingStatusCounts.length ? <div className="status-chart">{overview.bookingStatusCounts.map((item) => <div className="status-row" key={item.status}><span>{statusLabel(item.status)}</span><div className="status-track"><i style={{ width: `${Math.max(4, item.count / maxStatusCount * 100)}%` }}/></div><b>{item.count}</b></div>)}</div> : <div className="empty-state"><span className="empty-state-icon"><Wrench size={18}/></span><b>No service bookings yet</b><p>Booking totals will appear here when your team starts receiving jobs.</p></div>}
        <div className="panel-footer-stats"><span><i className="legend-dot pending"/>Pending <b>{overview.metrics.pendingBookings}</b></span><span><i className="legend-dot running"/>In progress <b>{overview.metrics.inProgressBookings}</b></span><span><i className="legend-dot done"/>Completed <b>{overview.metrics.completedBookings}</b></span></div>
      </article>
      <article className="panel revenue-panel"><div className="panel-heading"><div><span className="panel-kicker">BUSINESS HEALTH</span><h2>Revenue & payments</h2></div><Link className="subtle-link" href="/invoices">Invoices <ArrowRight size={14}/></Link></div><div className="revenue-metrics"><div><span>Collected this month</span><b>{new Intl.NumberFormat("en-PK", { style: "currency", currency: overview.organization.currency, maximumFractionDigits: 0 }).format(overview.metrics.revenue ?? 0)}</b></div><div><span>Outstanding balance</span><b>{new Intl.NumberFormat("en-PK", { style: "currency", currency: overview.organization.currency, maximumFractionDigits: 0 }).format(overview.metrics.outstandingBalance ?? 0)}</b></div></div><p className="revenue-currency">Only verified payments count as collected · {overview.organization.currency}</p></article>
    </section>
    <section className="dashboard-columns bottom-panels">
      <article className="panel recent-panel"><div className="panel-heading"><div><span className="panel-kicker">CUSTOMER RELATIONSHIPS</span><h2>Recently added</h2></div><Link href="/customers" className="subtle-link">See all <ArrowRight size={14}/></Link></div>
        {overview.recentCustomers.length ? <div className="recent-list">{overview.recentCustomers.map((customer) => <Link href={`/customers/${customer.id}`} className="recent-customer" key={customer.id}><span className="customer-avatar">{customer.fullName.trim().slice(0,1).toUpperCase()}</span><span className="recent-customer-copy"><b>{customer.fullName}</b><small>{customer.phone}</small></span><time>{new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short" }).format(new Date(customer.createdAt))}</time></Link>)}</div> : <div className="empty-state compact"><b>No customers added yet</b><p>Your customer list will show here as your team grows.</p><Link className="text-link" href="/customers/new">Add first customer <ArrowRight size={14}/></Link></div>}
      </article>
      <article className="panel recent-panel"><div className="panel-heading"><div><span className="panel-kicker">FIELD SERVICE</span><h2>Recent bookings</h2></div><span className="recent-total">{overview.metrics.totalBookings} total</span></div>
        {overview.recentBookings.length ? <div className="recent-list">{overview.recentBookings.slice(0,5).map((booking) => <div className="recent-customer" key={booking.id}><span className="booking-status-dot"/><span className="recent-customer-copy"><b>{booking.service?.name ?? "Service request"}</b><small>{booking.customer.fullName} · {statusLabel(booking.status)}</small></span><time>{new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short" }).format(new Date(booking.createdAt))}</time></div>)}</div> : <div className="empty-state compact"><b>No bookings to show</b><p>New requests and updates will appear here.</p></div>}
      </article>
    </section>
    <div className="data-refresh-note"><ArrowDownRight size={13}/> Numbers reflect live records at {new Intl.DateTimeFormat("en-PK", { hour: "numeric", minute: "2-digit", timeZone: overview.organization.timezone }).format(new Date(overview.generatedAt))}.</div>
  </AppFrame>;
}

import Link from "next/link";
import { BarChart3, Building2, ContactRound, FileText, ListTodo, Settings2, UsersRound, Wrench, CalendarClock, Boxes, ShieldCheck, Bell, Bot, CreditCard, Command, CircleHelp } from "lucide-react";
import { Brand } from "@/components/brand";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { SignOutButton } from "@/components/sign-out-button";

type Membership = { organization: { id: string; name: string }; role: string };
type User = { fullName: string; email: string; avatarUrl?: string | null; memberships: Membership[] };

const navigation = [
  { href: "/dashboard", label: "Overview", icon: BarChart3 },
  { href: "/customers", label: "Customers", icon: ContactRound },
  { href: "/properties", label: "Homes & assets", icon: Building2 },
  { href: "/bookings", label: "Bookings", icon: ListTodo },
  { href: "/services", label: "Services", icon: Wrench },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/workforce", label: "Workforce", icon: CalendarClock },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/warranty", label: "Warranty", icon: ShieldCheck },
  { href: "/team", label: "Team & branches", icon: UsersRound },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/assistant", label: "AI assistant", icon: Bot },
  { href: "/help-desk", label: "Help desk chat", icon: CircleHelp },
  { href: "/billing", label: "Plans & billing", icon: CreditCard },
  { href: "/platform", label: "Platform admin", icon: Command },
];

export function AppFrame({ user, organizationId, active, children }: { user: User; organizationId: string; active: string; children: React.ReactNode }) {
  const organizations = user.memberships.map((membership) => membership.organization);
  const selected = organizations.find((organization) => organization.id === organizationId);
  const role = user.memberships.find((membership) => membership.organization.id === organizationId)?.role;
  const canManageTeam = role === "OWNER" || role === "ADMIN";
  const canManageBilling = ["OWNER", "ADMIN", "MANAGER"].includes(role ?? "");
  const platformAdmins = (process.env.PLATFORM_ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  const visibleNavigation = navigation.filter((item) => (item.href !== "/team" || canManageTeam) && (item.href !== "/assistant" || canManageBilling) && (item.href !== "/billing" || canManageBilling) && (item.href !== "/platform" || platformAdmins.includes(user.email.toLowerCase())) && (role !== "TECHNICIAN" || (item.href !== "/customers" && item.href !== "/invoices" && item.href !== "/inventory" && item.href !== "/warranty")));
  return <div className="business-app">
    <aside className="app-sidebar">
      <div className="sidebar-brand"><Brand light /><span className="business-label">BUSINESS</span></div>
      <div className="sidebar-workspace"><span className="workspace-avatar">{(selected?.name ?? "G").slice(0, 1).toUpperCase()}</span><span><small>WORKSPACE</small><b>{selected?.name ?? "Your organization"}</b></span></div>
      <nav className="app-navigation" aria-label="Business navigation">
        <span className="nav-section-title">WORKSPACE</span>
        {visibleNavigation.map(({ href, label, icon: Icon }) => <Link className={active === href ? "active" : ""} href={href} key={href}><Icon size={17} /><span>{label}</span></Link>)}
        <span className="nav-section-title nav-section-lower">MANAGE</span>
        <Link className={active === "/settings/profile" ? "active" : ""} href="/settings/profile"><UsersRound size={17} /><span>My profile</span></Link>
        <Link className={active === "/settings/appearance" ? "active" : ""} href="/settings/appearance"><Settings2 size={17} /><span>Appearance</span></Link>
        {canManageTeam && <Link className={active === "/settings/branches" ? "active" : ""} href="/settings/branches"><Settings2 size={17} /><span>Branches</span></Link>}
      </nav>
      <div className="sidebar-help"><span className="help-mark">?</span><span><b>Need a hand?</b><small>Your service team workspace</small></span></div>
      <div className="sidebar-user"><Link href="/settings/profile" className="user-avatar-link" aria-label="Profile settings">{user.avatarUrl ? <img className="user-avatar-image" src={`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1"}${user.avatarUrl}`} alt=""/> : <span className="user-avatar">{user.fullName.trim().slice(0, 1).toUpperCase()}</span>}</Link><span className="user-info"><b>{user.fullName}</b><small>{user.email}</small><Link href="/settings/profile">Edit profile</Link></span><SignOutButton /></div>
    </aside>
    <section className="app-main">
      <header className="app-topbar"><div className="mobile-brand"><Brand /></div><div className="topbar-breadcrumb"><span>GharSync</span><i>/</i><b>{navigation.find((item) => item.href === active)?.label ?? "Organization"}</b></div><div className="topbar-actions"><OrganizationSwitcher organizations={organizations} selectedId={organizationId} /><span className="topbar-divider"/><span className="topbar-date">Pakistan · PKR</span></div></header>
      <main className="app-content">{children}</main>
    </section>
  </div>;
}

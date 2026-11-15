import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/customers", "/properties", "/assets", "/bookings", "/invoices", "/team", "/workforce", "/inventory", "/warranty", "/notifications", "/assistant", "/billing", "/platform", "/settings", "/onboarding", "/join"] }], sitemap: `${base.replace(/\/$/, "")}/sitemap.xml` };
}

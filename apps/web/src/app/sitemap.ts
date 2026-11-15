import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const updated = new Date();
  return ["/", "/login", "/signup", "/forgot-password", "/terms", "/privacy"].map((path) => ({ url: `${base}${path}`, lastModified: updated, changeFrequency: path === "/" ? "weekly" : "monthly", priority: path === "/" ? 1 : 0.5 }));
}

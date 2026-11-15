import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_BASE = process.env.API_INTERNAL_URL ?? "http://localhost:4000/api/v1";

export async function serverApi<T>(path: string, init: RequestInit = {}, unauthorizedPath = "/login"): Promise<T> {
  const cookieJar = await cookies();
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { cookie: cookieJar.toString(), ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (response.status === 401) redirect(unauthorizedPath);
  if (response.status === 403) redirect("/onboarding");
  if (!response.ok) throw new Error(`GharSync API request failed (${response.status}).`);
  return response.json() as Promise<T>;
}

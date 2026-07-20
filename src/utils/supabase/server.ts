import { cookies } from "next/headers";

/**
 * Server-side database client
 * Uses the local PostgreSQL database via DB_URL environment variable
 * No Supabase dependency
 */
export async function getServerSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("app_session")?.value;
  return sessionCookie
    ? JSON.parse(Buffer.from(sessionCookie, "base64").toString())
    : null;
}

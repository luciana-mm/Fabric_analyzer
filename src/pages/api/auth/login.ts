import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "@/lib/db";
import { createSessionCookie, createSessionToken, verifyPassword } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const lowerEmail = email.trim().toLowerCase();

  try {
    const userResult = await query(
      "SELECT id, email, password_hash FROM users WHERE email = $1",
      [lowerEmail],
    );

    const user = userResult.rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid login credentials" });
    }

    const profileResult = await query(
      "SELECT display_name, job_title, shift FROM profiles WHERE user_id = $1",
      [user.id],
    );
    const roleResult = await query(
      "SELECT role FROM user_roles WHERE user_id = $1",
      [user.id],
    );

    const role = roleResult.rows[0]?.role ?? null;
    const displayName = profileResult.rows[0]?.display_name ?? null;
    const sessionToken = createSessionToken(user.id);
    res.setHeader("Set-Cookie", createSessionCookie(sessionToken));
    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        role,
        display_name: displayName,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to login" });
  }
}

import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, code, email, password, role } = req.body ?? {};
  if (
    typeof name !== "string" ||
    typeof code !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof role !== "string"
  ) {
    return res.status(400).json({ error: "Name, code, email, password and role are required" });
  }

  const lowerEmail = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password.trim());

  try {
    const userInsert = await query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
      [lowerEmail, passwordHash],
    );

    const userId = userInsert.rows[0]?.id;
    if (!userId) {
      throw new Error("Failed to create user");
    }

    await query(
      `INSERT INTO profiles (user_id, display_name, employee_code, job_title, active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, employee_code = EXCLUDED.employee_code, job_title = EXCLUDED.job_title, active = EXCLUDED.active`,
      [userId, name.trim(), code.trim(), role === "gestor" ? "Gestor" : "Operador"],
    );

    await query(
      `INSERT INTO user_roles (user_id, role)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role`,
      [userId, role],
    );

    return res.status(201).json({
      user: {
        id: userId,
        email: lowerEmail,
        role,
        display_name: name.trim(),
      },
    });
  } catch (error) {
    if ((error as Error).message.includes("duplicate key value")) {
      return res.status(409).json({ error: "Email already exists" });
    }

    console.error(error);
    return res.status(500).json({ error: "Unable to create user" });
  }
}

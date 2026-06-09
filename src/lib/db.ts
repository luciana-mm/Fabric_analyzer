import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
export const pool = connectionString ? new Pool({ connectionString }) : null;

export async function query(text: string, params: Array<unknown> = []) {
  if (!pool) {
    throw new Error(
      "Missing DATABASE_URL environment variable. Configure a Postgres connection string in .env.local.",
    );
  }

  const result = await pool.query(text, params);
  return result;
}

import { query } from "@/lib/db";

const DATABASE_URL = process.env.DATABASE_URL;
export const dynamic = "force-dynamic";

type Todo = {
  id: string;
  name: string;
};

export default async function TodosPage() {
  if (!DATABASE_URL) {
    return (
      <main className="min-h-screen p-6">
        <h1 className="text-lg font-semibold mb-4">Todos</h1>
        <p className="text-sm text-slate-500">
          O banco de dados não está configurado. Defina DATABASE_URL em .env.local para habilitar esta página.
        </p>
      </main>
    );
  }

  const result = await query("SELECT id, name FROM todos ORDER BY id", []);
  const todos = result.rows as Todo[];

  return (
    <main className="min-h-screen p-6">
      <h1 className="text-lg font-semibold mb-4">Todos</h1>
      <ul className="space-y-2">
        {todos?.map((todo) => (
          <li key={todo.id}>{todo.name}</li>
        ))}
      </ul>
    </main>
  );
}

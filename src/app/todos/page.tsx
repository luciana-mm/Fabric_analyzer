import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export default async function TodosPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: todos } = await supabase.from("todos").select();

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

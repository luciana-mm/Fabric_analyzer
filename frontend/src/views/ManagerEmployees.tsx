"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Power,
  Search,
  ShieldCheck,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ManagerShell } from "@/components/ManagerShell";
import { useManagerDashboardData } from "@/hooks/useDashboardData";
import { fetchJson } from "@/lib/api-client";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Employee = {
  id: string;
  userId: string;
  name: string;
  email?: string;
  accessId?: string;
  password?: string;
  role: string;
  shift: string;
  verified: number;
  success: number;
  fails: number;
  active: boolean;
};

type StatusFilter = "all" | "active" | "inactive";
type NewEmployeeRole = "FUNCIONARIO (OPERADOR)" | "GESTOR";
type SortKey =
  | "name"
  | "shift"
  | "status"
  | "verified"
  | "success"
  | "fails"
  | "rate";
type SortDirection = "asc" | "desc";

type NewEmployeeForm = {
  name: string;
  email: string;
  accessId: string;
  password: string;
  role: NewEmployeeRole;
  shift: string;
};

const emptyNewEmployeeForm: NewEmployeeForm = {
  name: "",
  email: "",
  accessId: "",
  password: "",
  role: "FUNCIONARIO (OPERADOR)",
  shift: "Nao informado",
};

const mapDashboardRole = (role: string) =>
  role.toLowerCase().includes("gestor") ? "GESTOR" : "FUNCIONARIO (OPERADOR)";

const getSuccessRateValue = (employee: Employee) => {
  if (employee.verified === 0) return 0;
  return employee.success / employee.verified;
};

const ManagerEmployees = () => {
  const router = useRouter();
  const {
    employees: dashboardEmployees,
    loading,
    isError,
    refresh,
  } = useManagerDashboardData({
    includeManagers: true,
    includeInactive: true,
    period: "daily",
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pending, setPending] = useState<Employee | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [isSavingToggle, setIsSavingToggle] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newEmployee, setNewEmployee] =
    useState<NewEmployeeForm>(emptyNewEmployeeForm);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  useEffect(() => {
    setEmployees(
      dashboardEmployees.map((employee) => ({
        id: employee.id,
        userId: employee.userId,
        name: employee.name,
        role: mapDashboardRole(employee.role),
        shift: employee.shift,
        verified: employee.verified,
        success: employee.success,
        fails: employee.failure,
        active: employee.active,
      })),
    );
  }, [dashboardEmployees]);

  const counts = useMemo(
    () => ({
      all: employees.length,
      active: employees.filter((employee) => employee.active).length,
      inactive: employees.filter((employee) => !employee.active).length,
    }),
    [employees],
  );

  const filteredEmployees = useMemo(() => {
    const filtered = employees.filter((employee) => {
      const matchesSearch = employee.name
        .toLowerCase()
        .includes(search.trim().toLowerCase());
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && employee.active) ||
        (filter === "inactive" && !employee.active);

      return matchesSearch && matchesFilter;
    });

    const sorted = [...filtered].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;

      if (sortKey === "name") {
        return (
          a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }) *
          direction
        );
      }
      if (sortKey === "shift") {
        return (
          a.shift.localeCompare(b.shift, "pt-BR", { sensitivity: "base" }) *
          direction
        );
      }
      if (sortKey === "status") {
        return (Number(a.active) - Number(b.active)) * direction;
      }
      if (sortKey === "verified") {
        return (a.verified - b.verified) * direction;
      }
      if (sortKey === "success") {
        return (a.success - b.success) * direction;
      }
      if (sortKey === "fails") {
        return (a.fails - b.fails) * direction;
      }

      return (getSuccessRateValue(a) - getSuccessRateValue(b)) * direction;
    });

    return sorted;
  }, [employees, filter, search, sortDirection, sortKey]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  };

  const toggleActive = async (employee: Employee) => {
    const nextActive = !employee.active;
    setToggleError(null);
    setIsSavingToggle(true);

    try {
      await fetchJson<{ ok: boolean }>(`/api/profiles/${employee.userId}`, {
        method: "PATCH",
        body: JSON.stringify({ active: nextActive }),
      });

      setEmployees((prev) =>
        prev.map((current) =>
          current.userId === employee.userId
            ? { ...current, active: nextActive }
            : current,
        ),
      );

      await refresh();
    } catch {
      setToggleError(
        "Nao foi possivel atualizar o status no banco.",
      );
    } finally {
      setIsSavingToggle(false);
    }
  };

  const confirmToggle = async () => {
    if (pending) {
      await toggleActive(pending);
      setPending(null);
    }
  };

  const resetAddForm = () => {
    setNewEmployee(emptyNewEmployeeForm);
  };

  const handleAddOpenChange = (open: boolean) => {
    setIsAddOpen(open);

    if (!open) {
      resetAddForm();
    }
  };

  const handleAddEmployee = async () => {
    const name = newEmployee.name.trim();
    const email = newEmployee.email.trim().toLowerCase();
    const accessId = newEmployee.accessId.trim();
    const password = newEmployee.password.trim();
    const shift = newEmployee.shift.trim() || "Nao informado";

    if (!name || !email || !accessId || !password) return;

    // Converte a string do formulário para o formato aceito pelo banco ("operador" ou "gestor")
    const apiRole =
      newEmployee.role === "GESTOR" ? "gestor" : "operador";

    try {
      await fetchJson("/api/users", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          code: accessId,
          password,
          role: apiRole,
          shift,
        }),
      });

      setIsAddOpen(false);
      resetAddForm();
      await refresh();
    } catch (err) {
      console.error("Erro ao cadastrar funcionário:", err);
      alert("Não foi possível cadastrar o funcionário. Verifique se o e-mail já existe.");
    }
  };
  return (
    <ManagerShell>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Cabeçalho da Página */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => router.push("/gestor")}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar
            </button>
            <h2 className="text-xl font-bold text-stone-900 tracking-tight">
              Gestão de funcionários
            </h2>
            <p className="text-xs text-stone-500">
              Cadastre colaboradores e controle o acesso às estações.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-stone-900 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-stone-800"
          >
            <Plus className="h-4 w-4" />
            Novo Funcionário
          </button>
        </div>

        {/* 3 Cards de Resumo (Total, Ativos, Inativos) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-xl border bg-white p-5 text-left shadow-sm transition-all ${
              filter === "all"
                ? "border-stone-900 ring-1 ring-stone-900/10"
                : "border-stone-200 hover:border-stone-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-stone-500">Total</span>
              <span className="w-7 h-7 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center">
                <User className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="mt-2.5 font-mono-tech text-2xl font-bold text-stone-900">
              {counts.all}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setFilter("active")}
            className={`rounded-xl border bg-white p-5 text-left shadow-sm transition-all ${
              filter === "active"
                ? "border-emerald-600 ring-1 ring-emerald-600/20"
                : "border-stone-200 hover:border-stone-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-stone-500">Ativos</span>
              <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="mt-2.5 font-mono-tech text-2xl font-bold text-stone-900">
              {counts.active}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setFilter("inactive")}
            className={`rounded-xl border bg-white p-5 text-left shadow-sm transition-all ${
              filter === "inactive"
                ? "border-rose-600 ring-1 ring-rose-600/20"
                : "border-stone-200 hover:border-stone-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-stone-500">Inativos</span>
              <span className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <Power className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="mt-2.5 font-mono-tech text-2xl font-bold text-stone-900">
              {counts.inactive}
            </p>
          </button>
        </div>

        {(isError || toggleError) && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            {toggleError ??
              "Erro ao carregar funcionários do banco. Verifique a conexão e as configurações."}
          </p>
        )}

        {loading && employees.length === 0 && (
          <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-xs text-stone-500">
            Carregando funcionários do banco...
          </div>
        )}

        {/* Busca */}
        <div className="flex h-10 w-full max-w-md items-center gap-2.5 rounded-lg border border-stone-200 bg-white px-3.5 shadow-sm focus-within:border-stone-900">
          <Search className="h-4 w-4 text-stone-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, código ou e-mail..."
            className="w-full bg-transparent text-xs text-stone-900 outline-none placeholder:text-stone-400"
          />
        </div>

        {/* Tabela de Funcionários */}
        <div className="w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[780px]">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/70 text-xs font-medium text-stone-500">
                  <SortableHeader
                    label="Funcionário"
                    sortKey="name"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                    className="px-5 text-left"
                  />
                  <th className="px-4 py-3 text-left">Código</th>
                  <th className="px-4 py-3 text-left">Cargo</th>
                  <SortableHeader
                    label="Turno"
                    sortKey="shift"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                    className="px-4 text-left"
                  />
                  <SortableHeader
                    label="Status"
                    sortKey="status"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                    className="px-4 text-left"
                  />
                  <th className="px-5 py-3 text-right">Acesso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-xs text-stone-500"
                    >
                      Nenhum funcionário encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((employee) => {
                    const active = employee.active;
                    const initials = employee.name
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();

                    return (
                      <tr
                        key={employee.id}
                        className={`transition-colors hover:bg-stone-50 ${
                          !active ? "opacity-65" : ""
                        }`}
                      >
                        <td className="px-5 py-3.5 align-middle">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center text-xs font-semibold text-[#B85D3B] shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-stone-900">
                                {employee.name}
                              </p>
                              <p className="truncate text-xs text-stone-400">
                                {employee.email || "Sem e-mail"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 align-middle font-mono-tech text-xs text-stone-700">
                          {employee.accessId || "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 align-middle text-xs text-stone-600">
                          {employee.role}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 align-middle text-xs text-stone-600">
                          {employee.shift}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 align-middle">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                              active
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                : "bg-stone-100 border-stone-200 text-stone-500"
                            }`}
                          >
                            {active ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 align-middle text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            {isSavingToggle && pending?.id === employee.id && (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                            )}
                            <Switch
                              checked={active}
                              onCheckedChange={() =>
                                !isSavingToggle && setPending(employee)
                              }
                              disabled={isSavingToggle}
                              className="data-[state=checked]:bg-stone-900 data-[state=unchecked]:bg-stone-300"
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Confirmar Ativação / Inativação */}
      <AlertDialog
        open={!!pending}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <AlertDialogContent className="border-stone-200 bg-white text-stone-900">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.active
                ? "Inativar funcionário?"
                : "Ativar funcionário?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-stone-500">
              {pending?.active
                ? `Tem certeza que deseja inativar "${pending.name}"? Ele perderá acesso até ser reativado.`
                : `Deseja ativar "${pending?.name}"? Ele poderá acessar o sistema novamente.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-stone-200 bg-white text-stone-700 hover:bg-stone-50">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmToggle}
              disabled={isSavingToggle}
              className={
                pending?.active
                  ? "bg-rose-600 text-white hover:bg-rose-500"
                  : "bg-emerald-600 text-white hover:bg-emerald-500"
              }
            >
              {isSavingToggle ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </span>
              ) : pending?.active ? (
                "Inativar"
              ) : (
                "Ativar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Novo Funcionário */}
      <AlertDialog open={isAddOpen} onOpenChange={handleAddOpenChange}>
        <AlertDialogContent className="border-stone-200 bg-white text-stone-900 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-stone-900">
              Novo funcionário
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-stone-500">
              Cadastre o colaborador e defina seu perfil de acesso.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-1">
            <label className="block space-y-1.5 text-xs font-medium text-stone-700">
              <span>Nome</span>
              <input
                value={newEmployee.name}
                onChange={(event) =>
                  setNewEmployee((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Nome completo"
                className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none transition focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5 text-xs font-medium text-stone-700">
                <span>Código / ID</span>
                <input
                  value={newEmployee.accessId}
                  onChange={(event) =>
                    setNewEmployee((current) => ({
                      ...current,
                      accessId: event.target.value,
                    }))
                  }
                  placeholder="Ex: OP-0142"
                  className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none transition focus:border-stone-900"
                />
              </label>

              <label className="block space-y-1.5 text-xs font-medium text-stone-700">
                <span>Cargo</span>
                <select
                  value={newEmployee.role}
                  onChange={(event) =>
                    setNewEmployee((current) => ({
                      ...current,
                      role: event.target.value as NewEmployeeRole,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none transition focus:border-stone-900"
                >
                  <option value="FUNCIONARIO (OPERADOR)">Operador</option>
                  <option value="GESTOR">Gestor</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5 text-xs font-medium text-stone-700">
                <span>Turno</span>
                <select
                  value={newEmployee.shift}
                  onChange={(event) =>
                    setNewEmployee((current) => ({
                      ...current,
                      shift: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none transition focus:border-stone-900"
                >
                  <option value="Manhã">Manhã</option>
                  <option value="Tarde">Tarde</option>
                  <option value="Noite">Noite</option>
                  <option value="Integral">Integral</option>
                </select>
              </label>

              <label className="block space-y-1.5 text-xs font-medium text-stone-700">
                <span>E-mail</span>
                <input
                  value={newEmployee.email}
                  onChange={(event) =>
                    setNewEmployee((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="usuario@empresa.com"
                  type="email"
                  className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none transition focus:border-stone-900"
                />
              </label>
            </div>

            <label className="block space-y-1.5 text-xs font-medium text-stone-700">
              <span>Senha</span>
              <input
                value={newEmployee.password}
                onChange={(event) =>
                  setNewEmployee((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                placeholder="Mínimo 6 caracteres"
                type="password"
                className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none transition focus:border-stone-900"
              />
            </label>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="border-stone-200 bg-white text-stone-700 hover:bg-stone-50">
              Cancelar
            </AlertDialogCancel>
            <button
              type="button"
              onClick={handleAddEmployee}
              disabled={
                !newEmployee.name.trim() ||
                !newEmployee.email.trim() ||
                !newEmployee.accessId.trim() ||
                !newEmployee.password.trim()
              }
              className="inline-flex h-10 items-center justify-center rounded-lg bg-stone-900 px-4 text-xs font-semibold text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cadastrar
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ManagerShell>
  );
};

interface SortableHeaderProps {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
  className?: string;
}

const SortableHeader = ({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = "left",
  className = "",
}: SortableHeaderProps) => {
  const active = sortKey === activeKey;
  const Icon = direction === "asc" ? ChevronUp : ChevronDown;

  return (
    <th className={`whitespace-nowrap py-3 ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex w-full items-center gap-1 transition-colors hover:text-stone-900 ${
          align === "right"
            ? "justify-end text-right"
            : "justify-start text-left"
        } ${active ? "text-stone-900 font-semibold" : "text-stone-500"}`}
      >
        <span>{label}</span>
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center">
          {active && <Icon className="h-3.5 w-3.5" />}
        </span>
      </button>
    </th>
  );
};

export default ManagerEmployees;

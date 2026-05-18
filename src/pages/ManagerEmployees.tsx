"use client";

import { useMemo, useState } from "react";
import { Plus, Power, Search, ShieldCheck, SlidersHorizontal, User } from "lucide-react";
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

const initialEmployees: Employee[] = [
  {
    id: "1",
    name: "gestor",
    role: "FUNCIONARIO (OPERADOR)",
    shift: "Nao informado",
    verified: 25,
    success: 13,
    fails: 12,
    active: false,
  },
  {
    id: "2",
    name: "admin",
    role: "FUNCIONARIO (OPERADOR)",
    shift: "Nao informado",
    verified: 0,
    success: 0,
    fails: 0,
    active: true,
  },
  {
    id: "3",
    name: "testereal",
    role: "FUNCIONARIO (OPERADOR)",
    shift: "Nao informado",
    verified: 0,
    success: 0,
    fails: 0,
    active: true,
  },
  {
    id: "4",
    name: "teste",
    role: "FUNCIONARIO (OPERADOR)",
    shift: "Nao informado",
    verified: 0,
    success: 0,
    fails: 0,
    active: false,
  },
  {
    id: "5",
    name: "teste2",
    role: "FUNCIONARIO (OPERADOR)",
    shift: "Nao informado",
    verified: 0,
    success: 0,
    fails: 0,
    active: true,
  },
  {
    id: "6",
    name: "gestor2",
    role: "FUNCIONARIO (OPERADOR)",
    shift: "Nao informado",
    verified: 0,
    success: 0,
    fails: 0,
    active: true,
  },
  {
    id: "7",
    name: "luciana melo",
    role: "FUNCIONARIO",
    shift: "Nao informado",
    verified: 0,
    success: 0,
    fails: 0,
    active: false,
  },
];

const getSuccessRate = (employee: Employee) => {
  if (employee.verified === 0) return "0.0";
  return ((employee.success / employee.verified) * 100).toFixed(1);
};

const ManagerEmployees = () => {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [pending, setPending] = useState<Employee | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newEmployee, setNewEmployee] = useState<NewEmployeeForm>(emptyNewEmployeeForm);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const counts = useMemo(
    () => ({
      all: employees.length,
      active: employees.filter((employee) => employee.active).length,
      inactive: employees.filter((employee) => !employee.active).length,
    }),
    [employees],
  );

  const filteredEmployees = useMemo(
    () =>
      employees.filter((employee) => {
        const matchesSearch = employee.name.toLowerCase().includes(search.trim().toLowerCase());
        const matchesFilter =
          filter === "all" ||
          (filter === "active" && employee.active) ||
          (filter === "inactive" && !employee.active);

        return matchesSearch && matchesFilter;
      }),
    [employees, filter, search],
  );

  const toggleActive = (id: string) => {
    setEmployees((prev) =>
      prev.map((employee) =>
        employee.id === id ? { ...employee, active: !employee.active } : employee,
      ),
    );
  };

  const confirmToggle = () => {
    if (pending) {
      toggleActive(pending.id);
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

  const handleAddEmployee = () => {
    const name = newEmployee.name.trim();
    const email = newEmployee.email.trim().toLowerCase();
    const accessId = newEmployee.accessId.trim();
    const password = newEmployee.password.trim();
    const shift = newEmployee.shift.trim() || "Nao informado";

    if (!name || !email || !accessId || !password) return;

    setEmployees((prev) => [
      ...prev,
      {
        id: accessId,
        name,
        email,
        accessId,
        password,
        role: newEmployee.role,
        shift,
        verified: 0,
        success: 0,
        fails: 0,
        active: true,
      },
    ]);

    setIsAddOpen(false);
    resetAddForm();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-3">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              Todos - {counts.all}
            </FilterChip>
            <FilterChip active={filter === "active"} onClick={() => setFilter("active")} tone="emerald">
              Ativos - {counts.active}
            </FilterChip>
            <FilterChip active={filter === "inactive"} onClick={() => setFilter("inactive")} tone="rose">
              Inativos - {counts.inactive}
            </FilterChip>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-full min-w-0 items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-4 md:w-80">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar funcionario..."
                className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
              />
            </div>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-slate-400 transition-colors hover:text-white"
              aria-label="Filtros"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.07]"
          >
            <Plus className="h-4 w-4" />
            Adicionar Funcionario
          </button>
        </div>

        <div className="w-full max-w-full overflow-hidden rounded-2xl border border-white/10 bg-[#101016]">
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-full min-w-[1000px] table-fixed">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[16%]" />
                <col className="w-[14%]" />
                <col className="w-[10%]" />
                <col className="w-[9%]" />
                <col className="w-[9%]" />
                <col className="w-[8%]" />
                <col className="w-[190px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-white/10 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                  <th className="whitespace-nowrap px-6 py-4 text-left">Funcionario</th>
                  <th className="whitespace-nowrap px-4 py-4 text-left">Turno</th>
                  <th className="whitespace-nowrap px-4 py-4 text-left">Status</th>
                  <th className="whitespace-nowrap px-4 py-4 text-right">Verificados</th>
                  <th className="whitespace-nowrap px-4 py-4 text-right">Sucesso</th>
                  <th className="whitespace-nowrap px-4 py-4 text-right">Falhas</th>
                  <th className="whitespace-nowrap px-4 py-4 text-right">Taxa</th>
                  <th className="whitespace-nowrap px-6 py-4 text-right">Acao</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">
                      Nenhum funcionario encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((employee) => {
                    const active = employee.active;
                    const rate = getSuccessRate(employee);

                    return (
                      <tr
                        key={employee.id}
                        className={`h-[94px] border-b border-white/[0.06] transition-colors last:border-b-0 hover:bg-white/[0.02] ${
                          !active ? "opacity-50" : ""
                        }`}
                      >
                        <td className="px-6 py-5 align-middle">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{employee.name}</p>
                            <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                              {employee.role}
                            </p>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-5 align-middle text-sm text-slate-300">
                          {employee.shift}
                        </td>
                        <td className="whitespace-nowrap px-4 py-5 align-middle">
                          <span
                            className={`inline-flex items-center gap-2 text-sm ${
                              active ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                active ? "bg-emerald-500" : "bg-rose-500"
                              }`}
                            />
                            {active ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-5 text-right align-middle text-sm text-slate-200">
                          {employee.verified}
                        </td>
                        <td className="whitespace-nowrap px-4 py-5 text-right align-middle text-sm text-slate-200">
                          {employee.success}
                        </td>
                        <td className="whitespace-nowrap px-4 py-5 text-right align-middle text-sm text-rose-400">
                          {employee.fails}
                        </td>
                        <td className="whitespace-nowrap px-4 py-5 text-right align-middle text-sm text-slate-200">
                          {rate}%
                        </td>
                        <td className="whitespace-nowrap px-6 py-5 align-middle">
                          <div className="flex min-w-[150px] items-center justify-end gap-3">
                            <Switch
                              checked={active}
                              onCheckedChange={() => setPending(employee)}
                              className="data-[state=checked]:bg-indigo-600 data-[state=unchecked]:bg-slate-700"
                            />
                            <button
                              type="button"
                              onClick={() => setPending(employee)}
                              className={`inline-flex h-8 min-w-[86px] items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${
                                active
                                  ? "border-rose-500/50 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15"
                                  : "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15"
                              }`}
                            >
                              <Power className="h-3.5 w-3.5" />
                              {active ? "Inativar" : "Ativar"}
                            </button>
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

      <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent className="border-white/10 bg-[#101016] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.active ? "Inativar funcionario?" : "Ativar funcionario?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {pending?.active
                ? `Tem certeza que deseja inativar "${pending.name}"? Ele perdera acesso ate ser reativado.`
                : `Deseja ativar "${pending?.name}"? Ele podera acessar o sistema novamente.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 bg-transparent text-slate-200 hover:bg-white/10 hover:text-white">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmToggle}
              className={
                pending?.active
                  ? "bg-rose-600 text-white hover:bg-rose-500"
                  : "bg-emerald-600 text-white hover:bg-emerald-500"
              }
            >
              {pending?.active ? "Inativar" : "Ativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isAddOpen} onOpenChange={handleAddOpenChange}>
        <AlertDialogContent className="border-white/10 bg-[#101016] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Adicionar funcionario</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Cadastre o funcionario na lista e selecione se ele sera operador ou gestor.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Tipo de acesso
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(["FUNCIONARIO (OPERADOR)", "GESTOR"] as NewEmployeeRole[]).map((role) => {
                  const active = newEmployee.role === role;
                  const Icon = role === "GESTOR" ? ShieldCheck : User;

                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setNewEmployee((current) => ({ ...current, role }))}
                      className={`flex min-h-[74px] flex-col items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold transition-colors ${
                        active
                          ? "border-indigo-400/50 bg-indigo-500/15 text-white"
                          : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {role === "GESTOR" ? "Gestor" : "Operador"}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="block space-y-2 text-sm font-medium text-slate-300">
              <span>Nome</span>
              <input
                value={newEmployee.name}
                onChange={(event) =>
                  setNewEmployee((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Nome do funcionario"
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none transition focus:border-indigo-400/50"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 text-sm font-medium text-slate-300">
                <span>E-mail</span>
                <input
                  value={newEmployee.email}
                  onChange={(event) =>
                    setNewEmployee((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="usuario@empresa.com"
                  type="email"
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none transition focus:border-indigo-400/50"
                />
              </label>

              <label className="block space-y-2 text-sm font-medium text-slate-300">
                <span>ID</span>
                <input
                  value={newEmployee.accessId}
                  onChange={(event) =>
                    setNewEmployee((current) => ({ ...current, accessId: event.target.value }))
                  }
                  placeholder="Ex: 33333"
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none transition focus:border-indigo-400/50"
                />
              </label>
            </div>

            <label className="block space-y-2 text-sm font-medium text-slate-300">
              <span>Senha</span>
              <input
                value={newEmployee.password}
                onChange={(event) =>
                  setNewEmployee((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="Senha de acesso"
                type="password"
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none transition focus:border-indigo-400/50"
              />
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-300">
              <span>Turno</span>
              <input
                value={newEmployee.shift}
                onChange={(event) =>
                  setNewEmployee((current) => ({ ...current, shift: event.target.value }))
                }
                placeholder="Nao informado"
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none transition focus:border-indigo-400/50"
              />
            </label>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 bg-transparent text-slate-200 hover:bg-white/10 hover:text-white">
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
              className="inline-flex h-10 items-center justify-center rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Salvar
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

interface FilterChipProps {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  tone?: "neutral" | "emerald" | "rose";
}

const FilterChip = ({ active, children, onClick, tone = "neutral" }: FilterChipProps) => {
  const dotClass =
    tone === "emerald" ? "bg-emerald-500" : tone === "rose" ? "bg-rose-500" : "bg-slate-400";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-2 rounded-full border px-4 text-xs font-semibold transition-colors ${
        active
          ? "border-white/20 bg-white/10 text-white"
          : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
      }`}
    >
      {tone !== "neutral" && <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />}
      {children}
    </button>
  );
};

export default ManagerEmployees;

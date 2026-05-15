"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Filter, Plus, Search, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import gridBg from "@/assets/grid-bg.jpg";
import { useManagerDashboardData } from "@/hooks/useDashboardData";
import AddUser from "@/components/AddUser";
import FilterModal, { EmployeeStatusFilter } from "@/components/filterModal";

const ManagerEmployees = () => {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { employees, loading, isError } = useManagerDashboardData();

  const [isOpen, setIsOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<EmployeeStatusFilter>("active");
    
  const employeesWithMockStatus = useMemo(
  () =>
    employees.map((employee, index) => ({
      ...employee,
      status: index % 4 === 0 ? "inactive" : "active",
    })),
  [employees],
  );

  
  const filtered = useMemo(
    () =>
      employeesWithMockStatus.filter((employee) => {
        const matchesSearch =
          employee.name.toLowerCase().includes(search.toLowerCase()) ||
          employee.id.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === "all" || employee.status === statusFilter;

        return matchesSearch && matchesStatus;
      }),
    [employeesWithMockStatus, search, statusFilter],
  );

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      <img
        src={gridBg.src}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-20"
        width={1920}
        height={1080}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/95 to-background/70" />

      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-6 border-b border-border/20">
        <button
          onClick={() => router.push("/gestor")}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/40 border border-border/30 hover:bg-muted/60 hover:border-foreground/30 transition-all text-xs uppercase text-foreground/80"
        >
          <ArrowLeft className="w-3 h-3" />
          Voltar
        </button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          Todos os Funcionarios
        </div>
      </header>

      <main className="relative z-10 flex-1 p-6 md:p-10">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex justify-between">
            <div className="flex gap-3 items-center">
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-muted/40 border border-border/30 w-fit">
                <Search className="w-3 h-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar funcionario..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="bg-transparent outline-none text-xs text-foreground placeholder:text-muted-foreground w-48"
                />
              </div>
              <div className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border/30 bg-transparent">
                <button
                  type="button"
                  onClick={() => setFilterOpen((open) => !open)}
                  className="flex h-full w-full items-center justify-center rounded-full text-white/50 transition-colors hover:text-foreground"
                  aria-label="Filtrar funcionarios"
                >
                  <Filter size={18} />
                </button>
                <FilterModal
                  filterOpen={filterOpen}
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  onClose={() => setFilterOpen(false)}
                />
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-full border border-border/30 bg-transparent outline-none text-xs text-muted-foreground w-48">
              <Plus size={15}/>
              Adicionar Funcionário
            </button>
             <AddUser
              isOpen = {isOpen}
              isClosed = {() => setIsOpen(false)}
            />
          </div>

          <div className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-border/30 bg-muted/20 text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
              <div className="col-span-2">Funcionario</div>
              <div className="col-span-2">Turno</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-2 text-right">Verificados</div>
              <div className="col-span-2 text-right">Sucesso</div>
              <div className="col-span-2 text-right">Falhas</div>
              <div className="col-span-1 text-right">Taxa</div>
            </div>

            {filtered.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-muted-foreground">
                {loading ? "Carregando funcionarios..." : "Nenhum funcionario encontrado"}
              </div>
            ) : (
              filtered.map((employee, index) => {
                const successRate =
                  employee.verified === 0 ? "0.0" : ((employee.success / employee.verified) * 100).toFixed(1);

                return (
                  <div
                    key={employee.id}
                    className={`grid grid-cols-12 gap-4 px-5 py-4 items-center text-left ${
                      index !== filtered.length - 1 ? "border-b border-border/20" : ""
                    }`}
                  >
                    <div className="col-span-2 min-w-0">
                      <p className="text-sm text-foreground/90 truncate">{employee.name}</p>
                      <p className="text-[10px] text-muted-foreground tracking-wider uppercase">{employee.role}</p>
                    </div>
                    <div className="col-span-2 text-xs text-muted-foreground">{employee.shift}</div>
                    <div
                      className={`col-span-1 flex items-center gap-2 text-xs ${
                        employee.status === "active" ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          employee.status === "active" ? "bg-green-500" : "bg-red-500"
                        }`}
                        aria-hidden="true"
                      />
                      {employee.status === "active" ? "Ativo" : "Inativo"}
                    </div>
                    <div className="col-span-2 text-right text-sm text-foreground/90">{employee.verified}</div>
                    <div className="col-span-2 text-right text-sm text-primary">{employee.success}</div>
                    <div className="col-span-2 text-right text-sm text-destructive">{employee.failure}</div>
                    <div className="col-span-1 text-right text-xs text-muted-foreground">{successRate}%</div>
                  </div>
                );
              })
            )}
          </div>

          {isError && (
            <p className="text-xs text-destructive">
              Nao foi possivel carregar os funcionarios. Verifique as policies de profiles e user_roles.
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default ManagerEmployees;

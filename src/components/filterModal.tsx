export type EmployeeStatusFilter = "all" | "active" | "inactive";

interface FilterModalProps {
  filterOpen: boolean;
  statusFilter: EmployeeStatusFilter;
  onStatusFilterChange: (status: EmployeeStatusFilter) => void;
  onClose: () => void;
}

export default function FilterModal({
  filterOpen,
  statusFilter,
  onStatusFilterChange,
  onClose,
}: FilterModalProps) {
  if (!filterOpen) return null;

  const handleSelect = (status: EmployeeStatusFilter) => {
    onStatusFilterChange(status);
    onClose();
  };

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default"
        onClick={onClose}
        aria-label="Fechar filtro"
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute left-1/2 top-full z-50 mt-2 w-[120px] -translate-x-1/2 overflow-hidden rounded-md border border-border/30 bg-gray-900 text-sm shadow-lg"
      >
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => handleSelect("all")}
            className={`flex w-full cursor-pointer items-center gap-2 border-b border-[#ffffff13] p-3 text-left hover:bg-[#42424285] ${
              statusFilter === "all" ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-muted-foreground"></div>
            <span>Todos</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelect("active")}
            className={`flex w-full cursor-pointer items-center gap-2 border-b border-[#ffffff13] p-3 text-left hover:bg-[#42424285] ${
              statusFilter === "active" ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Ativos</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelect("inactive")}
            className={`flex w-full cursor-pointer items-center gap-2 p-3 text-left hover:bg-[#42424285] ${
              statusFilter === "inactive" ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span>Inativos</span>
          </button>
        </div>
      </div>
    </>
  );
}

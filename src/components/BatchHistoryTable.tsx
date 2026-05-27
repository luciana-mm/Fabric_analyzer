"use client";

import { useState, useMemo } from "react";
import { useBatchHistory, useBatchDetails, type BatchHistoryRow } from "@/hooks/useBatchHistory";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Calendar, User, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type PageSizeOption = 5 | 10 | 25 | 50;

export const BatchHistoryTable = () => {
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [pageSize, setPageSize] = useState<PageSizeOption>(10);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");

  // Pegar lista de operadores para o filtro
  const { data: operators = [] } = useQuery({
    queryKey: ["operators-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .not("display_name", "is", null)
        .order("display_name");

      if (error) throw error;
      return data || [];
    },
  });

  // Converter strings de data para Date objects
  const parsedStartDate = startDate ? new Date(startDate) : undefined;
  const parsedEndDate = endDate ? new Date(endDate + "T23:59:59") : undefined;

  // Buscar histórico
  const { batches, total, isLoading, isError } = useBatchHistory(
    search || undefined,
    selectedUserId || undefined,
    parsedStartDate,
    parsedEndDate,
    pageSize,
    pageIndex
  );

  // Buscar detalhes do lote selecionado
  const { details: batchDetails, isLoading: detailsLoading } = useBatchDetails(
    selectedBatchId
  );

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-sansserief text-lg tracking-[0.15em] uppercase">
            Histórico de Análises
          </h2>
          <p className="text-sm text-muted-foreground">
            {total > 0 ? `${total} lote${total !== 1 ? "s" : ""} encontrado${total !== 1 ? "s" : ""}` : "Nenhum lote"}
          </p>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar lote..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPageIndex(0);
              }}
              className="pl-10 h-9 text-sm"
            />
          </div>

          {/* Filtro de Usuário */}
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <select
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value);
                setPageIndex(0);
              }}
              className="w-full pl-10 pr-3 h-9 text-sm rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground"
            >
              <option value="">Todos os usuários</option>
              {operators.map((op) => (
                <option key={op.user_id} value={op.user_id}>
                  {op.display_name}
                </option>
              ))}
            </select>
          </div>

          {/* Data de início */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPageIndex(0);
              }}
              className="w-full pl-10 pr-3 h-9 text-sm rounded-md border border-input bg-background"
            />
          </div>

          {/* Data de fim */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPageIndex(0);
              }}
              className="w-full pl-10 pr-3 h-9 text-sm rounded-md border border-input bg-background"
            />
          </div>

          {/* Reset filters */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch("");
              setSelectedUserId("");
              setStartDate("");
              setEndDate("");
              setPageIndex(0);
            }}
            className="h-9 text-xs"
          >
            Limpar
          </Button>
        </div>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="p-6 rounded-xl border border-destructive/20 bg-destructive/5 text-center text-sm text-destructive">
          Erro ao carregar histórico. Tente novamente.
        </div>
      ) : batches.length === 0 ? (
        <div className="p-12 rounded-xl border border-border/30 bg-card/40 text-center">
          <p className="text-sm text-muted-foreground">Nenhum lote encontrado com os filtros aplicados.</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-hidden">
            {/* Header da tabela */}
            <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-border/30 bg-muted/20 font-sansserief text-[10px] tracking-[0.25em] uppercase">
              <div className="col-span-2">Lote</div>
              <div className="col-span-2">Primeira Análise</div>
              <div className="col-span-2">Última Análise</div>
              <div className="col-span-2">Total / Aprovados</div>
              <div className="col-span-2">Reprovados</div>
              <div className="col-span-2">Ação</div>
            </div>

            {/* Linhas */}
            {batches.map((batch) => (
              <div
                key={batch.batch_id}
                className="grid grid-cols-12 gap-4 px-5 py-4 border-b border-border/20 hover:bg-muted/10 transition-colors"
              >
                <div className="col-span-2 text-sm font-mono truncate">{batch.batch_code}</div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  {new Date(batch.first_analyzed_at).toLocaleDateString("pt-BR")}
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  {new Date(batch.last_analyzed_at).toLocaleDateString("pt-BR")}
                </div>
                <div className="col-span-2 text-sm">
                  <span className="text-foreground font-semibold">{batch.total_fabrics}</span>
                  <span className="text-muted-foreground"> / </span>
                  <span className="text-green-500 font-semibold">{batch.approved_count}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-red-500 font-semibold">{batch.rejected_count}</span>
                </div>
                <div className="col-span-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedBatchId(batch.batch_id)}
                    className="text-xs h-8"
                  >
                    Detalhes
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Paginação e tamanho de página */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
            {/* Seletor de tamanho */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Itens por página:</span>
              <div className="flex gap-2">
                {([5, 10, 25, 50] as const).map((size) => (
                  <Button
                    key={size}
                    size="sm"
                    variant={pageSize === size ? "default" : "outline"}
                    onClick={() => {
                      setPageSize(size);
                      setPageIndex(0);
                    }}
                    className="text-xs h-8 w-10"
                  >
                    {size}
                  </Button>
                ))}
              </div>
            </div>

            {/* Navegação de página */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pageIndex === 0}
                onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <span className="text-xs text-muted-foreground min-w-fit">
                Página {pageIndex + 1} de {totalPages || 1}
              </span>

              <Button
                size="sm"
                variant="outline"
                disabled={pageIndex >= totalPages - 1}
                onClick={() => setPageIndex(pageIndex + 1)}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Modal de Detalhes */}
      <Dialog open={!!selectedBatchId} onOpenChange={(open) => !open && setSelectedBatchId("")}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : batchDetails ? (
            <>
              <DialogHeader>
                <div className="space-y-2">
                  <DialogTitle className="font-sansserief tracking-[0.2em] uppercase">
                    Detalhes do Lote
                  </DialogTitle>
                  <DialogDescription className="font-mono text-sm">
                    {batchDetails.batch_code}
                  </DialogDescription>
                </div>
              </DialogHeader>

              <div className="space-y-6">
                {/* Grid de informações principais */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
                    <p className="text-xs text-muted-foreground tracking-widest uppercase mb-1">
                      Total de Tecidos
                    </p>
                    <p className="text-2xl font-semibold">{batchDetails.total_fabrics}</p>
                  </div>

                  <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
                    <p className="text-xs text-muted-foreground tracking-widest uppercase mb-1">
                      Taxa de Aprovação
                    </p>
                    <p className="text-2xl font-semibold">
                      {batchDetails.total_fabrics > 0
                        ? (
                            (batchDetails.approved_count / batchDetails.total_fabrics) *
                            100
                          ).toFixed(1)
                        : 0}
                      %
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                    <p className="text-xs text-muted-foreground tracking-widest uppercase mb-1">
                      Aprovados
                    </p>
                    <p className="text-2xl font-semibold text-green-500">
                      {batchDetails.approved_count}
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                    <p className="text-xs text-muted-foreground tracking-widest uppercase mb-1">
                      Reprovados
                    </p>
                    <p className="text-2xl font-semibold text-red-500">{batchDetails.rejected_count}</p>
                  </div>
                </div>

                {/* Datas */}
                <div className="space-y-3">
                  <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
                    <p className="text-xs text-muted-foreground tracking-widest uppercase mb-2">
                      Primeira Análise
                    </p>
                    <p className="text-sm">
                      {new Date(batchDetails.first_analyzed_at).toLocaleDateString("pt-BR", {
                        weekday: "short",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
                    <p className="text-xs text-muted-foreground tracking-widest uppercase mb-2">
                      Última Análise
                    </p>
                    <p className="text-sm">
                      {new Date(batchDetails.last_analyzed_at).toLocaleDateString("pt-BR", {
                        weekday: "short",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                {/* Operadores */}
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground tracking-widest uppercase font-semibold">
                    Operador{batchDetails.operators.length !== 1 ? "es" : ""} Responsável{batchDetails.operators.length !== 1 ? "eis" : ""}
                  </p>
                  <div className="space-y-2">
                    {batchDetails.operators.length > 0 ? (
                      batchDetails.operators.map((op) => (
                        <div
                          key={op.user_id}
                          className="p-3 rounded-lg bg-muted/30 border border-border/30 flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{op.display_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{op.user_id}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum operador registrado.</p>
                    )}
                  </div>
                </div>

                {/* ID do Lote */}
                <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-xs text-muted-foreground tracking-widest uppercase mb-2">
                    ID do Lote
                  </p>
                  <p className="text-xs font-mono break-all">{batchDetails.batch_id}</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-12">
              Nenhum detalhe encontrado.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

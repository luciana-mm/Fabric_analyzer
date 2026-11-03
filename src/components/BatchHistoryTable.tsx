"use client";

import { useState } from "react";
import { useBatchHistory, useBatchDetails } from "@/hooks/useBatchHistory";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Search,
  Calendar,
  User,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Printer,
  Sparkles,
  FileText,
  Layers,
} from "lucide-react";

type PageSizeOption = 5 | 10 | 25 | 50;

export const BatchHistoryTable = () => {
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [pageSize, setPageSize] = useState<PageSizeOption>(10);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");

  const { data: operators = [] } = useQuery({
    queryKey: ["operators-list"],
    queryFn: async () => {
      const response = await fetchJson<{ data: Array<{ user_id: string; display_name: string }> }>(
        `/api/profiles?role=operador`,
      );

      return response.data ?? [];
    },
  });

  const parsedStartDate = startDate ? new Date(startDate) : undefined;
  const parsedEndDate = endDate ? new Date(endDate + "T23:59:59") : undefined;

  const { batches, total, isLoading, isError } = useBatchHistory(
    search || undefined,
    selectedUserId || undefined,
    parsedStartDate,
    parsedEndDate,
    pageSize,
    pageIndex,
  );

  const { details: batchDetails, isLoading: detailsLoading } = useBatchDetails(selectedBatchId);

  const totalPages = Math.ceil(total / pageSize);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full space-y-6">
      {/* Header & Filtros */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-sansserief text-lg tracking-[0.15em] uppercase text-white">
              Relatórios por Lote
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Histórico consolidado de inspeções em tecidos lisos (OpenCV) e detalhados (Anomalib)
            </p>
          </div>
          <p className="text-xs font-mono-tech text-cyan-300 bg-cyan-500/10 border border-cyan-500/25 px-3 py-1.5 rounded-full">
            {total > 0
              ? `${total} lote${total !== 1 ? "s" : ""} registrado${total !== 1 ? "s" : ""}`
              : "Nenhum lote encontrado"}
          </p>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar código do lote..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPageIndex(0);
              }}
              className="pl-10 h-9 text-sm bg-slate-900/80 border-white/10 text-white"
            />
          </div>

          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <select
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value);
                setPageIndex(0);
              }}
              className="w-full pl-10 pr-3 h-9 text-sm rounded-md border border-white/10 bg-slate-900/80 text-white hover:border-cyan-400/40"
            >
              <option value="">Todos os operadores</option>
              {operators.map((op) => (
                <option key={op.user_id} value={op.user_id}>
                  {op.display_name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPageIndex(0);
              }}
              className="w-full pl-10 pr-3 h-9 text-sm rounded-md border border-white/10 bg-slate-900/80 text-white"
            />
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPageIndex(0);
              }}
              className="w-full pl-10 pr-3 h-9 text-sm rounded-md border border-white/10 bg-slate-900/80 text-white"
            />
          </div>

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
            className="h-9 text-xs border-white/15 bg-slate-900/70 text-slate-200 hover:bg-slate-800"
          >
            Limpar Filtros
          </Button>
        </div>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
        </div>
      ) : isError ? (
        <div className="p-6 rounded-xl border border-rose-500/30 bg-rose-500/10 text-center text-sm text-rose-300">
          Erro ao carregar histórico de lotes. Tente novamente.
        </div>
      ) : batches.length === 0 ? (
        <div className="p-12 rounded-xl border border-white/10 bg-slate-900/50 text-center">
          <p className="text-sm text-slate-400">Nenhum lote encontrado com os filtros aplicados.</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-white/10 bg-slate-900/65 backdrop-blur-xl overflow-hidden shadow-xl">
            <div className="grid grid-cols-12 gap-3 px-5 py-3.5 border-b border-white/10 bg-slate-950/60 font-sansserief text-[10px] tracking-[0.2em] uppercase text-slate-400">
              <div className="col-span-2">Lote</div>
              <div className="col-span-2">Tipo / Motor</div>
              <div className="col-span-2">Última Análise</div>
              <div className="col-span-2">Leituras / Status</div>
              <div className="col-span-2">Defeitos no Tecido</div>
              <div className="col-span-2 text-right">Relatório</div>
            </div>

            {batches.map((batch) => {
              const totalDefects = Number(batch.total_defects ?? 0);
              const patternedDefects = Number(batch.patterned_defects ?? 0);
              const isPatterned = Boolean(batch.is_patterned);

              return (
                <div
                  key={batch.batch_id}
                  className="grid grid-cols-12 gap-3 px-5 py-4 border-b border-white/5 items-center hover:bg-white/[0.03] transition-colors"
                >
                  <div className="col-span-2 text-sm font-mono-tech font-semibold text-white truncate">
                    {batch.batch_code}
                  </div>

                  <div className="col-span-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                        isPatterned
                          ? "bg-amber-500/15 text-amber-300 border-amber-400/35"
                          : "bg-cyan-500/15 text-cyan-300 border-cyan-400/35"
                      }`}
                    >
                      {isPatterned ? "Detalhado · Anomalib" : "Liso · OpenCV"}
                    </span>
                  </div>

                  <div className="col-span-2 text-xs text-slate-300">
                    {new Date(batch.last_analyzed_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>

                  <div className="col-span-2 text-xs flex items-center gap-2">
                    <span className="font-mono-tech font-semibold text-white">
                      {batch.total_fabrics}
                    </span>
                    <span className="text-slate-500">·</span>
                    <span className="text-emerald-400 font-semibold">{batch.approved_count} ok</span>
                    {batch.rejected_count > 0 && (
                      <>
                        <span className="text-slate-500">/</span>
                        <span className="text-rose-400 font-semibold">{batch.rejected_count} repr.</span>
                      </>
                    )}
                  </div>

                  <div className="col-span-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono-tech text-xs font-semibold border ${
                        totalDefects === 0
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
                          : "bg-amber-500/15 text-amber-300 border-amber-500/35"
                      }`}
                    >
                      {totalDefects === 0 ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          0 defeitos
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          {totalDefects} defeito{totalDefects !== 1 ? "s" : ""}
                          {isPatterned && patternedDefects > 0 ? " (Detalhado)" : ""}
                        </>
                      )}
                    </span>
                  </div>

                  <div className="col-span-2 flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedBatchId(batch.batch_id)}
                      className="text-xs h-8 border-cyan-500/35 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
                    >
                      <FileText className="w-3.5 h-3.5 mr-1.5" />
                      Relatório Detalhado
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Paginação */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">Itens por página:</span>
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

              <span className="text-xs text-slate-400 min-w-fit px-2">
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

      {/* Modal de Relatório Detalhado do Lote */}
      <Dialog open={!!selectedBatchId} onOpenChange={(open) => !open && setSelectedBatchId("")}>
        <DialogContent
          data-report-print
          className="max-w-4xl max-h-[88vh] overflow-y-auto bg-[#0a0c14] text-white border-slate-800"
        >
          {detailsLoading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            </div>
          ) : batchDetails ? (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <DialogTitle className="font-sansserief tracking-[0.18em] uppercase text-lg text-white">
                        Relatório Técnico do Lote
                      </DialogTitle>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                          batchDetails.is_patterned
                            ? "bg-amber-500/20 text-amber-300 border-amber-400/40"
                            : "bg-cyan-500/20 text-cyan-300 border-cyan-400/40"
                        }`}
                      >
                        {batchDetails.is_patterned
                          ? "Tecido Detalhado · Anomalib (PatchCore)"
                          : "Tecido Liso · OpenCV (CIEDE2000)"}
                      </span>
                    </div>
                    <DialogDescription className="font-mono-tech text-sm text-cyan-300">
                      Código do Lote: {batchDetails.batch_code}
                    </DialogDescription>
                  </div>

                  <button
                    data-no-print
                    type="button"
                    onClick={handlePrint}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3.5 text-xs font-medium uppercase tracking-wider text-slate-200 transition-colors hover:border-cyan-400 hover:text-cyan-300"
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir / PDF
                  </button>
                </div>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Cards Principais */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                  <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
                    <p className="text-[10px] text-slate-400 tracking-widest uppercase mb-1">
                      Inspeções no Lote
                    </p>
                    <p className="text-2xl font-bold font-mono-tech text-white">
                      {batchDetails.total_fabrics}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {batchDetails.approved_count} aprov. / {batchDetails.rejected_count} repr.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
                    <p className="text-[10px] text-slate-400 tracking-widest uppercase mb-1">
                      Taxa de Qualidade
                    </p>
                    <p className="text-2xl font-bold font-mono-tech text-emerald-400">
                      {batchDetails.total_fabrics > 0
                        ? ((batchDetails.approved_count / batchDetails.total_fabrics) * 100).toFixed(1)
                        : "0.0"}
                      %
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">Índice de aprovação</p>
                  </div>

                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/35">
                    <p className="text-[10px] text-amber-300/90 tracking-widest uppercase mb-1">
                      Defeitos no Tecido Detalhado
                    </p>
                    <p className="text-2xl font-bold font-mono-tech text-amber-300">
                      {batchDetails.patterned_defects ?? 0}
                    </p>
                    <p className="text-[11px] text-amber-200/75 mt-1">
                      Em {batchDetails.patterned_count ?? 0} inspeção(ões) Anomalib
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30">
                    <p className="text-[10px] text-rose-300/90 tracking-widest uppercase mb-1">
                      Total Geral de Defeitos
                    </p>
                    <p className="text-2xl font-bold font-mono-tech text-rose-400">
                      {batchDetails.total_defects ?? 0}
                    </p>
                    <p className="text-[11px] text-rose-200/75 mt-1">
                      Falhas físicas contabilizadas
                    </p>
                  </div>
                </div>

                {/* Resumo Técnico do Motor de Visão */}
                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
                    <Sparkles className="w-4 h-4" />
                    Diagnóstico Técnico de Inspeção
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80">
                      <span className="text-slate-400 block text-[10px] uppercase tracking-wider">
                        Motor de Visão Computacional
                      </span>
                      <span className="font-semibold text-white mt-1 block">
                        {batchDetails.is_patterned
                          ? "Anomalib · PatchCore (ResNet18 + LAB)"
                          : "OpenCV Clássico · Colorimetria CIEDE2000"}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80">
                      <span className="text-slate-400 block text-[10px] uppercase tracking-wider">
                        Densidade Média de Defeitos
                      </span>
                      <span className="font-mono-tech font-semibold text-amber-300 mt-1 block">
                        {batchDetails.total_fabrics > 0
                          ? (Number(batchDetails.total_defects ?? 0) / batchDetails.total_fabrics).toFixed(2)
                          : "0.00"}{" "}
                        defeito(s) por inspeção
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80">
                      <span className="text-slate-400 block text-[10px] uppercase tracking-wider">
                        {batchDetails.is_patterned ? "Conformidade Estrutural" : "Média Colorimétrica (ΔE / Precisão)"}
                      </span>
                      <span className="font-mono-tech font-semibold text-cyan-300 mt-1 block">
                        {batchDetails.is_patterned
                          ? Number(batchDetails.patterned_defects ?? 0) === 0
                            ? "100% livre de anomalias"
                            : `${batchDetails.patterned_defects} anomalia(s) na estampa`
                          : `ΔE ${batchDetails.avg_delta_e ?? "0.00"} · ${batchDetails.avg_precision ?? "100"}%`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Registro Detalhado de Leituras do Lote */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-300 tracking-widest uppercase font-semibold flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      Histórico Detalhado de Leituras deste Lote ({batchDetails.records?.length ?? 0})
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
                    <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-950/70 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                      <div className="col-span-2">Horário</div>
                      <div className="col-span-2">Operador</div>
                      <div className="col-span-2">Tipo de Tecido</div>
                      <div className="col-span-2">Qtd. Defeitos</div>
                      <div className="col-span-2">Detalhe Técnico</div>
                      <div className="col-span-2 text-right">Status</div>
                    </div>

                    {batchDetails.records && batchDetails.records.length > 0 ? (
                      batchDetails.records.map((rec) => (
                        <div
                          key={rec.id}
                          className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-slate-800/60 items-center text-xs last:border-b-0"
                        >
                          <div className="col-span-2 text-slate-300 font-mono-tech text-[11px]">
                            {new Date(rec.analyzed_at).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </div>

                          <div className="col-span-2 text-slate-200 truncate">{rec.operator_name}</div>

                          <div className="col-span-2">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                                rec.is_patterned
                                  ? "bg-amber-500/15 text-amber-300 border border-amber-400/30"
                                  : "bg-cyan-500/15 text-cyan-300 border border-cyan-400/30"
                              }`}
                            >
                              {rec.is_patterned ? "Detalhado (Anomalib)" : "Liso (OpenCV)"}
                            </span>
                          </div>

                          <div className="col-span-2 font-mono-tech font-semibold">
                            {rec.defect_count > 0 ? (
                              <span className="text-amber-300">
                                {rec.defect_count} defeito{rec.defect_count !== 1 ? "s" : ""}
                              </span>
                            ) : (
                              <span className="text-emerald-400">0 defeitos</span>
                            )}
                          </div>

                          <div className="col-span-2 text-[11px] text-slate-300 truncate" title={rec.failure_reason ?? ""}>
                            {rec.is_patterned ? (
                              rec.failure_reason ?? "Padrão de estampa aprovado"
                            ) : (
                              <span className="inline-flex items-center gap-1.5">
                                {rec.measured_color_hex && (
                                  <span
                                    className="w-3 h-3 rounded-sm border border-white/20 inline-block shrink-0"
                                    style={{ backgroundColor: rec.measured_color_hex }}
                                  />
                                )}
                                ΔE {Number(rec.delta_e_measured ?? 0).toFixed(2)} ({Number(rec.precision_percent ?? 100).toFixed(0)}%)
                              </span>
                            )}
                          </div>

                          <div className="col-span-2 flex justify-end">
                            {rec.result === "ok" ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Aprovado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-400 font-semibold text-[11px]">
                                <XCircle className="w-3.5 h-3.5" /> Reprovado
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-xs text-slate-500">
                        Nenhuma leitura detalhada encontrada para este lote.
                      </div>
                    )}
                  </div>
                </div>

                {/* Datas e Operadores */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2 text-xs">
                    <p className="text-[10px] text-slate-400 tracking-widest uppercase font-semibold">
                      Janela de Inspeção do Lote
                    </p>
                    <p className="text-slate-300">
                      <strong className="text-white">Início:</strong>{" "}
                      {new Date(batchDetails.first_analyzed_at).toLocaleString("pt-BR")}
                    </p>
                    <p className="text-slate-300">
                      <strong className="text-white">Último registro:</strong>{" "}
                      {new Date(batchDetails.last_analyzed_at).toLocaleString("pt-BR")}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
                    <p className="text-[10px] text-slate-400 tracking-widest uppercase font-semibold">
                      Operador(es) Responsável(is)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {batchDetails.operators.map((op) => (
                        <div
                          key={op.user_id}
                          className="px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center gap-2 text-xs"
                        >
                          <User className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="font-semibold text-white">{op.display_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-center text-sm text-slate-400 py-12">
              Nenhum detalhe encontrado para este lote.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

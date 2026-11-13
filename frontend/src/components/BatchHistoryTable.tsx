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
    <div className="w-full space-y-5">
      {/* Filtros */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-stone-500">
            Filtrar histórico de inspeções
          </p>
          <span className="text-xs font-mono-tech text-stone-700 bg-stone-100 border border-stone-200 px-2.5 py-1 rounded-full">
            {total > 0
              ? `${total} lote${total !== 1 ? "s" : ""} registrado${total !== 1 ? "s" : ""}`
              : "Nenhum lote encontrado"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <Input
              placeholder="Buscar lote ou operador..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPageIndex(0);
              }}
              className="pl-9 h-9 text-xs bg-white border-stone-200 text-stone-900 placeholder:text-stone-400"
            />
          </div>

          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <select
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value);
                setPageIndex(0);
              }}
              className="w-full pl-9 pr-3 h-9 text-xs rounded-md border border-stone-200 bg-white text-stone-900 focus:outline-none focus:border-stone-900"
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
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPageIndex(0);
              }}
              className="w-full pl-9 pr-3 h-9 text-xs rounded-md border border-stone-200 bg-white text-stone-900 focus:outline-none focus:border-stone-900"
            />
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPageIndex(0);
              }}
              className="w-full pl-9 pr-3 h-9 text-xs rounded-md border border-stone-200 bg-white text-stone-900 focus:outline-none focus:border-stone-900"
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
            className="h-9 text-xs border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
          >
            Limpar Filtros
          </Button>
        </div>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-stone-500" />
        </div>
      ) : isError ? (
        <div className="p-6 rounded-xl border border-rose-200 bg-rose-50 text-center text-xs text-rose-700">
          Erro ao carregar histórico de lotes. Tente novamente.
        </div>
      ) : batches.length === 0 ? (
        <div className="p-12 rounded-xl border border-stone-200 bg-white text-center shadow-sm">
          <p className="text-xs text-stone-500">Nenhum lote encontrado com os filtros aplicados.</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-stone-200 bg-stone-50/70 text-xs font-medium text-stone-500">
              <div className="col-span-2">Lote</div>
              <div className="col-span-2">Detector</div>
              <div className="col-span-2">Data</div>
              <div className="col-span-2">Leituras / Status</div>
              <div className="col-span-2">Defeitos</div>
              <div className="col-span-2 text-right">Detalhes</div>
            </div>

            {batches.map((batch) => {
              const totalDefects = Number(batch.total_defects ?? 0);
              const patternedDefects = Number(batch.patterned_defects ?? 0);
              const isPatterned = Boolean(batch.is_patterned);

              return (
                <div
                  key={batch.batch_id}
                  className="grid grid-cols-12 gap-3 px-5 py-3.5 border-b border-stone-100 last:border-b-0 items-center hover:bg-stone-50 transition-colors"
                >
                  <div className="col-span-2 flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        batch.rejected_count > 0 ? "bg-[#B85D3B]" : "bg-stone-900"
                      }`}
                    />
                    <span className="text-sm font-mono-tech font-semibold text-stone-900 truncate">
                      {batch.batch_code}
                    </span>
                  </div>

                  <div className="col-span-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        isPatterned
                          ? "bg-orange-50 text-[#B85D3B] border-orange-200"
                          : "bg-stone-100 text-stone-700 border-stone-200"
                      }`}
                    >
                      {isPatterned ? "Anomalib" : "OpenCV"}
                    </span>
                  </div>

                  <div className="col-span-2 text-xs text-stone-600">
                    {new Date(batch.last_analyzed_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>

                  <div className="col-span-2 text-xs flex items-center gap-1.5">
                    <span className="font-mono-tech font-semibold text-stone-900">
                      {batch.total_fabrics}
                    </span>
                    <span className="text-stone-400">·</span>
                    <span className="text-emerald-700 font-medium">{batch.approved_count} ok</span>
                    {batch.rejected_count > 0 && (
                      <>
                        <span className="text-stone-400">/</span>
                        <span className="text-rose-600 font-medium">{batch.rejected_count} repr.</span>
                      </>
                    )}
                  </div>

                  <div className="col-span-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono-tech text-xs font-medium border ${
                        totalDefects === 0
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-800 border-amber-200"
                      }`}
                    >
                      {totalDefects === 0 ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          0 defeitos
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
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
                      className="text-xs h-8 border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                    >
                      <FileText className="w-3.5 h-3.5 mr-1.5 text-stone-500" />
                      Detalhes
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Paginação */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2">
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-stone-500">Itens por página:</span>
              <div className="flex gap-1.5">
                {([5, 10, 25, 50] as const).map((size) => (
                  <Button
                    key={size}
                    size="sm"
                    variant={pageSize === size ? "default" : "outline"}
                    onClick={() => {
                      setPageSize(size);
                      setPageIndex(0);
                    }}
                    className={`text-xs h-8 w-9 ${
                      pageSize === size
                        ? "bg-stone-900 text-white hover:bg-stone-800"
                        : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                    }`}
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
                className="h-8 w-8 p-0 border-stone-200 bg-white text-stone-700"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <span className="text-xs text-stone-500 min-w-fit px-2">
                Página {pageIndex + 1} de {totalPages || 1}
              </span>

              <Button
                size="sm"
                variant="outline"
                disabled={pageIndex >= totalPages - 1}
                onClick={() => setPageIndex(pageIndex + 1)}
                className="h-8 w-8 p-0 border-stone-200 bg-white text-stone-700"
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
          className="max-w-4xl max-h-[88vh] overflow-y-auto bg-white text-stone-900 border-stone-200"
        >
          {detailsLoading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="w-6 h-6 animate-spin text-stone-500" />
            </div>
          ) : batchDetails ? (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <DialogTitle className="text-lg font-semibold text-stone-900">
                        Relatório Técnico do Lote
                      </DialogTitle>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          batchDetails.is_patterned
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-orange-200 bg-orange-50 text-[#B85D3B]"
                        }`}
                      >
                        {batchDetails.is_patterned
                          ? "Tecido Detalhado · Anomalib (PatchCore)"
                          : "Tecido Liso · OpenCV (CIEDE2000)"}
                      </span>
                    </div>
                    <DialogDescription className="font-mono text-sm text-stone-600">
                      Código do Lote: {batchDetails.batch_code}
                    </DialogDescription>
                  </div>

                  <button
                    data-no-print
                    type="button"
                    onClick={handlePrint}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50"
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir / PDF
                  </button>
                </div>
              </DialogHeader>

              <div className="mt-4 space-y-6">
                {/* Cards Principais */}
                <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-stone-500">
                      Inspeções no Lote
                    </p>
                    <p className="font-mono text-2xl font-bold text-stone-900">
                      {batchDetails.total_fabrics}
                    </p>
                    <p className="mt-1 text-[11px] text-stone-500">
                      {batchDetails.approved_count} aprov. / {batchDetails.rejected_count} repr.
                    </p>
                  </div>

                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-stone-500">
                      Taxa de Qualidade
                    </p>
                    <p className="font-mono text-2xl font-bold text-emerald-700">
                      {batchDetails.total_fabrics > 0
                        ? ((batchDetails.approved_count / batchDetails.total_fabrics) * 100).toFixed(1)
                        : "0.0"}
                      %
                    </p>
                    <p className="mt-1 text-[11px] text-stone-500">Índice de aprovação</p>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-amber-800">
                      Defeitos no Tecido Detalhado
                    </p>
                    <p className="font-mono text-2xl font-bold text-amber-700">
                      {batchDetails.patterned_defects ?? 0}
                    </p>
                    <p className="mt-1 text-[11px] text-amber-700/80">
                      Em {batchDetails.patterned_count ?? 0} inspeção(ões) Anomalib
                    </p>
                  </div>

                  <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-rose-800">
                      Total Geral de Defeitos
                    </p>
                    <p className="font-mono text-2xl font-bold text-rose-700">
                      {batchDetails.total_defects ?? 0}
                    </p>
                    <p className="mt-1 text-[11px] text-rose-700/80">
                      Falhas físicas contabilizadas
                    </p>
                  </div>
                </div>

                {/* Resumo Técnico do Motor de Visão */}
                <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#B85D3B]">
                    <Sparkles className="h-4 w-4" />
                    Diagnóstico Técnico de Inspeção
                  </div>

                  <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
                    <div className="rounded-lg border border-stone-200 bg-white p-3">
                      <span className="block text-[10px] uppercase tracking-wider text-stone-400">
                        Motor de Visão Computacional
                      </span>
                      <span className="mt-1 block font-semibold text-stone-900">
                        {batchDetails.is_patterned
                          ? "Anomalib · PatchCore (ResNet18 + LAB)"
                          : "OpenCV Clássico · Colorimetria CIEDE2000"}
                      </span>
                    </div>

                    <div className="rounded-lg border border-stone-200 bg-white p-3">
                      <span className="block text-[10px] uppercase tracking-wider text-stone-400">
                        Densidade Média de Defeitos
                      </span>
                      <span className="mt-1 block font-mono font-semibold text-amber-700">
                        {batchDetails.total_fabrics > 0
                          ? (Number(batchDetails.total_defects ?? 0) / batchDetails.total_fabrics).toFixed(2)
                          : "0.00"}{" "}
                        defeito(s) por inspeção
                      </span>
                    </div>

                    <div className="rounded-lg border border-stone-200 bg-white p-3">
                      <span className="block text-[10px] uppercase tracking-wider text-stone-400">
                        {batchDetails.is_patterned ? "Conformidade Estrutural" : "Média Colorimétrica (ΔE / Precisão)"}
                      </span>
                      <span className="mt-1 block font-mono font-semibold text-stone-900">
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
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-700">
                      <Layers className="h-3.5 w-3.5 text-[#B85D3B]" />
                      Histórico Detalhado de Leituras deste Lote ({batchDetails.records?.length ?? 0})
                    </p>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                    <div className="grid grid-cols-12 gap-2 border-b border-stone-200 bg-stone-50 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
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
                          className="grid grid-cols-12 items-center gap-2 border-b border-stone-100 px-4 py-3 text-xs last:border-b-0"
                        >
                          <div className="col-span-2 font-mono text-[11px] text-stone-600">
                            {new Date(rec.analyzed_at).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </div>

                          <div className="col-span-2 truncate text-stone-800">{rec.operator_name}</div>

                          <div className="col-span-2">
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                rec.is_patterned
                                  ? "border-amber-200 bg-amber-50 text-amber-800"
                                  : "border-orange-200 bg-orange-50 text-[#B85D3B]"
                              }`}
                            >
                              {rec.is_patterned ? "Detalhado (Anomalib)" : "Liso (OpenCV)"}
                            </span>
                          </div>

                          <div className="col-span-2 font-mono font-semibold">
                            {rec.defect_count > 0 ? (
                              <span className="text-amber-700">
                                {rec.defect_count} defeito{rec.defect_count !== 1 ? "s" : ""}
                              </span>
                            ) : (
                              <span className="text-emerald-700">0 defeitos</span>
                            )}
                          </div>

                          <div className="col-span-2 truncate text-[11px] text-stone-600" title={rec.failure_reason ?? ""}>
                            {rec.is_patterned ? (
                              rec.failure_reason ?? "Padrão de estampa aprovado"
                            ) : (
                              <span className="inline-flex items-center gap-1.5">
                                {rec.measured_color_hex && (
                                  <span
                                    className="inline-block h-3 w-3 shrink-0 rounded-sm border border-stone-300"
                                    style={{ backgroundColor: rec.measured_color_hex }}
                                  />
                                )}
                                ΔE {Number(rec.delta_e_measured ?? 0).toFixed(2)} ({Number(rec.precision_percent ?? 100).toFixed(0)}%)
                              </span>
                            )}
                          </div>

                          <div className="col-span-2 flex justify-end">
                            {rec.result === "ok" ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Aprovado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700">
                                <XCircle className="h-3.5 w-3.5" /> Reprovado
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-xs text-stone-500">
                        Nenhuma leitura detalhada encontrada para este lote.
                      </div>
                    )}
                  </div>
                </div>

                {/* Datas e Operadores */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-4 text-xs">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                      Janela de Inspeção do Lote
                    </p>
                    <p className="text-stone-600">
                      <strong className="text-stone-900">Início:</strong>{" "}
                      {new Date(batchDetails.first_analyzed_at).toLocaleString("pt-BR")}
                    </p>
                    <p className="text-stone-600">
                      <strong className="text-stone-900">Último registro:</strong>{" "}
                      {new Date(batchDetails.last_analyzed_at).toLocaleString("pt-BR")}
                    </p>
                  </div>

                  <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                      Operador(es) Responsável(is)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {batchDetails.operators.map((op) => (
                        <div
                          key={op.user_id}
                          className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs"
                        >
                          <User className="h-3.5 w-3.5 text-[#B85D3B]" />
                          <span className="font-semibold text-stone-900">{op.display_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="py-12 text-center text-sm text-stone-500">
              Nenhum detalhe encontrado para este lote.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

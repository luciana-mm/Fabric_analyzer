"use client";

import { useState } from "react";
import { Camera, Sun, CheckCircle, AlertCircle, Loader, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { CameraPreview } from "./CameraPreview";
import { useCameraRobustCapture } from "@/hooks/useCameraRobustCapture";
import { calculateAmbientLightMatch } from "@/utils/calibrationUtils";
import { rgb8BitToNormalized, rgbToHex } from "@/utils/colorSpaceConversion";

interface AmbientLightCalibrationProps {
  onBack: () => void;
  onSave: (patch: {
    lightCalibrated: boolean;
    ambientLightConfigured?: boolean;
    ambientLightReferenceHex?: string;
    ambientLightReferenceRgb?: {
      r: number;
      g: number;
      b: number;
    };
  }) => Promise<void> | void;
  referenceHex: string;
  referenceRgb: {
    r: number;
    g: number;
    b: number;
  };
  hasReferenceConfigured: boolean;
  initialLightCalibrated: boolean;
  mode?: "setup" | "compare";
}

export const AmbientLightCalibration = ({
  onBack,
  onSave,
  referenceHex,
  referenceRgb,
  hasReferenceConfigured,
  initialLightCalibrated,
  mode = "compare",
}: AmbientLightCalibrationProps) => {
  const cameraCapture = useCameraRobustCapture();
  const [ambientHex, setAmbientHex] = useState<string>("#000000");
  const [ambientRgb, setAmbientRgb] = useState({ r: 0, g: 0, b: 0 });
  const [similarity, setSimilarity] = useState<number | null>(null);
  const [matchLabel, setMatchLabel] = useState<string>("");
  const [lastDeltaE, setLastDeltaE] = useState<number | null>(null);
  const [calibrated, setCalibrated] = useState(initialLightCalibrated);

  const handleCaptureAmbientLight = async () => {
    if (!hasReferenceConfigured) {
      toast.error("Defina a luz base nas configurações antes de calibrar no painel.", {
        description: "Acesse Configurações > Capturar Cor.",
      });
      return;
    }

    try {
      const rgbSample = await cameraCapture.captureRobustSample(5, 200);
      if (!rgbSample) {
        toast.error("Falha ao capturar a luz ambiente.");
        return;
      }

      const normalizedAmbient = rgb8BitToNormalized(rgbSample);
      const result = calculateAmbientLightMatch(normalizedAmbient, {
        r: referenceRgb.r / 255,
        g: referenceRgb.g / 255,
        b: referenceRgb.b / 255,
      });

      setAmbientRgb(rgbSample);
      setAmbientHex(rgbToHex(normalizedAmbient));
      if (mode === "setup") {
        setSimilarity(null);
        setMatchLabel("Luz base definida");
        setLastDeltaE(null);
        setCalibrated(true);
        await onSave({
          lightCalibrated: false,
          ambientLightConfigured: true,
          ambientLightReferenceHex: rgbToHex(normalizedAmbient),
          ambientLightReferenceRgb: rgbSample,
        });
        toast.success("Luz base salva nas configurações");
        return;
      }

      setSimilarity(result.similarityPercent);
      setMatchLabel(result.matches ? "Ambiente compatível" : "Ambiente divergente");
      setLastDeltaE(result.deltaE);
      setCalibrated(result.matches);

      await onSave({ lightCalibrated: result.matches });

      toast.success("Calibração de luz ambiente concluída", {
        description: `Similaridade: ${result.similarityPercent.toFixed(0)}% (${result.matches ? "compatível" : "divergente"})`,
      });
    } catch (err) {
      console.error("Erro ao medir luz ambiente:", err);
      toast.error("Erro ao comparar a luz ambiente.");
    }
  };

  return (
    <div className="bg-[#0a0c14] p-8 rounded-xl border border-slate-800 text-white max-w-3xl mx-auto">
      <div className="mb-8 flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        <div>
          <h2 className="text-center text-2xl font-bold mb-2">Calibração de Luz Ambiente</h2>
          <p className="text-center text-xs text-slate-400">
            {mode === "setup"
              ? "Defina a luz base do ambiente para servir como referência."
              : "Compare a iluminação atual com a luz base salva nas configurações."}
          </p>
        </div>

        <div className="w-12" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">
              {mode === "setup" ? "Luz base atual" : "Luz base configurada"}
            </p>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg border border-slate-600" style={{ backgroundColor: referenceHex }} />
              <div>
                <p className="font-medium text-sm">{referenceHex.toUpperCase()}</p>
                <p className="text-xs text-slate-500">
                  {referenceRgb.r}, {referenceRgb.g}, {referenceRgb.b}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleCaptureAmbientLight}
            disabled={cameraCapture.isCapturing}
            className="w-full rounded-xl border border-blue-700 bg-blue-900/40 px-5 py-4 text-sm font-medium text-blue-200 transition hover:bg-blue-800/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cameraCapture.isCapturing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader className="w-4 h-4 animate-spin" /> Medindo luz ambiente
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Sun className="w-4 h-4" /> {mode === "setup" ? "Definir luz base" : "Capturar luz ambiente"}
              </span>
            )}
          </button>

          <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Resultado</p>
            <p className="text-sm">
              {mode === "setup"
                ? matchLabel || "Nenhuma medição realizada ainda."
                : similarity !== null
                ? `${similarity.toFixed(0)}% de similaridade com a luz base`
                : "Nenhuma medição realizada ainda."}
            </p>
            {mode === "compare" && lastDeltaE !== null && (
              <p className="text-xs text-slate-500 mt-1">ΔE = {lastDeltaE.toFixed(2)}</p>
            )}
            {matchLabel && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-1 text-xs text-slate-200">
                {calibrated ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-amber-400" />}
                {matchLabel}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl overflow-hidden border border-slate-700/70 bg-slate-950/40">
            <CameraPreview
              className="w-full h-[260px] border-0 rounded-none"
              imageClassName="w-full h-full object-cover"
              fallbackMessage="Preview indisponível durante calibração"
              showRetryButton={false}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-4">
              <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Luz ambiente capturada</p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg border border-slate-600" style={{ backgroundColor: ambientHex }} />
                <div>
                  <p className="font-medium text-sm">{ambientHex.toUpperCase()}</p>
                  <p className="text-xs text-slate-500">{ambientRgb.r}, {ambientRgb.g}, {ambientRgb.b}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-4">
              <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Status de calibração</p>
              <p className="text-sm">{calibrated ? "Última medição válida" : "Luz ambiente ainda não validada"}</p>
              <p className="text-xs text-slate-500 mt-1">{initialLightCalibrated ? "Calibração anterior disponível" : "Nenhum resultado salvo"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

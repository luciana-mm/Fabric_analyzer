import { useState } from "react";
import { Camera, Lightbulb, Save } from "lucide-react";
import { toast } from "sonner";
import { CameraPreview } from "./CameraPreview";

const CAMERA_PROXY_URL = process.env.NEXT_PUBLIC_CAMERA_PROXY_URL ?? "http://127.0.0.1:8090";

interface SampleColorResponse {
  hex: string;
  rgb: {
    r: number;
    g: number;
    b: number;
  };
}

interface ColorCaptureProps {
  onBack: () => void;
  initialColorHex: string;
  initialColorRgb: {
    r: number;
    g: number;
    b: number;
  };
  initialLightCalibrated: boolean;
  onSave: (value: {
    referenceColorHex: string;
    referenceColorRgb: {
      r: number;
      g: number;
      b: number;
    };
    colorConfigured: boolean;
    lightCalibrated: boolean;
  }) => void;
}

export const ColorCapture = ({ onBack, initialColorHex, initialColorRgb, initialLightCalibrated, onSave }: ColorCaptureProps) => {
  const [capturedColor, setCapturedColor] = useState<SampleColorResponse>({
    hex: initialColorHex,
    rgb: initialColorRgb,
  });
  const [isCalibrated, setIsCalibrated] = useState(initialLightCalibrated);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCaptureColor = async () => {
    setIsCapturing(true);

    try {
      const response = await fetch(`${CAMERA_PROXY_URL}/sample-color`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Falha na leitura da cor da camera");
      }

      const color = (await response.json()) as SampleColorResponse;
      setCapturedColor(color);
      setIsCalibrated(false);

      toast.success("Cor capturada", {
        description: `Cor detectada: ${color.hex.toUpperCase()}`,
      });
    } catch {
      toast.error("Nao foi possivel capturar a cor", {
        description: "Verifique se a camera/proxy esta online.",
      });
    } finally {
      setIsCapturing(false);
    }
  };

  const handleCalibrate = () => {
    setIsCalibrated(true);
    toast.success("Luz calibrada", {
      description: `Referencia atual: ${capturedColor.hex.toUpperCase()}`,
    });
  };

  const handleSave = () => {
    onSave({
      referenceColorHex: capturedColor.hex,
      referenceColorRgb: capturedColor.rgb,
      colorConfigured: true,
      lightCalibrated: isCalibrated,
    });
    onBack();
  };


  return (
    <div className="bg-[#0a0c14] p-8 rounded-xl border border-slate-800 text-white max-w-2xl mx-auto">
      <h2 className="text-center text-xl font-bold mb-10 cursor-default">
        Calibrar luz branca
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_3fr] text-sm gap-6">
        <div className="flex flex-col gap-3">
            <section
              onClick={handleCaptureColor}
              className="flex-flex-col justify-items-center bg-gray-500 p-2 rounded-[10px] hover:bg-gray-400 cursor-pointer w-[120px]"
            >
                <Camera/>
                <p>{isCapturing ? "Capturando" : "Capturar Cor"}</p>
            </section>
            <section
              onClick={handleCalibrate}
              className="flex-flex-col justify-items-center bg-gray-500 p-2 rounded-[10px] hover:bg-gray-400 cursor-pointer w-[120px]"
            >
                <Lightbulb/>
                <p>Calibrar Luz</p>
            </section>
        </div>
        <div className="space-y-4">
            <div className="rounded-lg overflow-hidden border border-slate-700/70">
              <CameraPreview
                className="w-full h-[220px] border-0 rounded-none"
                imageClassName="w-full h-full object-cover"
                fallbackMessage="Preview indisponivel durante a calibracao."
                showRetryButton={false}
              />
            </div>
            <div className="flex gap-3 items-center">
              <p className="flex-1">Representacao da cor selecionada:</p>
              <section className="flex-[2] w-[100px] h-[50px] rounded border border-slate-600" style={{ backgroundColor: capturedColor.hex }}>
              </section>
            </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-300">Cor: {capturedColor.hex.toUpperCase()} | Luz calibrada: {isCalibrated ? "Sim" : "Nao"}</p>
      <div className="flex justify-end gap-5 mt-10 text-sm ">
        <button 
          onClick={handleSave} 
          className="flex-col justify-items-center bg-gray-500 p-2 w-[100px] gap-2 rounded-[10px] hover:bg-gray-400">
            <Save/>
            <p>Salvar</p>
        </button>
      </div>
    </div>
  );
};

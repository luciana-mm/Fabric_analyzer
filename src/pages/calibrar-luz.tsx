"use client";

import { useRouter } from "next/navigation";
import { AmbientLightCalibration } from "@/components/AmbientLightCalibration";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSystemConfig } from "@/hooks/useOperatorSystemConfig";

export default function CalibrarLuzPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { config: systemConfig, persistPatch } = useOperatorSystemConfig(user?.id);

  return (
    <AmbientLightCalibration
      onBack={() => router.push("/painel")}
      onSave={async (patch) => {
        if (persistPatch) {
          await persistPatch({
            lightCalibrated: patch.lightCalibrated,
            systemStep: patch.lightCalibrated ? "READY" : "LIGHT",
          });
        }
      }}
      referenceHex={systemConfig.ambientLightReferenceHex}
      referenceRgb={systemConfig.ambientLightReferenceRgb}
      hasReferenceConfigured={systemConfig.ambientLightConfigured}
      initialLightCalibrated={systemConfig.lightCalibrated}
      sampleAreaWidthPercent={systemConfig.sampleAreaWidthPercent}
      sampleAreaHeightPercent={systemConfig.sampleAreaHeightPercent}
      mode="compare"
    />
  );
}

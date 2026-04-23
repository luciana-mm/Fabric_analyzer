import React from "react";

export const MeasurementGridOverlay = ({ width, height }) => {

  const pointClass =
    "w-[6px] h-[6px] bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]";

  return (
    <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
      <div
        className="border-2 border-dashed border-blue-600/60 rounded-lg p-2 flex flex-wrap gap-3 items-center justify-center transition-all duration-150 ease-out"
        style={{
          width: `${width}vw`,
          height: `${height}vh`,
          maxWidth: "90vw",
          maxHeight: "70vh",
        }}
      >
      </div>
    </div>
  );
};

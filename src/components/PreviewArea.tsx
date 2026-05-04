import React from "react";

export const MeasurementGridOverlay = ({ width, height }) => {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
      <div
        className="border-[10px] border-dashed border-blue-600/60 rounded-lg p-2 flex flex-wrap gap-3 items-center justify-center transition-all duration-150 ease-out"
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

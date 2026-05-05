import React from "react";

export const MeasurementGridOverlay = ({ width, height }) => {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
      <div
  className="relative p-2 flex flex-wrap gap-3 items-center justify-center transition-all duration-150 ease-out"
  style={{
    width: `${width}vw`,
    height: `${height}vh`,
    maxWidth: "90vw",
    maxHeight: "70vh",
  }}
>
  <div className="absolute inset-0 pointer-events-none rounded-lg border-[10px] border-dashed border-white drop-shadow-[0_0_4px_rgba(0,0,0,1)]" />
</div>
    </div>
  );
};

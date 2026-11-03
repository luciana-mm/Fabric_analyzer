"use client";

import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hexToRgb, rgbToHex } from "@/utils/colorSpaceConversion";

interface RgbScreenProps {
  open: boolean;
  initialHex: string;
  onOpenChange: (open: boolean) => void;
  onSelect: (color: { hex: string; rgb: { r: number; g: number; b: number } }) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function rgb8BitToHsv(rgb: { r: number; g: number; b: number }) {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;

  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : delta / max;
  const v = max;

  return { h, s, v };
}

function hsvToRgb8Bit(h: number, s: number, v: number) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function normalizeHex(input: string) {
  const value = input.trim().replace(/[^0-9a-f]/gi, "");
  if (value.length === 3) {
    return `#${value[0]}${value[0]}${value[1]}${value[1]}${value[2]}${value[2]}`.toUpperCase();
  }
  if (value.length === 6) {
    return `#${value.toUpperCase()}`;
  }
  return `#${value.toUpperCase()}`;
}

export const RgbScreen = ({ open, initialHex, onOpenChange, onSelect }: RgbScreenProps) => {
  const [hex, setHex] = useState(initialHex.toUpperCase());
  const [rgb, setRgb] = useState({ r: 255, g: 255, b: 255 });
  const [hsv, setHsv] = useState({ h: 0, s: 1, v: 1 });
  const [dragging, setDragging] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const parsed = hexToRgb(initialHex);
    if (parsed) {
      const rgb8 = {
        r: Math.round(parsed.r * 255),
        g: Math.round(parsed.g * 255),
        b: Math.round(parsed.b * 255),
      };
      setRgb(rgb8);
      setHex(initialHex.toUpperCase());
      setHsv(rgb8BitToHsv(rgb8));
    }
  }, [initialHex, open]);

  useEffect(() => {
    const handlePointerUp = () => setDragging(false);
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchend", handlePointerUp);
    return () => {
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchend", handlePointerUp);
    };
  }, []);

  const colorHex = useMemo(() => {
    return rgbToHex({ r: rgb.r / 255, g: rgb.g / 255, b: rgb.b / 255 });
  }, [rgb]);

  const updateFromHsv = (nextHsv: { h: number; s: number; v: number }) => {
    const nextRgb = hsvToRgb8Bit(nextHsv.h, nextHsv.s, nextHsv.v);
    setHsv(nextHsv);
    setRgb(nextRgb);
    setHex(rgbToHex({ r: nextRgb.r / 255, g: nextRgb.g / 255, b: nextRgb.b / 255 }));
  };

  const handlePointerEvent = (event: PointerEvent<HTMLDivElement>) => {
    if (!pickerRef.current) return;
    const rect = pickerRef.current.getBoundingClientRect();
    const x = clamp(event.clientX - rect.left, 0, rect.width);
    const y = clamp(event.clientY - rect.top, 0, rect.height);
    const nextS = Number((x / rect.width).toFixed(3));
    const nextV = Number((1 - y / rect.height).toFixed(3));
    updateFromHsv({ ...hsv, s: nextS, v: nextV });
  };

  const handleHexChange = (value: string) => {
    const cleaned = normalizeHex(value);
    setHex(cleaned);
    const parsed = hexToRgb(cleaned);

    if (parsed) {
      const rgb8 = {
        r: Math.round(parsed.r * 255),
        g: Math.round(parsed.g * 255),
        b: Math.round(parsed.b * 255),
      };
      setRgb(rgb8);
      setHsv(rgb8BitToHsv(rgb8));
    }
  };

  const handleChannelChange = (channel: 'r' | 'g' | 'b', value: number) => {
    const nextRgb = {
      ...rgb,
      [channel]: clamp(Math.round(value), 0, 255),
    };
    const parsed = hexToRgb(normalizeHex(rgbToHex({ r: nextRgb.r / 255, g: nextRgb.g / 255, b: nextRgb.b / 255 })));
    if (parsed) {
      setRgb(nextRgb);
      setHex(rgbToHex({ r: nextRgb.r / 255, g: nextRgb.g / 255, b: nextRgb.b / 255 }));
      setHsv(rgb8BitToHsv(nextRgb));
    }
  };

  const handleHueChange = (value: number) => {
    updateFromHsv({ ...hsv, h: clamp(value, 0, 360) });
  };

  const handleSave = () => {
    onSelect({
      hex: colorHex,
      rgb,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl overflow-hidden bg-[#0a0c14] text-white border border-slate-800 shadow-2xl">
        <DialogHeader>
          <DialogTitle>Selecionar cor</DialogTitle>
          <DialogDescription className="text-slate-400">
            Arraste ou clique no seletor para escolher uma cor, ou cole o valor em hexadecimal abaixo.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div
            className="relative rounded-3xl overflow-hidden border border-slate-700 bg-slate-900 shadow-inner h-72 sm:h-80"
            ref={pickerRef}
            onPointerDown={(event) => {
              setDragging(true);
              event.currentTarget.setPointerCapture(event.pointerId);
              handlePointerEvent(event);
            }}
            onPointerMove={(event) => {
              if (dragging) handlePointerEvent(event);
            }}
            onPointerUp={(event) => {
              setDragging(false);
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
          >
              <div className="absolute inset-0" style={{ background: `hsl(${hsv.h}, 100%, 50%)` }} />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/95 to-transparent" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-transparent" />
              <div
                className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg"
                style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, boxShadow: '0 0 0 4px rgba(0,0,0,0.35)' }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl border border-slate-700 p-4 bg-slate-950/80">
                <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Visualização</p>
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 rounded-3xl border border-white/10 shadow-inner" style={{ backgroundColor: colorHex }} />
                  <div>
                    <p className="text-sm font-semibold">{colorHex.toUpperCase()}</p>
                    <p className="text-xs text-slate-500">R {rgb.r} · G {rgb.g} · B {rgb.b}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-700 p-4 bg-slate-950/80">
                <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-2">Tonalidade</p>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={Math.round(hsv.h)}
                  onChange={(event) => handleHueChange(Number(event.target.value))}
                  className="h-3 w-full cursor-pointer accent-violet-500"
                  style={{ background: 'linear-gradient(to right, red, yellow, lime, aqua, blue, magenta, red)' }}
                />
                <div className="mt-2 text-xs text-slate-400">H: {Math.round(hsv.h)}°</div>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-slate-700 bg-slate-950/80 p-5">
            <div>
              <label className="block text-xs text-slate-400 uppercase tracking-[0.2em] mb-2" htmlFor="rgb-hex">
                Hexadecimal
              </label>
              <Input
                id="rgb-hex"
                value={hex}
                onChange={(event) => handleHexChange(event.target.value)}
                className="bg-slate-900 border-slate-700 text-white"
                maxLength={7}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {(['r', 'g', 'b'] as const).map((channel) => (
                <div key={channel}>
                  <label className="block text-xs text-slate-400 uppercase tracking-[0.2em] mb-2" htmlFor={`rgb-${channel}`}>
                    {channel.toUpperCase()}
                  </label>
                  <Input
                    id={`rgb-${channel}`}
                    type="number"
                    value={rgb[channel]}
                    onChange={(event) => handleChannelChange(channel, Number(event.target.value))}
                    className="bg-slate-900 border-slate-700 text-white"
                    min={0}
                    max={255}
                  />
                </div>
              ))}
            </div>

            <div className="rounded-3xl border border-slate-800 bg-[#11141f] p-4">
              <p className="text-xs text-slate-400 uppercase tracking-[0.2em] mb-3">Guia rápido</p>
              <ul className="space-y-2 text-[11px] text-slate-500 list-disc pl-4">
                <li>Arraste dentro do seletor para ajustar saturação e brilho.</li>
                <li>Use o controle de tonalidade para escolher a cor base.</li>
                <li>Digite um valor hex válido para definir a cor diretamente.</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-slate-700 text-slate-200 hover:bg-slate-900/70">
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} className="bg-violet-600 text-white hover:bg-violet-500">
            Confirmar cor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

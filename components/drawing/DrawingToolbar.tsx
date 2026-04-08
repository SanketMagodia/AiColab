"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SelectIcon,
  PencilIcon,
  RectIcon,
  CircleIcon,
  ArrowIcon,
  TextIcon,
  EraserIcon,
  TrashIcon,
  SlidersIcon,
} from "@/components/layout/icons";
export type Tool = "select" | "freehand" | "rectangle" | "ellipse" | "arrow" | "text" | "eraser";

const COLORS = ["#fafafa", "#f43f5e", "#eab308", "#22c55e", "#0ea5e9", "#8b5cf6", "#ec4899", "#18181b"];
const WIDTHS: { label: string; value: number }[] = [
  { label: "S", value: 2 },
  { label: "M", value: 5 },
  { label: "L", value: 10 },
];

type Props = {
  tool: Tool;
  setTool: (t: Tool) => void;
  color: string;
  setColor: (c: string) => void;
  strokeWidth: number;
  setStrokeWidth: (w: number) => void;
  onClear: () => void;
};

export default function DrawingToolbar({
  tool,
  setTool,
  color,
  setColor,
  strokeWidth,
  setStrokeWidth,
  onClear,
}: Props) {
  const [styleOpen, setStyleOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setStyleOpen(false), []);

  useEffect(() => {
    if (!styleOpen) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [styleOpen, close]);

  const tools: { id: Tool; Icon: React.FC<{ size?: number }>; title: string }[] = [
    { id: "select", Icon: SelectIcon, title: "Select / Move" },
    { id: "freehand", Icon: PencilIcon, title: "Pen" },
    { id: "rectangle", Icon: RectIcon, title: "Rectangle" },
    { id: "ellipse", Icon: CircleIcon, title: "Ellipse" },
    { id: "arrow", Icon: ArrowIcon, title: "Arrow" },
    { id: "text", Icon: TextIcon, title: "Text" },
    { id: "eraser", Icon: EraserIcon, title: "Eraser" },
  ];

  return (
    <div className="drawing-toolbar">
      <div className="drawing-toolbar-row">
        {tools.map((t) => (
          <button
            key={t.id}
            className={tool === t.id ? "active" : ""}
            onClick={() => setTool(t.id)}
            title={t.title}
            type="button"
          >
            <t.Icon size={18} />
          </button>
        ))}
        <div className="drawing-toolbar-divider vertical" aria-hidden />
        <div className="drawing-toolbar-pop-anchor" ref={wrapRef}>
          <button
            type="button"
            className={styleOpen ? "active" : ""}
            onClick={() => setStyleOpen((o) => !o)}
            title="Stroke & color"
            aria-expanded={styleOpen}
          >
            <SlidersIcon size={18} />
          </button>
          {styleOpen && (
            <div className="drawing-style-popover" role="dialog" aria-label="Stroke and color">
              <div className="drawing-style-section">
                <span className="drawing-style-label">Stroke</span>
                <div className="drawing-style-widths">
                  {WIDTHS.map((w) => (
                    <button
                      key={w.value}
                      type="button"
                      className={`drawing-width-btn ${strokeWidth === w.value ? "active" : ""}`}
                      onClick={() => setStrokeWidth(w.value)}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="drawing-style-section">
                <span className="drawing-style-label">Color</span>
                <div className="drawing-style-colors">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="drawing-swatch-btn"
                      style={{
                        background: c,
                        boxShadow: c === color ? "0 0 0 2px var(--accent)" : "inset 0 0 0 1px var(--border)",
                      }}
                      title={c}
                    />
                  ))}
                  <label className="drawing-color-custom" title="Custom">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      aria-label="Custom color"
                    />
                    <span className="drawing-color-custom-fake" style={{ background: color }} />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
        <button type="button" onClick={onClear} title="Clear all">
          <TrashIcon size={18} />
        </button>
      </div>
    </div>
  );
}

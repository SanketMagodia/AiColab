"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getStroke } from "perfect-freehand";
import { v4 as uuid } from "uuid";
import type { Shape } from "@/lib/types";
import DrawingToolbar, { Tool } from "./DrawingToolbar";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/hooks/useToast";
import { PlusIcon, MinusIcon } from "@/components/layout/icons";

type Camera = { x: number; y: number; zoom: number };

function strokeToPath(points: number[][]): string {
  const stroke = getStroke(points, { size: 8, thinning: 0.5, smoothing: 0.5, streamline: 0.5 });
  if (!stroke.length) return "";
  let d = `M ${stroke[0][0]} ${stroke[0][1]}`;
  for (let i = 1; i < stroke.length; i++) {
    d += ` L ${stroke[i][0]} ${stroke[i][1]}`;
  }
  d += " Z";
  return d;
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function shapeBounds(s: Shape): { x: number; y: number; w: number; h: number } {
  if (s.type === "freehand" && s.points && s.points.length) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of s.points) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  return { x: s.x, y: s.y, w: s.width, h: s.height };
}

function hitTest(s: Shape, px: number, py: number): boolean {
  if (s.type === "freehand" && s.points) {
    for (let i = 1; i < s.points.length; i++) {
      const [x1, y1] = s.points[i - 1];
      const [x2, y2] = s.points[i];
      if (distToSegment(px, py, x1, y1, x2, y2) < 8) return true;
    }
    return false;
  }
  if (s.type === "rectangle") {
    return px >= s.x && px <= s.x + s.width && py >= s.y && py <= s.y + s.height;
  }
  if (s.type === "ellipse") {
    const cx = s.x + s.width / 2;
    const cy = s.y + s.height / 2;
    const rx = Math.abs(s.width / 2) || 1;
    const ry = Math.abs(s.height / 2) || 1;
    const dx = (px - cx) / rx;
    const dy = (py - cy) / ry;
    return dx * dx + dy * dy <= 1;
  }
  if (s.type === "arrow") {
    return distToSegment(px, py, s.x, s.y, s.x + s.width, s.y + s.height) < 8;
  }
  if (s.type === "text") {
    const w = (s.text?.length || 1) * 9;
    const h = 20;
    return px >= s.x && px <= s.x + w && py >= s.y - h && py <= s.y;
  }
  return false;
}

export default function DrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const shapesRef = useRef<Shape[]>([]);
  const [tool, setTool] = useState<Tool>("freehand");
  const [color, setColor] = useState("#ffffff");
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const cameraRef = useRef(camera);
  const [drawing, setDrawing] = useState<Shape | null>(null);
  const drawingRef = useRef<Shape | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<Shape[][]>([]);
  const [textInput, setTextInput] = useState<{ x: number; y: number; value: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState<{ startX: number; startY: number; camX: number; camY: number } | null>(null);
  const draggingId = useRef<{ id: string; offX: number; offY: number } | null>(null);
  const lastPushedAt = useRef(0);
  const toast = useToast();

  cameraRef.current = camera;
  shapesRef.current = shapes;
  drawingRef.current = drawing;

  // Initial load + 3s polling
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch("/api/drawing");
        const data = await res.json();
        if (mounted && Array.isArray(data.shapes)) {
          setShapes(data.shapes);
        }
      } catch {}
    }
    load();
    const id = setInterval(load, 3000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  // Save shapes to server (debounced via lastPushedAt)
  const pushShapes = useCallback(async (next: Shape[]) => {
    lastPushedAt.current = Date.now();
    try {
      await fetch("/api/drawing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shapes: next }),
      });
    } catch {}
  }, []);

  // Resize canvas to container
  useEffect(() => {
    function resize() {
      const c = canvasRef.current;
      const cont = containerRef.current;
      if (!c || !cont) return;
      const r = cont.getBoundingClientRect();
      c.width = r.width;
      c.height = r.height;
      draw();
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw when state changes
  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes, drawing, camera, selectedId]);

  function draw() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    const all = drawing ? [...shapes, drawing] : shapes;
    for (const s of all) drawShape(ctx, s);

    if (selectedId) {
      const sel = shapes.find((s) => s.id === selectedId);
      if (sel) {
        const b = shapeBounds(sel);
        ctx.strokeStyle = "#6c63ff";
        ctx.lineWidth = 1 / camera.zoom;
        ctx.setLineDash([4 / camera.zoom, 4 / camera.zoom]);
        ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }

  function drawShape(ctx: CanvasRenderingContext2D, s: Shape) {
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = s.strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (s.type === "freehand" && s.points && s.points.length) {
      const path = new Path2D(strokeToPath(s.points));
      ctx.fill(path);
    } else if (s.type === "rectangle") {
      ctx.strokeRect(s.x, s.y, s.width, s.height);
    } else if (s.type === "ellipse") {
      ctx.beginPath();
      ctx.ellipse(s.x + s.width / 2, s.y + s.height / 2, Math.abs(s.width / 2), Math.abs(s.height / 2), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (s.type === "arrow") {
      const x1 = s.x, y1 = s.y, x2 = s.x + s.width, y2 = s.y + s.height;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const head = 10 + s.strokeWidth;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    } else if (s.type === "text") {
      ctx.font = `${14 + s.strokeWidth * 2}px sans-serif`;
      ctx.fillText(s.text || "", s.x, s.y);
    }
  }

  function screenToWorld(clientX: number, clientY: number) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: (clientX - r.left - cameraRef.current.x) / cameraRef.current.zoom,
      y: (clientY - r.top - cameraRef.current.y) / cameraRef.current.zoom,
    };
  }

  function pushHistory() {
    setHistory((h) => [...h.slice(-49), shapesRef.current.map((s) => ({ ...s }))]);
  }

  // Keyboard
  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (e.code === "Space") setSpaceDown(true);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        setHistory((h) => {
          if (!h.length) return h;
          const prev = h[h.length - 1];
          setShapes(prev);
          pushShapes(prev);
          return h.slice(0, -1);
        });
      }
    }
    function up(e: KeyboardEvent) {
      if (e.code === "Space") setSpaceDown(false);
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [pushShapes]);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    if (spaceDown || e.button === 1) {
      setPanning({ startX: e.clientX, startY: e.clientY, camX: camera.x, camY: camera.y });
      return;
    }
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    if (tool === "select") {
      // hit test top-down
      for (let i = shapes.length - 1; i >= 0; i--) {
        if (hitTest(shapes[i], x, y)) {
          setSelectedId(shapes[i].id);
          const b = shapeBounds(shapes[i]);
          draggingId.current = { id: shapes[i].id, offX: x - b.x, offY: y - b.y };
          pushHistory();
          return;
        }
      }
      setSelectedId(null);
      return;
    }
    if (tool === "eraser") {
      for (let i = shapes.length - 1; i >= 0; i--) {
        if (hitTest(shapes[i], x, y)) {
          pushHistory();
          const next = shapes.filter((s) => s.id !== shapes[i].id);
          setShapes(next);
          pushShapes(next);
          return;
        }
      }
      return;
    }
    if (tool === "text") {
      setTextInput({ x, y, value: "" });
      return;
    }
    const base: Shape = {
      id: uuid(),
      type: tool === "freehand" ? "freehand" : tool === "rectangle" ? "rectangle" : tool === "ellipse" ? "ellipse" : "arrow",
      x,
      y,
      width: 0,
      height: 0,
      color,
      strokeWidth,
      points: tool === "freehand" ? [[x, y]] : undefined,
    };
    setDrawing(base);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (panning) {
      setCamera({ ...camera, x: panning.camX + (e.clientX - panning.startX), y: panning.camY + (e.clientY - panning.startY) });
      return;
    }
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    if (draggingId.current) {
      const { id, offX, offY } = draggingId.current;
      setShapes((prev) => prev.map((s) => {
        if (s.id !== id) return s;
        const b = shapeBounds(s);
        const dx = x - offX - b.x;
        const dy = y - offY - b.y;
        if (s.type === "freehand" && s.points) {
          return { ...s, points: s.points.map(([px, py]) => [px + dx, py + dy]) };
        }
        return { ...s, x: s.x + dx, y: s.y + dy };
      }));
      return;
    }
    if (!drawingRef.current) return;
    const cur = drawingRef.current;
    if (cur.type === "freehand") {
      setDrawing({ ...cur, points: [...(cur.points || []), [x, y]] });
    } else {
      setDrawing({ ...cur, width: x - cur.x, height: y - cur.y });
    }
  }

  function onPointerUp() {
    if (panning) { setPanning(null); return; }
    if (draggingId.current) {
      draggingId.current = null;
      pushShapes(shapesRef.current);
      return;
    }
    if (drawingRef.current) {
      pushHistory();
      const next = [...shapesRef.current, drawingRef.current];
      setShapes(next);
      setDrawing(null);
      pushShapes(next);
    }
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const newZoom = Math.min(5, Math.max(0.2, camera.zoom * (1 + delta)));
    const r = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const wx = (mx - camera.x) / camera.zoom;
    const wy = (my - camera.y) / camera.zoom;
    setCamera({ x: mx - wx * newZoom, y: my - wy * newZoom, zoom: newZoom });
  }

  function commitText() {
    if (!textInput) return;
    if (textInput.value.trim()) {
      pushHistory();
      const s: Shape = {
        id: uuid(),
        type: "text",
        x: textInput.x,
        y: textInput.y,
        width: textInput.value.length * 9,
        height: 20,
        color,
        strokeWidth,
        text: textInput.value,
      };
      const next = [...shapes, s];
      setShapes(next);
      pushShapes(next);
    }
    setTextInput(null);
  }

  function clearAll() {
    pushHistory();
    setShapes([]);
    pushShapes([]);
    setConfirmClear(false);
    toast.push("Drawing cleared");
  }

  return (
    <div>
      <h1 className="page-title">Drawing Board</h1>
      <div className="drawing-shell" ref={containerRef}>
        <DrawingToolbar
          tool={tool}
          setTool={setTool}
          color={color}
          setColor={setColor}
          strokeWidth={strokeWidth}
          setStrokeWidth={setStrokeWidth}
          onClear={() => setConfirmClear(true)}
        />
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
          style={{ display: "block", cursor: spaceDown ? "grab" : tool === "select" ? "default" : "crosshair", touchAction: "none" }}
        />
        {textInput && (
          <input
            autoFocus
            value={textInput.value}
            onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
            onBlur={commitText}
            onKeyDown={(e) => { if (e.key === "Enter") commitText(); if (e.key === "Escape") setTextInput(null); }}
            style={{
              position: "absolute",
              left: textInput.x * camera.zoom + camera.x,
              top: textInput.y * camera.zoom + camera.y - 24,
              width: 200,
              zIndex: 11,
            }}
          />
        )}
        <div className="zoom-controls">
          <button onClick={() => setCamera({ ...camera, zoom: Math.max(0.2, camera.zoom - 0.1) })} title="Zoom out">
            <MinusIcon size={16} />
          </button>
          <button className="label" onClick={() => setCamera({ x: 0, y: 0, zoom: 1 })} title="Reset zoom">
            {Math.round(camera.zoom * 100)}%
          </button>
          <button onClick={() => setCamera({ ...camera, zoom: Math.min(5, camera.zoom + 0.1) })} title="Zoom in">
            <PlusIcon size={16} />
          </button>
        </div>
      </div>
      <Modal
        open={confirmClear}
        title="Clear drawing?"
        message="This will erase the entire canvas for all users."
        onConfirm={clearAll}
        onCancel={() => setConfirmClear(false)}
        confirmLabel="Clear All"
      />
    </div>
  );
}

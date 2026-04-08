"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { TaskStatus } from "@/lib/types";

type DragState = {
  taskId: string | null;
  fromStatus: TaskStatus | null;
  pointerX: number;
  pointerY: number;
  title: string;
};

type Ctx = {
  state: DragState;
  startDrag: (taskId: string, fromStatus: TaskStatus, title: string, x: number, y: number) => void;
  registerColumn: (status: TaskStatus, el: HTMLElement | null) => void;
  hoveredStatus: TaskStatus | null;
};

const DnDContext = createContext<Ctx | null>(null);

export function DnDProvider({
  onDrop,
  children,
}: {
  onDrop: (taskId: string, from: TaskStatus, to: TaskStatus) => void;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<DragState>({ taskId: null, fromStatus: null, pointerX: 0, pointerY: 0, title: "" });
  const stateRef = useRef(state);
  stateRef.current = state;
  const cols = useRef<Map<TaskStatus, HTMLElement>>(new Map());
  const [hoveredStatus, setHoveredStatus] = useState<TaskStatus | null>(null);

  const registerColumn = useCallback((status: TaskStatus, el: HTMLElement | null) => {
    if (el) cols.current.set(status, el);
    else cols.current.delete(status);
  }, []);

  const findHovered = useCallback((x: number, y: number): TaskStatus | null => {
    for (const [status, el] of cols.current.entries()) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return status;
    }
    return null;
  }, []);

  const startDrag = useCallback((taskId: string, fromStatus: TaskStatus, title: string, x: number, y: number) => {
    setState({ taskId, fromStatus, pointerX: x, pointerY: y, title });
  }, []);

  useEffect(() => {
    if (!state.taskId) return;
    function move(e: PointerEvent) {
      setState((s) => ({ ...s, pointerX: e.clientX, pointerY: e.clientY }));
      setHoveredStatus(findHovered(e.clientX, e.clientY));
    }
    function up(e: PointerEvent) {
      const cur = stateRef.current;
      const target = findHovered(e.clientX, e.clientY);
      if (cur.taskId && cur.fromStatus && target && target !== cur.fromStatus) {
        onDrop(cur.taskId, cur.fromStatus, target);
      }
      setState({ taskId: null, fromStatus: null, pointerX: 0, pointerY: 0, title: "" });
      setHoveredStatus(null);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [state.taskId, findHovered, onDrop]);

  return (
    <DnDContext.Provider value={{ state, startDrag, registerColumn, hoveredStatus }}>
      {children}
      {state.taskId && (
        <div
          className="drag-ghost"
          style={{ left: state.pointerX + 12, top: state.pointerY + 12 }}
        >
          {state.title}
        </div>
      )}
    </DnDContext.Provider>
  );
}

export function useDnD() {
  const ctx = useContext(DnDContext);
  if (!ctx) throw new Error("useDnD must be inside DnDProvider");
  return ctx;
}

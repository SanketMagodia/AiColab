"use client";

import type { Task, TaskStatus, User } from "@/lib/types";
import { initials } from "./UserBar";
import { useDnD } from "./dnd";

type Props = {
  task: Task;
  users: User[];
  onClick: () => void;
};

export default function TaskCard({ task, users, onClick }: Props) {
  const user = users.find((u) => u._id === task.assignedUserId);
  const { startDrag, state } = useDnD();
  const isDragging = state.taskId === task._id;

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let started = false;
    function move(ev: PointerEvent) {
      if (!started && (Math.abs(ev.clientX - startX) > 5 || Math.abs(ev.clientY - startY) > 5)) {
        started = true;
        startDrag(task._id, task.status as TaskStatus, task.title, ev.clientX, ev.clientY);
        cleanup();
      }
    }
    function up() {
      cleanup();
    }
    function cleanup() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div
      className={`task-card ${isDragging ? "dragging" : ""}`}
      onClick={(e) => {
        if (state.taskId) return;
        onClick();
      }}
      onPointerDown={onPointerDown}
      style={{ touchAction: "none" }}
    >
      <div className="title">{task.title}</div>
      {task.description && <div className="desc">{task.description}</div>}
      <div className="meta">
        {task.project ? <span className="project-pill">{task.project}</span> : <span />}
        {user && (
          <div className="avatar sm" style={{ background: user.color }} title={user.name}>
            {initials(user.name)}
          </div>
        )}
      </div>
    </div>
  );
}

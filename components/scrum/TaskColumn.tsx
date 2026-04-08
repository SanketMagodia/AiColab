"use client";

import { useEffect, useRef, useState } from "react";
import type { Task, TaskStatus, User } from "@/lib/types";
import TaskCard from "./TaskCard";
import { useDnD } from "./dnd";

type Props = {
  status: TaskStatus;
  label: string;
  tasks: Task[];
  users: User[];
  onOpen: (task: Task) => void;
};

const colClass: Record<TaskStatus, string> = {
  todo: "col-todo",
  inprogress: "col-inprogress",
  finished: "col-finished",
};

export default function TaskColumn({ status, label, tasks, users, onOpen }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { registerColumn, hoveredStatus, state } = useDnD();

  useEffect(() => {
    registerColumn(status, ref.current);
    return () => registerColumn(status, null);
  }, [status, registerColumn]);

  const isHover = state.taskId && hoveredStatus === status && state.fromStatus !== status;

  return (
    <div ref={ref} className={`scrum-col ${colClass[status]} ${isHover ? "drop-target" : ""}`}>
      <div className="scrum-col-head" onClick={() => setCollapsed((c) => !c)}>
        <div className="name">
          <span className="dot" />
          {label}
          <span className="badge">{tasks.length}</span>
        </div>
        <span className="chev">{collapsed ? "›" : "⌄"}</span>
      </div>
      {!collapsed && (
        <div className="col-body">
          {tasks.length === 0 ? (
            <div className="empty-col">Drop tasks here</div>
          ) : (
            tasks.map((t) => (
              <TaskCard key={t._id} task={t} users={users} onClick={() => onOpen(t)} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

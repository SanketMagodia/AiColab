export type User = {
  _id: string;
  name: string;
  color: string;
  createdAt: string;
};

export type TaskStatus = "todo" | "inprogress" | "finished";

export type Section = {
  _id: string;
  name: string;
  createdAt: string;
};

export type Task = {
  _id: string;
  title: string;
  description: string;
  project: string;
  assignedUserId: string | null;
  sectionId: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
};

export type Credential = {
  _id: string;
  env: "DEV" | "QA" | "UAT" | "STAGING" | "PROD";
  label: string;
  username: string;
  password: string;
  createdAt: string;
};

export type Note = {
  _id: string;
  title: string;
  body: string;
  color: string;
  x: number;
  y: number;
  createdAt: string;
  updatedAt: string;
};

export type Shape = {
  id: string;
  type: "freehand" | "rectangle" | "ellipse" | "arrow" | "text";
  points?: number[][];
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
  text?: string;
};

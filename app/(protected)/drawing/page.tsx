"use client";

import dynamic from "next/dynamic";

const DrawingCanvas = dynamic(() => import("@/components/drawing/DrawingCanvas"), { ssr: false });

export default function DrawingPage() {
  return <DrawingCanvas />;
}

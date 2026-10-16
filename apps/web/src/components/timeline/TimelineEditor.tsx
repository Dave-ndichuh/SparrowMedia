"use client";

import React from "react";
import { TimelineControls } from "./TimelineControls";
import { TimelineCanvas } from "./TimelineCanvas";

export const TimelineEditor: React.FC = () => {
  return (
    <div className="flex flex-col h-full w-full bg-studio-950 border-t border-studio-800 overflow-hidden shadow-2xl">
      {/* Top Transport & Tool Deck */}
      <TimelineControls />

      {/* 60fps Canvas Timeline Area */}
      <div className="flex-1 w-full min-h-0 relative">
        <TimelineCanvas />
      </div>
    </div>
  );
};

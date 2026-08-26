"use client";

import { useState, type DragEvent } from "react";

/**
 * Drag-and-drop between kanban columns, shared by the pipeline and creative
 * boards. Native HTML5 dragging — no library, no bundle cost.
 *
 * `onMove` is called with the card id and the stage it was dropped on. The
 * caller is responsible for saving and refreshing.
 */
export function useBoardDrag(onMove: (id: string, stage: string) => void | Promise<void>) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  function cardProps(id: string) {
    return {
      draggable: true,
      onDragStart: (e: DragEvent) => {
        // Firefox refuses to start a drag unless data is set.
        e.dataTransfer.setData("text/plain", id);
        e.dataTransfer.effectAllowed = "move";
        setDragging(id);
      },
      onDragEnd: () => {
        setDragging(null);
        setOver(null);
      },
    };
  }

  function columnProps(stage: string) {
    return {
      onDragOver: (e: DragEvent) => {
        // Without preventDefault the browser won't allow a drop at all.
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (over !== stage) setOver(stage);
      },
      onDragLeave: () => setOver((o) => (o === stage ? null : o)),
      onDrop: async (e: DragEvent) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain") || dragging;
        setDragging(null);
        setOver(null);
        if (id) await onMove(id, stage);
      },
    };
  }

  return { dragging, over, cardProps, columnProps };
}

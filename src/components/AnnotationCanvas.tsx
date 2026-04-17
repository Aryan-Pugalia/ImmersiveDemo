import { useRef, useEffect, useState, useCallback } from "react";
import type { Annotation, DrawingTool } from "@/types/annotation";

type HandleType = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w" | "move" | null;

const HANDLE_SIZE = 8;

interface AnnotationCanvasProps {
  imageUrl: string;
  annotations: Annotation[];
  activeTool: DrawingTool;
  selectedId: string | null;
  opacity: number;
  onAnnotationDrawn: (bounds: { x: number; y: number; width: number; height: number }, shape: "rect" | "ellipse") => void;
  onAnnotationSelected: (id: string | null) => void;
  onAnnotationUpdated?: (id: string, bounds: { x: number; y: number; width: number; height: number }) => void;
}

export function AnnotationCanvas({
  imageUrl,
  annotations,
  activeTool,
  selectedId,
  opacity,
  onAnnotationDrawn,
  onAnnotationSelected,
  onAnnotationUpdated,
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [drawEnd, setDrawEnd] = useState({ x: 0, y: 0 });

  // Resize/move state
  const [dragHandle, setDragHandle] = useState<HandleType>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOrigBounds, setDragOrigBounds] = useState({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    if (!imgLoaded || !imgRef.current || !containerRef.current) return;
    const container = containerRef.current;
    const img = imgRef.current;
    const maxW = container.clientWidth;
    const maxH = window.innerHeight * 0.7;
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
    setCanvasSize({
      width: Math.round(img.naturalWidth * scale),
      height: Math.round(img.naturalHeight * scale),
    });
  }, [imgLoaded]);

  // Get handle positions for a selected annotation (in pixel coords)
  const getHandles = useCallback(
    (ann: Annotation) => {
      const { width, height } = canvasSize;
      const rx = ann.bounds.x * width;
      const ry = ann.bounds.y * height;
      const rw = ann.bounds.width * width;
      const rh = ann.bounds.height * height;
      const hs = HANDLE_SIZE / 2;
      return {
        nw: { x: rx - hs, y: ry - hs },
        n: { x: rx + rw / 2 - hs, y: ry - hs },
        ne: { x: rx + rw - hs, y: ry - hs },
        w: { x: rx - hs, y: ry + rh / 2 - hs },
        e: { x: rx + rw - hs, y: ry + rh / 2 - hs },
        sw: { x: rx - hs, y: ry + rh - hs },
        s: { x: rx + rw / 2 - hs, y: ry + rh - hs },
        se: { x: rx + rw - hs, y: ry + rh - hs },
      };
    },
    [canvasSize]
  );

  const hitTestHandle = useCallback(
    (px: number, py: number, ann: Annotation): HandleType => {
      const handles = getHandles(ann);
      for (const [key, pos] of Object.entries(handles)) {
        if (
          px >= pos.x - 2 &&
          px <= pos.x + HANDLE_SIZE + 2 &&
          py >= pos.y - 2 &&
          py <= pos.y + HANDLE_SIZE + 2
        ) {
          return key as HandleType;
        }
      }
      // Check if inside bounds (for move)
      const { width, height } = canvasSize;
      const b = ann.bounds;
      const nx = px / width;
      const ny = py / height;
      if (nx >= b.x && nx <= b.x + b.width && ny >= b.y && ny <= b.y + b.height) {
        return "move";
      }
      return null;
    },
    [canvasSize, getHandles]
  );

  const paint = useCallback(() => {
    if (!canvasRef.current || !imgRef.current || !canvasSize.width) return;
    const ctx = canvasRef.current.getContext("2d")!;
    const { width, height } = canvasSize;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(imgRef.current, 0, 0, width, height);

    const alpha = opacity / 100;

    annotations.forEach((ann) => {
      const rx = ann.bounds.x * width;
      const ry = ann.bounds.y * height;
      const rw = ann.bounds.width * width;
      const rh = ann.bounds.height * height;
      const hex = ann.color.replace("#", "");
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.3})`;
      ctx.strokeStyle =
        ann.id === selectedId
          ? `rgba(255, 255, 255, 1)`
          : `rgba(${r}, ${g}, ${b}, ${Math.min(alpha + 0.4, 1)})`;
      ctx.lineWidth = ann.id === selectedId ? 3 : 2;

      if (ann.id === selectedId) {
        ctx.setLineDash([6, 3]);
      } else {
        ctx.setLineDash([]);
      }

      if (ann.shape === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(rx + rw / 2, ry + rh / 2, rw / 2, rh / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeRect(rx, ry, rw, rh);
      }
      ctx.setLineDash([]);

      // Label
      if (ann.label) {
        ctx.font = "bold 13px system-ui";
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(alpha + 0.5, 1)})`;
        ctx.strokeStyle = `rgba(0, 0, 0, 0.7)`;
        ctx.lineWidth = 3;
        ctx.strokeText(ann.label, rx + 4, ry + 16);
        ctx.fillText(ann.label, rx + 4, ry + 16);
      }

      // Draw resize handles for selected annotation
      if (ann.id === selectedId) {
        const handles = getHandles(ann);
        ctx.setLineDash([]);
        Object.values(handles).forEach((pos) => {
          ctx.fillStyle = "white";
          ctx.strokeStyle = "rgba(59, 130, 246, 1)";
          ctx.lineWidth = 2;
          ctx.fillRect(pos.x, pos.y, HANDLE_SIZE, HANDLE_SIZE);
          ctx.strokeRect(pos.x, pos.y, HANDLE_SIZE, HANDLE_SIZE);
        });
      }
    });

    // Draw in-progress shape
    if (drawing) {
      const sx = Math.min(drawStart.x, drawEnd.x);
      const sy = Math.min(drawStart.y, drawEnd.y);
      const sw = Math.abs(drawEnd.x - drawStart.x);
      const sh = Math.abs(drawEnd.y - drawStart.y);
      ctx.strokeStyle = "rgba(59, 130, 246, 0.9)";
      ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);

      if (activeTool === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(sx + sw / 2, sy + sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(sx, sy, sw, sh);
        ctx.strokeRect(sx, sy, sw, sh);
      }
      ctx.setLineDash([]);
    }
  }, [canvasSize, annotations, opacity, selectedId, drawing, drawStart, drawEnd, activeTool, getHandles]);

  useEffect(() => {
    paint();
  }, [paint]);

  const getCanvasPos = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const getCursorForHandle = (handle: HandleType): string => {
    switch (handle) {
      case "nw": case "se": return "nwse-resize";
      case "ne": case "sw": return "nesw-resize";
      case "n": case "s": return "ns-resize";
      case "e": case "w": return "ew-resize";
      case "move": return "move";
      default: return activeTool === "select" ? "default" : "crosshair";
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getCanvasPos(e);

    // If in select mode and there's a selected annotation, check for handle/move
    if (activeTool === "select" && selectedId) {
      const selAnn = annotations.find((a) => a.id === selectedId);
      if (selAnn) {
        const handle = hitTestHandle(pos.x, pos.y, selAnn);
        if (handle) {
          setDragHandle(handle);
          setDragStart({ x: pos.x, y: pos.y });
          setDragOrigBounds({ ...selAnn.bounds });
          return;
        }
      }
    }

    if (activeTool === "select") {
      const nx = pos.x / canvasSize.width;
      const ny = pos.y / canvasSize.height;
      const found = [...annotations].reverse().find((a) => {
        const b = a.bounds;
        return nx >= b.x && nx <= b.x + b.width && ny >= b.y && ny <= b.y + b.height;
      });
      onAnnotationSelected(found?.id ?? null);
      return;
    }

    setDrawing(true);
    setDrawStart(pos);
    setDrawEnd(pos);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getCanvasPos(e);

    // Handle dragging (resize/move)
    if (dragHandle && selectedId && onAnnotationUpdated) {
      const { width, height } = canvasSize;
      const dx = (pos.x - dragStart.x) / width;
      const dy = (pos.y - dragStart.y) / height;
      const ob = dragOrigBounds;
      let newBounds = { ...ob };

      switch (dragHandle) {
        case "move":
          newBounds.x = Math.max(0, Math.min(ob.x + dx, 1 - ob.width));
          newBounds.y = Math.max(0, Math.min(ob.y + dy, 1 - ob.height));
          break;
        case "nw":
          newBounds.x = Math.min(ob.x + dx, ob.x + ob.width - 0.02);
          newBounds.y = Math.min(ob.y + dy, ob.y + ob.height - 0.02);
          newBounds.width = ob.width - (newBounds.x - ob.x);
          newBounds.height = ob.height - (newBounds.y - ob.y);
          break;
        case "ne":
          newBounds.y = Math.min(ob.y + dy, ob.y + ob.height - 0.02);
          newBounds.width = Math.max(0.02, ob.width + dx);
          newBounds.height = ob.height - (newBounds.y - ob.y);
          break;
        case "sw":
          newBounds.x = Math.min(ob.x + dx, ob.x + ob.width - 0.02);
          newBounds.width = ob.width - (newBounds.x - ob.x);
          newBounds.height = Math.max(0.02, ob.height + dy);
          break;
        case "se":
          newBounds.width = Math.max(0.02, ob.width + dx);
          newBounds.height = Math.max(0.02, ob.height + dy);
          break;
        case "n":
          newBounds.y = Math.min(ob.y + dy, ob.y + ob.height - 0.02);
          newBounds.height = ob.height - (newBounds.y - ob.y);
          break;
        case "s":
          newBounds.height = Math.max(0.02, ob.height + dy);
          break;
        case "w":
          newBounds.x = Math.min(ob.x + dx, ob.x + ob.width - 0.02);
          newBounds.width = ob.width - (newBounds.x - ob.x);
          break;
        case "e":
          newBounds.width = Math.max(0.02, ob.width + dx);
          break;
      }

      // Clamp to canvas
      newBounds.x = Math.max(0, newBounds.x);
      newBounds.y = Math.max(0, newBounds.y);
      newBounds.width = Math.min(newBounds.width, 1 - newBounds.x);
      newBounds.height = Math.min(newBounds.height, 1 - newBounds.y);

      onAnnotationUpdated(selectedId, newBounds);
      return;
    }

    // Update cursor on hover over handles
    if (activeTool === "select" && selectedId && !drawing) {
      const selAnn = annotations.find((a) => a.id === selectedId);
      if (selAnn && canvasRef.current) {
        const handle = hitTestHandle(pos.x, pos.y, selAnn);
        canvasRef.current.style.cursor = getCursorForHandle(handle);
        return;
      }
    }

    if (!drawing) {
      if (canvasRef.current) {
        canvasRef.current.style.cursor = activeTool === "select" ? "default" : "crosshair";
      }
      return;
    }
    setDrawEnd(pos);
  };

  const handleMouseUp = () => {
    if (dragHandle) {
      setDragHandle(null);
      return;
    }
    if (!drawing) return;
    setDrawing(false);
    const { width, height } = canvasSize;
    const x1 = Math.min(drawStart.x, drawEnd.x) / width;
    const y1 = Math.min(drawStart.y, drawEnd.y) / height;
    const w = Math.abs(drawEnd.x - drawStart.x) / width;
    const h = Math.abs(drawEnd.y - drawStart.y) / height;
    if (w > 0.01 && h > 0.01) {
      onAnnotationDrawn({ x: x1, y: y1, width: w, height: h }, activeTool as "rect" | "ellipse");
    }
  };

  return (
    <div ref={containerRef} className="w-full flex justify-center">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="rounded-xl shadow-2xl max-w-full"
        style={{ cursor: activeTool === "select" ? "default" : "crosshair" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (drawing) setDrawing(false);
          if (dragHandle) setDragHandle(null);
        }}
      />
    </div>
  );
}

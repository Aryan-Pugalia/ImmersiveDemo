import React, { useRef, useState, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut, Maximize2, X, RotateCcw } from "lucide-react";

interface Props {
  imageUrl: string;
  label: string;
  side: "A" | "B";
}

export function ImagePanelAB({ imageUrl, label, side }: Props) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [imgError, setImgError] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const isDragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, tx: 0, ty: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const accentColor = side === "A" ? "#6366f1" : "#7c3aed"; // indigo vs violet

  const reset = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const zoom = useCallback((delta: number) => {
    setScale((s) => Math.max(0.5, Math.min(5, s + delta)));
  }, []);

  // Wheel to zoom
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.max(0.5, Math.min(5, s - e.deltaY * 0.0015)));
  }, []);

  // Mouse drag to pan
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    dragStart.current = {
      mx: e.clientX,
      my: e.clientY,
      tx: translate.x,
      ty: translate.y,
    };
  }, [translate]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - dragStart.current.mx;
      const dy = e.clientY - dragStart.current.my;
      setTranslate({ x: dragStart.current.tx + dx, y: dragStart.current.ty + dy });
    };
    const onMouseUp = () => { isDragging.current = false; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const imageStyle: React.CSSProperties = {
    transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
    transformOrigin: "center center",
    cursor: isDragging.current ? "grabbing" : scale > 1 ? "grab" : "default",
    userSelect: "none",
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    display: "block",
  };

  const panelContent = (inFullscreen = false) => (
    <div
      className="relative flex flex-col bg-[hsl(0,0%,5%)] overflow-hidden h-full"
      style={{ borderRadius: inFullscreen ? 0 : "0.75rem" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 border-b shrink-0"
        style={{ borderColor: accentColor + "33", background: "hsl(0,0%,7%)" }}
      >
        <span
          className="text-sm font-bold px-3 py-1 rounded-full text-white"
          style={{ background: accentColor }}
        >
          Image {label}
        </span>
        <div className="flex items-center gap-0.5">
          <PanelBtn title="Zoom in" onClick={() => zoom(0.3)}>
            <ZoomIn className="w-4 h-4" />
          </PanelBtn>
          <PanelBtn title="Zoom out" onClick={() => zoom(-0.3)}>
            <ZoomOut className="w-4 h-4" />
          </PanelBtn>
          <PanelBtn title="Reset zoom" onClick={reset}>
            <RotateCcw className="w-4 h-4" />
          </PanelBtn>
          {!inFullscreen && (
            <PanelBtn title="Fullscreen" onClick={() => setFullscreen(true)}>
              <Maximize2 className="w-4 h-4" />
            </PanelBtn>
          )}
          {inFullscreen && (
            <PanelBtn title="Close" onClick={() => setFullscreen(false)}>
              <X className="w-4 h-4" />
            </PanelBtn>
          )}
        </div>
      </div>

      {/* Image area */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden min-h-0"
        style={{ background: "#080810" }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onDoubleClick={reset}
      >
        {imgError ? (
          <div className="flex flex-col items-center text-muted-foreground p-8 text-center gap-3">
            <svg className="w-12 h-12 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">Image failed to load</p>
            <p className="text-sm opacity-50 break-all">{imageUrl}</p>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={`Image ${label}`}
            style={imageStyle}
            draggable={false}
            onError={() => setImgError(true)}
          />
        )}
      </div>

      {/* Scale indicator */}
      {scale !== 1 && (
        <div className="absolute bottom-2 right-2 text-sm font-mono text-white/70 bg-black/60 px-2.5 py-1 rounded">
          {(scale * 100).toFixed(0)}%
        </div>
      )}
    </div>
  );

  return (
    <>
      {panelContent(false)}

      {/* Fullscreen overlay */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
          onClick={() => setFullscreen(false)}
        >
          <div
            className="w-full h-full"
            onClick={(e) => e.stopPropagation()}
          >
            {panelContent(true)}
          </div>
        </div>
      )}
    </>
  );
}

function PanelBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="p-1.5 rounded text-gray-400 hover:text-gray-100 hover:bg-white/10 transition-colors"
    >
      {children}
    </button>
  );
}

import { useRef, useEffect, useState, useCallback } from "react";
import type { SegmentedRegion } from "@/types/segmentation";

interface SegmentationCanvasProps {
  imageUrl: string;
  regions: SegmentedRegion[];
  overlayVisible: boolean;
  opacity: number;
  onRegionClick: (region: SegmentedRegion, x: number, y: number) => void;
}

export function SegmentationCanvas({
  imageUrl,
  regions,
  overlayVisible,
  opacity,
  onRegionClick,
}: SegmentationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

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
    const maxH = window.innerHeight * 0.65;
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    setCanvasSize({ width: w, height: h });
  }, [imgLoaded]);

  useEffect(() => {
    if (!canvasRef.current || !imgRef.current || !canvasSize.width) return;
    const ctx = canvasRef.current.getContext("2d")!;
    const { width, height } = canvasSize;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(imgRef.current, 0, 0, width, height);

    if (!overlayVisible || regions.length === 0) return;

    regions.forEach((region) => {
      const rx = region.bounds.x * width;
      const ry = region.bounds.y * height;
      const rw = region.bounds.width * width;
      const rh = region.bounds.height * height;

      // Parse hex color and apply opacity
      const hex = region.color.replace("#", "");
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const alpha = opacity / 100;

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.4})`;
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(alpha + 0.3, 1)})`;
      ctx.lineWidth = 2;

      if (region.shape === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(rx + rw / 2, ry + rh / 2, rw / 2, rh / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeRect(rx, ry, rw, rh);
      }

      // Label
      ctx.font = "bold 12px system-ui";
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(alpha + 0.5, 1)})`;
      ctx.strokeStyle = `rgba(0, 0, 0, 0.6)`;
      ctx.lineWidth = 3;
      ctx.strokeText(region.name, rx + 4, ry + 16);
      ctx.fillText(region.name, rx + 4, ry + 16);
    });
  }, [canvasSize, regions, overlayVisible, opacity]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!canvasRef.current || !overlayVisible) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const nx = x / canvasSize.width;
      const ny = y / canvasSize.height;

      for (const region of regions) {
        const b = region.bounds;
        if (nx >= b.x && nx <= b.x + b.width && ny >= b.y && ny <= b.y + b.height) {
          onRegionClick(region, e.clientX, e.clientY);
          return;
        }
      }
    },
    [regions, canvasSize, overlayVisible, onRegionClick]
  );

  return (
    <div ref={containerRef} className="w-full flex justify-center">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="rounded-xl shadow-2xl cursor-crosshair max-w-full"
        onClick={handleCanvasClick}
      />
    </div>
  );
}

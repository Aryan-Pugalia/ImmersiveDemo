import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  X,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────
export interface VideoPairPlayerProps {
  leftUrl: string;
  rightUrl: string;
  fps: number;
  hasAudio: boolean;
  labelA?: string;
  labelB?: string;
}

export interface VideoPairPlayerHandle {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
}

const DRIFT_THRESHOLD = 0.05; // seconds

// ─── Component ──────────────────────────────────────────────────────────────
export const VideoPairPanel = forwardRef<
  VideoPairPlayerHandle,
  VideoPairPlayerProps
>(function VideoPairPanel(
  { leftUrl, rightUrl, fps, hasAudio, labelA = "A", labelB = "B" },
  ref
) {
  const leftRef = useRef<HTMLVideoElement>(null);
  const rightRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(0);
  const isPlayingRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  // Read real duration from the video element itself
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [leftReady, setLeftReady] = useState(false);
  const [rightReady, setRightReady] = useState(false);

  // Audio
  const [muted, setMuted] = useState(false);
  const [soloSide, setSoloSide] = useState<"A" | "B" | null>(null);
  const [fullscreenSide, setFullscreenSide] = useState<"A" | "B" | null>(null);

  // ── Apply audio state to video elements ──────────────────────────────────
  useEffect(() => {
    const l = leftRef.current;
    const r = rightRef.current;
    if (!l || !r) return;
    l.muted = muted || soloSide === "B";
    r.muted = muted || soloSide === "A";
  }, [muted, soloSide]);

  // ── Reset everything when URLs change ────────────────────────────────────
  useEffect(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLeftReady(false);
    setRightReady(false);
    cancelAnimationFrame(rafRef.current);
  }, [leftUrl, rightUrl]);

  // ── RAF sync loop — only updates time display and corrects drift ─────────
  // No manual end-detection. Browser fires onEnded naturally.
  const syncLoop = useCallback(() => {
    const l = leftRef.current;
    const r = rightRef.current;
    if (!l || !r || !isPlayingRef.current) return;

    // Correct drift between the two videos
    const drift = Math.abs(l.currentTime - r.currentTime);
    if (drift > DRIFT_THRESHOLD) {
      r.currentTime = l.currentTime;
    }

    setCurrentTime(l.currentTime);
    rafRef.current = requestAnimationFrame(syncLoop);
  }, []);

  // ── Natural video end handler ─────────────────────────────────────────────
  const handleEnded = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    cancelAnimationFrame(rafRef.current);
    // Pause the right video too in case it's slightly behind
    rightRef.current?.pause();
    // Show final time
    const l = leftRef.current;
    if (l) setCurrentTime(l.duration || l.currentTime);
  }, []);

  // ── Playback controls ──────────────────────────────────────────────────────
  const play = useCallback(() => {
    const l = leftRef.current;
    const r = rightRef.current;
    if (!l || !r) return;

    // If at end, restart from beginning
    if (l.ended || (l.duration > 0 && l.currentTime >= l.duration - 0.1)) {
      l.currentTime = 0;
      r.currentTime = 0;
    } else {
      r.currentTime = l.currentTime;
    }

    isPlayingRef.current = true;
    setIsPlaying(true);
    rafRef.current = requestAnimationFrame(syncLoop);

    Promise.all([l.play(), r.play()]).catch(() => {
      // Fallback: retry muted if browser blocks audio autoplay
      l.muted = true;
      r.muted = true;
      Promise.all([l.play(), r.play()]).catch(() => {
        isPlayingRef.current = false;
        setIsPlaying(false);
        cancelAnimationFrame(rafRef.current);
      });
    });
  }, [syncLoop]);

  const pause = useCallback(() => {
    leftRef.current?.pause();
    rightRef.current?.pause();
    isPlayingRef.current = false;
    setIsPlaying(false);
    cancelAnimationFrame(rafRef.current);
  }, []);

  const seek = useCallback((t: number) => {
    const l = leftRef.current;
    const r = rightRef.current;
    if (!l || !r) return;
    const dur = l.duration || duration;
    const clamped = Math.max(0, Math.min(dur, t));
    l.currentTime = clamped;
    r.currentTime = clamped;
    setCurrentTime(clamped);
  }, [duration]);

  const stepFrame = useCallback(
    (dir: 1 | -1) => {
      pause();
      const l = leftRef.current;
      if (!l) return;
      seek(l.currentTime + (dir * 1) / fps);
    },
    [pause, seek, fps]
  );

  const setPlayRate = useCallback((r: number) => {
    if (leftRef.current) leftRef.current.playbackRate = r;
    if (rightRef.current) rightRef.current.playbackRate = r;
    setRate(r);
  }, []);

  useImperativeHandle(ref, () => ({ play, pause, seek }), [play, pause, seek]);

  const bothReady = leftReady && rightReady;
  const displayDuration = duration || 0;

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Video pair */}
      <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
        <VideoFrame
          videoRef={leftRef}
          url={leftUrl}
          label={labelA}
          accent="#6366f1"
          ready={leftReady}
          soloed={soloSide === "A"}
          onReady={(dur) => {
            setLeftReady(true);
            if (dur > 0) setDuration(dur);
          }}
          onError={() => setLeftReady(false)}
          onEnded={handleEnded}
          onSolo={() => setSoloSide((s) => (s === "A" ? null : "A"))}
          onFullscreen={() => setFullscreenSide("A")}
        />
        <VideoFrame
          videoRef={rightRef}
          url={rightUrl}
          label={labelB}
          accent="#7c3aed"
          ready={rightReady}
          soloed={soloSide === "B"}
          onReady={(dur) => setRightReady(true)}
          onError={() => setRightReady(false)}
          onEnded={() => {/* left video drives end handling */}}
          onSolo={() => setSoloSide((s) => (s === "B" ? null : "B"))}
          onFullscreen={() => setFullscreenSide("B")}
        />
      </div>

      {/* Seek bar */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm text-muted-foreground tabular-nums w-14 text-right font-mono">
          {formatTime(currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={displayDuration || 1}
          step={displayDuration > 0 ? 1 / fps : 0.001}
          value={currentTime}
          onChange={(e) => seek(parseFloat(e.target.value))}
          className="flex-1 h-1.5 accent-primary cursor-pointer"
          aria-label="Seek"
        />
        <span className="text-sm text-muted-foreground tabular-nums w-14 font-mono">
          {formatTime(displayDuration)}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap shrink-0 pb-1">
        <ControlBtn onClick={() => stepFrame(-1)} title="Step back 1 frame (←)">
          <SkipBack className="w-4 h-4" />
        </ControlBtn>

        <button
          onClick={isPlaying ? pause : play}
          className="flex items-center gap-2 px-4 h-9 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition"
          title="Play / Pause"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {isPlaying ? "Pause" : "Play"}
        </button>

        <ControlBtn onClick={() => stepFrame(1)} title="Step forward 1 frame (→)">
          <SkipForward className="w-4 h-4" />
        </ControlBtn>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Speed */}
        <div className="flex items-center gap-1">
          {([0.25, 0.5, 1] as const).map((r) => (
            <button
              key={r}
              onClick={() => setPlayRate(r)}
              className={`px-2.5 h-8 rounded text-sm font-mono font-semibold transition ${
                rate === r
                  ? "bg-primary/20 border border-primary/50 text-primary"
                  : "bg-surface-raised border border-border text-muted-foreground hover:border-muted-foreground/40"
              }`}
            >
              {r}×
            </button>
          ))}
        </div>

        {hasAudio && (
          <>
            <div className="w-px h-5 bg-border mx-1" />

            {/* Mute toggle */}
            <button
              onClick={() => setMuted((v) => !v)}
              className={`flex items-center gap-1.5 px-2.5 h-8 rounded text-sm font-semibold border transition ${
                muted
                  ? "bg-red-600/15 border-red-500/40 text-red-400"
                  : "bg-surface-raised border-border text-muted-foreground hover:border-muted-foreground/40"
              }`}
              title="Mute both"
            >
              {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              {muted ? "Muted" : "Audio"}
            </button>

            {/* Solo A / B */}
            <div className="flex items-center gap-0.5">
              <span className="text-sm text-muted-foreground uppercase tracking-widest mr-1">Solo</span>
              {(["A", "B"] as const).map((s) => {
                const active = soloSide === s;
                const color = s === "A" ? "#6366f1" : "#7c3aed";
                return (
                  <button
                    key={s}
                    onClick={() => setSoloSide(active ? null : s)}
                    className="w-7 h-8 rounded text-sm font-bold border transition"
                    style={{
                      background: active ? color : "hsl(0,0%,9%)",
                      borderColor: active ? color : "hsl(var(--border))",
                      color: active ? "#fff" : "hsl(var(--muted-foreground))",
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {!bothReady && (
          <span className="text-sm text-amber-400 ml-2 animate-pulse font-medium">
            Loading…
          </span>
        )}
      </div>

      {/* Fullscreen overlay */}
      {fullscreenSide && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setFullscreenSide(null)}
        >
          <div
            className="relative w-full max-w-6xl aspect-video"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              src={fullscreenSide === "A" ? leftUrl : rightUrl}
              controls
              autoPlay
              className="w-full h-full object-contain rounded-lg"
            />
            <button
              onClick={() => setFullscreenSide(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
            <span
              className="absolute top-3 left-3 px-3 py-1 rounded-full text-sm font-bold text-white"
              style={{ background: fullscreenSide === "A" ? "#6366f1" : "#7c3aed" }}
            >
              Video {fullscreenSide}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

// ─── Single video frame ──────────────────────────────────────────────────────
function VideoFrame({
  videoRef,
  url,
  label,
  accent,
  ready,
  soloed,
  onReady,
  onError,
  onEnded,
  onSolo,
  onFullscreen,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  url: string;
  label: string;
  accent: string;
  ready: boolean;
  soloed: boolean;
  onReady: (duration: number) => void;
  onError: () => void;
  onEnded: () => void;
  onSolo: () => void;
  onFullscreen: () => void;
}) {
  return (
    <div
      className="relative flex flex-col h-full bg-[hsl(0,0%,5%)] overflow-hidden rounded-xl border"
      style={{ borderColor: accent + "33" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b shrink-0"
        style={{ borderColor: accent + "33", background: "hsl(0,0%,7%)" }}
      >
        <span
          className="text-sm font-bold px-3 py-1 rounded-full text-white"
          style={{ background: accent }}
        >
          Video {label}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onSolo}
            title={soloed ? "Un-solo audio" : "Solo audio"}
            className={`p-1.5 rounded transition ${
              soloed ? "bg-white/15 text-white" : "text-gray-400 hover:text-gray-100 hover:bg-white/10"
            }`}
          >
            {soloed ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={onFullscreen}
            title="Fullscreen"
            className="p-1.5 rounded text-gray-400 hover:text-gray-100 hover:bg-white/10 transition"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Video */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden min-h-0 relative"
        style={{ background: "#080810" }}
      >
        <video
          ref={videoRef}
          src={url}
          className="w-full h-full object-contain"
          preload="auto"
          playsInline
          loop={false}
          onLoadedMetadata={(e) => {
            // Read actual duration from the element, not a hardcoded prop
            const vid = e.currentTarget;
            onReady(isFinite(vid.duration) ? vid.duration : 0);
          }}
          onCanPlay={(e) => {
            const vid = e.currentTarget;
            onReady(isFinite(vid.duration) ? vid.duration : 0);
          }}
          onEnded={onEnded}
          onError={onError}
        />
        {!ready && (
          <span className="absolute top-2 left-2 bg-yellow-500/80 text-black text-sm px-2 py-0.5 rounded animate-pulse font-bold">
            Loading
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function ControlBtn({
  onClick,
  title,
  disabled,
  children,
}: {
  onClick: () => void;
  title?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="flex items-center justify-center w-9 h-9 rounded bg-surface-raised border border-border hover:border-muted-foreground/40 disabled:opacity-40 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground transition"
    >
      {children}
    </button>
  );
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00.00";
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2).padStart(5, "0");
  return `${m}:${s}`;
}

/**
 * VideoObjectTracking.tsx
 * "Tracking Through Obstacles – Gaming AI"
 * 4-stage pipeline: AI Output → Human Annotation → QA Review → Delivered
 * CS:GO / Tactical FPS overhead tracking with smoke occlusion scenario.
 * Real MP4 video with mocked tracking overlay — no backend required.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ChevronRight, Play, Pause, SkipForward, SkipBack,
  AlertTriangle, Check, RefreshCw, ZapOff, Eye, Crosshair,
  ShieldAlert, ChevronLeft, ChevronRight as ChevronRightIcon,
  Target, Activity, Layers, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/context/ThemeContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = 1 | 2 | 3 | 4;

type TrackStatus =
  | "tracking"
  | "partial_occlusion"
  | "full_occlusion"
  | "lost"
  | "id_switch"
  | "recovered";

interface TrackBox {
  id:     string;
  label:  string;
  bbox:   [number, number, number, number]; // [x, y, w, h] normalised 0-1
  conf:   number;
  status: TrackStatus;
  color:  string;
}

interface TrackKeyframe {
  t:      number; // video time in seconds
  tracks: TrackBox[];
}

interface Annotation {
  id:        string;
  trackId:   string;
  bbox:      [number, number, number, number];
  eventType: EventType;
  color:     string;
  frame:     number; // approx frame number
}

type EventType =
  | "partial_occlusion"
  | "full_occlusion"
  | "reappearance"
  | "re_identification"
  | "tracking_failure"
  | "tracking_recovery";

// ─── Constants ────────────────────────────────────────────────────────────────

const VIDEO_SRC = "/videos/cs-game-tracking.mp4";

const TRACK_COLORS: Record<string, string> = {
  "PLR-01": "#22d3ee",  // cyan  – primary suspect
  "PLR-02": "#f59e0b",  // amber
  "PLR-03": "#a855f7",  // purple
  "PLR-05": "#ef4444",  // red   – wrong ID after smoke switch
};

const STATUS_META: Record<TrackStatus, { label: string; color: string; icon: string }> = {
  tracking:          { label: "Tracking",         color: "#22d3ee", icon: "✓" },
  partial_occlusion: { label: "Partial Occlusion", color: "#f59e0b", icon: "◑" },
  full_occlusion:    { label: "Full Occlusion",    color: "#f97316", icon: "●" },
  lost:              { label: "Track Lost",         color: "#ef4444", icon: "✕" },
  id_switch:         { label: "ID Switch",          color: "#ef4444", icon: "⚠" },
  recovered:         { label: "Recovered",          color: "#22c55e", icon: "↺" },
};

const EVENT_TYPES: { id: EventType; label: string; color: string }[] = [
  { id: "partial_occlusion",  label: "Partial Occlusion",    color: "#f59e0b" },
  { id: "full_occlusion",     label: "Full Occlusion",       color: "#f97316" },
  { id: "reappearance",       label: "Reappearance",         color: "#22c55e" },
  { id: "re_identification",  label: "Re-Identification",    color: "#3b82f6" },
  { id: "tracking_failure",   label: "Tracking Failure",     color: "#ef4444" },
  { id: "tracking_recovery",  label: "Tracking Recovery",    color: "#a855f7" },
];

// ─── Mocked tracking keyframes ────────────────────────────────────────────────
// CS:GO overhead radar-style clip. PLR-01 (cyan) is the suspect player.
// Enters smoke cloud at t≈2.5s → fully hidden → exits with wrong ID (PLR-05).

const KEYFRAMES: TrackKeyframe[] = [
  // ── Phase 1: Clean tracking — players in open area ───────────────────────
  { t: 0.0, tracks: [
    { id: "PLR-01", label: "PLR-01", bbox: [0.07, 0.38, 0.13, 0.16], conf: 0.97, status: "tracking",   color: TRACK_COLORS["PLR-01"] },
    { id: "PLR-02", label: "PLR-02", bbox: [0.42, 0.18, 0.12, 0.15], conf: 0.94, status: "tracking",   color: TRACK_COLORS["PLR-02"] },
    { id: "PLR-03", label: "PLR-03", bbox: [0.70, 0.57, 0.12, 0.15], conf: 0.91, status: "tracking",   color: TRACK_COLORS["PLR-03"] },
  ]},
  { t: 0.5, tracks: [
    { id: "PLR-01", label: "PLR-01", bbox: [0.12, 0.39, 0.13, 0.16], conf: 0.96, status: "tracking",   color: TRACK_COLORS["PLR-01"] },
    { id: "PLR-02", label: "PLR-02", bbox: [0.46, 0.20, 0.12, 0.15], conf: 0.93, status: "tracking",   color: TRACK_COLORS["PLR-02"] },
    { id: "PLR-03", label: "PLR-03", bbox: [0.67, 0.54, 0.12, 0.15], conf: 0.90, status: "tracking",   color: TRACK_COLORS["PLR-03"] },
  ]},
  { t: 1.0, tracks: [
    { id: "PLR-01", label: "PLR-01", bbox: [0.18, 0.40, 0.13, 0.16], conf: 0.95, status: "tracking",   color: TRACK_COLORS["PLR-01"] },
    { id: "PLR-02", label: "PLR-02", bbox: [0.50, 0.22, 0.12, 0.15], conf: 0.92, status: "tracking",   color: TRACK_COLORS["PLR-02"] },
    { id: "PLR-03", label: "PLR-03", bbox: [0.64, 0.52, 0.12, 0.15], conf: 0.89, status: "tracking",   color: TRACK_COLORS["PLR-03"] },
  ]},
  { t: 1.5, tracks: [
    { id: "PLR-01", label: "PLR-01", bbox: [0.24, 0.40, 0.13, 0.16], conf: 0.95, status: "tracking",   color: TRACK_COLORS["PLR-01"] },
    { id: "PLR-02", label: "PLR-02", bbox: [0.54, 0.24, 0.12, 0.15], conf: 0.91, status: "tracking",   color: TRACK_COLORS["PLR-02"] },
    { id: "PLR-03", label: "PLR-03", bbox: [0.61, 0.50, 0.12, 0.15], conf: 0.88, status: "tracking",   color: TRACK_COLORS["PLR-03"] },
  ]},
  { t: 2.0, tracks: [
    { id: "PLR-01", label: "PLR-01", bbox: [0.30, 0.41, 0.13, 0.16], conf: 0.94, status: "tracking",   color: TRACK_COLORS["PLR-01"] },
    { id: "PLR-02", label: "PLR-02", bbox: [0.57, 0.26, 0.12, 0.15], conf: 0.90, status: "tracking",   color: TRACK_COLORS["PLR-02"] },
    { id: "PLR-03", label: "PLR-03", bbox: [0.58, 0.49, 0.12, 0.15], conf: 0.87, status: "tracking",   color: TRACK_COLORS["PLR-03"] },
  ]},
  // ── Phase 2: PLR-01 enters smoke cloud — partial occlusion (t=2.5) ──────
  { t: 2.5, tracks: [
    { id: "PLR-01", label: "PLR-01", bbox: [0.35, 0.41, 0.13, 0.16], conf: 0.77, status: "partial_occlusion", color: TRACK_COLORS["PLR-01"] },
    { id: "PLR-02", label: "PLR-02", bbox: [0.61, 0.28, 0.12, 0.15], conf: 0.89, status: "tracking",         color: TRACK_COLORS["PLR-02"] },
    { id: "PLR-03", label: "PLR-03", bbox: [0.55, 0.47, 0.12, 0.15], conf: 0.85, status: "tracking",         color: TRACK_COLORS["PLR-03"] },
  ]},
  { t: 3.0, tracks: [
    { id: "PLR-01", label: "PLR-01", bbox: [0.39, 0.42, 0.13, 0.16], conf: 0.59, status: "partial_occlusion", color: TRACK_COLORS["PLR-01"] },
    { id: "PLR-02", label: "PLR-02", bbox: [0.63, 0.30, 0.12, 0.15], conf: 0.88, status: "tracking",         color: TRACK_COLORS["PLR-02"] },
    { id: "PLR-03", label: "PLR-03", bbox: [0.52, 0.46, 0.12, 0.15], conf: 0.84, status: "tracking",         color: TRACK_COLORS["PLR-03"] },
  ]},
  // ── Phase 3: Fully inside smoke — track lost (t=3.5–5.0) ────────────────
  { t: 3.5, tracks: [
    { id: "PLR-01", label: "PLR-01", bbox: [0.42, 0.43, 0.13, 0.16], conf: 0.32, status: "full_occlusion", color: TRACK_COLORS["PLR-01"] },
    { id: "PLR-02", label: "PLR-02", bbox: [0.65, 0.31, 0.12, 0.15], conf: 0.87, status: "tracking",       color: TRACK_COLORS["PLR-02"] },
    { id: "PLR-03", label: "PLR-03", bbox: [0.49, 0.45, 0.12, 0.15], conf: 0.83, status: "tracking",       color: TRACK_COLORS["PLR-03"] },
  ]},
  { t: 4.0, tracks: [
    { id: "PLR-01", label: "PLR-01", bbox: [0.44, 0.46, 0.13, 0.16], conf: 0.17, status: "lost",       color: "#ef4444" },
    { id: "PLR-02", label: "PLR-02", bbox: [0.67, 0.33, 0.12, 0.15], conf: 0.86, status: "tracking",   color: TRACK_COLORS["PLR-02"] },
    { id: "PLR-03", label: "PLR-03", bbox: [0.46, 0.44, 0.12, 0.15], conf: 0.82, status: "tracking",   color: TRACK_COLORS["PLR-03"] },
  ]},
  { t: 4.5, tracks: [
    { id: "PLR-01", label: "PLR-01 (?)", bbox: [0.47, 0.49, 0.13, 0.16], conf: 0.11, status: "lost",   color: "#ef4444" },
    { id: "PLR-02", label: "PLR-02",     bbox: [0.69, 0.34, 0.12, 0.15], conf: 0.85, status: "tracking", color: TRACK_COLORS["PLR-02"] },
    { id: "PLR-03", label: "PLR-03",     bbox: [0.43, 0.43, 0.12, 0.15], conf: 0.81, status: "tracking", color: TRACK_COLORS["PLR-03"] },
  ]},
  { t: 5.0, tracks: [
    { id: "PLR-01", label: "PLR-01 (?)", bbox: [0.51, 0.52, 0.13, 0.16], conf: 0.08, status: "lost",   color: "#ef4444" },
    { id: "PLR-02", label: "PLR-02",     bbox: [0.71, 0.36, 0.12, 0.15], conf: 0.84, status: "tracking", color: TRACK_COLORS["PLR-02"] },
    { id: "PLR-03", label: "PLR-03",     bbox: [0.40, 0.42, 0.12, 0.15], conf: 0.80, status: "tracking", color: TRACK_COLORS["PLR-03"] },
  ]},
  // ── Phase 4: Exits smoke — ID switch (t=5.5) ─────────────────────────────
  { t: 5.5, tracks: [
    { id: "PLR-05", label: "PLR-05 ⚠",  bbox: [0.54, 0.41, 0.13, 0.16], conf: 0.41, status: "id_switch",  color: TRACK_COLORS["PLR-05"] },
    { id: "PLR-02", label: "PLR-02",     bbox: [0.73, 0.37, 0.12, 0.15], conf: 0.83, status: "tracking",   color: TRACK_COLORS["PLR-02"] },
    { id: "PLR-03", label: "PLR-03",     bbox: [0.37, 0.41, 0.12, 0.15], conf: 0.79, status: "tracking",   color: TRACK_COLORS["PLR-03"] },
  ]},
  { t: 6.0, tracks: [
    { id: "PLR-05", label: "PLR-05 ⚠",  bbox: [0.58, 0.41, 0.13, 0.16], conf: 0.44, status: "id_switch",  color: TRACK_COLORS["PLR-05"] },
    { id: "PLR-02", label: "PLR-02",     bbox: [0.75, 0.38, 0.12, 0.15], conf: 0.82, status: "tracking",   color: TRACK_COLORS["PLR-02"] },
    { id: "PLR-03", label: "PLR-03",     bbox: [0.34, 0.40, 0.12, 0.15], conf: 0.78, status: "tracking",   color: TRACK_COLORS["PLR-03"] },
  ]},
  // ── Phase 5: Correct ID restored after human fix (t=6.5+) ────────────────
  { t: 6.5, tracks: [
    { id: "PLR-01", label: "PLR-01",  bbox: [0.62, 0.40, 0.13, 0.16], conf: 0.73, status: "recovered",  color: TRACK_COLORS["PLR-01"] },
    { id: "PLR-02", label: "PLR-02",  bbox: [0.77, 0.39, 0.12, 0.15], conf: 0.81, status: "tracking",   color: TRACK_COLORS["PLR-02"] },
    { id: "PLR-03", label: "PLR-03",  bbox: [0.31, 0.39, 0.12, 0.15], conf: 0.77, status: "tracking",   color: TRACK_COLORS["PLR-03"] },
  ]},
  { t: 7.0, tracks: [
    { id: "PLR-01", label: "PLR-01",  bbox: [0.66, 0.40, 0.13, 0.16], conf: 0.85, status: "tracking",   color: TRACK_COLORS["PLR-01"] },
    { id: "PLR-02", label: "PLR-02",  bbox: [0.79, 0.40, 0.12, 0.15], conf: 0.80, status: "tracking",   color: TRACK_COLORS["PLR-02"] },
    { id: "PLR-03", label: "PLR-03",  bbox: [0.28, 0.38, 0.12, 0.15], conf: 0.76, status: "tracking",   color: TRACK_COLORS["PLR-03"] },
  ]},
  { t: 7.5, tracks: [
    { id: "PLR-01", label: "PLR-01",  bbox: [0.70, 0.40, 0.13, 0.16], conf: 0.90, status: "tracking",   color: TRACK_COLORS["PLR-01"] },
    { id: "PLR-02", label: "PLR-02",  bbox: [0.81, 0.41, 0.12, 0.15], conf: 0.79, status: "tracking",   color: TRACK_COLORS["PLR-02"] },
    { id: "PLR-03", label: "PLR-03",  bbox: [0.25, 0.37, 0.12, 0.15], conf: 0.75, status: "tracking",   color: TRACK_COLORS["PLR-03"] },
  ]},
  { t: 8.0, tracks: [
    { id: "PLR-01", label: "PLR-01",  bbox: [0.74, 0.40, 0.13, 0.16], conf: 0.94, status: "tracking",   color: TRACK_COLORS["PLR-01"] },
    { id: "PLR-02", label: "PLR-02",  bbox: [0.83, 0.42, 0.12, 0.15], conf: 0.78, status: "tracking",   color: TRACK_COLORS["PLR-02"] },
    { id: "PLR-03", label: "PLR-03",  bbox: [0.22, 0.36, 0.12, 0.15], conf: 0.74, status: "tracking",   color: TRACK_COLORS["PLR-03"] },
  ]},
];

// Problem frames the user can jump to
const PROBLEM_FRAMES = [
  { label: "Smoke Entry",   t: 2.5, icon: "◑", color: "#f59e0b", desc: "PLR-01 enters smoke cloud — visibility drops" },
  { label: "Track Lost",    t: 4.0, icon: "✕", color: "#ef4444", desc: "AI loses PLR-01 inside smoke — box drifts" },
  { label: "ID Switch",     t: 5.5, icon: "⚠", color: "#ef4444", desc: "Exits smoke — re-tagged as PLR-05 (wrong)" },
];

// ─── Interpolation helper ─────────────────────────────────────────────────────

function interpolateTracks(t: number): TrackBox[] {
  if (KEYFRAMES.length === 0) return [];

  const last = KEYFRAMES[KEYFRAMES.length - 1];
  if (t >= last.t) return last.tracks;

  const first = KEYFRAMES[0];
  if (t <= first.t) return first.tracks;

  let lo = 0, hi = KEYFRAMES.length - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (KEYFRAMES[mid].t <= t) lo = mid; else hi = mid;
  }

  const kf0 = KEYFRAMES[lo], kf1 = KEYFRAMES[hi];
  const alpha = (t - kf0.t) / (kf1.t - kf0.t);

  // Use the closer keyframe for status/conf; interpolate bbox
  const useKF = alpha < 0.5 ? kf0 : kf1;
  return useKF.tracks.map((track) => {
    const match = kf0.tracks.find(b => b.id === track.id);
    const match1 = kf1.tracks.find(b => b.id === track.id);
    if (!match || !match1) return track;
    return {
      ...track,
      bbox: [
        match.bbox[0] + (match1.bbox[0] - match.bbox[0]) * alpha,
        match.bbox[1] + (match1.bbox[1] - match.bbox[1]) * alpha,
        match.bbox[2] + (match1.bbox[2] - match.bbox[2]) * alpha,
        match.bbox[3] + (match1.bbox[3] - match.bbox[3]) * alpha,
      ] as [number, number, number, number],
    };
  });
}

// ─── Canvas drawing ───────────────────────────────────────────────────────────

function drawTrackBox(
  ctx: CanvasRenderingContext2D,
  box: TrackBox,
  vw: number, vh: number,
  selected: boolean,
  isHuman = false,
) {
  const [nx, ny, nw, nh] = box.bbox;
  const x = nx * vw, y = ny * vh, w = nw * vw, h = nh * vh;
  const col = box.color;
  const alpha = box.status === "lost" ? 0.45 : 0.9;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Fill
  ctx.fillStyle = col;
  ctx.globalAlpha = box.status === "lost" ? 0.08 : 0.10;
  ctx.fillRect(x, y, w, h);

  // Border
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = col;
  ctx.lineWidth = selected ? 3 : box.status === "lost" ? 1.5 : 2;
  if (box.status === "lost" || box.status === "id_switch") {
    ctx.setLineDash([6, 4]);
  }
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);

  // Corner handles (top-left, top-right, bottom-right, bottom-left)
  const hs = 6;
  ctx.fillStyle = col;
  ctx.fillRect(x - hs / 2,     y - hs / 2,     hs, hs);
  ctx.fillRect(x + w - hs / 2, y - hs / 2,     hs, hs);
  ctx.fillRect(x + w - hs / 2, y + h - hs / 2, hs, hs);
  ctx.fillRect(x - hs / 2,     y + h - hs / 2, hs, hs);

  // Label badge
  const meta = STATUS_META[box.status];
  const badgeText = isHuman ? `✓ ${box.label}` : `${meta.icon} ${box.label}`;
  const confText = isHuman ? "CORRECTED" : `${Math.round(box.conf * 100)}%`;
  ctx.font = "bold 11px monospace";
  const tw = ctx.measureText(badgeText).width;
  const bx = x, by = y - 22;
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = box.status === "lost" || box.status === "id_switch" ? "#7f1d1d" : "#0f172a";
  ctx.fillRect(bx, by, tw + 54, 18);
  ctx.globalAlpha = 1;
  ctx.fillStyle = col;
  ctx.fillText(badgeText, bx + 4, by + 13);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "10px monospace";
  ctx.fillText(confText, bx + tw + 10, by + 13);

  ctx.restore();
}

// ─── Progress stepper ─────────────────────────────────────────────────────────

const STEPS = [
  { n: 1 as Stage, label: "AI Output"        },
  { n: 2 as Stage, label: "Annotate"         },
  { n: 3 as Stage, label: "QA Review"        },
  { n: 4 as Stage, label: "Delivered"        },
] as const;

function ProgressStepper({ stage }: { stage: Stage }) {
  return (
    <div className="flex items-center justify-center py-4">
      {STEPS.map((step, i) => {
        const done = stage > step.n, current = stage === step.n;
        return (
          <div key={step.n} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                done    ? "bg-violet-600 border-violet-600 text-white" :
                current ? "bg-[var(--s6)] border-violet-500 text-violet-400 ring-4 ring-violet-900/40" :
                          "bg-[var(--s4)] border-white/10 text-white/30"
              }`}>
                {done ? <Check size={16} /> : step.n}
              </div>
              <span className={`mt-1 text-sm font-semibold whitespace-nowrap ${
                current ? "text-violet-400" : done ? "text-foreground/60" : "text-foreground/30"
              }`}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-16 h-0.5 mx-1 mb-6 transition-all ${stage > step.n ? "bg-violet-600" : "bg-white/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Video Player + Overlay ───────────────────────────────────────────────────

function VideoPanel({
  videoRef, canvasRef, duration, currentTime, isPlaying,
  onPlayPause, onSeek, onStep,
  annotations, showAnnotations,
  stage,
}: {
  videoRef:        React.RefObject<HTMLVideoElement>;
  canvasRef:       React.RefObject<HTMLCanvasElement>;
  duration:        number;
  currentTime:     number;
  isPlaying:       boolean;
  onPlayPause:     () => void;
  onSeek:          (t: number) => void;
  onStep:          (dir: 1 | -1) => void;
  annotations:     Annotation[];
  showAnnotations: boolean;
  stage:           Stage;
}) {
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Problem-frame markers on scrubber
  const markers = PROBLEM_FRAMES.map(pf => ({
    ...pf, pct: duration > 0 ? (pf.t / duration) * 100 : 0,
  }));

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-3">
      {/* Video + canvas */}
      <div className="relative rounded-xl overflow-hidden border border-border bg-black"
        style={{ aspectRatio: "16/9" }}>
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          className="w-full h-full object-contain"
          preload="auto"
          muted
          playsInline
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: stage === 2 ? "auto" : "none" }}
        />
        {/* HUD badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
          <span className="px-2 py-0.5 rounded text-xs font-bold tracking-widest uppercase"
            style={{ background: "rgba(0,0,0,0.75)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.3)" }}>
            {stage === 1 ? "AI OUTPUT" : stage === 2 ? "ANNOTATION MODE" : stage === 3 ? "QA REVIEW" : "DELIVERED"}
          </span>
          {stage === 1 && (
            <span className="px-2 py-0.5 rounded text-xs font-bold"
              style={{ background: "rgba(0,0,0,0.75)", color: "#a855f7" }}>
              3 TRACKS ACTIVE
            </span>
          )}
        </div>
        {/* Confidence HUD */}
        {stage === 1 && (() => {
          const tracks = interpolateTracks(currentTime);
          const primary = tracks.find(t => t.id === "PLR-01" || t.id === "PLR-05");
          if (!primary) return null;
          const meta = STATUS_META[primary.status];
          return (
            <div className="absolute top-3 right-3 pointer-events-none"
              style={{ background: "rgba(0,0,0,0.80)", borderRadius: 8, border: `1px solid ${meta.color}44`, padding: "6px 10px" }}>
              <div className="text-xs text-white/50 uppercase tracking-wider mb-0.5">Primary Target</div>
              <div className="text-sm font-bold font-mono" style={{ color: meta.color }}>{meta.icon} {meta.label}</div>
              <div className="text-xs mt-0.5" style={{ color: `${meta.color}99` }}>
                conf {Math.round(primary.conf * 100)}%
              </div>
            </div>
          );
        })()}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-2 px-1">
        {/* Scrubber + markers */}
        <div className="relative group">
          <div className="relative h-2 rounded-full cursor-pointer overflow-visible"
            style={{ background: "var(--s6)" }}
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              onSeek(ratio * duration);
            }}>
            {/* Progress fill */}
            <div className="absolute top-0 left-0 h-full rounded-full transition-none"
              style={{ width: `${pct}%`, background: "#7c3aed" }} />
            {/* Problem markers */}
            {markers.map(m => (
              <div key={m.label} className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-black cursor-pointer z-10"
                style={{ left: `${m.pct}%`, background: m.color, transform: "translate(-50%, -50%)" }}
                onClick={e => { e.stopPropagation(); onSeek(m.t); }}
                title={m.label} />
            ))}
            {/* Thumb */}
            <div className="absolute top-1/2 w-4 h-4 rounded-full border-2 border-white shadow-lg"
              style={{ left: `${pct}%`, transform: "translate(-50%, -50%)", background: "#7c3aed" }} />
          </div>
          {/* Marker labels */}
          <div className="relative h-5 mt-1">
            {markers.map(m => (
              <span key={m.label} className="absolute text-xs font-semibold"
                style={{ left: `${m.pct}%`, transform: "translateX(-50%)", color: m.color, fontSize: 9, whiteSpace: "nowrap" }}>
                {m.label.split(" ")[0]}
              </span>
            ))}
          </div>
        </div>

        {/* Playback buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => onStep(-1)}
              className="p-2 rounded-lg border border-border hover:border-violet-500 hover:bg-violet-900/20 transition text-foreground/70">
              <SkipBack size={14} />
            </button>
            <button onClick={onPlayPause}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm transition text-white"
              style={{ background: "#7c3aed" }}>
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button onClick={() => onStep(1)}
              className="p-2 rounded-lg border border-border hover:border-violet-500 hover:bg-violet-900/20 transition text-foreground/70">
              <SkipForward size={14} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-foreground/50">{fmt(currentTime)} / {fmt(duration)}</span>
            <div className="flex gap-1">
              {PROBLEM_FRAMES.map((pf, i) => (
                <button key={i} onClick={() => onSeek(pf.t)}
                  className="px-2 py-1 rounded text-xs font-semibold border transition"
                  style={{ borderColor: `${pf.color}50`, color: pf.color, background: `${pf.color}15` }}
                  title={pf.desc}>
                  ⚡ {pf.label.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stage 1: AI Output ───────────────────────────────────────────────────────

function Stage1({
  videoRef, canvasRef, duration, currentTime, isPlaying,
  onPlayPause, onSeek, onStep, onSubmit,
}: {
  videoRef:    React.RefObject<HTMLVideoElement>;
  canvasRef:   React.RefObject<HTMLCanvasElement>;
  duration:    number;
  currentTime: number;
  isPlaying:   boolean;
  onPlayPause: () => void;
  onSeek:      (t: number) => void;
  onStep:      (dir: 1 | -1) => void;
  onSubmit:    () => void;
}) {
  const tracks = useMemo(() => interpolateTracks(currentTime), [currentTime]);
  const failures = tracks.filter(t => t.status === "lost" || t.status === "id_switch");

  return (
    <div className="flex gap-5 items-start">
      <VideoPanel videoRef={videoRef} canvasRef={canvasRef} duration={duration}
        currentTime={currentTime} isPlaying={isPlaying} onPlayPause={onPlayPause}
        onSeek={onSeek} onStep={onStep} annotations={[]} showAnnotations={false} stage={1} />

      {/* Right panel */}
      <div className="w-72 flex-shrink-0 space-y-4">
        {/* AI banner */}
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border border-blue-600/30"
          style={{ background: "rgba(37,99,235,0.12)" }}>
          <Crosshair size={22} className="text-blue-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-blue-300">AI Tracker — Model Output</div>
            <div className="text-xs text-blue-400/70">Mocked predictions · no real inference</div>
          </div>
        </div>

        {/* Live track list */}
        <div className="rounded-2xl border border-border p-4" style={{ background: "var(--s4)" }}>
          <p className="text-xs font-bold text-foreground/35 uppercase tracking-wider mb-3">Live Tracks</p>
          <div className="space-y-2.5">
            {tracks.map(t => {
              const meta = STATUS_META[t.status];
              return (
                <div key={t.id} className="flex items-center gap-2.5 p-2.5 rounded-xl border"
                  style={{ borderColor: `${t.color}35`, background: `${t.color}0a` }}>
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: t.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold font-mono truncate" style={{ color: t.color }}>{t.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: meta.color }}>{meta.icon} {meta.label}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold" style={{ color: t.conf < 0.35 ? "#ef4444" : t.conf < 0.7 ? "#f59e0b" : "#22c55e" }}>
                      {Math.round(t.conf * 100)}%
                    </div>
                    <div className="text-xs text-foreground/35">conf</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Failures panel */}
        {failures.length > 0 && (
          <div className="rounded-2xl border border-red-800/40 p-4" style={{ background: "rgba(220,38,38,0.10)" }}>
            <p className="text-xs font-bold text-red-400/60 uppercase tracking-wider mb-2">AI Failures Detected</p>
            <div className="space-y-2">
              {failures.map(f => (
                <div key={f.id} className="flex items-center gap-2 text-sm text-red-300">
                  <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />
                  <span>{f.id}: {STATUS_META[f.status].label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Problem frame jump list */}
        <div className="rounded-2xl border border-border p-4" style={{ background: "var(--s4)" }}>
          <p className="text-xs font-bold text-foreground/35 uppercase tracking-wider mb-3">Problem Frames</p>
          <div className="space-y-2">
            {PROBLEM_FRAMES.map((pf, i) => (
              <button key={i} onClick={() => onSeek(pf.t)}
                className="w-full flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition hover:border-opacity-100"
                style={{ borderColor: `${pf.color}40`, background: `${pf.color}0d` }}>
                <span className="text-lg flex-shrink-0" style={{ color: pf.color }}>{pf.icon}</span>
                <div>
                  <div className="text-sm font-semibold" style={{ color: pf.color }}>{pf.label}</div>
                  <div className="text-xs text-foreground/45 mt-0.5">{pf.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <Button onClick={onSubmit} className="w-full h-11 bg-violet-600 hover:bg-violet-700 font-semibold">
          Send to Human Annotator →
        </Button>
      </div>
    </div>
  );
}

// ─── Stage 2: Human Annotation ────────────────────────────────────────────────

function Stage2({
  videoRef, canvasRef, duration, currentTime, isPlaying,
  onPlayPause, onSeek, onStep, annotations, setAnnotations, onSubmit,
}: {
  videoRef:       React.RefObject<HTMLVideoElement>;
  canvasRef:      React.RefObject<HTMLCanvasElement>;
  duration:       number;
  currentTime:    number;
  isPlaying:      boolean;
  onPlayPause:    () => void;
  onSeek:         (t: number) => void;
  onStep:         (dir: 1 | -1) => void;
  annotations:    Annotation[];
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
  onSubmit:       () => void;
}) {
  const [drawing, setDrawing]     = useState(false);
  const [startPt, setStartPt]     = useState({ x: 0, y: 0 });
  const [currentRect, setCurrentRect] = useState<[number,number,number,number] | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventType>("re_identification");
  const [selectedTrack, setSelectedTrack] = useState("PLR-01");

  const getRelPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = getRelPos(e);
    setDrawing(true);
    setStartPt(p);
    setCurrentRect(null);
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const p = getRelPos(e);
    const x = Math.min(startPt.x, p.x), y = Math.min(startPt.y, p.y);
    const w = Math.abs(p.x - startPt.x), h = Math.abs(p.y - startPt.y);
    setCurrentRect([x, y, w, h]);
  };

  const onMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    setDrawing(false);
    const p = getRelPos(e);
    const x = Math.min(startPt.x, p.x), y = Math.min(startPt.y, p.y);
    const w = Math.abs(p.x - startPt.x), h = Math.abs(p.y - startPt.y);
    if (w < 0.02 || h < 0.02) { setCurrentRect(null); return; }
    const ann: Annotation = {
      id:        `ann-${Date.now()}`,
      trackId:   selectedTrack,
      bbox:      [x, y, w, h],
      eventType: selectedEvent,
      color:     TRACK_COLORS[selectedTrack] ?? "#22c55e",
      frame:     Math.round(currentTime * 30),
    };
    setAnnotations(prev => [...prev, ann]);
    setCurrentRect(null);
  };

  return (
    <div className="flex gap-5 items-start">
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        {/* Annotation canvas wrapped video */}
        <div className="relative rounded-xl overflow-hidden border border-violet-600/40 bg-black"
          style={{ aspectRatio: "16/9", cursor: "crosshair" }}>
          <video ref={videoRef} src={VIDEO_SRC} className="w-full h-full object-contain" preload="auto" muted playsInline />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full"
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} />
          {/* Live draw rect */}
          {currentRect && (() => {
            const [x, y, w, h] = currentRect;
            const ev = EVENT_TYPES.find(e => e.id === selectedEvent);
            return (
              <div className="absolute pointer-events-none rounded border-2 border-dashed"
                style={{
                  left: `${x * 100}%`, top: `${y * 100}%`,
                  width: `${w * 100}%`, height: `${h * 100}%`,
                  borderColor: ev?.color ?? "#22c55e",
                  background: `${ev?.color ?? "#22c55e"}15`,
                }} />
            );
          })()}
          {/* Annotation mode HUD */}
          <div className="absolute top-3 left-3 pointer-events-none">
            <span className="px-2 py-1 rounded text-xs font-bold text-violet-300"
              style={{ background: "rgba(109,40,217,0.80)", border: "1px solid rgba(139,92,246,0.5)" }}>
              ✏ ANNOTATION MODE — Click &amp; drag to annotate
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button onClick={() => onStep(-1)} className="p-2 rounded-lg border border-border hover:border-violet-500 text-foreground/70"><SkipBack size={14}/></button>
          <button onClick={onPlayPause}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "#7c3aed" }}>
            {isPlaying ? <Pause size={14}/> : <Play size={14}/>} {isPlaying ? "Pause" : "Play"}
          </button>
          <button onClick={() => onStep(1)} className="p-2 rounded-lg border border-border hover:border-violet-500 text-foreground/70"><SkipForward size={14}/></button>
          <span className="text-sm font-mono text-foreground/50 ml-2">{Math.floor(currentTime*30)} frames</span>
          <div className="flex-1" />
          {PROBLEM_FRAMES.map((pf, i) => (
            <button key={i} onClick={() => onSeek(pf.t)}
              className="px-2 py-1 rounded text-xs font-semibold border transition"
              style={{ borderColor: `${pf.color}50`, color: pf.color, background: `${pf.color}15` }}>
              ⚡ {pf.label.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="w-72 flex-shrink-0 space-y-4">
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border border-violet-600/30"
          style={{ background: "rgba(109,40,217,0.12)" }}>
          <Target size={22} className="text-violet-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-violet-300">Human Annotation</div>
            <div className="text-xs text-violet-400/70">Draw boxes · fix IDs · label events</div>
          </div>
        </div>

        {/* Track selector */}
        <div className="rounded-2xl border border-border p-4" style={{ background: "var(--s4)" }}>
          <p className="text-xs font-bold text-foreground/35 uppercase tracking-wider mb-2">Assign to Track</p>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.keys(TRACK_COLORS).filter(k => k !== "PLR-05").map(tid => (
              <button key={tid} onClick={() => setSelectedTrack(tid)}
                className="px-2 py-1.5 rounded-lg border text-xs font-bold font-mono transition"
                style={{
                  borderColor: selectedTrack === tid ? TRACK_COLORS[tid] : `${TRACK_COLORS[tid]}40`,
                  color: TRACK_COLORS[tid],
                  background: selectedTrack === tid ? `${TRACK_COLORS[tid]}25` : `${TRACK_COLORS[tid]}0a`,
                }}>
                {tid}
              </button>
            ))}
          </div>
        </div>

        {/* Event type selector */}
        <div className="rounded-2xl border border-border p-4" style={{ background: "var(--s4)" }}>
          <p className="text-xs font-bold text-foreground/35 uppercase tracking-wider mb-2">Event Type</p>
          <div className="grid grid-cols-1 gap-1">
            {EVENT_TYPES.map(ev => (
              <button key={ev.id} onClick={() => setSelectedEvent(ev.id)}
                className="px-2 py-1.5 rounded-lg border text-xs font-semibold text-left transition"
                style={{
                  borderColor: selectedEvent === ev.id ? ev.color : `${ev.color}30`,
                  color: selectedEvent === ev.id ? ev.color : "var(--foreground)",
                  background: selectedEvent === ev.id ? `${ev.color}20` : "transparent",
                  opacity: selectedEvent === ev.id ? 1 : 0.6,
                }}>
                {ev.label}
              </button>
            ))}
          </div>
        </div>

        {/* Annotation list */}
        <div className="rounded-2xl border border-border p-4" style={{ background: "var(--s4)" }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-foreground/35 uppercase tracking-wider">Annotations ({annotations.length})</p>
            {annotations.length > 0 && (
              <button onClick={() => setAnnotations([])}
                className="text-xs text-red-400/70 hover:text-red-400 transition">Clear all</button>
            )}
          </div>
          {annotations.length === 0 ? (
            <p className="text-xs text-foreground/30 italic">Draw boxes on the video to annotate frames.</p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {annotations.map(a => (
                <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg border"
                  style={{ borderColor: `${a.color}30`, background: `${a.color}08` }}>
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: a.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono font-bold truncate" style={{ color: a.color }}>{a.trackId}</div>
                    <div className="text-xs text-foreground/40 truncate">{EVENT_TYPES.find(e => e.id === a.eventType)?.label}</div>
                  </div>
                  <button onClick={() => setAnnotations(p => p.filter(x => x.id !== a.id))}
                    className="text-foreground/30 hover:text-red-400 text-xs">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button disabled={annotations.length === 0} onClick={onSubmit}
          className="w-full h-11 bg-violet-600 hover:bg-violet-700 font-semibold disabled:opacity-40">
          Submit for QA Review ({annotations.length}) →
        </Button>
        {annotations.length === 0 && (
          <p className="text-xs text-center text-foreground/35">Annotate at least one problem frame to continue</p>
        )}
      </div>
    </div>
  );
}

// ─── Stage 3: QA Review ───────────────────────────────────────────────────────

function Stage3({
  videoRef, canvasRef, duration, currentTime, isPlaying,
  onPlayPause, onSeek, onStep, annotations, onSubmit,
}: {
  videoRef:    React.RefObject<HTMLVideoElement>;
  canvasRef:   React.RefObject<HTMLCanvasElement>;
  duration:    number;
  currentTime: number;
  isPlaying:   boolean;
  onPlayPause: () => void;
  onSeek:      (t: number) => void;
  onStep:      (dir: 1 | -1) => void;
  annotations: Annotation[];
  onSubmit:    () => void;
}) {
  const [showHuman, setShowHuman] = useState(true);

  const eventCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    annotations.forEach(a => { counts[a.eventType] = (counts[a.eventType] ?? 0) + 1; });
    return counts;
  }, [annotations]);

  const aiFailures = KEYFRAMES.flatMap(kf => kf.tracks.filter(t =>
    t.status === "lost" || t.status === "id_switch"
  )).length;

  const improvementPct = Math.min(99, Math.round(60 + annotations.length * 8));

  return (
    <div className="flex gap-5 items-start">
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        {/* Toggle before/after */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground/50">View:</span>
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button onClick={() => setShowHuman(false)}
              className={`px-3 py-1.5 text-sm font-semibold transition ${!showHuman ? "bg-red-600/80 text-white" : "text-foreground/60 hover:bg-muted/40"}`}>
              Before (AI)
            </button>
            <button onClick={() => setShowHuman(true)}
              className={`px-3 py-1.5 text-sm font-semibold transition ${showHuman ? "bg-violet-600 text-white" : "text-foreground/60 hover:bg-muted/40"}`}>
              After (Human)
            </button>
          </div>
          <span className="text-xs text-foreground/35">{showHuman ? "Human-corrected annotation overlay" : "Raw AI predictions (with failures)"}</span>
        </div>

        <VideoPanel videoRef={videoRef} canvasRef={canvasRef} duration={duration}
          currentTime={currentTime} isPlaying={isPlaying} onPlayPause={onPlayPause}
          onSeek={onSeek} onStep={onStep} annotations={annotations} showAnnotations={showHuman} stage={3} />
      </div>

      {/* Right panel */}
      <div className="w-72 flex-shrink-0 space-y-4">
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border border-indigo-600/30"
          style={{ background: "rgba(79,70,229,0.12)" }}>
          <ShieldAlert size={22} className="text-indigo-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-indigo-300">QA Review</div>
            <div className="text-xs text-indigo-400/70">Compare AI vs human corrections</div>
          </div>
        </div>

        {/* Before vs After */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-red-800/40 p-3 text-center" style={{ background: "rgba(220,38,38,0.10)" }}>
            <div className="text-2xl font-black text-red-400">{aiFailures}</div>
            <div className="text-xs text-foreground/50 mt-0.5">AI Failures</div>
          </div>
          <div className="rounded-xl border border-emerald-700/40 p-3 text-center" style={{ background: "rgba(5,150,105,0.10)" }}>
            <div className="text-2xl font-black text-emerald-400">{annotations.length}</div>
            <div className="text-xs text-foreground/50 mt-0.5">Human Fixes</div>
          </div>
        </div>

        {/* Tracking improvement */}
        <div className="rounded-2xl border border-violet-700/40 p-4" style={{ background: "rgba(109,40,217,0.12)" }}>
          <p className="text-xs font-bold text-violet-400/60 uppercase tracking-wider mb-3">Tracking Improvement</p>
          <div className="flex items-end gap-2 mb-2">
            <div className="text-3xl font-black text-violet-300">+{improvementPct - 60}%</div>
            <div className="text-sm text-violet-400/70 mb-1">trajectory stability</div>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--s6)" }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${improvementPct}%`, background: "linear-gradient(90deg, #7c3aed, #22d3ee)" }} />
          </div>
          <div className="flex justify-between text-xs text-foreground/35 mt-1">
            <span>Before: {100 - improvementPct + 40}%</span>
            <span>After: {improvementPct}%</span>
          </div>
        </div>

        {/* Event summary */}
        <div className="rounded-2xl border border-border p-4" style={{ background: "var(--s4)" }}>
          <p className="text-xs font-bold text-foreground/35 uppercase tracking-wider mb-3">Annotated Events</p>
          <div className="space-y-1.5">
            {Object.entries(eventCounts).map(([evId, count]) => {
              const ev = EVENT_TYPES.find(e => e.id === evId);
              return (
                <div key={evId} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: ev?.color ?? "white" }}>{ev?.label ?? evId}</span>
                  <span className="text-sm font-bold text-foreground/60">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <Button onClick={onSubmit} className="w-full h-11 bg-violet-600 hover:bg-violet-700 font-semibold">
          Approve &amp; Mark Delivered →
        </Button>
      </div>
    </div>
  );
}

// ─── Stage 4: Delivered ───────────────────────────────────────────────────────

function Stage4({ annotations, onReset }: { annotations: Annotation[]; onReset: () => void }) {
  const navigate = useNavigate();
  const kpis = [
    { icon: <Target size={18} className="text-cyan-400" />,    label: "Players Re-Identified",     value: "3",                       sub: "PLR-01 re-linked after smoke",   bg: "rgba(6,182,212,0.18)" },
    { icon: <Layers size={18} className="text-violet-400" />,  label: "Occlusion Events Labelled", value: `${annotations.length}`,   sub: "across all frames",              bg: "rgba(109,40,217,0.18)" },
    { icon: <Activity size={18} className="text-emerald-400"/>, label: "ID Switch Corrections",    value: "1",                       sub: "PLR-05 → PLR-01 corrected",      bg: "rgba(5,150,105,0.18)" },
    { icon: <ZapOff size={18} className="text-amber-400" />,   label: "Ghost Boxes Cleared",       value: `${Math.max(2, annotations.length)}`, sub: "smoke drift & phantom tracks", bg: "rgba(217,119,6,0.18)" },
  ];

  return (
    <div className="flex flex-col gap-5 items-center max-w-2xl mx-auto w-full">
      <div className="inline-flex items-center gap-2 text-white text-sm font-bold px-4 py-1.5 rounded-full"
        style={{ background: "var(--s8)" }}>
        📦 Step 4: Annotation Dataset Delivered
      </div>

      <div className="w-full rounded-2xl border-2 border-emerald-700/50 p-6 text-center"
        style={{ background: "rgba(5,150,105,0.10)" }}>
        <div className="text-5xl mb-3">✅</div>
        <div className="text-2xl font-black text-emerald-400 mb-2">Tracking Dataset Delivered</div>
        <p className="text-base text-foreground/60">
          Human-corrected tracking annotations exported. <br />
          AI model retrained with <strong className="text-foreground/80">{annotations.length} labelled events</strong>.
        </p>
      </div>

      <div className="w-full grid grid-cols-2 gap-3">
        {kpis.map((kpi, i) => (
          <div key={i} className="rounded-xl border border-border p-4" style={{ background: "var(--s4)" }}>
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-2" style={{ background: kpi.bg }}>
              {kpi.icon}
            </div>
            <div className="text-2xl font-black text-foreground">{kpi.value}</div>
            <div className="text-sm font-semibold text-foreground/75">{kpi.label}</div>
            <div className="text-xs text-foreground/40 mt-0.5">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Story callout */}
      <div className="w-full rounded-2xl border border-violet-700/40 p-5" style={{ background: "rgba(109,40,217,0.10)" }}>
        <p className="text-sm font-bold text-violet-300 mb-2 uppercase tracking-wider">Why Human-in-the-Loop Matters</p>
        <p className="text-sm text-foreground/60 leading-relaxed">
          The AI lost track of PLR-01 for <strong className="text-foreground/80">2.5 seconds</strong> inside a
          smoke cloud and assigned it the wrong ID (PLR-05) on reappearance. Human annotators caught the ID
          switch and corrected the trajectory — data the model can now learn from for future smoke and
          occlusion scenarios.
        </p>
      </div>

      <div className="flex gap-3 w-full">
        <Button variant="outline" onClick={onReset} className="flex-1 h-11 gap-2 border-white/15 text-foreground/80 hover:bg-white/5">
          <RotateCcw size={15} /> Try Again
        </Button>
        <Button onClick={() => navigate("/use-cases")} className="flex-1 h-11 bg-violet-600 hover:bg-violet-700 gap-2">
          <ArrowLeft size={15} /> Back to DataStudio
        </Button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VideoObjectTracking() {
  const navigate = useNavigate();
  const { theme } = useTheme();

  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number | null>(null);

  const [stage,       setStage]       = useState<Stage>(1);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [humanMode,   setHumanMode]   = useState(false);

  // Sync canvas size to video display size
  const syncCanvas = useCallback(() => {
    const vid = videoRef.current;
    const cvs = canvasRef.current;
    if (!vid || !cvs) return;
    const rect = vid.getBoundingClientRect();
    if (cvs.width !== rect.width || cvs.height !== rect.height) {
      cvs.width  = rect.width;
      cvs.height = rect.height;
    }
  }, []);

  // Main render loop
  const renderFrame = useCallback(() => {
    const vid = videoRef.current;
    const cvs = canvasRef.current;
    if (!vid || !cvs) return;

    syncCanvas();
    const ctx = cvs.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, cvs.width, cvs.height);
    const t = vid.currentTime;
    setCurrentTime(t);

    // Decide what to draw
    if (stage === 1 || (stage === 3 && !humanMode)) {
      // AI predictions
      const tracks = interpolateTracks(t);
      tracks.forEach(box => drawTrackBox(ctx, box, cvs.width, cvs.height, false));
    } else if (stage === 3 && humanMode) {
      // Human annotations overlay
      annotations.forEach(ann => {
        const box: TrackBox = {
          id: ann.trackId, label: ann.trackId,
          bbox: ann.bbox, conf: 1,
          status: "recovered", color: ann.color,
        };
        drawTrackBox(ctx, box, cvs.width, cvs.height, false, true);
      });
      // Also show non-failed AI tracks
      const tracks = interpolateTracks(t).filter(tr => tr.status !== "lost" && tr.status !== "id_switch");
      tracks.forEach(box => drawTrackBox(ctx, box, cvs.width, cvs.height, false));
    } else if (stage === 2) {
      // Show AI predictions faded + annotation prompts at problem zones
      const tracks = interpolateTracks(t);
      tracks.forEach(box => {
        const faded: TrackBox = { ...box, conf: box.conf * 0.4 };
        drawTrackBox(ctx, faded, cvs.width, cvs.height, false);
      });
    }

    if (!vid.paused) {
      rafRef.current = requestAnimationFrame(renderFrame);
    }
  }, [stage, annotations, humanMode, syncCanvas]);

  // Set up video event listeners
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const onLoaded = () => setDuration(vid.duration);
    const onTimeUpdate = () => { setCurrentTime(vid.currentTime); renderFrame(); };
    const onPlay  = () => { setIsPlaying(true);  rafRef.current = requestAnimationFrame(renderFrame); };
    const onPause = () => { setIsPlaying(false); renderFrame(); };
    const onEnded = () => { setIsPlaying(false); };

    vid.addEventListener("loadedmetadata", onLoaded);
    vid.addEventListener("timeupdate",    onTimeUpdate);
    vid.addEventListener("play",          onPlay);
    vid.addEventListener("pause",         onPause);
    vid.addEventListener("ended",         onEnded);

    if (vid.readyState >= 1) setDuration(vid.duration);

    return () => {
      vid.removeEventListener("loadedmetadata", onLoaded);
      vid.removeEventListener("timeupdate",    onTimeUpdate);
      vid.removeEventListener("play",          onPlay);
      vid.removeEventListener("pause",         onPause);
      vid.removeEventListener("ended",         onEnded);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [renderFrame]);

  // Re-render on stage change
  useEffect(() => { renderFrame(); }, [stage, renderFrame]);

  useEffect(() => {
    const onResize = () => { syncCanvas(); renderFrame(); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [syncCanvas, renderFrame]);

  const handlePlayPause = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) { vid.play(); } else { vid.pause(); }
  };

  const handleSeek = (t: number) => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.currentTime = Math.max(0, Math.min(t, vid.duration));
    renderFrame();
  };

  const handleStep = (dir: 1 | -1) => {
    handleSeek(currentTime + dir * (1 / 30)); // ~1 frame at 30fps
  };

  const reset = () => {
    setStage(1);
    setAnnotations([]);
    setHumanMode(false);
    handleSeek(0);
  };

  const isLight = theme === "light";

  return (
    <div className="min-h-screen" style={{ background: "var(--s0)" }}>
      {/* Header */}
      <header className="dark-surface sticky top-0 z-50 bg-[hsl(0,0%,5%)] w-full border-b border-white/10">
        <div className="flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate("/use-cases")}
              className="flex items-center justify-center p-2 hover:bg-white/10 rounded-full transition shrink-0">
              <ArrowLeft className="w-4 h-4 text-white" />
            </button>
            <span onClick={() => navigate("/use-cases")}
              className="text-sm font-bold tracking-wide text-white cursor-pointer hover:text-white/80 transition font-headline shrink-0">
              TP.ai <span style={{ color: "#9071f0" }}>Data</span>Studio
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-white/40 shrink-0" />
            <span className="text-sm text-white/70 truncate">Tracking Through Obstacles</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <button onClick={reset}
              className="flex items-center gap-1.5 text-sm text-foreground/55 hover:text-foreground/80 px-3 py-1.5 rounded-full border border-white/10 hover:border-white/25 transition">
              <RefreshCw size={13} /> Reset Demo
            </button>
            <span className="text-sm bg-cyan-600/20 text-cyan-300 border border-cyan-600/30 px-3 py-1 rounded-full font-semibold">
              Video Annotation · Live Demo
            </span>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-[2px] w-full progress-bar-gradient" />
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Title */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-black text-white">
            Tracking Through Obstacles <span className="text-cyan-400">— Gaming AI</span>
          </h1>
          <p className="text-sm text-foreground/50 mt-1 max-w-xl mx-auto">
            AI tracking fails on occlusion. Humans correct. Models improve. See the full loop.
          </p>
        </div>

        <ProgressStepper stage={stage} />

        <div className="mt-4">
          {stage === 1 && (
            <Stage1
              videoRef={videoRef} canvasRef={canvasRef}
              duration={duration} currentTime={currentTime} isPlaying={isPlaying}
              onPlayPause={handlePlayPause} onSeek={handleSeek} onStep={handleStep}
              onSubmit={() => setStage(2)}
            />
          )}
          {stage === 2 && (
            <Stage2
              videoRef={videoRef} canvasRef={canvasRef}
              duration={duration} currentTime={currentTime} isPlaying={isPlaying}
              onPlayPause={handlePlayPause} onSeek={handleSeek} onStep={handleStep}
              annotations={annotations} setAnnotations={setAnnotations}
              onSubmit={() => setStage(3)}
            />
          )}
          {stage === 3 && (
            <Stage3
              videoRef={videoRef} canvasRef={canvasRef}
              duration={duration} currentTime={currentTime} isPlaying={isPlaying}
              onPlayPause={handlePlayPause} onSeek={handleSeek} onStep={handleStep}
              annotations={annotations}
              onSubmit={() => setStage(4)}
            />
          )}
          {stage === 4 && (
            <Stage4 annotations={annotations} onReset={reset} />
          )}
        </div>
      </div>
    </div>
  );
}

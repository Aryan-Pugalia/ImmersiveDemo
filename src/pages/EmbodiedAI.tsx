import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskId = "pick-place" | "microwave" | "selfie";
type Stage = "annotate" | "ai-verify" | "qa" | "export";

type EventSegment = {
  id: string;
  startTime: number;
  endTime: number;
  event_type: string;
  contact_quality: string;
  stability: string;
  confidence: string;
};

type PickPlaceAnnotation = {
  segments: EventSegment[];
  training_suitability: string;
  primary_risk: string;
  notes: string;
  complete: boolean;
};

type GraphNode = {
  id: string;
  label: string;
  completed: boolean;
  timestamp: number | null;
};

type GraphEdge = { from: string; to: string };

type MicrowaveAnnotation = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  door_closed_before_timer: string;
  timer_set_to_30s: string;
  safe_handling: string;
  clarification_needed: boolean;
  complete: boolean;
};

type SelfieAnnotation = {
  lighting_quality: string;
  framing_quality: string;
  steadiness: string;
  eye_contact_consistency: string;
  face_visibility: string;
  motion_pattern: string;
  resolution_estimate: string;
  overall_capture_quality: string;
  usable_for_training: string;
  notes: string;
  complete: boolean;
};

type TaskAnnotations = {
  "pick-place": PickPlaceAnnotation | null;
  microwave: MicrowaveAnnotation | null;
  selfie: SelfieAnnotation | null;
};

type AIFlag = { type: "warning" | "error"; message: string };

type PickPlaceAIResult = {
  flags: AIFlag[];
  overall_confidence: number;
};

type MicrowaveAIResult = {
  flags: AIFlag[];
  procedure_consistency_score: number;
};

type SelfieAIResult = {
  flags: AIFlag[];
  ai_recommendation: "approve" | "conditional" | "reshoot";
  confidence: number;
};

type AIResult = PickPlaceAIResult | MicrowaveAIResult | SelfieAIResult | null;

type QAState = {
  accepted_ai: boolean;
  // pick-place overrides
  override_suitability: string;
  override_risk: string;
  // microwave overrides
  override_procedure_score: number;
  override_constraint_status: string;
  // selfie overrides
  override_final_status: string;
  locked: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TASK_VIDEO: Record<TaskId, string> = {
  "pick-place": "/assets/task_pick_place_bottle.mp4",
  microwave: "/assets/task_microwave_plate_timer.mp4",
  selfie: "/assets/selfie_presence_quality.mp4",
};

const MICROWAVE_NODES_DEFAULT: GraphNode[] = [
  { id: "open_door", label: "Open Door", completed: false, timestamp: null },
  { id: "place_plate", label: "Place Plate", completed: false, timestamp: null },
  { id: "close_door", label: "Close Door", completed: false, timestamp: null },
  { id: "set_timer", label: "Set Timer", completed: false, timestamp: null },
  { id: "start_heating", label: "Start Heating", completed: false, timestamp: null },
];

const MICROWAVE_EDGES: GraphEdge[] = [
  { from: "open_door", to: "place_plate" },
  { from: "place_plate", to: "close_door" },
  { from: "close_door", to: "set_timer" },
];

const DEFAULT_MICROWAVE: MicrowaveAnnotation = {
  nodes: MICROWAVE_NODES_DEFAULT.map((n) => ({ ...n })),
  edges: [],
  door_closed_before_timer: "unknown",
  timer_set_to_30s: "unknown",
  safe_handling: "unknown",
  clarification_needed: false,
  complete: false,
};

const DEFAULT_SELFIE: SelfieAnnotation = {
  lighting_quality: "",
  framing_quality: "",
  steadiness: "",
  eye_contact_consistency: "",
  face_visibility: "",
  motion_pattern: "",
  resolution_estimate: "",
  overall_capture_quality: "",
  usable_for_training: "",
  notes: "",
  complete: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function genId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── AI Verification Logic ────────────────────────────────────────────────────

function runPickPlaceAI(ann: PickPlaceAnnotation): PickPlaceAIResult {
  const flags: AIFlag[] = [];
  const hasPlacement = ann.segments.some((s) => s.event_type === "placement");
  if (!hasPlacement) flags.push({ type: "warning", message: "Missing placement event" });
  if (
    ann.training_suitability === "approved" &&
    ann.segments.some((s) => s.event_type === "drop")
  ) {
    flags.push({ type: "error", message: "Contradicting verdict: drop event found but suitability is approved" });
  }
  ann.segments.forEach((s) => {
    if (s.endTime <= s.startTime) {
      flags.push({ type: "error", message: `Invalid segment duration for segment starting at ${fmtTime(s.startTime)}` });
    }
  });
  return {
    flags,
    overall_confidence: Math.max(0, 100 - flags.length * 10),
  };
}

function runMicrowaveAI(ann: MicrowaveAnnotation): MicrowaveAIResult {
  const flags: AIFlag[] = [];
  const getNode = (id: string) => ann.nodes.find((n) => n.id === id);
  const openDoor = getNode("open_door");
  const placePlate = getNode("place_plate");
  const closeDoor = getNode("close_door");
  const setTimer = getNode("set_timer");
  if (placePlate?.completed && !openDoor?.completed) {
    flags.push({ type: "error", message: "place_plate completed before open_door" });
  }
  if (setTimer?.completed && !closeDoor?.completed) {
    flags.push({ type: "error", message: "set_timer completed before close_door" });
  }
  if (ann.door_closed_before_timer !== "pass") {
    flags.push({ type: "warning", message: "Constraint: door_closed_before_timer not passed" });
  }
  return {
    flags,
    procedure_consistency_score: Math.max(0, 100 - flags.length * 15),
  };
}

function runSelfieAI(ann: SelfieAnnotation): SelfieAIResult {
  const flags: AIFlag[] = [];
  const failFields = [
    ann.lighting_quality,
    ann.framing_quality,
    ann.steadiness,
    ann.eye_contact_consistency,
    ann.face_visibility,
    ann.motion_pattern,
  ];
  const failCount = failFields.filter((v) => v === "fail").length;
  if (failCount >= 2 && ann.usable_for_training === "yes") {
    flags.push({ type: "error", message: "Contradicting usability verdict: multiple fails but marked usable" });
  }
  let ai_recommendation: "approve" | "conditional" | "reshoot" = "approve";
  if (failCount >= 3) ai_recommendation = "reshoot";
  else if (failCount >= 1) ai_recommendation = "conditional";
  return {
    flags,
    ai_recommendation,
    confidence: Math.max(0, 90 - failCount * 10),
  };
}

// ─── Export JSON builders ─────────────────────────────────────────────────────

function buildPickPlaceJSON(
  ann: PickPlaceAnnotation,
  ai: PickPlaceAIResult,
  qa: QAState
): object {
  return {
    task_id: "pick-place",
    annotator_id: "annotator-demo",
    timestamp: new Date().toISOString(),
    segments: ann.segments,
    verdict: {
      training_suitability: ann.training_suitability,
      primary_risk: ann.primary_risk,
    },
    ai_verification: {
      flags: ai.flags,
      confidence: ai.overall_confidence,
    },
    qa: {
      accepted_ai: qa.accepted_ai,
      override: !qa.accepted_ai,
      final_suitability: qa.accepted_ai ? ann.training_suitability : qa.override_suitability,
      final_risk: qa.accepted_ai ? ann.primary_risk : qa.override_risk,
    },
  };
}

function buildMicrowaveJSON(
  ann: MicrowaveAnnotation,
  ai: MicrowaveAIResult,
  qa: QAState
): object {
  return {
    task_id: "microwave",
    annotator_id: "annotator-demo",
    timestamp: new Date().toISOString(),
    nodes: ann.nodes,
    edges: ann.edges,
    constraints: {
      door_closed_before_timer: ann.door_closed_before_timer,
      timer_set_to_30s: ann.timer_set_to_30s,
      safe_handling: ann.safe_handling,
    },
    procedure_consistency_score: qa.accepted_ai
      ? ai.procedure_consistency_score
      : qa.override_procedure_score,
    qa_override: !qa.accepted_ai,
    final_suitability: qa.accepted_ai ? "ai-verified" : qa.override_constraint_status,
  };
}

function buildSelfieJSON(
  ann: SelfieAnnotation,
  ai: SelfieAIResult,
  qa: QAState
): object {
  return {
    task_id: "selfie",
    annotator_id: "annotator-demo",
    timestamp: new Date().toISOString(),
    quality_checks: {
      lighting_quality: ann.lighting_quality,
      framing_quality: ann.framing_quality,
      steadiness: ann.steadiness,
      eye_contact_consistency: ann.eye_contact_consistency,
      face_visibility: ann.face_visibility,
      motion_pattern: ann.motion_pattern,
    },
    overall_capture_quality: ann.overall_capture_quality,
    usable_for_training: ann.usable_for_training,
    ai_recommendation: ai.ai_recommendation,
    ai_confidence: ai.confidence,
    final_status: qa.accepted_ai ? ai.ai_recommendation : qa.override_final_status,
  };
}

function buildPickPlaceCSV(ann: PickPlaceAnnotation): string {
  const rows = [["segment_id", "start_time", "end_time", "event_type", "confidence"]];
  ann.segments.forEach((s) => {
    rows.push([s.id, fmtTime(s.startTime), fmtTime(s.endTime), s.event_type, s.confidence]);
  });
  return rows.map((r) => r.join(",")).join("\n");
}

function buildMicrowaveCSV(ann: MicrowaveAnnotation): string {
  const rows = [["node_id", "label", "completed", "timestamp"]];
  ann.nodes.forEach((n) => {
    rows.push([n.id, n.label, n.completed ? "yes" : "no", n.timestamp !== null ? fmtTime(n.timestamp) : ""]);
  });
  return rows.map((r) => r.join(",")).join("\n");
}

function buildSelfieCSV(ann: SelfieAnnotation): string {
  const rows = [
    ["dimension", "value"],
    ["lighting_quality", ann.lighting_quality],
    ["framing_quality", ann.framing_quality],
    ["steadiness", ann.steadiness],
    ["eye_contact_consistency", ann.eye_contact_consistency],
    ["face_visibility", ann.face_visibility],
    ["motion_pattern", ann.motion_pattern],
    ["overall_capture_quality", ann.overall_capture_quality],
    ["usable_for_training", ann.usable_for_training],
  ];
  return rows.map((r) => r.join(",")).join("\n");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SelectField({
  label,
  value,
  onChange,
  options,
  isDark,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  isDark: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className={`text-xs font-medium ${isDark ? "text-white/60" : "text-gray-500"}`}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`text-sm rounded-md px-2 py-1.5 border outline-none ${
          isDark
            ? "bg-white/10 border-white/20 text-white"
            : "bg-white border-gray-300 text-gray-900"
        }`}
      >
        <option value="">-- Select --</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ConfidenceBar({ score, isDark }: { score: number; isDark: boolean }) {
  const color = score >= 80 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 h-2 rounded-full ${isDark ? "bg-white/10" : "bg-gray-200"}`}>
        <div
          className={`h-2 rounded-full ${color} transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-xs font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{score}%</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const EmbodiedAI: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const videoRef = useRef<HTMLVideoElement>(null);

  // Global stage
  const [stage, setStage] = useState<Stage>("annotate");
  const [activeTask, setActiveTask] = useState<TaskId>("pick-place");

  // Video time tracking
  const [currentTime, setCurrentTime] = useState(0);
  const [markedStart, setMarkedStart] = useState<number>(0);
  const [markedEnd, setMarkedEnd] = useState<number>(0);

  // Per-task annotation state
  const [annotations, setAnnotations] = useState<TaskAnnotations>({
    "pick-place": null,
    microwave: null,
    selfie: null,
  });

  // AI results per task
  const [aiResults, setAiResults] = useState<Record<TaskId, AIResult>>({
    "pick-place": null,
    microwave: null,
    selfie: null,
  });

  // AI thinking state
  const [aiThinking, setAiThinking] = useState(false);

  // QA state per task
  const defaultQA: QAState = {
    accepted_ai: false,
    override_suitability: "",
    override_risk: "",
    override_procedure_score: 80,
    override_constraint_status: "",
    override_final_status: "",
    locked: false,
  };
  const [qaStates, setQaStates] = useState<Record<TaskId, QAState>>({
    "pick-place": { ...defaultQA },
    microwave: { ...defaultQA },
    selfie: { ...defaultQA },
  });

  // Pick & Place form state
  const [ppAddingSegment, setPpAddingSegment] = useState(false);
  const [ppSegForm, setPpSegForm] = useState({
    startTime: 0,
    endTime: 0,
    event_type: "",
    contact_quality: "",
    stability: "",
    confidence: "",
  });

  // ── Lazy-init annotations when switching tasks ──────────────────────────────
  const getOrInitAnnotation = useCallback(
    (task: TaskId): PickPlaceAnnotation | MicrowaveAnnotation | SelfieAnnotation => {
      if (task === "pick-place") {
        return (
          annotations["pick-place"] || {
            segments: [],
            training_suitability: "",
            primary_risk: "",
            notes: "",
            complete: false,
          }
        );
      }
      if (task === "microwave") {
        return annotations.microwave || { ...DEFAULT_MICROWAVE, nodes: MICROWAVE_NODES_DEFAULT.map((n) => ({ ...n })), edges: [] };
      }
      return annotations.selfie || { ...DEFAULT_SELFIE };
    },
    [annotations]
  );

  // ── Video time tracking ────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handler = () => setCurrentTime(video.currentTime);
    video.addEventListener("timeupdate", handler);
    return () => video.removeEventListener("timeupdate", handler);
  }, [activeTask]);

  // Reset time display when switching tasks
  useEffect(() => {
    setCurrentTime(0);
    setMarkedStart(0);
    setMarkedEnd(0);
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [activeTask]);

  // ── Stage indicator ────────────────────────────────────────────────────────
  const stages: { id: Stage; label: string }[] = [
    { id: "annotate", label: "① Annotate" },
    { id: "ai-verify", label: "② AI Verify" },
    { id: "qa", label: "③ QA Review" },
    { id: "export", label: "④ Export" },
  ];

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleMarkStart() {
    const t = videoRef.current?.currentTime ?? 0;
    setMarkedStart(t);
    setPpSegForm((f) => ({ ...f, startTime: t }));
  }

  function handleMarkEnd() {
    const t = videoRef.current?.currentTime ?? 0;
    setMarkedEnd(t);
    setPpSegForm((f) => ({ ...f, endTime: t }));
  }

  // Pick & Place
  function getPPAnnotation(): PickPlaceAnnotation {
    return (
      annotations["pick-place"] || {
        segments: [],
        training_suitability: "",
        primary_risk: "",
        notes: "",
        complete: false,
      }
    );
  }

  function updatePP(updater: (prev: PickPlaceAnnotation) => PickPlaceAnnotation) {
    setAnnotations((prev) => ({
      ...prev,
      "pick-place": updater(getPPAnnotation()),
    }));
  }

  function addPPSegment() {
    if (!ppSegForm.event_type || !ppSegForm.contact_quality || !ppSegForm.stability || !ppSegForm.confidence) return;
    updatePP((prev) => ({
      ...prev,
      segments: [
        ...prev.segments,
        {
          id: genId(),
          startTime: ppSegForm.startTime,
          endTime: ppSegForm.endTime,
          event_type: ppSegForm.event_type,
          contact_quality: ppSegForm.contact_quality,
          stability: ppSegForm.stability,
          confidence: ppSegForm.confidence,
        },
      ],
    }));
    setPpSegForm({ startTime: 0, endTime: 0, event_type: "", contact_quality: "", stability: "", confidence: "" });
    setPpAddingSegment(false);
  }

  function deletePPSegment(id: string) {
    updatePP((prev) => ({ ...prev, segments: prev.segments.filter((s) => s.id !== id) }));
  }

  // Microwave
  function getMWAnnotation(): MicrowaveAnnotation {
    return annotations.microwave || { ...DEFAULT_MICROWAVE, nodes: MICROWAVE_NODES_DEFAULT.map((n) => ({ ...n })), edges: [] };
  }

  function updateMW(updater: (prev: MicrowaveAnnotation) => MicrowaveAnnotation) {
    setAnnotations((prev) => ({
      ...prev,
      microwave: updater(getMWAnnotation()),
    }));
  }

  function toggleMWNodeComplete(nodeId: string) {
    updateMW((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, completed: !n.completed, timestamp: !n.completed ? (videoRef.current?.currentTime ?? null) : null }
          : n
      ),
    }));
  }

  function captureMWNodeTimestamp(nodeId: string) {
    const t = videoRef.current?.currentTime ?? 0;
    updateMW((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, timestamp: t } : n)),
    }));
  }

  function toggleMWEdge(from: string, to: string) {
    updateMW((prev) => {
      const exists = prev.edges.some((e) => e.from === from && e.to === to);
      return {
        ...prev,
        edges: exists
          ? prev.edges.filter((e) => !(e.from === from && e.to === to))
          : [...prev.edges, { from, to }],
      };
    });
  }

  // Selfie
  function getSelfieAnnotation(): SelfieAnnotation {
    return annotations.selfie || { ...DEFAULT_SELFIE };
  }

  function updateSelfie(updater: (prev: SelfieAnnotation) => SelfieAnnotation) {
    setAnnotations((prev) => ({
      ...prev,
      selfie: updater(getSelfieAnnotation()),
    }));
  }

  // Submit annotation → trigger AI
  function handleSubmitAnnotation() {
    const ann = getOrInitAnnotation(activeTask);
    // Mark complete
    if (activeTask === "pick-place") {
      updatePP((p) => ({ ...p, complete: true }));
    } else if (activeTask === "microwave") {
      updateMW((m) => ({ ...m, complete: true }));
    } else {
      updateSelfie((s) => ({ ...s, complete: true }));
    }
    setAiThinking(true);
    setStage("ai-verify");

    setTimeout(() => {
      let result: AIResult = null;
      const freshAnn = ann;
      if (activeTask === "pick-place") {
        const pp = annotations["pick-place"] || (freshAnn as PickPlaceAnnotation);
        result = runPickPlaceAI(pp);
      } else if (activeTask === "microwave") {
        const mw = annotations.microwave || (freshAnn as MicrowaveAnnotation);
        result = runMicrowaveAI(mw);
      } else {
        const sf = annotations.selfie || (freshAnn as SelfieAnnotation);
        result = runSelfieAI(sf);
      }
      setAiResults((prev) => ({ ...prev, [activeTask]: result }));
      setAiThinking(false);
    }, 1500);
  }

  // Recalculate AI on the freshest annotation then enter stage
  function handleSubmitAnnotationFresh() {
    setAiThinking(true);
    setStage("ai-verify");
    setTimeout(() => {
      let result: AIResult = null;
      if (activeTask === "pick-place") {
        const pp = annotations["pick-place"];
        if (pp) result = runPickPlaceAI(pp);
      } else if (activeTask === "microwave") {
        const mw = annotations.microwave;
        if (mw) result = runMicrowaveAI(mw);
      } else {
        const sf = annotations.selfie;
        if (sf) result = runSelfieAI(sf);
      }
      setAiResults((prev) => ({ ...prev, [activeTask]: result }));
      setAiThinking(false);
    }, 1500);
  }

  function handleProceedToQA() {
    setStage("qa");
  }

  function updateQA(updater: (prev: QAState) => QAState) {
    setQaStates((prev) => ({ ...prev, [activeTask]: updater(prev[activeTask]) }));
  }

  function handleAcceptAI() {
    updateQA((q) => ({ ...q, accepted_ai: true }));
  }

  function handleLockQA() {
    updateQA((q) => ({ ...q, locked: true }));
    setStage("export");
  }

  function handleStartNewTask() {
    setStage("annotate");
    setAnnotations((prev) => ({ ...prev, [activeTask]: null }));
    setAiResults((prev) => ({ ...prev, [activeTask]: null }));
    setQaStates((prev) => ({ ...prev, [activeTask]: { ...defaultQA } }));
    setPpAddingSegment(false);
    setPpSegForm({ startTime: 0, endTime: 0, event_type: "", contact_quality: "", stability: "", confidence: "" });
  }

  // ── Computed helpers ──────────────────────────────────────────────────────

  const ppAnn = getPPAnnotation();
  const mwAnn = getMWAnnotation();
  const selfieAnn = getSelfieAnnotation();

  const ppSubmittable =
    ppAnn.segments.length > 0 && ppAnn.training_suitability !== "" && ppAnn.primary_risk !== "";

  const mwSubmittable = mwAnn.nodes.some((n) => n.completed);

  const selfieSubmittable =
    selfieAnn.lighting_quality !== "" &&
    selfieAnn.framing_quality !== "" &&
    selfieAnn.steadiness !== "" &&
    selfieAnn.eye_contact_consistency !== "" &&
    selfieAnn.face_visibility !== "" &&
    selfieAnn.motion_pattern !== "" &&
    selfieAnn.overall_capture_quality !== "" &&
    selfieAnn.usable_for_training !== "";

  const canSubmit =
    activeTask === "pick-place"
      ? ppSubmittable
      : activeTask === "microwave"
      ? mwSubmittable
      : selfieSubmittable;

  const aiResult = aiResults[activeTask];
  const qaState = qaStates[activeTask];

  // Export data
  function getExportJSON(): object {
    if (activeTask === "pick-place" && annotations["pick-place"] && aiResult) {
      return buildPickPlaceJSON(annotations["pick-place"]!, aiResult as PickPlaceAIResult, qaState);
    }
    if (activeTask === "microwave" && annotations.microwave && aiResult) {
      return buildMicrowaveJSON(annotations.microwave!, aiResult as MicrowaveAIResult, qaState);
    }
    if (activeTask === "selfie" && annotations.selfie && aiResult) {
      return buildSelfieJSON(annotations.selfie!, aiResult as SelfieAIResult, qaState);
    }
    return {};
  }

  function getExportCSV(): string {
    if (activeTask === "pick-place" && annotations["pick-place"]) return buildPickPlaceCSV(annotations["pick-place"]!);
    if (activeTask === "microwave" && annotations.microwave) return buildMicrowaveCSV(annotations.microwave!);
    if (activeTask === "selfie" && annotations.selfie) return buildSelfieCSV(annotations.selfie!);
    return "";
  }

  // ── Styling helpers ────────────────────────────────────────────────────────
  const panelClass = `rounded-xl border p-4 ${isDark ? "bg-white/5 border-white/15" : "bg-gray-50 border-gray-200"}`;
  const inputClass = `w-full text-sm rounded-md px-2 py-1.5 border outline-none ${
    isDark ? "bg-white/10 border-white/20 text-white" : "bg-white border-gray-300 text-gray-900"
  }`;
  const labelClass = `text-xs font-medium ${isDark ? "text-white/60" : "text-gray-500"}`;
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-white/60" : "text-gray-500";
  const btnViolet = `px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed`;
  const btnGhost = `px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
    isDark ? "border-white/20 text-white/70 hover:bg-white/10" : "border-gray-300 text-gray-600 hover:bg-gray-100"
  }`;

  // ── Render helpers ─────────────────────────────────────────────────────────

  function renderAIFlags(flags: AIFlag[]) {
    if (flags.length === 0) {
      return (
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <span className="material-symbols-outlined text-base">check_circle</span>
          No issues found
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        {flags.map((f, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 text-sm rounded-lg px-2 py-1.5 ${
              f.type === "error"
                ? "bg-red-500/10 text-red-400"
                : "bg-yellow-500/10 text-yellow-400"
            }`}
          >
            <span className="material-symbols-outlined text-base mt-0.5">
              {f.type === "error" ? "error" : "warning"}
            </span>
            <span>{f.message}</span>
          </div>
        ))}
      </div>
    );
  }

  // ── Pick & Place annotation panel ─────────────────────────────────────────
  function renderPickPlaceAnnotation() {
    const pp = ppAnn;
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className={`text-sm font-semibold ${textPrimary}`}>Event Segments</span>
          <button className={btnViolet} onClick={() => setPpAddingSegment((v) => !v)}>
            {ppAddingSegment ? "Cancel" : "+ Add Event Segment"}
          </button>
        </div>

        {ppAddingSegment && (
          <div className={`${panelClass} flex flex-col gap-3`}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Start Time (s)</label>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={ppSegForm.startTime}
                  onChange={(e) => setPpSegForm((f) => ({ ...f, startTime: parseFloat(e.target.value) || 0 }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>End Time (s)</label>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={ppSegForm.endTime}
                  onChange={(e) => setPpSegForm((f) => ({ ...f, endTime: parseFloat(e.target.value) || 0 }))}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Event Type"
                value={ppSegForm.event_type}
                onChange={(v) => setPpSegForm((f) => ({ ...f, event_type: v }))}
                isDark={isDark}
                options={[
                  { value: "grasp", label: "Grasp" },
                  { value: "lift", label: "Lift" },
                  { value: "transport", label: "Transport" },
                  { value: "placement", label: "Placement" },
                  { value: "release", label: "Release" },
                  { value: "drop", label: "Drop" },
                  { value: "regrasp", label: "Regrasp" },
                  { value: "idle", label: "Idle" },
                ]}
              />
              <SelectField
                label="Contact Quality"
                value={ppSegForm.contact_quality}
                onChange={(v) => setPpSegForm((f) => ({ ...f, contact_quality: v }))}
                isDark={isDark}
                options={[
                  { value: "clean", label: "Clean" },
                  { value: "partial", label: "Partial" },
                  { value: "failed", label: "Failed" },
                ]}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Stability"
                value={ppSegForm.stability}
                onChange={(v) => setPpSegForm((f) => ({ ...f, stability: v }))}
                isDark={isDark}
                options={[
                  { value: "stable", label: "Stable" },
                  { value: "wobble", label: "Wobble" },
                  { value: "drop", label: "Drop" },
                ]}
              />
              <SelectField
                label="Confidence"
                value={ppSegForm.confidence}
                onChange={(v) => setPpSegForm((f) => ({ ...f, confidence: v }))}
                isDark={isDark}
                options={[
                  { value: "high", label: "High" },
                  { value: "medium", label: "Medium" },
                  { value: "low", label: "Low" },
                ]}
              />
            </div>
            <button
              className={btnViolet}
              onClick={addPPSegment}
              disabled={!ppSegForm.event_type || !ppSegForm.contact_quality || !ppSegForm.stability || !ppSegForm.confidence}
            >
              Add Segment
            </button>
          </div>
        )}

        {pp.segments.length === 0 ? (
          <p className={`text-sm ${textSecondary}`}>No segments added yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {pp.segments.map((s) => (
              <div
                key={s.id}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm border ${
                  isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className={`font-medium ${textPrimary}`}>
                    {fmtTime(s.startTime)} → {fmtTime(s.endTime)}
                  </span>
                  <span className={textSecondary}>
                    {s.event_type} · {s.contact_quality} · {s.stability} · {s.confidence}
                  </span>
                </div>
                <button
                  onClick={() => deletePPSegment(s.id)}
                  className="text-red-400 hover:text-red-300 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mt-2">
          <SelectField
            label="Training Suitability"
            value={pp.training_suitability}
            onChange={(v) => updatePP((p) => ({ ...p, training_suitability: v }))}
            isDark={isDark}
            options={[
              { value: "approved", label: "Approved" },
              { value: "needs-review", label: "Needs Review" },
              { value: "rejected", label: "Rejected" },
            ]}
          />
          <SelectField
            label="Primary Risk"
            value={pp.primary_risk}
            onChange={(v) => updatePP((p) => ({ ...p, primary_risk: v }))}
            isDark={isDark}
            options={[
              { value: "none", label: "None" },
              { value: "drop", label: "Drop" },
              { value: "slip", label: "Slip" },
              { value: "collision", label: "Collision" },
            ]}
          />
        </div>

        <div>
          <label className={labelClass}>Notes (optional)</label>
          <textarea
            value={pp.notes}
            onChange={(e) => updatePP((p) => ({ ...p, notes: e.target.value }))}
            rows={2}
            className={`${inputClass} resize-none mt-1`}
            placeholder="Additional notes..."
          />
        </div>

        <button
          className={`${btnViolet} self-end mt-1`}
          disabled={!canSubmit}
          onClick={handleSubmitAnnotationFresh}
        >
          Submit Annotation →
        </button>
      </div>
    );
  }

  // ── Microwave annotation panel ─────────────────────────────────────────────
  function renderMicrowaveAnnotation() {
    const mw = mwAnn;
    const edgeChecked = (from: string, to: string) => mw.edges.some((e) => e.from === from && e.to === to);

    return (
      <div className="flex flex-col gap-4">
        <span className={`text-sm font-semibold ${textPrimary}`}>Skill Graph Nodes</span>
        <div className="flex flex-col gap-2">
          {mw.nodes.map((node) => (
            <div
              key={node.id}
              className={`flex items-center justify-between rounded-lg px-3 py-2 border ${
                isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={node.completed}
                  onChange={() => toggleMWNodeComplete(node.id)}
                  className="accent-violet-500 w-4 h-4"
                />
                <span className={`text-sm ${textPrimary}`}>{node.label}</span>
                {node.timestamp !== null && (
                  <span className={`text-xs px-1.5 py-0.5 rounded ${isDark ? "bg-violet-500/20 text-violet-300" : "bg-violet-100 text-violet-700"}`}>
                    {fmtTime(node.timestamp)}
                  </span>
                )}
              </div>
              <button
                className={`text-xs px-2 py-1 rounded border ${isDark ? "border-white/20 text-white/60 hover:bg-white/10" : "border-gray-200 text-gray-500 hover:bg-gray-100"}`}
                onClick={() => captureMWNodeTimestamp(node.id)}
              >
                Capture timestamp
              </button>
            </div>
          ))}
        </div>

        <span className={`text-sm font-semibold ${textPrimary}`}>Prerequisite Edges Satisfied</span>
        <div className="flex flex-col gap-2">
          {MICROWAVE_EDGES.map((edge) => (
            <label key={`${edge.from}-${edge.to}`} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={edgeChecked(edge.from, edge.to)}
                onChange={() => toggleMWEdge(edge.from, edge.to)}
                className="accent-violet-500 w-4 h-4"
              />
              <span className={`text-sm ${textSecondary}`}>
                <span className={`font-mono ${textPrimary}`}>{edge.from}</span> → requires →{" "}
                <span className={`font-mono ${textPrimary}`}>{edge.to}</span>
              </span>
            </label>
          ))}
        </div>

        <span className={`text-sm font-semibold ${textPrimary}`}>Constraint Checks</span>
        <div className="grid grid-cols-1 gap-3">
          <SelectField
            label="Door closed before timer"
            value={mw.door_closed_before_timer}
            onChange={(v) => updateMW((m) => ({ ...m, door_closed_before_timer: v }))}
            isDark={isDark}
            options={[
              { value: "pass", label: "Pass" },
              { value: "fail", label: "Fail" },
              { value: "unknown", label: "Unknown" },
            ]}
          />
          <SelectField
            label="Timer set to 30s"
            value={mw.timer_set_to_30s}
            onChange={(v) => updateMW((m) => ({ ...m, timer_set_to_30s: v }))}
            isDark={isDark}
            options={[
              { value: "pass", label: "Pass" },
              { value: "fail", label: "Fail" },
              { value: "unknown", label: "Unknown" },
            ]}
          />
          <SelectField
            label="Safe handling"
            value={mw.safe_handling}
            onChange={(v) => updateMW((m) => ({ ...m, safe_handling: v }))}
            isDark={isDark}
            options={[
              { value: "pass", label: "Pass" },
              { value: "fail", label: "Fail" },
              { value: "unknown", label: "Unknown" },
            ]}
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={mw.clarification_needed}
            onChange={() => updateMW((m) => ({ ...m, clarification_needed: !m.clarification_needed }))}
            className="accent-violet-500 w-4 h-4"
          />
          <span className={`text-sm ${textSecondary}`}>Clarification needed from task owner</span>
        </label>

        <button
          className={`${btnViolet} self-end mt-1`}
          disabled={!canSubmit}
          onClick={handleSubmitAnnotationFresh}
        >
          Submit Annotation →
        </button>
      </div>
    );
  }

  // ── Selfie annotation panel ────────────────────────────────────────────────
  const SELFIE_CHECKS: { key: keyof SelfieAnnotation; label: string }[] = [
    { key: "lighting_quality", label: "Lighting Quality" },
    { key: "framing_quality", label: "Framing Quality" },
    { key: "steadiness", label: "Steadiness" },
    { key: "eye_contact_consistency", label: "Eye Contact Consistency" },
    { key: "face_visibility", label: "Face Visibility" },
    { key: "motion_pattern", label: "Motion Pattern" },
  ];

  function renderSelfieAnnotation() {
    const sf = selfieAnn;
    return (
      <div className="flex flex-col gap-4">
        <span className={`text-sm font-semibold ${textPrimary}`}>Quality Checklist</span>
        <div className="flex flex-col gap-3">
          {SELFIE_CHECKS.map((check) => {
            const val = sf[check.key] as string;
            return (
              <div key={check.key} className="flex items-center justify-between">
                <span className={`text-sm ${textSecondary}`}>{check.label}</span>
                <div className="flex gap-3">
                  {["pass", "fail"].map((opt) => (
                    <label key={opt} className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name={check.key}
                        value={opt}
                        checked={val === opt}
                        onChange={() => updateSelfie((s) => ({ ...s, [check.key]: opt }))}
                        className="accent-violet-500"
                      />
                      <span className={`text-sm capitalize ${val === opt ? (opt === "pass" ? "text-green-400" : "text-red-400") : textSecondary}`}>
                        {opt}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-3 mt-2">
          <SelectField
            label="Resolution Estimate"
            value={sf.resolution_estimate}
            onChange={(v) => updateSelfie((s) => ({ ...s, resolution_estimate: v }))}
            isDark={isDark}
            options={[
              { value: "720p", label: "720p" },
              { value: "1080p", label: "1080p" },
              { value: "4k", label: "4K" },
              { value: "sub-720p", label: "Sub-720p" },
            ]}
          />
          <SelectField
            label="Overall Capture Quality"
            value={sf.overall_capture_quality}
            onChange={(v) => updateSelfie((s) => ({ ...s, overall_capture_quality: v }))}
            isDark={isDark}
            options={[
              { value: "excellent", label: "Excellent" },
              { value: "good", label: "Good" },
              { value: "acceptable", label: "Acceptable" },
              { value: "poor", label: "Poor" },
            ]}
          />
          <SelectField
            label="Usable for Training?"
            value={sf.usable_for_training}
            onChange={(v) => updateSelfie((s) => ({ ...s, usable_for_training: v }))}
            isDark={isDark}
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
              { value: "conditional", label: "Conditional" },
            ]}
          />
        </div>

        <div>
          <label className={labelClass}>Notes (optional)</label>
          <textarea
            value={sf.notes}
            onChange={(e) => updateSelfie((s) => ({ ...s, notes: e.target.value }))}
            rows={2}
            className={`${inputClass} resize-none mt-1`}
            placeholder="Additional notes..."
          />
        </div>

        <button
          className={`${btnViolet} self-end mt-1`}
          disabled={!canSubmit}
          onClick={handleSubmitAnnotationFresh}
        >
          Submit Annotation →
        </button>
      </div>
    );
  }

  // ── AI Verify right panel ──────────────────────────────────────────────────
  function renderAIVerifyPanel() {
    if (aiThinking) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-10">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <span className={`text-sm ${textSecondary}`}>AI verifying annotation…</span>
        </div>
      );
    }
    if (!aiResult) {
      return <p className={`text-sm ${textSecondary}`}>Submit annotation to trigger AI verification.</p>;
    }

    let confidenceScore = 0;
    let flags: AIFlag[] = [];

    if (activeTask === "pick-place") {
      const r = aiResult as PickPlaceAIResult;
      flags = r.flags;
      confidenceScore = r.overall_confidence;
    } else if (activeTask === "microwave") {
      const r = aiResult as MicrowaveAIResult;
      flags = r.flags;
      confidenceScore = r.procedure_consistency_score;
    } else {
      const r = aiResult as SelfieAIResult;
      flags = r.flags;
      confidenceScore = r.confidence;
    }

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className={`material-symbols-outlined text-violet-400`}>psychology</span>
          <span className={`font-semibold text-sm ${textPrimary}`}>AI Verification Result</span>
        </div>

        <div className="flex flex-col gap-2">
          <span className={labelClass}>Confidence Score</span>
          <ConfidenceBar score={confidenceScore} isDark={isDark} />
        </div>

        <div className="flex flex-col gap-2">
          <span className={labelClass}>Flags</span>
          {renderAIFlags(flags)}
        </div>

        {activeTask === "selfie" && (
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            (aiResult as SelfieAIResult).ai_recommendation === "approve"
              ? "bg-green-500/10 text-green-400"
              : (aiResult as SelfieAIResult).ai_recommendation === "reshoot"
              ? "bg-red-500/10 text-red-400"
              : "bg-yellow-500/10 text-yellow-400"
          }`}>
            <span className="material-symbols-outlined text-base">lightbulb</span>
            AI Recommendation: <span className="font-bold ml-1 capitalize">{(aiResult as SelfieAIResult).ai_recommendation}</span>
          </div>
        )}

        <button className={btnViolet} onClick={handleProceedToQA}>
          Proceed to QA →
        </button>
      </div>
    );
  }

  // ── QA Review right panel ─────────────────────────────────────────────────
  function renderQAPanel() {
    if (!aiResult) {
      return <p className={`text-sm ${textSecondary}`}>AI verification results not available.</p>;
    }

    let flags: AIFlag[] = [];
    if (activeTask === "pick-place") flags = (aiResult as PickPlaceAIResult).flags;
    else if (activeTask === "microwave") flags = (aiResult as MicrowaveAIResult).flags;
    else flags = (aiResult as SelfieAIResult).flags;

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-yellow-400">rate_review</span>
          <span className={`font-semibold text-sm ${textPrimary}`}>QA Review</span>
        </div>

        <div className={`${panelClass} flex flex-col gap-2`}>
          <span className={`text-xs font-semibold ${textSecondary}`}>AI Findings</span>
          {renderAIFlags(flags)}
        </div>

        {!qaState.accepted_ai ? (
          <div className="flex flex-col gap-3">
            <button className={btnViolet} onClick={handleAcceptAI}>
              Accept AI Findings
            </button>
            <span className={`text-xs ${textSecondary}`}>— or override below —</span>

            {activeTask === "pick-place" && (
              <>
                <SelectField
                  label="Override Training Suitability"
                  value={qaState.override_suitability}
                  onChange={(v) => updateQA((q) => ({ ...q, override_suitability: v }))}
                  isDark={isDark}
                  options={[
                    { value: "approved", label: "Approved" },
                    { value: "needs-review", label: "Needs Review" },
                    { value: "rejected", label: "Rejected" },
                  ]}
                />
                <SelectField
                  label="Override Primary Risk"
                  value={qaState.override_risk}
                  onChange={(v) => updateQA((q) => ({ ...q, override_risk: v }))}
                  isDark={isDark}
                  options={[
                    { value: "none", label: "None" },
                    { value: "drop", label: "Drop" },
                    { value: "slip", label: "Slip" },
                    { value: "collision", label: "Collision" },
                  ]}
                />
              </>
            )}

            {activeTask === "microwave" && (
              <>
                <div>
                  <label className={labelClass}>Override Procedure Score (0–100)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={qaState.override_procedure_score}
                    onChange={(e) =>
                      updateQA((q) => ({ ...q, override_procedure_score: parseInt(e.target.value) || 0 }))
                    }
                    className={`${inputClass} mt-1`}
                  />
                </div>
                <SelectField
                  label="Final Constraint Status"
                  value={qaState.override_constraint_status}
                  onChange={(v) => updateQA((q) => ({ ...q, override_constraint_status: v }))}
                  isDark={isDark}
                  options={[
                    { value: "all-pass", label: "All Pass" },
                    { value: "partial", label: "Partial" },
                    { value: "fail", label: "Fail" },
                  ]}
                />
              </>
            )}

            {activeTask === "selfie" && (
              <SelectField
                label="Final Status Override"
                value={qaState.override_final_status}
                onChange={(v) => updateQA((q) => ({ ...q, override_final_status: v }))}
                isDark={isDark}
                options={[
                  { value: "usable", label: "Usable" },
                  { value: "reshoot", label: "Reshoot" },
                  { value: "conditional", label: "Conditional" },
                ]}
              />
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <span className="material-symbols-outlined text-base">check_circle</span>
            AI findings accepted
          </div>
        )}

        <button
          className={`${btnViolet} mt-1`}
          onClick={handleLockQA}
          disabled={!qaState.accepted_ai && (
            activeTask === "pick-place"
              ? !qaState.override_suitability || !qaState.override_risk
              : activeTask === "microwave"
              ? !qaState.override_constraint_status
              : !qaState.override_final_status
          )}
        >
          Lock QA Decision →
        </button>
      </div>
    );
  }

  // ── Export right panel (+ bottom) ─────────────────────────────────────────
  function renderExportPanel() {
    const json = getExportJSON();
    const jsonStr = JSON.stringify(json, null, 2);
    const csvStr = getExportCSV();

    // Build CSV table preview
    const csvLines = csvStr.split("\n");
    const csvHeaders = csvLines[0]?.split(",") || [];
    const csvRows = csvLines.slice(1).map((l) => l.split(","));

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-green-400">download</span>
          <span className={`font-semibold text-sm ${textPrimary}`}>Export</span>
        </div>

        <div className="flex gap-2">
          <button
            className={btnViolet}
            onClick={() => downloadBlob(jsonStr, `${activeTask}-annotation.json`, "application/json")}
          >
            Download JSON
          </button>
          <button
            className={btnGhost}
            onClick={() => downloadBlob(csvStr, `${activeTask}-annotation.csv`, "text/csv")}
          >
            Download CSV
          </button>
        </div>

        <div>
          <span className={`text-xs font-semibold ${textSecondary}`}>JSON Preview</span>
          <pre
            className={`mt-1 text-xs rounded-lg p-3 overflow-auto max-h-64 font-mono border ${
              isDark ? "bg-black/40 border-white/10 text-green-300" : "bg-gray-900 border-gray-700 text-green-300"
            }`}
          >
            {jsonStr}
          </pre>
        </div>

        {csvLines.length > 1 && (
          <div>
            <span className={`text-xs font-semibold ${textSecondary}`}>CSV Preview</span>
            <div className="mt-1 overflow-auto max-h-40 rounded-lg border border-white/10">
              <table className="w-full text-xs">
                <thead>
                  <tr className={isDark ? "bg-white/10" : "bg-gray-200"}>
                    {csvHeaders.map((h, i) => (
                      <th key={i} className={`px-2 py-1 text-left font-semibold ${textPrimary}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvRows.map((row, ri) => (
                    <tr key={ri} className={isDark ? "border-t border-white/5" : "border-t border-gray-100"}>
                      {row.map((cell, ci) => (
                        <td key={ci} className={`px-2 py-1 ${textSecondary}`}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <button className={btnGhost} onClick={handleStartNewTask}>
          Start New Task →
        </button>
      </div>
    );
  }

  // ── Right panel switcher ──────────────────────────────────────────────────
  function renderRightPanel() {
    switch (stage) {
      case "annotate":
        return (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-violet-400">info</span>
              <span className={`font-semibold text-sm ${textPrimary}`}>Workflow</span>
            </div>
            <p className={`text-sm ${textSecondary}`}>
              Complete the annotation panel, then click "Submit Annotation" to trigger AI verification.
            </p>
            <div className={`${panelClass} flex flex-col gap-2 text-sm`}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-violet-400 text-base">videocam</span>
                <span className={textSecondary}>Use video controls to scrub through footage</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-violet-400 text-base">timer</span>
                <span className={textSecondary}>Mark Start / Mark End captures current playback time</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-violet-400 text-base">check_circle</span>
                <span className={textSecondary}>Fill all required fields to enable Submit</span>
              </div>
            </div>
          </div>
        );
      case "ai-verify":
        return renderAIVerifyPanel();
      case "qa":
        return renderQAPanel();
      case "export":
        return renderExportPanel();
    }
  }

  // ── Center annotation panel switcher ─────────────────────────────────────
  function renderAnnotationPanel() {
    if (activeTask === "pick-place") return renderPickPlaceAnnotation();
    if (activeTask === "microwave") return renderMicrowaveAnnotation();
    return renderSelfieAnnotation();
  }

  // ── Task metadata ─────────────────────────────────────────────────────────
  const TASK_META: Record<TaskId, { icon: string; title: string; desc: string; tag: string }> = {
    "pick-place": {
      icon: "smart_toy",
      title: "Manipulation: Pick & Place",
      desc: "Label robotic grasp, transport, and placement events with contact quality and stability scores.",
      tag: "Robotics · Manipulation",
    },
    microwave: {
      icon: "microwave",
      title: "Multi-step: Microwave",
      desc: "Construct a skill graph for the microwave task sequence and verify prerequisite constraints.",
      tag: "Household AI · Task Graph",
    },
    selfie: {
      icon: "face",
      title: "Human Presence: Selfie QA",
      desc: "Assess selfie video for lighting, framing, steadiness, and face visibility for training suitability.",
      tag: "Presence QA · Video",
    },
  };
  const meta = TASK_META[activeTask];

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen ${isDark ? "bg-[hsl(0,0%,5%)]" : "bg-white"}`}>
      {/* Header */}
      <header
        className={`sticky top-0 z-50 w-full border-b ${
          isDark ? "bg-[hsl(0,0%,5%)] border-white/14" : "bg-white border-black/10"
        }`}
      >
        <div className="flex justify-between items-center px-6 py-3 h-16">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/use-cases")}
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                isDark ? "hover:bg-white/10" : "hover:bg-gray-100"
              }`}
            >
              <span className={`material-symbols-outlined ${isDark ? "text-white" : "text-gray-700"}`}>
                arrow_back
              </span>
            </button>
            <span className={`material-symbols-outlined ${isDark ? "text-violet-400" : "text-violet-600"}`}>
              smart_toy
            </span>
            <span className={`font-bold text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
              Embodied AI Data Labeling
            </span>
          </div>
        </div>
      </header>

      {/* Stage indicator */}
      <div
        className={`border-b px-6 py-3 flex items-center gap-2 flex-wrap ${
          isDark ? "border-white/10 bg-[hsl(0,0%,7%)]" : "border-gray-100 bg-gray-50"
        }`}
      >
        {stages.map((s, i) => (
          <React.Fragment key={s.id}>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                stage === s.id
                  ? "bg-violet-600 text-white"
                  : isDark
                  ? "bg-white/10 text-white/50"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {s.label}
            </span>
            {i < stages.length - 1 && (
              <span className={`material-symbols-outlined text-base ${isDark ? "text-white/20" : "text-gray-300"}`}>
                chevron_right
              </span>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Main layout */}
      <div className="flex flex-col md:flex-row gap-0">
        {/* Left panel: task selector + metadata */}
        <aside
          className={`md:w-72 shrink-0 border-r p-4 flex flex-col gap-4 ${
            isDark ? "border-white/10" : "border-gray-200"
          }`}
        >
          <div className="flex flex-col gap-2">
            <span className={`text-xs font-semibold uppercase tracking-wider ${textSecondary}`}>Tasks</span>
            {(["pick-place", "microwave", "selfie"] as TaskId[]).map((taskId) => {
              const m = TASK_META[taskId];
              const isActive = activeTask === taskId;
              return (
                <button
                  key={taskId}
                  onClick={() => {
                    setActiveTask(taskId);
                    if (stage !== "annotate") setStage("annotate");
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors ${
                    isActive
                      ? "bg-violet-600 text-white"
                      : isDark
                      ? "text-white/70 hover:bg-white/10"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span className="material-symbols-outlined text-base">{m.icon}</span>
                  <span className="truncate">{m.title}</span>
                </button>
              );
            })}
          </div>

          {/* Task metadata card */}
          <div className={panelClass}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`material-symbols-outlined text-violet-400 text-xl`}>{meta.icon}</span>
              <span className={`font-semibold text-sm ${textPrimary}`}>{meta.title}</span>
            </div>
            <p className={`text-xs ${textSecondary} mb-3`}>{meta.desc}</p>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                isDark ? "bg-violet-500/20 text-violet-300" : "bg-violet-100 text-violet-700"
              }`}
            >
              {meta.tag}
            </span>
          </div>

          {/* Annotation progress indicator */}
          <div className={panelClass}>
            <span className={`text-xs font-semibold ${textSecondary}`}>Progress</span>
            {(["pick-place", "microwave", "selfie"] as TaskId[]).map((taskId) => {
              const ann = annotations[taskId];
              const done = ann?.complete;
              return (
                <div key={taskId} className="flex items-center gap-2 mt-2">
                  <span
                    className={`material-symbols-outlined text-base ${
                      done ? "text-green-400" : isDark ? "text-white/20" : "text-gray-300"
                    }`}
                  >
                    {done ? "check_circle" : "radio_button_unchecked"}
                  </span>
                  <span className={`text-xs ${done ? (isDark ? "text-green-300" : "text-green-600") : textSecondary}`}>
                    {TASK_META[taskId].title.split(":")[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Center panel: video + annotation controls */}
        <main className="flex-1 p-4 flex flex-col gap-4 min-w-0">
          {/* Video player */}
          <div className={panelClass}>
            <video
              ref={videoRef}
              key={activeTask}
              controls
              className="w-full rounded-lg"
              src={TASK_VIDEO[activeTask]}
              onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
            >
              Your browser does not support the video element.
            </video>

            {/* Video controls row */}
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <span
                className={`text-xs font-mono px-2 py-1 rounded ${
                  isDark ? "bg-white/10 text-white" : "bg-gray-100 text-gray-800"
                }`}
              >
                {fmtTime(currentTime)}
              </span>
              <button
                className={`${btnGhost} text-xs`}
                onClick={handleMarkStart}
              >
                Mark Start ({fmtTime(markedStart)})
              </button>
              <button
                className={`${btnGhost} text-xs`}
                onClick={handleMarkEnd}
              >
                Mark End ({fmtTime(markedEnd)})
              </button>
              {activeTask === "selfie" && videoRef.current?.duration && (
                <span className={`text-xs ${textSecondary}`}>
                  Duration: {fmtTime(videoRef.current.duration)}
                </span>
              )}
            </div>
          </div>

          {/* Annotation panel */}
          <div className={panelClass}>
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-violet-400 text-base">edit_note</span>
              <span className={`font-semibold text-sm ${textPrimary}`}>Annotation Controls</span>
            </div>
            {stage === "annotate" ? (
              renderAnnotationPanel()
            ) : (
              <div className={`flex flex-col items-center gap-3 py-6 ${textSecondary}`}>
                <span className="material-symbols-outlined text-3xl text-violet-400">
                  {stage === "ai-verify" ? "psychology" : stage === "qa" ? "rate_review" : "download"}
                </span>
                <span className="text-sm">
                  {stage === "ai-verify"
                    ? "AI verification in progress…"
                    : stage === "qa"
                    ? "QA review in progress"
                    : "Annotation complete — export ready"}
                </span>
                <button
                  className={btnGhost}
                  onClick={() => setStage("annotate")}
                >
                  ← Back to Annotate
                </button>
              </div>
            )}
          </div>
        </main>

        {/* Right panel: workflow */}
        <aside
          className={`md:w-80 shrink-0 border-l p-4 ${
            isDark ? "border-white/10" : "border-gray-200"
          }`}
        >
          {renderRightPanel()}
        </aside>
      </div>
    </div>
  );
};

export default EmbodiedAI;

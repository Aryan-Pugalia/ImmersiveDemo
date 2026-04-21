import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, ArrowLeftRight, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VideoPairPanel } from "@/components/videotesting/VideoPanelAB";
import {
  VideoWorkflowPanel,
  WorkflowStage,
} from "@/components/videotesting/VideoWorkflowPanel";
import {
  VIDEO_TASKS,
  RatingDimKey,
  VideoRatings,
  EMPTY_RATINGS,
} from "@/components/videotesting/vidData";

export default function VideoABTesting() {
  const navigate = useNavigate();

  const [taskIndex, setTaskIndex] = useState(0);
  const currentTask = VIDEO_TASKS[taskIndex];

  const [allRatings, setAllRatings] = useState<Record<string, VideoRatings>>(
    () =>
      Object.fromEntries(VIDEO_TASKS.map((t) => [t.id, { ...EMPTY_RATINGS }]))
  );

  const [swapped, setSwapped] = useState(false);
  const [stage, setStage] = useState<WorkflowStage>("evaluate");
  const [aiRan, setAiRan] = useState(false);

  const handleRatingChange = useCallback(
    (
      taskId: string,
      key: RatingDimKey | "strength" | "confidence" | "rationale",
      val: unknown
    ) => {
      setAllRatings((prev) => ({
        ...prev,
        [taskId]: { ...prev[taskId], [key]: val },
      }));
    },
    []
  );

  const goToTask = (idx: number) => {
    setTaskIndex(idx);
    setSwapped(false);
  };

  const videoAUrl = swapped ? currentTask.videoB : currentTask.videoA;
  const videoBUrl = swapped ? currentTask.videoA : currentTask.videoB;
  const labelA = swapped ? "B" : "A";
  const labelB = swapped ? "A" : "B";
  const modelAText = swapped ? currentTask.modelB : currentTask.modelA;
  const modelBText = swapped ? currentTask.modelA : currentTask.modelB;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "hsl(0,0%,4%)" }}
    >
      {/* ── FABStudio Header ── */}
      <header className="sticky top-0 z-50 bg-[hsl(0,0%,5%)] w-full border-b border-border/20">
        <div className="flex items-center justify-between px-6 h-16 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate("/use-cases")}
              className="flex items-center justify-center p-2 hover:bg-muted rounded-full transition-colors shrink-0"
              title="Back to capabilities"
            >
              <ArrowLeft className="w-4 h-4 text-foreground" />
            </button>
            <span
              className="text-sm font-bold tracking-wide text-white cursor-pointer hover:text-white/80 transition-colors font-headline shrink-0"
              onClick={() => navigate("/use-cases")}
            >
              TP.ai <span style={{ color: "#aa00b6" }}>FAB</span>Studio
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm text-foreground/80 font-body whitespace-nowrap">
              Video A/B Testing
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-sm border-primary/50 text-primary hidden md:inline-flex">
              RLHF · Video Preference
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-sm"
              onClick={() => navigate("/qa-report/video-ab-testing")}
            >
              <BarChart2 className="h-3.5 w-3.5" /> QA Report
            </Button>
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full border border-border bg-surface-raised">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">A</span>
              </div>
              <span className="text-sm text-muted-foreground">Alex Johnson</span>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-[2px] w-full progress-bar-gradient" />
      </header>

      {/* Main split layout */}
      <div
        className="flex flex-1 overflow-hidden"
        style={{ height: "calc(100vh - 4rem)" }}
      >
        {/* Left: content */}
        <div className="flex-1 flex flex-col overflow-y-auto min-w-0">
          <div className="flex flex-col gap-3 p-4 h-full">
            {/* Prompt card */}
            <PromptCard
              taskNumber={currentTask.taskNumber}
              label={currentTask.promptLabel}
              prompt={currentTask.prompt}
              modelA={modelAText}
              modelB={modelBText}
              labelA={labelA}
              labelB={labelB}
            />

            {/* Controls bar */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Video A</span>
                <div className="flex gap-1">
                  {(["A", "B"] as const).map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center justify-center w-6 h-6 rounded text-sm font-bold text-white"
                      style={{ background: s === "A" ? "#6366f1" : "#7c3aed" }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <span>Video B</span>
              </div>

              <button
                onClick={() => setSwapped((v) => !v)}
                title="Swap video sides"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  swapped
                    ? "border-amber-600/50 bg-amber-600/10 text-amber-400"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-border/60"
                }`}
              >
                <ArrowLeftRight className="h-4 w-4" />
                Swap Sides
                {swapped && <span className="text-amber-400">(swapped)</span>}
              </button>
            </div>

            {/* Video pair player — constrained so controls stay above the fold */}
            <div
              className="min-h-0"
              style={{ height: "clamp(300px, 45vh, 460px)" }}
            >
              <VideoPairPanel
                key={currentTask.id + (swapped ? "-s" : "")}
                leftUrl={videoAUrl}
                rightUrl={videoBUrl}
                fps={currentTask.fps}
                hasAudio={currentTask.hasAudio}
                labelA={labelA}
                labelB={labelB}
              />
            </div>

            {/* Task label row */}
            <div className="flex items-center justify-center gap-3 pb-2">
              <span className="text-sm text-muted-foreground">
                Task {currentTask.taskNumber} of {VIDEO_TASKS.length} —
              </span>
              <span className="text-sm font-medium text-foreground/80">
                {currentTask.promptLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Right: workflow */}
        <aside
          className="w-[420px] shrink-0 border-l border-border/20 overflow-y-auto flex flex-col"
          style={{ background: "hsl(0,0%,5.5%)" }}
        >
          <VideoWorkflowPanel
            currentTaskId={currentTask.id}
            taskIndex={taskIndex}
            totalTasks={VIDEO_TASKS.length}
            onNextTask={() =>
              goToTask(Math.min(VIDEO_TASKS.length - 1, taskIndex + 1))
            }
            allRatings={allRatings}
            stage={stage}
            onStageChange={setStage}
            aiRan={aiRan}
            onRunAI={() => setAiRan(true)}
            onRatingChange={handleRatingChange}
            onOpenQAReport={() => navigate("/qa-report/video-ab-testing")}
          />
        </aside>
      </div>
    </div>
  );
}

// ─── Prompt Card ────────────────────────────────────────────────────────────
function PromptCard({
  taskNumber,
  label,
  prompt,
  modelA,
  modelB,
  labelA,
  labelB,
}: {
  taskNumber: number;
  label: string;
  prompt: string;
  modelA: string;
  modelB: string;
  labelA: string;
  labelB: string;
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="rounded-xl border border-border/40 p-4 flex gap-3 items-start"
      style={{ background: "hsl(0,0%,7%)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-sm font-bold uppercase tracking-widest text-primary">
            Prompt
          </span>
          <span className="text-sm text-muted-foreground font-mono">
            Task {taskNumber} · {label}
          </span>
          <span
            className="text-sm font-bold px-2 py-0.5 rounded text-white"
            style={{ background: "#6366f1" }}
          >
            {labelA}: {modelA}
          </span>
          <span
            className="text-sm font-bold px-2 py-0.5 rounded text-white"
            style={{ background: "#7c3aed" }}
          >
            {labelB}: {modelB}
          </span>
        </div>
        <p
          className={`text-base text-foreground/90 leading-relaxed font-mono ${
            !expanded ? "line-clamp-2" : ""
          }`}
        >
          {prompt}
        </p>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-sm text-primary/80 hover:text-primary mt-1.5"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      </div>
      <button
        onClick={handleCopy}
        title="Copy prompt"
        className="shrink-0 mt-0.5 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
      >
        {copied ? (
          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        )}
      </button>
    </div>
  );
}

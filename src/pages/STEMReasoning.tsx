/**
 * STEMReasoning.tsx — STEM Reasoning Validation & Chain-of-Thought Annotation
 * 6-stage pipeline:
 *   1. Problem Presentation
 *   2. Model-Generated Solution (Chain-of-Thought)
 *   3. Human Annotation (per-step labeling)
 *   4. AI Verification Pass
 *   5. Human QA / Adjudication
 *   6. Final Verdict & Data Delivery
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight, ChevronLeft, RefreshCw, CheckCircle, AlertCircle,
  XCircle, Brain, User, Shield, Award, Download, Star, AlertTriangle,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = 1 | 2 | 3 | 4 | 5 | 6;
type CorrectnessLabel = "correct" | "partially_correct" | "incorrect";
type ErrorType =
  | "conceptual_error"
  | "algebraic_error"
  | "calculus_misapplication"
  | "missing_justification";
type ConfidenceLevel = "high" | "medium" | "low";

interface StepAnnotation {
  stepId: number;
  correctness: CorrectnessLabel;
  errorType: ErrorType | null;
  confidence: ConfidenceLevel;
  note: string;
}

interface AIVerification {
  stepId: number;
  verdict: "agree" | "disagree";
  confidence: number;
  justification: string;
}

interface QADecision {
  stepId: number;
  finalLabel: CorrectnessLabel;
  confidence: ConfidenceLevel;
  source: "human" | "ai" | "manual";
}

// ─── Static data ──────────────────────────────────────────────────────────────

const STEPS = [
  {
    id: 1,
    title: "Rule Identification",
    latex:
      "f(x) = \\underbrace{x^2}_{u(x)} \\cdot \\underbrace{\\ln(x)}_{v(x)} \\implies \\text{Apply Product Rule}",
    description:
      "Recognize f(x) as a product of two differentiable functions: u(x) = x² and v(x) = ln(x). The Product Rule is required whenever a derivative is taken of a product of functions.",
  },
  {
    id: 2,
    title: "Product Rule Application",
    latex:
      "f'(x) = \\frac{d}{dx}\\bigl[x^2\\bigr] \\cdot \\ln(x) \\;+\\; x^2 \\cdot \\frac{d}{dx}\\bigl[\\ln(x)\\bigr]",
    description:
      "Apply the Product Rule: (uv)' = u'v + uv'. Expand by differentiating each factor independently while holding the other fixed.",
  },
  {
    id: 3,
    title: "Derivative Computation",
    latex:
      "\\frac{d}{dx}\\bigl[x^2\\bigr] = 2x \\qquad \\frac{d}{dx}\\bigl[\\ln(x)\\bigr] = \\frac{1}{x}",
    description:
      "Evaluate each derivative: Power Rule gives d/dx[x²] = 2x; the Natural Logarithm Rule gives d/dx[ln(x)] = 1/x for x > 0.",
  },
  {
    id: 4,
    title: "Substitution & Simplification",
    latex:
      "f'(x) = 2x \\cdot \\ln(x) + x^2 \\cdot \\frac{1}{x} = 2x\\ln(x) + x",
    description:
      "Substitute the computed derivatives and simplify: x²·(1/x) = x. Final answer: f'(x) = 2x ln(x) + x.",
  },
];

const AI_VERIFICATIONS: AIVerification[] = [
  {
    stepId: 1,
    verdict: "agree",
    confidence: 0.97,
    justification:
      "Product Rule selection is correct. Both x² and ln(x) are continuously differentiable on the domain x > 0.",
  },
  {
    stepId: 2,
    verdict: "agree",
    confidence: 0.95,
    justification:
      "Product Rule expansion is correctly structured; term ordering and notation are consistent with standard calculus convention.",
  },
  {
    stepId: 3,
    verdict: "agree",
    confidence: 0.99,
    justification:
      "Both derivatives are exact: Power Rule and Natural Logarithm Rule applied without error.",
  },
  {
    stepId: 4,
    verdict: "agree",
    confidence: 0.97,
    justification:
      "Algebraic simplification is correct. x²·(1/x) = x, and the final form 2x ln(x) + x is fully simplified.",
  },
];

const DEFAULT_ANNOTATIONS: StepAnnotation[] = STEPS.map((s) => ({
  stepId: s.id,
  correctness: "correct",
  errorType: null,
  confidence: "high",
  note: "",
}));

const DEFAULT_QA: QADecision[] = STEPS.map((s) => ({
  stepId: s.id,
  finalLabel: "correct",
  confidence: "high",
  source: "human",
}));

const STAGE_LABELS = [
  "Problem",
  "Model Solution",
  "Annotation",
  "AI Verification",
  "QA Review",
  "Final Verdict",
];

const ACCENT = "#7c3aed";
const ACCENT_LIGHT = "#9071f0";
const ACCENT_BG = "rgba(124,58,237,0.12)";

// ─── Standalone helper components (defined outside main to prevent remounting) ──

interface MathBlockProps {
  tex: string;
  display?: boolean;
  katexLoaded: boolean;
}

const MathBlock = ({ tex, display = false, katexLoaded }: MathBlockProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!katexLoaded || !ref.current || !(window as any).katex) return;
    try {
      (window as any).katex.render(tex, ref.current, {
        displayMode: display,
        throwOnError: false,
      });
    } catch {
      /* ignore parse errors in demo */
    }
  }, [katexLoaded, tex, display]);

  return (
    <span
      ref={ref}
      className={display ? "block py-3 text-center overflow-x-auto" : "inline"}
    >
      {!katexLoaded && (
        <code className="font-mono text-sm opacity-80 italic">{tex}</code>
      )}
    </span>
  );
};

const CorrectnessChip = ({ label }: { label: CorrectnessLabel }) => {
  const map: Record<CorrectnessLabel, { cls: string; icon: string; text: string }> = {
    correct: {
      cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
      icon: "✓",
      text: "Correct",
    },
    partially_correct: {
      cls: "text-amber-400 bg-amber-400/10 border-amber-400/30",
      icon: "~",
      text: "Partial",
    },
    incorrect: {
      cls: "text-red-400 bg-red-400/10 border-red-400/30",
      icon: "✗",
      text: "Incorrect",
    },
  };
  const { cls, icon, text } = map[label];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${cls}`}
    >
      {icon} {text}
    </span>
  );
};

const ConfidenceChip = ({ level }: { level: ConfidenceLevel }) => {
  const cls: Record<ConfidenceLevel, string> = {
    high: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
    medium: "text-amber-400 bg-amber-400/10 border-amber-400/30",
    low: "text-red-400 bg-red-400/10 border-red-400/30",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${cls[level]}`}
    >
      {level.charAt(0).toUpperCase() + level.slice(1)} Conf.
    </span>
  );
};

const MetaRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start justify-between gap-4 py-2 border-b border-border/20 last:border-0">
    <span className="text-xs text-foreground/50 uppercase tracking-wider font-bold whitespace-nowrap">
      {label}
    </span>
    <span className="text-xs text-foreground/80 text-right">{value}</span>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const STEMReasoning = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isLight = theme === "light";

  const [stage, setStage] = useState<Stage>(1);
  const [katexLoaded, setKatexLoaded] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [annotations, setAnnotations] =
    useState<StepAnnotation[]>(DEFAULT_ANNOTATIONS);
  const [aiVerifying, setAiVerifying] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiDone, setAiDone] = useState(false);
  const [qaDecisions, setQaDecisions] = useState<QADecision[]>(DEFAULT_QA);
  const [qaScore, setQaScore] = useState(5);
  const [qaNote, setQaNote] = useState("");
  const [exportTab, setExportTab] = useState<"json" | "csv">("json");

  // Load KaTeX from CDN once
  useEffect(() => {
    if ((window as any).katex) {
      setKatexLoaded(true);
      return;
    }
    const existingCss = document.getElementById("katex-css-stem");
    if (!existingCss) {
      const link = document.createElement("link");
      link.id = "katex-css-stem";
      link.rel = "stylesheet";
      link.href =
        "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";
      document.head.appendChild(link);
    }
    const existingJs = document.getElementById("katex-js-stem");
    if (existingJs) {
      setKatexLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.id = "katex-js-stem";
    script.src =
      "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js";
    script.async = true;
    script.onload = () => setKatexLoaded(true);
    document.head.appendChild(script);
  }, []);

  const reset = useCallback(() => {
    setStage(1);
    setCurrentStep(0);
    setAnnotations(DEFAULT_ANNOTATIONS);
    setAiVerifying(false);
    setAiProgress(0);
    setAiDone(false);
    setQaDecisions(DEFAULT_QA);
    setQaScore(5);
    setQaNote("");
    setExportTab("json");
  }, []);

  const startAiVerification = useCallback(() => {
    setStage(4);
    setAiVerifying(true);
    setAiProgress(0);
    setAiDone(false);
    const interval = setInterval(() => {
      setAiProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setAiVerifying(false);
          setAiDone(true);
          return 100;
        }
        return p + 2.5;
      });
    }, 50);
  }, []);

  const updateAnnotation = (
    stepId: number,
    field: keyof StepAnnotation,
    value: unknown
  ) => {
    setAnnotations((prev) =>
      prev.map((a) =>
        a.stepId === stepId
          ? {
              ...a,
              [field]: value,
              ...(field === "correctness" && value === "correct"
                ? { errorType: null }
                : {}),
            }
          : a
      )
    );
  };

  const updateQA = (
    stepId: number,
    field: keyof QADecision,
    value: unknown
  ) => {
    setQaDecisions((prev) =>
      prev.map((q) => (q.stepId === stepId ? { ...q, [field]: value } : q))
    );
  };

  // ── Stage 1: Problem Presentation ─────────────────────────────────────────

  const renderStage1 = () => (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="text-center">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-4"
          style={{
            background: ACCENT_BG,
            color: ACCENT_LIGHT,
            border: `1px solid ${ACCENT}50`,
          }}
        >
          ∫ calc_prod_rule_001 · Calculus I · Chain-of-Thought Verification
        </div>
        <h2 className="text-2xl font-black text-foreground mb-1">
          Problem Presentation
        </h2>
        <p className="text-sm text-foreground/50">
          Review the calculus problem before beginning chain-of-thought
          verification.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Problem card */}
        <div className="lg:col-span-2 rounded-xl border border-border/20 bg-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-bold px-2 py-0.5 rounded"
              style={{ background: ACCENT_BG, color: ACCENT_LIGHT }}
            >
              MODEL OUTPUT
            </span>
            <span className="text-xs text-foreground/40">
              Unverified · Awaiting STEM Expert Review
            </span>
          </div>

          <div className="rounded-lg bg-background border border-border/20 p-6">
            <div className="text-xs text-foreground/40 uppercase tracking-widest mb-4 font-bold text-center">
              Problem Statement
            </div>
            <div className="text-xl min-h-[3rem] flex items-center justify-center">
              <MathBlock
                tex="f(x) = x^2 \ln(x) \qquad \text{Find } f'(x)"
                display
                katexLoaded={katexLoaded}
              />
            </div>
          </div>

          <div className="rounded-lg bg-amber-400/5 border border-amber-400/20 p-3 flex items-start gap-2">
            <AlertTriangle
              size={14}
              className="text-amber-400 mt-0.5 flex-shrink-0"
            />
            <p className="text-xs text-amber-400/80 leading-relaxed">
              This solution was generated by an AI model and has not been
              verified. A STEM subject-matter expert must validate each
              reasoning step before this data enters any training pipeline.
            </p>
          </div>
        </div>

        {/* Metadata panel */}
        <div className="rounded-xl border border-border/20 bg-card p-5">
          <div className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-3">
            Task Metadata
          </div>
          <MetaRow label="Problem ID" value="calc_prod_rule_001" />
          <MetaRow label="Domain" value="STEM / Calculus" />
          <MetaRow label="Subdomain" value="Differential Calculus" />
          <MetaRow label="Difficulty" value="Calculus I — Undergraduate" />
          <MetaRow label="Task Type" value="Reasoning Verification · RLHF" />
          <MetaRow label="Skill Focus" value="Product Rule · Power Rule" />
          <MetaRow label="Modality" value="Text / LaTeX" />
          <MetaRow
            label="Annotator Role"
            value="STEM Subject-Matter Expert"
          />
          <MetaRow
            label="AI Lifecycle Stage"
            value="Model Evaluation · Post-Training QA"
          />
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={() => setStage(2)}
          className="flex items-center gap-2 px-7 py-3 rounded-full text-sm font-bold text-white shadow-lg transition hover:opacity-90"
          style={{ background: ACCENT }}
        >
          Review Model Solution <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );

  // ── Stage 2: Model Solution ────────────────────────────────────────────────

  const renderStage2 = () => (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="text-center">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-4"
          style={{
            background: ACCENT_BG,
            color: ACCENT_LIGHT,
            border: `1px solid ${ACCENT}50`,
          }}
        >
          <Brain size={12} /> Model-Generated Chain-of-Thought · Unverified
        </div>
        <h2 className="text-2xl font-black text-foreground mb-1">
          AI-Generated Solution
        </h2>
        <p className="text-sm text-foreground/50">
          4-step reasoning chain. Each step must be individually verified by a
          STEM expert.
        </p>
      </div>

      {/* Problem reminder */}
      <div className="rounded-xl border border-border/20 bg-card px-5 py-3 flex items-center gap-3">
        <span className="text-xs text-foreground/40 font-bold flex-shrink-0">
          Problem:
        </span>
        <MathBlock
          tex="f(x) = x^2 \ln(x) \quad \text{Find } f'(x)"
          katexLoaded={katexLoaded}
        />
      </div>

      <div className="space-y-4">
        {STEPS.map((step) => (
          <div
            key={step.id}
            className="rounded-xl border border-border/20 bg-card p-5"
          >
            <div className="flex items-start gap-4">
              <div
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-white"
                style={{ background: ACCENT }}
              >
                {step.id}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="text-sm font-bold text-foreground">
                    {step.title}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 font-bold">
                    MODEL GENERATED · UNVERIFIED
                  </span>
                </div>
                <div className="rounded-lg bg-background border border-border/20 p-4 overflow-x-auto mb-3">
                  <MathBlock
                    tex={step.latex}
                    display
                    katexLoaded={katexLoaded}
                  />
                </div>
                <p className="text-xs text-foreground/55 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center">
        <button
          onClick={() => {
            setStage(3);
            setCurrentStep(0);
          }}
          className="flex items-center gap-2 px-7 py-3 rounded-full text-sm font-bold text-white shadow-lg transition hover:opacity-90"
          style={{ background: ACCENT }}
        >
          <User size={15} /> Begin Expert Annotation
        </button>
      </div>
    </div>
  );

  // ── Stage 3: Human Annotation ──────────────────────────────────────────────

  const renderStage3 = () => {
    const ann = annotations[currentStep];
    const step = STEPS[currentStep];

    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-5">
        <div className="text-center">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-4"
            style={{
              background: "rgba(34,197,94,0.12)",
              color: "#22c55e",
              border: "1px solid rgba(34,197,94,0.3)",
            }}
          >
            <User size={12} /> STEM Expert Annotation · Step {currentStep + 1}{" "}
            of {STEPS.length}
          </div>
          <h2 className="text-2xl font-black text-foreground mb-1">
            Human Annotation
          </h2>
          <p className="text-sm text-foreground/50">
            Label each step for correctness, error type, and confidence level.
          </p>
        </div>

        {/* Step navigator */}
        <div className="flex gap-2 justify-center">
          {STEPS.map((s, i) => {
            const isActive = i === currentStep;
            const isDone = annotations[i].note !== undefined;
            return (
              <button
                key={s.id}
                onClick={() => setCurrentStep(i)}
                className="w-9 h-9 rounded-full text-xs font-black border transition-all"
                style={
                  isActive
                    ? { background: ACCENT, borderColor: ACCENT, color: "#fff" }
                    : {
                        borderColor: "rgba(var(--border),0.3)",
                        color: "rgba(var(--foreground),0.5)",
                      }
                }
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Step content */}
          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-xl border border-border/20 bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                  style={{ background: ACCENT }}
                >
                  {step.id}
                </div>
                <span className="font-bold text-sm text-foreground">
                  {step.title}
                </span>
              </div>
              <div className="rounded-lg bg-background border border-border/20 p-4 overflow-x-auto mb-3">
                <MathBlock
                  tex={step.latex}
                  display
                  katexLoaded={katexLoaded}
                />
              </div>
              <p className="text-xs text-foreground/55 leading-relaxed">
                {step.description}
              </p>
            </div>

            {/* Annotation summary for already-labeled steps */}
            <div className="rounded-xl border border-border/20 bg-card p-4">
              <div className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-3">
                All Steps Status
              </div>
              {STEPS.map((s, i) => {
                const a = annotations[i];
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 py-1.5 border-b border-border/10 last:border-0"
                  >
                    <span className="text-xs text-foreground/40 w-4 font-bold">
                      {s.id}
                    </span>
                    <span className="text-xs text-foreground/70 flex-1 truncate">
                      {s.title}
                    </span>
                    <CorrectnessChip label={a.correctness} />
                    <ConfidenceChip level={a.confidence} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Annotation form */}
          <div className="lg:col-span-2 rounded-xl border border-border/20 bg-card p-5 space-y-5">
            <div className="text-xs font-bold text-foreground/40 uppercase tracking-widest">
              Annotation Panel
            </div>

            {/* Correctness */}
            <div>
              <div className="text-xs font-bold text-foreground mb-2">
                Correctness Label{" "}
                <span className="text-red-400 font-normal">*</span>
              </div>
              <div className="space-y-2">
                {(
                  [
                    "correct",
                    "partially_correct",
                    "incorrect",
                  ] as CorrectnessLabel[]
                ).map((lbl) => {
                  const cfg: Record<
                    CorrectnessLabel,
                    { active: string; text: string }
                  > = {
                    correct: {
                      active: "border-emerald-400/60 text-emerald-400 bg-emerald-400/8",
                      text: "Correct",
                    },
                    partially_correct: {
                      active: "border-amber-400/60 text-amber-400 bg-amber-400/8",
                      text: "Partially Correct",
                    },
                    incorrect: {
                      active: "border-red-400/60 text-red-400 bg-red-400/8",
                      text: "Incorrect",
                    },
                  };
                  const isSelected = ann.correctness === lbl;
                  return (
                    <label
                      key={lbl}
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? cfg[lbl].active
                          : "border-border/20 text-foreground/60 hover:border-border/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`correctness-${currentStep}`}
                        value={lbl}
                        checked={isSelected}
                        onChange={() =>
                          updateAnnotation(step.id, "correctness", lbl)
                        }
                        className="sr-only"
                      />
                      <div
                        className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isSelected ? "border-current" : "border-foreground/30"
                        }`}
                      >
                        {isSelected && (
                          <div className="w-1.5 h-1.5 rounded-full bg-current" />
                        )}
                      </div>
                      <span className="text-xs font-bold">{cfg[lbl].text}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Error type (conditional) */}
            {ann.correctness !== "correct" && (
              <div>
                <div className="text-xs font-bold text-foreground mb-2">
                  Error Type{" "}
                  <span className="text-red-400 font-normal">*</span>
                </div>
                <select
                  value={ann.errorType ?? ""}
                  onChange={(e) =>
                    updateAnnotation(
                      step.id,
                      "errorType",
                      e.target.value as ErrorType
                    )
                  }
                  className="w-full text-xs rounded-lg border border-border/30 bg-background text-foreground px-3 py-2 focus:outline-none focus:border-violet-500"
                >
                  <option value="" disabled>
                    Select error type…
                  </option>
                  <option value="conceptual_error">Conceptual Error</option>
                  <option value="algebraic_error">Algebraic Error</option>
                  <option value="calculus_misapplication">
                    Calculus Rule Misapplication
                  </option>
                  <option value="missing_justification">
                    Missing Justification
                  </option>
                </select>
              </div>
            )}

            {/* Confidence */}
            <div>
              <div className="text-xs font-bold text-foreground mb-2">
                Annotator Confidence{" "}
                <span className="text-red-400 font-normal">*</span>
              </div>
              <div className="flex gap-2">
                {(["high", "medium", "low"] as ConfidenceLevel[]).map((lvl) => {
                  const cls: Record<ConfidenceLevel, string> = {
                    high: "text-emerald-400 border-emerald-400/40 bg-emerald-400/8",
                    medium: "text-amber-400 border-amber-400/40 bg-amber-400/8",
                    low: "text-red-400 border-red-400/40 bg-red-400/8",
                  };
                  const isSelected = ann.confidence === lvl;
                  return (
                    <button
                      key={lvl}
                      onClick={() =>
                        updateAnnotation(step.id, "confidence", lvl)
                      }
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                        isSelected
                          ? cls[lvl]
                          : "border-border/20 text-foreground/50 hover:border-border/40"
                      }`}
                    >
                      {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div>
              <div className="text-xs font-bold text-foreground mb-2">
                Annotator Note{" "}
                <span className="text-foreground/30 font-normal">
                  (optional)
                </span>
              </div>
              <textarea
                value={ann.note}
                onChange={(e) =>
                  updateAnnotation(step.id, "note", e.target.value)
                }
                placeholder="e.g. Step is mathematically correct, notation is clear and unambiguous…"
                rows={3}
                className="w-full text-xs rounded-lg border border-border/30 bg-background text-foreground px-3 py-2 resize-none focus:outline-none focus:border-violet-500 placeholder:text-foreground/30"
              />
            </div>

            {/* Navigation */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setCurrentStep((p) => Math.max(0, p - 1))}
                disabled={currentStep === 0}
                className="flex-1 py-2.5 rounded-lg border border-border/20 text-xs font-bold text-foreground/60 hover:text-foreground disabled:opacity-30 transition flex items-center justify-center gap-1"
              >
                <ChevronLeft size={13} /> Prev
              </button>
              {currentStep < STEPS.length - 1 ? (
                <button
                  onClick={() => setCurrentStep((p) => p + 1)}
                  className="flex-1 py-2.5 rounded-lg text-xs font-bold text-white transition flex items-center justify-center gap-1 hover:opacity-90"
                  style={{ background: ACCENT }}
                >
                  Next <ChevronRight size={13} />
                </button>
              ) : (
                <button
                  onClick={startAiVerification}
                  className="flex-1 py-2.5 rounded-lg text-xs font-bold text-white transition flex items-center justify-center gap-1 hover:opacity-90"
                  style={{ background: "rgba(34,197,94,0.85)" }}
                >
                  <Brain size={13} /> Submit to AI
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Stage 4: AI Verification ───────────────────────────────────────────────

  const renderStage4 = () => (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="text-center">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-4"
          style={{
            background: "rgba(59,130,246,0.12)",
            color: "#60a5fa",
            border: "1px solid rgba(59,130,246,0.3)",
          }}
        >
          <Brain size={12} /> AI Verification Agent ·{" "}
          {aiVerifying ? "Running…" : "Complete"}
        </div>
        <h2 className="text-2xl font-black text-foreground mb-1">
          AI Verification Pass
        </h2>
        <p className="text-sm text-foreground/50">
          Automated review of each step against mathematical ground truth and
          human annotations.
        </p>
      </div>

      {/* Loading state */}
      {aiVerifying && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-8 text-center space-y-5">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
          </div>
          <div>
            <div className="text-sm font-bold text-blue-400 mb-1">
              Verification Agent Running
            </div>
            <div className="text-xs text-foreground/50">
              Reviewing {STEPS.length} reasoning steps against mathematical
              ground truth…
            </div>
          </div>
          <div className="w-full max-w-xs mx-auto bg-border/20 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-100"
              style={{ width: `${aiProgress}%` }}
            />
          </div>
          <div className="text-xs text-blue-400 font-black">
            {Math.round(aiProgress)}%
          </div>
        </div>
      )}

      {/* Results */}
      {aiDone && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-center gap-2">
            <CheckCircle size={15} className="text-emerald-400 flex-shrink-0" />
            <span className="text-xs text-emerald-400 font-bold">
              AI verification complete — {STEPS.length} steps reviewed. Results
              below are visually distinct from human annotations.
            </span>
          </div>

          {STEPS.map((step, idx) => {
            const ai = AI_VERIFICATIONS[idx];
            const human = annotations[idx];
            const agree = ai.verdict === "agree";
            return (
              <div
                key={step.id}
                className="rounded-xl border border-border/20 bg-card p-5"
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white"
                    style={{ background: ACCENT }}
                  >
                    {step.id}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                      <span className="font-bold text-sm text-foreground">
                        {step.title}
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-foreground/40">
                          Human:
                        </span>
                        <CorrectnessChip label={human.correctness} />
                        <span className="text-xs text-foreground/40">AI:</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border font-bold ${
                            agree
                              ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/30"
                              : "text-amber-400 bg-amber-400/10 border-amber-400/30"
                          }`}
                        >
                          {agree ? "✓ AGREE" : "⚠ DISAGREE"}
                        </span>
                        <span className="text-xs text-foreground/50">
                          Conf:{" "}
                          <strong className="text-foreground">
                            {(ai.confidence * 100).toFixed(0)}%
                          </strong>
                        </span>
                      </div>
                    </div>

                    {/* AI justification box — visually distinct (blue tint) */}
                    <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Brain size={11} className="text-blue-400" />
                        <span className="text-xs text-blue-400 font-bold">
                          AI Justification
                        </span>
                      </div>
                      <p className="text-xs text-foreground/70 leading-relaxed">
                        {ai.justification}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="flex justify-center">
            <button
              onClick={() => setStage(5)}
              className="flex items-center gap-2 px-7 py-3 rounded-full text-sm font-bold text-white shadow-lg transition hover:opacity-90"
              style={{ background: ACCENT }}
            >
              <Shield size={15} /> Forward to QA Review
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ── Stage 5: QA Adjudication ───────────────────────────────────────────────

  const renderStage5 = () => (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="text-center">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-4"
          style={{
            background: "rgba(168,85,247,0.12)",
            color: "#c084fc",
            border: "1px solid rgba(168,85,247,0.3)",
          }}
        >
          <Shield size={12} /> QA Reviewer · Adjudication
        </div>
        <h2 className="text-2xl font-black text-foreground mb-1">
          QA Review & Adjudication
        </h2>
        <p className="text-sm text-foreground/50">
          Accept human verdict, accept AI correction, or override both. Assign
          final labels and overall quality score.
        </p>
      </div>

      <div className="space-y-3">
        {STEPS.map((step, idx) => {
          const human = annotations[idx];
          const ai = AI_VERIFICATIONS[idx];
          const qa = qaDecisions[idx];
          return (
            <div
              key={step.id}
              className="rounded-xl border border-border/20 bg-card p-5"
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                  style={{ background: ACCENT }}
                >
                  {step.id}
                </div>
                <span className="font-bold text-sm text-foreground">
                  {step.title}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Human verdict */}
                <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3 space-y-1.5">
                  <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <User size={10} /> Human
                  </div>
                  <CorrectnessChip label={human.correctness} />
                  <ConfidenceChip level={human.confidence} />
                  {human.note && (
                    <p className="text-xs text-foreground/50 italic leading-snug">
                      "{human.note}"
                    </p>
                  )}
                </div>

                {/* AI verdict */}
                <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3 space-y-1.5">
                  <div className="text-xs font-bold text-blue-400 flex items-center gap-1">
                    <Brain size={10} /> AI Verification
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border font-bold inline-flex ${
                      ai.verdict === "agree"
                        ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/30"
                        : "text-amber-400 bg-amber-400/10 border-amber-400/30"
                    }`}
                  >
                    {ai.verdict === "agree" ? "✓ Agree" : "⚠ Disagree"}
                  </span>
                  <div className="text-xs text-foreground/50">
                    {(ai.confidence * 100).toFixed(0)}% confidence
                  </div>
                </div>

                {/* QA decision */}
                <div className="rounded-lg bg-purple-500/5 border border-purple-500/20 p-3 space-y-2">
                  <div className="text-xs font-bold text-purple-400 flex items-center gap-1">
                    <Shield size={10} /> QA Final
                  </div>
                  <select
                    value={qa.finalLabel}
                    onChange={(e) =>
                      updateQA(
                        step.id,
                        "finalLabel",
                        e.target.value as CorrectnessLabel
                      )
                    }
                    className="w-full text-xs rounded border border-border/30 bg-background text-foreground px-2 py-1 focus:outline-none focus:border-violet-500"
                  >
                    <option value="correct">Correct</option>
                    <option value="partially_correct">Partially Correct</option>
                    <option value="incorrect">Incorrect</option>
                  </select>
                  <select
                    value={qa.source}
                    onChange={(e) =>
                      updateQA(
                        step.id,
                        "source",
                        e.target.value as QADecision["source"]
                      )
                    }
                    className="w-full text-xs rounded border border-border/30 bg-background text-foreground px-2 py-1 focus:outline-none focus:border-violet-500"
                  >
                    <option value="human">Accept Human</option>
                    <option value="ai">Accept AI</option>
                    <option value="manual">Manual Override</option>
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall quality score */}
      <div className="rounded-xl border border-border/20 bg-card p-5 space-y-4">
        <div className="text-sm font-bold text-foreground">
          Overall Solution Quality Score
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setQaScore(n)}
                className="w-9 h-9 rounded-lg border text-sm font-black transition-all hover:opacity-90"
                style={
                  n <= qaScore
                    ? { background: ACCENT, borderColor: ACCENT, color: "#fff" }
                    : { borderColor: "rgba(var(--border),0.3)", color: "rgba(var(--foreground),0.3)" }
                }
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex items-baseline gap-1">
            <span
              className="text-3xl font-black"
              style={{ color: ACCENT_LIGHT }}
            >
              {qaScore}.0
            </span>
            <span className="text-xs text-foreground/40">/ 5.0</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={18}
                style={{ color: ACCENT_LIGHT }}
                fill={i < qaScore ? ACCENT_LIGHT : "transparent"}
                className={i < qaScore ? "" : "opacity-20"}
              />
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-bold text-foreground mb-1">
            QA Notes{" "}
            <span className="text-foreground/30 font-normal">(optional)</span>
          </div>
          <textarea
            value={qaNote}
            onChange={(e) => setQaNote(e.target.value)}
            placeholder="Overall assessment of the solution chain…"
            rows={2}
            className="w-full text-xs rounded-lg border border-border/30 bg-background text-foreground px-3 py-2 resize-none focus:outline-none focus:border-violet-500 placeholder:text-foreground/30"
          />
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={() => setStage(6)}
          className="flex items-center gap-2 px-7 py-3 rounded-full text-sm font-bold text-white shadow-lg transition hover:opacity-90"
          style={{ background: ACCENT }}
        >
          <Award size={15} /> Finalize & Generate Report
        </button>
      </div>
    </div>
  );

  // ── Stage 6: Final Verdict ─────────────────────────────────────────────────

  const renderStage6 = () => {
    const correctCount = qaDecisions.filter(
      (q) => q.finalLabel === "correct"
    ).length;
    const pctCorrect = (correctCount / STEPS.length) * 100;
    const disagreements = AI_VERIFICATIONS.filter(
      (ai) => ai.verdict === "disagree"
    ).length;
    const avgConf =
      AI_VERIFICATIONS.reduce((s, a) => s + a.confidence, 0) /
      AI_VERIFICATIONS.length;

    const status: "approved_for_training" | "partial_needs_correction" | "rejected" =
      pctCorrect === 100
        ? "approved_for_training"
        : pctCorrect >= 50
        ? "partial_needs_correction"
        : "rejected";

    const statusConfig = {
      approved_for_training: {
        label: "Approved for Training",
        cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
        icon: <CheckCircle size={22} className="text-emerald-400 flex-shrink-0" />,
      },
      partial_needs_correction: {
        label: "Partial — Needs Correction",
        cls: "text-amber-400 bg-amber-400/10 border-amber-400/30",
        icon: <AlertCircle size={22} className="text-amber-400 flex-shrink-0" />,
      },
      rejected: {
        label: "Rejected",
        cls: "text-red-400 bg-red-400/10 border-red-400/30",
        icon: <XCircle size={22} className="text-red-400 flex-shrink-0" />,
      },
    };
    const sc = statusConfig[status];

    const exportJson = {
      problem_id: "calc_prod_rule_001",
      domain: "STEM_Calculus",
      problem_latex: "f(x) = x^2 \\ln(x) \\quad \\text{Find } f'(x)",
      annotator_id: "SME-0042",
      steps: STEPS.map((s, i) => ({
        step_id: s.id,
        title: s.title,
        latex: s.latex,
        human_label: annotations[i].correctness,
        human_confidence: annotations[i].confidence,
        human_note: annotations[i].note || null,
        ai_verification: AI_VERIFICATIONS[i].verdict,
        ai_confidence: AI_VERIFICATIONS[i].confidence,
        qa_final_label: qaDecisions[i].finalLabel,
        qa_source: qaDecisions[i].source,
        confidence: AI_VERIFICATIONS[i].confidence,
      })),
      overall_score: qaScore,
      qa_note: qaNote || null,
      review_status: status,
      pct_correct: pctCorrect,
      human_ai_disagreements: disagreements,
      avg_confidence: parseFloat(avgConf.toFixed(3)),
      timestamp: new Date().toISOString().split("T")[0],
    };

    const csvHeader = [
      "step_id",
      "title",
      "human_label",
      "human_confidence",
      "ai_verdict",
      "ai_confidence",
      "qa_final_label",
      "qa_source",
    ].join(",");
    const csvRows = STEPS.map((s, i) =>
      [
        s.id,
        `"${s.title}"`,
        annotations[i].correctness,
        annotations[i].confidence,
        AI_VERIFICATIONS[i].verdict,
        AI_VERIFICATIONS[i].confidence,
        qaDecisions[i].finalLabel,
        qaDecisions[i].source,
      ].join(",")
    ).join("\n");
    const csvOutput = [csvHeader, csvRows].join("\n");

    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-4"
            style={{
              background: "rgba(34,197,94,0.12)",
              color: "#22c55e",
              border: "1px solid rgba(34,197,94,0.3)",
            }}
          >
            <Award size={12} /> Final Verdict · Client-Ready
          </div>
          <h2 className="text-2xl font-black text-foreground mb-1">
            Final Verdict & Data Delivery
          </h2>
          <p className="text-sm text-foreground/50">
            Verified annotation data ready for model training and evaluation
            pipelines.
          </p>
        </div>

        {/* Status banner */}
        <div
          className={`rounded-xl border p-5 flex items-center gap-4 ${sc.cls}`}
        >
          {sc.icon}
          <div className="flex-1 min-w-0">
            <div className="font-black text-lg">{sc.label}</div>
            <div className="text-xs opacity-70 leading-relaxed">
              Reviewed by STEM subject-matter expert + AI verification agent + QA
              adjudication pipeline.
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-3xl font-black">{qaScore}.0 / 5</div>
            <div className="text-xs opacity-70">Quality Score</div>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Steps Correct",
              value: `${correctCount} / ${STEPS.length}`,
              sub: `${pctCorrect.toFixed(0)}% accuracy`,
              color: "text-emerald-400",
            },
            {
              label: "Human–AI Agreement",
              value: `${STEPS.length - disagreements} / ${STEPS.length}`,
              sub: `${disagreements} disagreement${disagreements !== 1 ? "s" : ""}`,
              color: "text-blue-400",
            },
            {
              label: "Avg AI Confidence",
              value: `${(avgConf * 100).toFixed(1)}%`,
              sub: "across all steps",
              color: "text-violet-400",
            },
            {
              label: "Review Status",
              value:
                status === "approved_for_training" ? "Approved" : "Partial",
              sub: "pipeline decision",
              color: "text-amber-400",
            },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-xl border border-border/20 bg-card p-4 text-center"
            >
              <div className={`text-2xl font-black ${m.color}`}>{m.value}</div>
              <div className="text-xs text-foreground/40 mt-0.5">{m.sub}</div>
              <div className="text-xs font-bold text-foreground/60 mt-1.5">
                {m.label}
              </div>
            </div>
          ))}
        </div>

        {/* Per-step summary */}
        <div className="rounded-xl border border-border/20 bg-card p-5">
          <div className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-4">
            Step-by-Step Summary
          </div>
          <div className="space-y-1">
            {STEPS.map((s, i) => {
              const ai = AI_VERIFICATIONS[i];
              const qa = qaDecisions[i];
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 py-2.5 border-b border-border/10 last:border-0"
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                    style={{ background: ACCENT }}
                  >
                    {s.id}
                  </div>
                  <span className="text-xs font-bold text-foreground flex-1 truncate">
                    {s.title}
                  </span>
                  <CorrectnessChip label={qa.finalLabel} />
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border font-bold ${
                      ai.verdict === "agree"
                        ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/30"
                        : "text-amber-400 bg-amber-400/10 border-amber-400/30"
                    }`}
                  >
                    AI {ai.verdict === "agree" ? "✓" : "⚠"}
                  </span>
                  <span className="text-xs text-foreground/40 w-10 text-right">
                    {(ai.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Export preview */}
        <div className="rounded-xl border border-border/20 bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-bold text-foreground/40 uppercase tracking-widest">
              Client Data Export Preview
            </div>
            <div className="flex gap-1">
              {(["json", "csv"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setExportTab(tab)}
                  className="px-3 py-1 rounded-md text-xs font-bold transition-all"
                  style={
                    exportTab === tab
                      ? { background: ACCENT, color: "#fff" }
                      : { color: "rgba(var(--foreground),0.5)" }
                  }
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <pre className="text-xs font-mono text-foreground/70 bg-background rounded-lg border border-border/20 p-4 overflow-x-auto max-h-64 overflow-y-auto leading-relaxed whitespace-pre-wrap break-all">
            {exportTab === "json"
              ? JSON.stringify(exportJson, null, 2)
              : csvOutput}
          </pre>
          <div className="flex justify-end mt-3">
            <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-border/30 text-xs font-bold text-foreground/60 hover:text-foreground hover:border-border/60 transition">
              <Download size={13} /> Export to Client
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const stageRenderers: (() => JSX.Element)[] = [
    renderStage1,
    renderStage2,
    renderStage3,
    renderStage4,
    renderStage5,
    renderStage6,
  ];

  const headerBg = isLight
    ? "bg-white border-b border-gray-200"
    : "bg-[hsl(0,0%,5%)] border-b border-border/20";

  return (
    <div className={`min-h-screen flex flex-col ${isLight ? "bg-gray-50" : "bg-background"}`}>
      {/* ── Header ── */}
      <header className={`sticky top-0 z-50 ${headerBg} relative`}>
        <div className="flex items-center justify-between px-4 py-3 h-14">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => navigate("/use-cases")}
              className="p-1.5 rounded-lg hover:bg-muted transition flex-shrink-0"
            >
              <ChevronLeft size={16} className="text-foreground" />
            </button>
            <span
              onClick={() => navigate("/use-cases")}
              className="text-sm font-bold tracking-wide text-foreground cursor-pointer hover:opacity-80 transition shrink-0 font-headline"
            >
              TP.ai <span style={{ color: "#9071f0" }}>Data</span>Studio
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-foreground/40 shrink-0" />
            <span className="text-sm text-foreground/70 truncate">
              STEM Reasoning Validation
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={reset}
              className={`flex items-center gap-1.5 text-sm text-foreground/55 hover:text-foreground/80 px-3 py-1.5 rounded-full border transition ${
                isLight
                  ? "border-black/15 hover:border-black/30"
                  : "border-white/10 hover:border-white/25"
              }`}
            >
              <RefreshCw size={13} /> Reset Demo
            </button>
            <span className="text-sm bg-violet-600/20 text-violet-300 border border-violet-600/30 px-3 py-1 rounded-full font-semibold">
              ∫ STEM · Live Demo
            </span>
          </div>
        </div>

        {/* Stage stepper */}
        <div
          className={`px-4 pb-3 ${
            isLight ? "border-t border-gray-100" : "border-t border-border/10"
          }`}
        >
          <div className="flex items-start gap-0 max-w-5xl mx-auto pt-2">
            {STAGE_LABELS.map((label, i) => {
              const n = (i + 1) as Stage;
              const active = n === stage;
              const done = n < stage;
              return (
                <div key={label} className="flex items-center flex-1 min-w-0">
                  <div className="flex flex-col items-center gap-0.5 min-w-0">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black transition-all flex-shrink-0"
                      style={
                        active
                          ? { background: ACCENT, color: "#fff" }
                          : done
                          ? { background: "#22c55e", color: "#fff" }
                          : {
                              background: "rgba(var(--border),0.3)",
                              color: "rgba(var(--foreground),0.4)",
                            }
                      }
                    >
                      {done ? "✓" : n}
                    </div>
                    <span
                      className={`text-[9px] font-bold whitespace-nowrap ${
                        active
                          ? "text-foreground"
                          : done
                          ? "text-emerald-400"
                          : "text-foreground/30"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                  {i < STAGE_LABELS.length - 1 && (
                    <div
                      className="flex-1 h-px mx-1 mt-[-10px] transition-all"
                      style={{
                        background: done
                          ? "rgba(34,197,94,0.4)"
                          : "rgba(var(--border),0.2)",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 h-[2px] w-full progress-bar-gradient" />
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto">
        {stageRenderers[stage - 1]()}
      </main>
    </div>
  );
};

export default STEMReasoning;

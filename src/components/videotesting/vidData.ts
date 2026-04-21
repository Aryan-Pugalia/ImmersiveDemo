// ─── Task definitions ────────────────────────────────────────────────────────

export interface VideoTask {
  id: string;
  taskNumber: number;
  promptLabel: string;
  prompt: string;
  videoA: string;
  videoB: string;
  modelA: string;
  modelB: string;
  hasAudio: boolean;
  fps: number;
  aiVerdict: {
    winner: "A" | "B" | "TIE";
    confidence: number;
    reasoning: string;
  };
}

const SHARED_PROMPT =
  "A short cinematic street-level video. A cyclist suddenly swerves sideways, cutting in front of a man walking on the sidewalk carrying a leather briefcase. The pedestrian stops abruptly, throws his hands up in frustration, briefly shakes his head, and mutters under his breath. Urban daytime street with light traffic and pedestrians in the background. Natural handheld camera, slight shake, realistic motion blur. Ambient city noise, bicycle chain sound, footsteps, distant traffic. Scene lasts 5–7 seconds.";

export const VIDEO_TASKS: VideoTask[] = [
  {
    id: "vid_chatgpt_vs_runway",
    taskNumber: 1,
    promptLabel: "Street Scene · Video Pair 1",
    prompt: SHARED_PROMPT,
    videoA: "/videos/ab-testing/runway.mp4",
    videoB: "/videos/ab-testing/chatgpt_1.mp4",
    modelA: "Model A",
    modelB: "Model B",
    hasAudio: true,
    fps: 24,
    aiVerdict: {
      winner: "A",
      confidence: 0.71,
      reasoning:
        "Video A produces more realistic lighting continuity and a coherent handheld camera feel. The bicycle chain sound and footstep timing are more authentic, and the briefcase swing respects gravity more naturally. Video B has visible exposure inconsistencies on the cyclist and a slight hand-raise desync. Confidence is moderate — the lip-mutter mismatch is present in both, so flagged for human review.",
    },
  },
];

// ─── Ratings schema ──────────────────────────────────────────────────────────

export type RatingValue = "A" | "TIE" | "B";

export interface VideoRatings {
  realism: RatingValue | null;
  temporal_stability: RatingValue | null;
  prompt_alignment: RatingValue | null;
  audio_sync: RatingValue | null;
  overall: RatingValue | null;
  strength: "SLIGHTLY" | "MUCH" | null;
  confidence: "LOW" | "MEDIUM" | "HIGH" | null;
  rationale: string;
}

export const EMPTY_RATINGS: VideoRatings = {
  realism: null,
  temporal_stability: null,
  prompt_alignment: null,
  audio_sync: null,
  overall: null,
  strength: null,
  confidence: null,
  rationale: "",
};

export type RatingDimKey =
  | "realism"
  | "temporal_stability"
  | "prompt_alignment"
  | "audio_sync"
  | "overall";

export interface RatingDim {
  key: RatingDimKey;
  label: string;
  description: string;
  section: "video" | "audio" | "alignment" | "overall";
}

export const RATING_DIMS: RatingDim[] = [
  {
    key: "realism",
    label: "Realism / Aesthetics",
    description: "Visual fidelity, lighting, cinematic quality",
    section: "video",
  },
  {
    key: "temporal_stability",
    label: "Temporal Stability",
    description: "Flicker, jitter, warping, frame-to-frame consistency",
    section: "video",
  },
  {
    key: "audio_sync",
    label: "Audio Quality & Sync",
    description: "Audio clarity, ambience, A/V sync with events on screen",
    section: "audio",
  },
  {
    key: "prompt_alignment",
    label: "Prompt Alignment",
    description: "How faithfully the video matches the written prompt",
    section: "alignment",
  },
  {
    key: "overall",
    label: "Overall Preference",
    description: "Your final holistic choice between the two videos",
    section: "overall",
  },
];

// ─── QA comparison logic ─────────────────────────────────────────────────────

export type QAStatus =
  | "match"
  | "conflict"
  | "low_ai_conf"
  | "low_annotator_conf"
  | "incomplete";

export interface TaskQAResult {
  task: VideoTask;
  humanRatings: VideoRatings | null;
  aiWinner: "A" | "B" | "TIE";
  aiConfidence: number;
  humanOverall: RatingValue | null;
  status: QAStatus;
  agreementScore: number;
  flagReasons: string[];
}

export function computeQAResults(
  allRatings: Record<string, VideoRatings>
): TaskQAResult[] {
  return VIDEO_TASKS.map((task) => {
    const ratings = allRatings[task.id] ?? null;
    const ai = task.aiVerdict;
    const flagReasons: string[] = [];

    if (!ratings) {
      return {
        task,
        humanRatings: null,
        aiWinner: ai.winner,
        aiConfidence: ai.confidence,
        humanOverall: null,
        status: "incomplete",
        agreementScore: 0,
        flagReasons: ["Task not annotated"],
      };
    }

    const humanOverall = ratings.overall;

    // Agreement score across all rated dimensions
    const DIMS: RatingDimKey[] = [
      "realism",
      "temporal_stability",
      "audio_sync",
      "prompt_alignment",
      "overall",
    ];
    let matching = 0;
    let scored = 0;
    for (const dim of DIMS) {
      const humanVal = ratings[dim];
      if (humanVal !== null) {
        scored++;
        if (ai.winner === "TIE") {
          if (humanVal === "TIE") matching++;
        } else {
          if (humanVal === ai.winner || humanVal === "TIE") matching++;
        }
      }
    }
    const agreementScore = scored > 0 ? matching / scored : 0;

    const hasConflict =
      humanOverall !== null &&
      humanOverall !== "TIE" &&
      ai.winner !== "TIE" &&
      humanOverall !== ai.winner;
    const hasLowAIConf = ai.confidence < 0.75;
    const hasLowAnnotatorConf = ratings.confidence === "LOW";

    // Collect flag reasons (always shown as informational warnings in QA cards)
    if (hasLowAIConf) {
      flagReasons.push(`AI confidence low (${(ai.confidence * 100).toFixed(0)}%)`);
    }
    if (hasLowAnnotatorConf) {
      flagReasons.push("Annotator reported low confidence");
    }
    if (hasConflict) {
      flagReasons.push(
        `Human chose Video ${humanOverall}, AI recommends Video ${ai.winner}`
      );
    }

    // Status priority:
    // 1. Conflict (human disagrees with AI) → always requires QA
    // 2. Low annotator confidence → needs review
    // 3. Low AI confidence alone when human agreed → counts as match with a warning
    // 4. Otherwise → match
    let status: QAStatus = "match";
    if (hasConflict) {
      status = "conflict";
    } else if (hasLowAnnotatorConf) {
      status = "low_annotator_conf";
    } else if (hasLowAIConf && humanOverall === null) {
      // AI uncertain AND human hasn't given an overall verdict yet
      status = "low_ai_conf";
    }

    return {
      task,
      humanRatings: ratings,
      aiWinner: ai.winner,
      aiConfidence: ai.confidence,
      humanOverall,
      status,
      agreementScore,
      flagReasons,
    };
  });
}

// ─── Task definitions ────────────────────────────────────────────────────────

export interface ABTask {
  id: string;
  taskNumber: number;
  promptLabel: string;
  prompt: string;
  imageA: string;
  imageB: string;
  aiVerdict: {
    winner: "A" | "B" | "TIE";
    confidence: number;
    reasoning: string;
  };
}

export const AB_TASKS: ABTask[] = [
  {
    id: "ab_dog",
    taskNumber: 1,
    promptLabel: "Golden Retriever Astronaut",
    prompt:
      "A cinematic portrait of a golden retriever astronaut wearing a NASA space suit, mission patch on arm, floating in front of the Milky Way galaxy, dramatic lighting, award-winning photography, 8K resolution",
    imageA: "/images/ab-testing/dog_1.png",
    imageB: "/images/ab-testing/dog_2.png",
    aiVerdict: {
      winner: "B",
      confidence: 0.82,
      reasoning:
        "Image B demonstrates superior prompt adherence with a more dramatic Milky Way backdrop, accurate NASA mission patch placement, and stronger cinematic depth-of-field typical of award-winning photography.",
    },
  },
  {
    id: "ab_garden",
    taskNumber: 2,
    promptLabel: "Japanese Garden at Dawn",
    prompt:
      "A serene Japanese garden at dawn with a koi pond, cherry blossom petals floating on still water, misty mountains in the background, soft golden light filtering through bamboo, Studio Ghibli inspired, watercolor painting style",
    imageA: "/images/ab-testing/CherryBlossom_1.jpg",
    imageB: "/images/ab-testing/CherryBlossom_2.png",
    aiVerdict: {
      winner: "A",
      confidence: 0.91,
      reasoning:
        "Image A more faithfully captures the soft watercolor painting style and Studio Ghibli aesthetic. The golden dawn light filtering through bamboo and the still water reflections are significantly stronger than Image B.",
    },
  },
  {
    id: "ab_cyberpunk",
    taskNumber: 3,
    promptLabel: "Cyberpunk Tokyo Night",
    prompt:
      "A futuristic cyberpunk Tokyo street at night, neon signs in Japanese and English, flying vehicles leaving light trails, holographic billboards, rain-slicked roads reflecting pink and cyan neon, ultra-detailed, cinematic composition, Blade Runner aesthetic",
    imageA: "/images/ab-testing/Cyberpunk_1.png",
    imageB: "/images/ab-testing/Cyberpunk_2.jpg",
    aiVerdict: {
      winner: "B",
      confidence: 0.64,
      reasoning:
        "Marginal preference for Image B's neon road reflections and light trail density, but both images lack the precise Blade Runner cinematic composition referenced in the prompt. The confidence is low — flagged for human expert review.",
    },
  },
];

// ─── Ratings schema ──────────────────────────────────────────────────────────

export type RatingValue = "A" | "TIE" | "B";

export interface TaskRatings {
  realism: RatingValue | null;
  composition: RatingValue | null;
  artifacts: RatingValue | null;
  prompt_alignment: RatingValue | null;
  overall: RatingValue | null;
  strength: "SLIGHTLY" | "MUCH" | null;
  confidence: "LOW" | "MEDIUM" | "HIGH" | null;
  rationale: string;
}

export const EMPTY_RATINGS: TaskRatings = {
  realism: null,
  composition: null,
  artifacts: null,
  prompt_alignment: null,
  overall: null,
  strength: null,
  confidence: null,
  rationale: "",
};

export type RatingDimKey =
  | "realism"
  | "composition"
  | "artifacts"
  | "prompt_alignment"
  | "overall";

export interface RatingDim {
  key: RatingDimKey;
  label: string;
  description: string;
  section: "quality" | "alignment" | "overall";
}

export const RATING_DIMS: RatingDim[] = [
  {
    key: "realism",
    label: "Realism / Aesthetics",
    description: "Overall visual quality, sharpness, and artistic appeal",
    section: "quality",
  },
  {
    key: "composition",
    label: "Layout / Composition",
    description: "Subject placement, framing, and visual balance",
    section: "quality",
  },
  {
    key: "artifacts",
    label: "Artifacts / Quality",
    description: "Presence of distortions, anatomical errors, or rendering glitches",
    section: "quality",
  },
  {
    key: "prompt_alignment",
    label: "Prompt Alignment",
    description: "How accurately the image follows the written prompt",
    section: "alignment",
  },
  {
    key: "overall",
    label: "Overall Preference",
    description: "Your final holistic choice between the two images",
    section: "overall",
  },
];

// ─── QA comparison logic ─────────────────────────────────────────────────────

export type QAStatus =
  | "match"         // human agrees with AI
  | "conflict"      // human disagrees with AI on overall winner
  | "low_ai_conf"   // AI confidence below threshold
  | "low_annotator_conf" // annotator self-reported LOW confidence
  | "incomplete";   // task not fully rated

export interface TaskQAResult {
  task: ABTask;
  humanRatings: TaskRatings | null;
  aiWinner: "A" | "B" | "TIE";
  aiConfidence: number;
  humanOverall: RatingValue | null;
  status: QAStatus;
  agreementScore: number; // 0–1 (fraction of dims that match AI recommendation)
  flagReasons: string[];
}

export function computeQAResults(
  allRatings: Record<string, TaskRatings>
): TaskQAResult[] {
  return AB_TASKS.map((task) => {
    const ratings = allRatings[task.id] ?? null;
    const ai = task.aiVerdict;
    const flagReasons: string[] = [];

    // Incomplete check
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
      "composition",
      "artifacts",
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
        `Human chose Image ${humanOverall}, AI recommends Image ${ai.winner}`
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

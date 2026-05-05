export interface UseCase {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  idTag: string;
  categoryTag: string;
  secondaryTag: string;
  filters: string[];
  /** Set to true to hide from the card grid without deleting the entry */
  hidden?: boolean;
}

export const FILTERS = [
  "All",
  "Image",
  "Video",
  "Audio",
  "Text / Doc",
  "3D / LiDAR",
] as const;

export type FilterLabel = typeof FILTERS[number];

export const useCases: UseCase[] = [
  {
    id: "1",
    slug: "lidar-annotation",
    title: "LiDAR 3D Annotation",
    description: "Annotate 3D point clouds with bounding boxes for autonomous driving, robotics, and spatial analysis pipelines. Score annotations with Hungarian IoU assignment and composite quality metrics.",
    icon: "view_in_ar",
    idTag: "LID-001",
    categoryTag: "3D / Point Cloud",
    secondaryTag: "Autonomous",
    filters: ["3D / LiDAR"],
  },
  {
    id: "6",
    slug: "medical-annotation",
    title: "Medical Image Annotation",
    description: "Annotate tumors, lesions, and regions of interest on medical scans — X-Ray, MRI, CT — with AI-assisted verification.",
    icon: "radiology",
    idTag: "MED-001",
    categoryTag: "Medical Imaging",
    secondaryTag: "AI-Assisted",
    filters: ["Image"],
  },
  {
    id: "10",
    slug: "audio-annotation",
    title: "Audio Transcription & Translation",
    description: "Transcribe multilingual speech and translate to English — with speaker diarization, segment timing, audio quality flags, and full QC reviewer workflow.",
    icon: "mic",
    idTag: "AUD-401",
    categoryTag: "Speech / NLP",
    secondaryTag: "Multilingual",
    filters: ["Audio"],
  },
  {
    id: "9",
    slug: "video-ab-testing",
    title: "AI Video Comparison & RLHF Optimization",
    description: "Compare AI-generated video pairs with synced playback, frame stepping, and audio solo — flag temporal artifacts and A/V sync issues for preference learning.",
    icon: "movie",
    idTag: "VID-301",
    categoryTag: "RLHF / Video GenAI",
    secondaryTag: "Multimodal",
    filters: ["Video"],
  },
  {
    id: "8",
    slug: "image-ab-testing",
    title: "Generative Image Evaluation & Preference Modeling",
    description: "Evaluate AI-generated image pairs against text prompts — rate realism, composition, and prompt alignment to build RLHF preference datasets.",
    icon: "compare",
    idTag: "IMG-201",
    categoryTag: "RLHF / GenAI",
    secondaryTag: "Preference",
    filters: ["Image"],
  },
  {
    id: "11",
    slug: "dating-trust-safety",
    hidden: true, // re-enable: remove or set to false
    title: "Digital Identity Protection & Policy Enforcement",
    description: "Profile labeling, content monitoring, and redaction of sensitive info + policy violations. Annotate, watch AI review, QA-override, and deliver a clean decision packet.",
    icon: "policy",
    idTag: "T&S-501",
    categoryTag: "Content Moderation",
    secondaryTag: "Impersonation + Redaction",
    filters: ["Image", "Text / Doc"],
  },
  {
    id: "14",
    slug: "intelligent-archives",
    title: "Enterprise Document Intelligence Platform",
    description: "Digitize, structure, and activate enterprise archives using secure scanning, intelligent indexing, and governed retrieval. From physical records to AI-ready enterprise knowledge.",
    icon: "folder_data",
    idTag: "IM-001",
    categoryTag: "Digitization · Search · Enterprise AI",
    secondaryTag: "Governance",
    filters: ["Text / Doc", "Text / Doc"],
  },
  {
    id: "13",
    slug: "video-object-tracking",
    title: "Advanced Multi-Object Tracking & Occlusion Handling",
    description: "Review multi-object video tracking across occlusions and ID switches. Correct partial/full occlusion failures, draw annotations on problem frames, QA the fix, and deliver a clean tracking output.",
    icon: "track_changes",
    idTag: "VID-601",
    categoryTag: "Video Annotation / Object Tracking",
    secondaryTag: "Gaming AI",
    filters: ["Video"],
  },
  {
    id: "15",
    slug: "stem-reasoning",
    title: "STEM Reasoning Validation & Chain-of-Thought Annotation",
    description:
      "Expert annotators review step-by-step LaTeX calculus solutions, validate mathematical reasoning, and score chain-of-thought correctness. AI verification accelerates review, while human QA ensures gold-standard training and evaluation data for STEM-capable models.",
    icon: "calculate",
    idTag: "STEM-001",
    categoryTag: "Reasoning Verification · RLHF",
    secondaryTag: "STEM / Calculus",
    filters: ["Text / Doc"],
  },
  {
    id: "16",
    slug: "physics-reasoning",
    title: "Physics Reasoning Verification & Multistep Solution",
    description:
      "Expert physics annotators review multistep solutions involving equations, physical laws, and unit analysis. AI flags conceptual errors and unit mismatches; human QA delivers gold-standard training data for physics-capable reasoning models.",
    icon: "science",
    idTag: "PHYS-001",
    categoryTag: "Reasoning Verification · RLHF",
    secondaryTag: "STEM / Physics",
    filters: ["Text / Doc"],
  },
  {
    id: "7",
    slug: "invoice-labeler",
    title: "Financial Document Intelligence & Extraction",
    description: "Label and extract structured fields from invoices and receipts — vendor, totals, line items — with bounding-box annotation and JSON export.",
    icon: "receipt_long",
    idTag: "DOC-101",
    categoryTag: "Document AI",
    secondaryTag: "IDP",
    filters: ["Text / Doc", "Image"],
  },
  {
    id: "18",
    slug: "audio-quality-qa",
    title: "Audio Quality & Signal Integrity QA",
    description: "7-dimension audio quality annotation — background noise, signal clarity, clipping, echo, dropouts and more. AI verification, QA adjudication, and structured JSON export for pre-training data pipelines.",
    icon: "graphic_eq",
    idTag: "AUD-402",
    categoryTag: "Audio / Speech",
    secondaryTag: "Pre-Training QA",
    filters: ["Audio"],
  },
  {
    id: "17",
    slug: "driver-monitoring",
    title: "Automotive DMS Video Annotation",
    description: "Review driver-facing IR clips flagged by a Driver Monitoring System. Validate distraction events, label driver gaze and hand position, QA the AI call, and export structured annotation packets for ADAS model training.",
    icon: "directions_car",
    idTag: "DMS-001",
    categoryTag: "Automotive / ADAS",
    secondaryTag: "Video · DMS",
    filters: ["Video"],
  },
  {
    id: "19",
    slug: "speech-emotion-qa",
    title: "Speech Emotion & Tone Reasoning",
    description: "4-stage emotion annotation pipeline — classify primary emotion, tone attributes, intensity, and escalation risk. AI verification with per-dimension confidence scores, human QA adjudication, and structured JSON export for CX intelligence and safety models.",
    icon: "psychology",
    idTag: "AUD-403",
    categoryTag: "Audio / Speech",
    secondaryTag: "Emotion · CX · Safety",
    filters: ["Audio"],
  },
  {
    id: "21",
    slug: "conversational-context-qa",
    title: "Conversational Context Retention",
    description: "Human reviewers assess whether in-vehicle voice assistants preserve conversational context across multiple turns. AI assists verification, while human QA ensures reliable, safe dialogue behavior for infotainment and navigation systems.",
    icon: "forum",
    idTag: "AUD-405",
    categoryTag: "Audio / Automotive",
    secondaryTag: "Context · IVI",
    filters: ["Audio"],
  },
  {
    id: "20",
    slug: "voice-command-intent-qa",
    title: "Voice Command Intent Understanding",
    description: "Human reviewers evaluate whether in-vehicle voice commands are correctly interpreted and fulfilled. AI assists verification, while human QA ensures safe, accurate intent understanding for infotainment and navigation systems.",
    icon: "record_voice_over",
    idTag: "AUD-404",
    categoryTag: "Audio / Automotive",
    secondaryTag: "Intent · Infotainment",
    filters: ["Audio"],
  },
  {
    id: "22",
    slug: "embodied-ai",
    title: "Embodied AI Data Labeling",
    description: "Unified 3-task annotation pipeline for embodied AI: manipulation pick & place, multi-step household tasks, and human presence QA — with AI verification, human adjudication, and structured export.",
    icon: "smart_toy",
    idTag: "EAI-001",
    categoryTag: "Video / Robotics",
    secondaryTag: "Embodied AI · 3 Tasks",
    filters: ["Video"],
  },
];

export function getUseCaseBySlug(slug: string): UseCase | undefined {
  return useCases.find((uc) => uc.slug === slug);
}

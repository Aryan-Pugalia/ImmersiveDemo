export interface UseCase {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  idTag: string;
  categoryTag: string;
  secondaryTag: string;
}

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
  },
  {
    id: "12",
    slug: "cheating-or-skill",
    title: "Cheating or Skill Review",
    description: "Label gameplay clips as skill or cheating, watch AI flag anomalies, then QA-override the call. Human-in-the-loop Gaming Trust & Safety at scale.",
    icon: "sports_esports",
    idTag: "GAM-118",
    categoryTag: "Gaming / T&S",
    secondaryTag: "GenAI + Human QA",
  },
  {
    id: "11",
    slug: "dating-trust-safety",
    title: "Digital Identity Protection & Policy Enforcement",
    description: "Profile labeling, content monitoring, and redaction of sensitive info + policy violations. Annotate, watch AI review, QA-override, and deliver a clean decision packet.",
    icon: "policy",
    idTag: "T&S-501",
    categoryTag: "Content Moderation",
    secondaryTag: "Impersonation + Redaction",
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
  },
  {
    id: "16",
    slug: "physics-reasoning",
    title: "Physics Reasoning Verification & Multistep Solution QA",
    description:
      "Expert physics annotators review multistep solutions involving equations, physical laws, and unit analysis. AI flags conceptual errors and unit mismatches; human QA delivers gold-standard training data for physics-capable reasoning models.",
    icon: "science",
    idTag: "PHYS-001",
    categoryTag: "Reasoning Verification · RLHF",
    secondaryTag: "STEM / Physics",
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
  },
];

export function getUseCaseBySlug(slug: string): UseCase | undefined {
  return useCases.find((uc) => uc.slug === slug);
}

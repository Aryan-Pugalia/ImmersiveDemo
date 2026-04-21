export const en = {
  // ── Nav / common ──────────────────────────────────────────────────────────
  nav: {
    dashboard: "Dashboard",
    back: "Back",
    newImage: "New Image",
    qaReport: "QA Report",
  },

  // ── Landing (Index) ───────────────────────────────────────────────────────
  landing: {
    introducing: "Introducing",
    cta: "Let's Go",
    capabilitiesLabel: "Capabilities",
    capabilitiesHeading: "Everything You Need To Train Frontier Models",
  },

  // ── Use-cases page ────────────────────────────────────────────────────────
  useCasesPage: {
    heading: "Select Your Pipeline",
    role: "Role",
    roleValue: "Data Annotator",
  },

  // ── Use-case cards (keyed by slug) ────────────────────────────────────────
  useCases: {
    "lidar-annotation": {
      title: "LiDAR 3D Annotation",
      description: "Annotate 3D point clouds with bounding boxes for autonomous driving, robotics, and spatial analysis pipelines.",
    },
    "medical-annotation": {
      title: "Medical Image Annotation",
      description: "Annotate tumors, lesions, and regions of interest on medical scans — X-Ray, MRI, CT — with AI-assisted verification.",
    },
    "invoice-labeler": {
      title: "Invoice Labeler",
      description: "Label and extract structured fields from invoices and receipts — vendor, totals, line items — with bounding-box annotation and JSON export.",
    },
    "image-ab-testing": {
      title: "Image A/B Testing",
      description: "Evaluate AI-generated image pairs against text prompts — rate realism, composition, and prompt alignment to build RLHF preference datasets.",
    },
    "video-ab-testing": {
      title: "Video A/B Testing",
      description: "Compare AI-generated video pairs with synced playback, frame stepping, and audio solo — flag temporal artifacts and A/V sync issues for preference learning.",
    },
    "audio-annotation": {
      title: "Audio Transcription & Translation",
      description: "Transcribe multilingual speech and translate to English — with speaker diarization, segment timing, audio quality flags, and full QC reviewer workflow.",
    },
  } as Record<string, { title: string; description: string }>,

  // ── Capabilities marquee ──────────────────────────────────────────────────
  capabilities: {
    "Text & NLP":        { title: "Text & NLP",        subs: ["Named Entity Recognition", "Intent Classification", "Summarisation QA", "Coreference Resolution"] },
    "Computer Vision":   { title: "Computer Vision",   subs: ["Object Detection", "Instance Segmentation", "Keypoint Annotation", "Image Classification"] },
    "Video Annotation":  { title: "Video Annotation",  subs: ["Object Tracking", "Action Recognition", "Scene Segmentation", "Event Detection"] },
    "3D Sensor Fusion":  { title: "3D Sensor Fusion",  subs: ["LiDAR Point Clouds", "Radar Fusion", "HD Map Labelling", "Obstacle Classification"] },
    "Audio & Speech":    { title: "Audio & Speech",    subs: ["Speech Transcription", "Speaker Diarisation", "Sound Event Detection", "Emotion Labelling"] },
    "RLHF & Red Teaming":{ title: "RLHF & Red Teaming",subs: ["Preference Ranking", "Constitutional AI Review", "Adversarial Prompting", "Safety Evaluation"] },
  } as Record<string, { title: string; subs: string[] }>,

  // ── Annotation tool common strings ────────────────────────────────────────
  tools: {
    annotate: "Annotate",
    aiVerify: "AI Verify",
    qaReview: "QA Review",
    delivered: "Delivered",
    submit: "Submit",
    export: "Export",
    save: "Save",
    transcript: "Transcript",
    translation: "Translation",
    play: "Play",
    pause: "Pause",
    annotations: "annotation",
    annotations_plural: "annotations",
    uploadPrompt: "Upload a medical scan to annotate tumors and regions of interest, then verify with AI analysis.",
    aiPowered: "AI-Powered Medical Imaging",
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  dashboard: {
    title: "Operations Overview",
    subtitle: "Real-time status across all active annotation projects",
    live: "Live · updated",
    onlineLabel: "online",
    kpi: {
      activeProjects: "Active Projects",
      activeProjectsSub: (done: number, total: number) => `${total} total · ${done} completed`,
      completion: "Overall Completion",
      completionSub: (done: number, total: number) => `${done.toLocaleString()} of ${total.toLocaleString()} tasks done`,
      attention: "Needs Attention",
      attentionSub: "Projects at risk or delayed",
      ready: "Ready for Download",
      readySub: "Datasets awaiting client pickup",
    },
    projectTracker: "Project Tracker",
    liveEvents: "Live Events",
    autoUpdating: "auto-updating",
    filterAll: "All",
    filterReady: "Ready",
    filterFlagged: "Flagged",
    filterCompleted: "Completed",
    liveMap: "Live Annotator Activity",
    annotators: "annotators online",
    hoverHint: "Hover a bubble for details",
    activeAnnotators: "active annotators",
    throughput: "7-day throughput",
    tasksToday: "tasks today",
    footerNote: "All data is simulated for demonstration purposes · TP.ai FABStudio Platform Dashboard",
    status: {
      on_track: "On Track",
      at_risk: "At Risk",
      delayed: "Delayed",
      completed: "Completed",
      // legacy aliases kept for legend dots
      onTrack: "On Track",
      atRisk: "At Risk",
    },
    col: {
      project: "Project / Client",
      language: "Language",
      progress: "Progress",
      status: "Status",
      due: "Due",
      team: "Team",
    },
    thisWeek: "↑ 2 this week",
    prio: { high: "HIGH", med: "MED", low: "LOW" },
    projects: {
      p1: "Multilingual Speech — Batch 7",
      p2: "Autonomous Driving — Q2 Set",
      p3: "Medical Scan Annotation",
      p4: "Invoice Extraction — APAC",
      p5: "RLHF Image Preference",
      p6: "Video Temporal Annotation",
      p7: "Korean CX Transcription",
      p8: "French Legal Document IDP",
    } as Record<string, string>,
    eventPool: [
      { title: "Dataset ready for client download",    detail: "Multilingual Speech Batch 7 — ZH subset (847 segments, 2.3 GB)" },
      { title: "Deadline at risk — immediate attention", detail: "Video Temporal Annotation is 16% complete; due Apr 20" },
      { title: "Dataset ready for client download",    detail: "Invoice APAC — KO subset export available (198 documents)" },
      { title: "QA flag: re-annotation required",      detail: "AutoVision LiDAR frame 0412 — missed occlusion, 3 boxes deleted" },
      { title: "Batch completed — review open",        detail: "Korean CX Transcription — 40 tasks submitted, IAA 88%" },
      { title: "Awaiting senior QA sign-off",          detail: "Medical Scan Annotation — 12 scans queued for final approval" },
      { title: "Dataset ready for client download",    detail: "French Legal IDP — first 67 invoices exported (JSON + SRT)" },
      { title: "Low-confidence segments flagged",      detail: "Hindi Batch hi_02 — 3 segments marked needs-pass-2" },
      { title: "Annotators onboarded",                 detail: "3 new annotators added to RLHF Image Preference (GenAI Studio)" },
      { title: "Quality milestone reached",            detail: "RLHF Image Preference exceeded 85% IAA threshold — ahead of schedule" },
      { title: "Client SLA at risk",                   detail: "AutoVision delivery window closes Apr 23 — 38 tasks remain in queue" },
      { title: "Dataset ready for client download",    detail: "Medical Scan Annotation — all 95 scans annotated, QC passed" },
    ],
  },
} as const;

export type Translations = typeof en;

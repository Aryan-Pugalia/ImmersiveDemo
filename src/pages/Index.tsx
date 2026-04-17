import { useNavigate } from "react-router-dom";

const CAPABILITIES = [
  {
    bullet: "magenta",
    category: "Text & NLP",
    title: "Text & NLP",
    description: "High-throughput annotation pipelines for language models and conversational AI at enterprise scale.",
    subs: ["Named Entity Recognition", "Intent Classification", "Summarisation QA", "Coreference Resolution"],
  },
  {
    bullet: "violet",
    category: "Computer Vision",
    title: "Computer Vision",
    description: "Pixel-perfect labelling for detection, segmentation, and visual understanding tasks.",
    subs: ["Object Detection", "Instance Segmentation", "Keypoint Annotation", "Image Classification"],
  },
  {
    bullet: "magenta",
    category: "Video Annotation",
    title: "Video Annotation",
    description: "Frame-accurate temporal labelling for action recognition and scene understanding.",
    subs: ["Object Tracking", "Action Recognition", "Scene Segmentation", "Event Detection"],
  },
  {
    bullet: "violet",
    category: "3D Sensor Fusion",
    title: "3D Sensor Fusion",
    description: "Multi-modal 3D annotation fusing LiDAR, radar, and camera for autonomous systems.",
    subs: ["LiDAR Point Clouds", "Radar Fusion", "HD Map Labelling", "Obstacle Classification"],
  },
  {
    bullet: "magenta",
    category: "Audio & Speech",
    title: "Audio & Speech",
    description: "Spoken language annotation with speaker attribution and phoneme-level precision.",
    subs: ["Speech Transcription", "Speaker Diarisation", "Sound Event Detection", "Emotion Labelling"],
  },
  {
    bullet: "violet",
    category: "RLHF & Red Teaming",
    title: "RLHF & Red Teaming",
    description: "Expert human feedback and adversarial probing to align and harden frontier models.",
    subs: ["Preference Ranking", "Constitutional AI Review", "Adversarial Prompting", "Safety Evaluation"],
  },
];

const CheckIcon = () => (
  <svg className="capability-check" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Index = () => {
  const navigate = useNavigate();

  return (
    <>
      {/* Single viewport — no scroll on desktop; natural scroll on mobile */}
      <div className="landing-root flex flex-col hero-gradient relative">

        {/* ── Hero ── */}
        <div className="flex-shrink-0 flex flex-col items-center justify-center px-6 pt-10 pb-5 text-center">
          <div className="space-y-3 mb-7">
            <span className="block font-headline text-base md:text-lg font-bold tracking-[0.15em] text-primary">
              TP.ai Data Services
            </span>
            <div className="space-y-1">
              <span className="block font-headline text-xs font-bold tracking-[0.3em] text-muted-foreground/60 uppercase">
                INTRODUCING
              </span>
              <h1 className="font-headline text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                TP.ai FABStudio
              </h1>
            </div>
            <p className="max-w-lg mx-auto text-muted-foreground text-sm md:text-base font-light leading-relaxed font-body pt-1">
              The next generation of industrial-grade data pipelines.
            </p>
          </div>
          <button
            onClick={() => navigate("/use-cases")}
            className="px-14 py-4 bg-primary text-primary-foreground font-bold uppercase tracking-[0.3em] text-xs rounded-sm transition-all duration-300 active:scale-95 hover:bg-primary/90"
          >
            LET'S GO
          </button>
        </div>

        {/* Thin accent divider */}
        <div className="w-16 h-px bg-primary/30 mx-auto flex-shrink-0 mb-1" />

        {/* ── Capabilities — fills remaining height ── */}
        <div className="flex-1 min-h-0 flex flex-col justify-center">
          <section className="capabilities-section">
            <div className="text-center mb-5 px-6">
              <span className="capabilities-label">CAPABILITIES</span>
              <h2 className="capabilities-heading">Everything You Need To Train Frontier Models</h2>
            </div>

            <div className="marquee-outer">
              <div className="marquee-fade-left" aria-hidden="true" />
              <div className="marquee-fade-right" aria-hidden="true" />
              <div className="marquee-track" aria-label="Capabilities showcase">
                {[...CAPABILITIES, ...CAPABILITIES].map((cap, i) => (
                  <article key={i} className="capability-card">
                    <div className="capability-card-header">
                      <div className={`capability-bullet ${cap.bullet === "magenta" ? "bullet-magenta" : "bullet-violet"}`} />
                      <span className="capability-category">{cap.category}</span>
                    </div>
                    <h3 className="capability-title">{cap.title}</h3>
                    <p className="capability-desc">{cap.description}</p>
                    <ul className="capability-subs">
                      {cap.subs.map((sub) => (
                        <li key={sub} className="capability-sub-item">
                          <CheckIcon />
                          {sub}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Background blur decorations */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-[-1] opacity-20">
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent rounded-full blur-[180px]" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[600px] h-[600px] bg-primary rounded-full blur-[180px]" />
      </div>
    </>
  );
};

export default Index;

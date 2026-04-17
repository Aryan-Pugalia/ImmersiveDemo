import { useNavigate } from "react-router-dom";

const CAPABILITIES = [
  {
    bullet: "purple",
    category: "Text & NLP",
    title: "Text & NLP",
    subs: ["Named Entity Recognition", "Intent Classification", "Summarisation QA", "Coreference Resolution"],
  },
  {
    bullet: "violet",
    category: "Computer Vision",
    title: "Computer Vision",
    subs: ["Object Detection", "Instance Segmentation", "Keypoint Annotation", "Image Classification"],
  },
  {
    bullet: "purple",
    category: "Video Annotation",
    title: "Video Annotation",
    subs: ["Object Tracking", "Action Recognition", "Scene Segmentation", "Event Detection"],
  },
  {
    bullet: "violet",
    category: "3D Sensor Fusion",
    title: "3D Sensor Fusion",
    subs: ["LiDAR Point Clouds", "Radar Fusion", "HD Map Labelling", "Obstacle Classification"],
  },
  {
    bullet: "purple",
    category: "Audio & Speech",
    title: "Audio & Speech",
    subs: ["Speech Transcription", "Speaker Diarisation", "Sound Event Detection", "Emotion Labelling"],
  },
  {
    bullet: "violet",
    category: "RLHF & Red Teaming",
    title: "RLHF & Red Teaming",
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
    <div className="page">

      {/* ── Header ── */}
      <header className="site-header">
        <div className="header-inner">
          <img src="/tp-ai-data-services-logo.png" alt="TP.ai Data Services" className="header-wordmark" />
          <img src="/TP-logo.png" alt="TP" className="header-icon" />
        </div>
        <div className="header-divider" />
      </header>

      {/* ── Banner ── */}
      <section className="banner-section" aria-label="Hero">
        <div className="banner-bg" aria-hidden="true" />
        <div className="banner-overlay" aria-hidden="true" />
        <div className="banner-glow" aria-hidden="true" />
        <div className="banner-content">
          <span className="label-service">TP.ai Data Services</span>
          <span className="label-introducing">Introducing</span>
          <h1 className="banner-title">TP.ai <span className="title-fab">FAB</span>Studio</h1>
          <p className="banner-subtitle">The next generation of industrial-grade data pipelines.</p>
        </div>
      </section>

      {/* ── Visual Band ── */}
      <div className="visual-band">
        <div className="circular-wrapper" aria-hidden="true">
          <img src="/circular-image.png" alt="" className="circular-img" />
        </div>
        <div className="cta-overlay">
          <button className="cta-btn" onClick={() => navigate("/use-cases")}>
            Let's Go
          </button>
          <div className="cta-underline" aria-hidden="true" />
        </div>
      </div>

      {/* ── Capabilities ── */}
      <section className="capabilities-section" aria-label="Capabilities">
        <div className="capabilities-header">
          <span className="capabilities-label">Capabilities</span>
          <h2 className="capabilities-heading">Everything You Need To Train Frontier Models</h2>
        </div>

        <div className="marquee-outer">
          <div className="marquee-fade-left" aria-hidden="true" />
          <div className="marquee-fade-right" aria-hidden="true" />
          <div className="marquee-track" aria-label="Capabilities showcase">
            {[...CAPABILITIES, ...CAPABILITIES].map((cap, i) => (
              <article
                key={i}
                className="capability-card"
                aria-hidden={i >= CAPABILITIES.length ? true : undefined}
              >
                <div className="capability-card-header">
                  <div className={`capability-bullet ${cap.bullet === "purple" ? "bullet-purple" : "bullet-violet"}`} />
                  <span className="capability-category">{cap.category}</span>
                </div>
                <h3 className="capability-title">{cap.title}</h3>
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
  );
};

export default Index;

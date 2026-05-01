import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/context/LanguageContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguagePicker } from "@/components/LanguagePicker";

const CAP_KEYS = [
  "Text & NLP",
  "Computer Vision",
  "Video Annotation",
  "3D Sensor Fusion",
  "Audio & Speech",
  "RLHF & Red Teaming",
] as const;

const CheckIcon = () => (
  <svg className="capability-check" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BULLET_COLORS = ["purple", "violet", "purple", "violet", "purple", "violet"] as const;

const Index = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="page">

      {/* ── Header ── */}
      <header className="site-header dark-surface">
        <div className="header-inner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <img src="/tp-ai-data-services-logo.png" alt="TP.ai Data Services" className="header-wordmark" />
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <LanguagePicker variant="pill" />
            <ThemeToggle />
          </div>
        </div>
        <div className="header-divider" />
      </header>

      {/* ── Banner ── */}
      <section className="banner-section" aria-label="Hero">
        <div className="banner-bg" aria-hidden="true" />
        <div className="banner-overlay" aria-hidden="true" />
        <div className="banner-glow" aria-hidden="true" />
        <div className="banner-content">
          <img src="/tp-ai-data-services-logo.png" alt="TP.ai Data Services" className="label-service-logo" />
          <span className="label-introducing">{t.landing.introducing}</span>
          <h1 className="banner-title">TP.ai <span className="title-fab">Data</span>Studio</h1>
        </div>
      </section>

      {/* ── Visual Band ── */}
      <div className="visual-band">
        <div className="circular-wrapper" aria-hidden="true">
          <img src="/circular-image.png" alt="" className="circular-img" />
        </div>
        <div className="cta-overlay">
          <button className="cta-btn" onClick={() => navigate("/use-cases")}>
            {t.landing.cta}
          </button>
        </div>
      </div>

      {/* ── Capabilities ── */}
      <section className="capabilities-section" aria-label="Capabilities">
        <div className="capabilities-header">
          <span className="capabilities-label">{t.landing.capabilitiesLabel}</span>
          <h2 className="capabilities-heading">{t.landing.capabilitiesHeading}</h2>
        </div>

        <div className="marquee-outer">
          <div className="marquee-fade-left" aria-hidden="true" />
          <div className="marquee-fade-right" aria-hidden="true" />
          <div className="marquee-track" aria-label="Capabilities showcase">
            {[...CAP_KEYS, ...CAP_KEYS].map((key, i) => {
              const cap = t.capabilities[key];
              const bullet = BULLET_COLORS[i % CAP_KEYS.length];
              return (
                <article
                  key={i}
                  className="capability-card"
                  aria-hidden={i >= CAP_KEYS.length ? true : undefined}
                >
                  <div className="capability-title-header">
                    <div className={`capability-bullet ${bullet === "purple" ? "bullet-purple" : "bullet-violet"}`} />
                    <h3 className="capability-title">{cap.title}</h3>
                  </div>
                  <ul className="capability-subs">
                    {cap.subs.map((sub) => (
                      <li key={sub} className="capability-sub-item">
                        <CheckIcon />
                        {sub}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </div>
      </section>

    </div>
  );
};

export default Index;

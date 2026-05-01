import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCases, FILTERS, FilterLabel } from "@/data/useCases";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { LanguagePicker } from "@/components/LanguagePicker";
import { ThemeToggle } from "@/components/ThemeToggle";

const FILTER_ICONS: Record<string, string> = {
  "All":        "apps",
  "Image":      "image",
  "Video":      "movie",
  "Audio":      "mic",
  "Text / Doc": "article",
  "3D / LiDAR": "view_in_ar",
};

const UseCaseSelection = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [activeFilter, setActiveFilter] = useState<FilterLabel>("All");

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    if (profileOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileOpen]);

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <header className="dark-surface sticky top-0 z-50 bg-[hsl(0,0%,5%)] w-full border-b border-border/20">
        <div className="flex justify-between items-center px-6 py-3 h-16">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/")}
              className="flex items-center justify-center p-2 hover:bg-muted rounded-full transition-colors"
            >
              <span className="material-symbols-outlined text-foreground">arrow_back</span>
            </button>
            <span className="text-sm font-bold tracking-wide text-white cursor-pointer hover:text-white/80 transition-colors font-headline shrink-0">
              TP.ai <span style={{ color: "#9071f0" }}>Data</span>Studio
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <LanguagePicker />
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/30 hover:border-primary/70 hover:bg-primary/10 transition-colors text-xs font-bold text-primary font-body uppercase tracking-wider"
            >
              <span className="material-symbols-outlined" style={{ fontSize:"14px" }}>monitoring</span>
              {t.nav.dashboard}
            </button>
            <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-9 h-9 rounded-full overflow-hidden border-2 border-primary/30 hover:border-primary transition-colors bg-muted flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-foreground/70 text-xl">person</span>
            </button>
            {profileOpen && (
              <div className={`absolute right-0 mt-2 w-56 rounded-lg border shadow-xl p-4 z-50 ${
                isDark
                  ? "bg-[var(--s4)] border-white/15"
                  : "bg-white border-gray-200 shadow-lg"
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isDark ? "bg-white/10" : "bg-gray-100"
                  }`}>
                    <span className={`material-symbols-outlined text-2xl ${isDark ? "text-white/70" : "text-gray-500"}`}>person</span>
                  </div>
                  <div>
                    <p className={`text-sm font-headline font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Alex Johnson</p>
                    <p className={`text-sm font-body ${isDark ? "text-white/55" : "text-gray-500"}`}>Annotator</p>
                  </div>
                </div>
                <div className={`border-t pt-2 ${isDark ? "border-white/15" : "border-gray-200"}`}>
                  <span className={`text-sm font-body uppercase tracking-[0.2em] ${isDark ? "text-white/45" : "text-gray-400"}`}>{t.useCasesPage.role}</span>
                  <span className="block text-sm font-body text-primary mt-0.5">{t.useCasesPage.roleValue}</span>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Gradient line — full width */}
        <div className="absolute bottom-0 left-0 h-[2px] w-full progress-bar-gradient"></div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 md:py-12">
        {/* Heading */}
        <div className="flex flex-col items-center mb-8">
          <div className="inline-block">
            <h1 className="text-2xl md:text-3xl font-headline font-bold text-foreground tracking-tight text-center">
              {t.useCasesPage.heading}
            </h1>
            <div className="gradient-underline mx-auto w-24"></div>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter;
            const count = filter === "All"
              ? useCases.length
              : useCases.filter(uc => uc.filters.includes(filter)).length;
            return (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-bold uppercase tracking-wider transition-all duration-200 ${
                  isActive
                    ? "bg-violet-600 text-white border-violet-600"
                    : isDark
                      ? "bg-transparent text-white/60 border-violet-400/25 hover:text-white/90 hover:border-violet-400/50"
                      : "bg-transparent text-gray-700 border-violet-400/50 hover:text-gray-900 hover:border-violet-600/70"
                }`}
                style={isActive ? { boxShadow: "0 0 16px rgba(144,113,240,0.35)" } : undefined}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "15px", lineHeight: 1 }}
                >
                  {FILTER_ICONS[filter]}
                </span>
                {filter}
                {filter === "All" && (
                  <span
                    className={`text-xs font-mono px-1.5 py-0.5 rounded-full ml-0.5 ${
                      isActive
                        ? "bg-white/20 text-white"
                        : isDark
                          ? "bg-violet-500/15 text-violet-300"
                          : "bg-violet-100 text-violet-700"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Use Case Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {useCases
            .filter(uc => activeFilter === "All" || uc.filters.includes(activeFilter))
            .map((useCase) => (
            <Link
              key={useCase.id}
              to={`/use-cases/${useCase.slug}`}
              className="industrial-card p-5 rounded-[12px] flex flex-col h-full group no-underline"
            >
              <div className="flex justify-between items-start mb-3">
                <span className="material-symbols-outlined text-4xl text-foreground/40 card-icon-hover">
                  {useCase.icon}
                </span>
              </div>
              <h3 className="text-[18px] font-bold font-headline mb-2 uppercase tracking-wide" style={{ color: "#D72483" }}>
                {t.useCases[useCase.slug]?.title ?? useCase.title}
              </h3>
              <p className="text-foreground/60 text-base leading-relaxed mb-4 flex-grow font-body">
                {t.useCases[useCase.slug]?.description ?? useCase.description}
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="bg-background text-primary text-sm font-bold uppercase tracking-widest px-3 py-1 border border-primary/20 rounded-full">
                  {useCase.categoryTag}
                </span>
                <span className="bg-background text-foreground/40 text-sm font-bold uppercase tracking-widest px-3 py-1 border border-border rounded-full">
                  {useCase.secondaryTag}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Empty state */}
        {useCases.filter(uc => activeFilter === "All" || uc.filters.includes(activeFilter)).length === 0 && (
          <div className="text-center py-20 text-foreground/30 text-lg font-body">
            No use cases found for <span className="text-primary font-bold">{activeFilter}</span>
          </div>
        )}
      </main>
    </div>
  );
};

export default UseCaseSelection;

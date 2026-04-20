import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCases } from "@/data/useCases";

const UseCaseSelection = () => {
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

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
      <header className="sticky top-0 z-50 bg-[hsl(0,0%,5%)] w-full border-b border-border/20">
        <div className="flex justify-between items-center px-6 py-3 h-16">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/")}
              className="flex items-center justify-center p-2 hover:bg-muted rounded-full transition-colors"
            >
              <span className="material-symbols-outlined text-foreground">arrow_back</span>
            </button>
            <span className="text-xl font-bold tracking-tight text-white font-headline">
              TP.ai <span style={{ color: "#aa00b6" }}>FAB</span>Studio
            </span>
          </div>
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-9 h-9 rounded-full overflow-hidden border-2 border-primary/30 hover:border-primary transition-colors bg-muted flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-foreground/70 text-xl">person</span>
            </button>
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-lg border border-border/30 bg-[hsl(0,0%,8%)] shadow-xl p-4 z-50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <span className="material-symbols-outlined text-foreground/70 text-2xl">person</span>
                  </div>
                  <div>
                    <p className="text-sm font-headline font-bold text-foreground">Alex Johnson</p>
                    <p className="text-xs font-body text-foreground/50">Annotator</p>
                  </div>
                </div>
                <div className="border-t border-border/20 pt-2">
                  <span className="text-[10px] font-body uppercase tracking-[0.2em] text-foreground/30">Role</span>
                  <span className="block text-xs font-body text-primary mt-0.5">Data Annotator</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Gradient line — full width */}
        <div className="absolute bottom-0 left-0 h-[2px] w-full progress-bar-gradient"></div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-16 md:py-24">
        {/* Heading */}
        <div className="flex flex-col items-center mb-16 md:mb-24">
          <div className="inline-block">
            <h1 className="text-4xl md:text-6xl font-headline font-bold text-foreground tracking-tight text-center">
              Select Your Pipeline
            </h1>
            <div className="gradient-underline mx-auto w-24"></div>
          </div>
          <p className="mt-6 text-foreground/60 font-body text-center max-w-xl text-lg">
            Select the foundational machine learning task for your current data batch. Our industrial-grade pipeline handles the rest.
          </p>
        </div>

        {/* Use Case Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {useCases.map((useCase) => (
            <Link
              key={useCase.id}
              to={`/use-cases/${useCase.slug}`}
              className="industrial-card p-8 rounded-[12px] flex flex-col h-full group no-underline"
            >
              <div className="flex justify-between items-start mb-8">
                <span className="material-symbols-outlined text-4xl text-foreground/40 card-icon-hover">
                  {useCase.icon}
                </span>
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/30 font-body">
                  ID: {useCase.idTag}
                </span>
              </div>
              <h3 className="text-[18px] font-bold font-headline text-foreground mb-3 uppercase tracking-wide">
                {useCase.title}
              </h3>
              <p className="text-foreground/60 text-sm leading-relaxed mb-8 flex-grow font-body">
                {useCase.description}
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="bg-background text-primary text-[10px] font-bold uppercase tracking-widest px-3 py-1 border border-primary/20 rounded-full">
                  {useCase.categoryTag}
                </span>
                <span className="bg-background text-foreground/40 text-[10px] font-bold uppercase tracking-widest px-3 py-1 border border-border rounded-full">
                  {useCase.secondaryTag}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
};

export default UseCaseSelection;

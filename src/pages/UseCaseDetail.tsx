import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getUseCaseBySlug } from "@/data/useCases";

const UseCaseDetail = () => {
  const { useCaseId } = useParams<{ useCaseId: string }>();
  const navigate = useNavigate();
  const useCase = useCaseId ? getUseCaseBySlug(useCaseId) : undefined;
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

  if (!useCase) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-headline text-3xl font-bold text-foreground mb-4">Use case not found</h1>
          <button
            onClick={() => navigate("/use-cases")}
            className="text-primary hover:underline font-body"
          >
            ← Back to capabilities
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[hsl(0,0%,5%)] w-full border-b border-border/20">
        <div className="flex justify-between items-center px-6 py-3 h-16">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/use-cases")}
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
                    <p className="text-sm font-body text-foreground/50">Annotator</p>
                  </div>
                </div>
                <div className="border-t border-border/20 pt-2">
                  <span className="text-sm font-body uppercase tracking-[0.2em] text-foreground/30">Role</span>
                  <span className="block text-sm font-body text-primary mt-0.5">Data Annotator</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-[2px] w-full bg-muted">
          <div className="h-full w-[20%] progress-bar-gradient"></div>
        </div>
      </header>

      {/* Content placeholder */}
      <main className="max-w-4xl mx-auto px-6 py-16 md:py-24">
        <div className="flex flex-col items-center text-center">
          <span className="material-symbols-outlined text-6xl text-foreground/30 mb-6 card-icon-hover">
            {useCase.icon}
          </span>
          <div className="inline-block mb-4">
            <span className="bg-background text-primary text-sm font-bold uppercase tracking-widest px-3 py-1 border border-primary/20 rounded-full">
              {useCase.categoryTag}
            </span>
          </div>
          <h1 className="font-headline text-4xl md:text-5xl font-bold text-foreground uppercase tracking-tight mb-4">
            {useCase.title}
          </h1>
          <p className="text-foreground/60 font-body text-lg max-w-xl leading-relaxed mb-12">
            {useCase.description}
          </p>
          <div className="border border-border/30 rounded-lg p-12 w-full max-w-lg">
            <span className="material-symbols-outlined text-4xl text-foreground/20 mb-4 block">construction</span>
            <p className="text-foreground/40 font-body text-sm uppercase tracking-[0.2em]">
              Pipeline configuration coming soon
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default UseCaseDetail;

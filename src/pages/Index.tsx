import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <>
      <main className="relative min-h-screen flex flex-col items-center justify-center px-6 py-20 hero-gradient">
        <div className="max-w-4xl w-full text-center flex flex-col items-center">
          {/* Branding */}
          <div className="space-y-4 mb-12">
            <span className="block font-headline text-lg md:text-xl font-bold tracking-[0.15em] text-primary">
              TP.ai Data Services
            </span>
            <div className="space-y-2">
              <span className="block font-headline text-sm md:text-base font-bold tracking-[0.3em] text-muted-foreground/60 uppercase">
                INTRODUCING
              </span>
              <h1 className="font-headline text-5xl md:text-7xl font-bold tracking-tight text-foreground">
                TP.ai FABStudio
              </h1>
            </div>
            <p className="max-w-xl mx-auto text-muted-foreground text-lg md:text-xl font-light leading-relaxed mt-6 font-body">
              The next generation of industrial-grade data pipelines.
            </p>
          </div>

          {/* CTA */}
          <div className="mb-20">
            <button
              onClick={() => navigate("/use-cases")}
              className="group px-16 py-5 bg-primary text-primary-foreground font-bold uppercase tracking-[0.3em] text-xs rounded-sm transition-all duration-300 active:scale-95 hover:bg-primary/90"
            >
              LET'S GO
            </button>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl">
            <div className="bg-muted border border-border p-8 flex flex-col items-start text-left hover:bg-muted/80 transition-all duration-400 group">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
                <span className="font-headline text-[10px] tracking-[0.2em] uppercase text-accent/80 font-bold">
                  Infrastructure
                </span>
              </div>
              <h3 className="font-headline text-2xl font-bold text-foreground mb-3 uppercase tracking-wide">
                Multi-modal Fortress
              </h3>
              <p className="text-sm text-muted-foreground font-body leading-relaxed max-w-xs">
                Secure annotation for Text, Image, Video, Audio, and 3D pipelines at enterprise scale.
              </p>
            </div>

            <div className="bg-muted border border-border p-8 flex flex-col items-start text-left hover:bg-muted/80 transition-all duration-400">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-accent"></div>
                <span className="font-headline text-[10px] tracking-[0.2em] uppercase text-accent/80 font-bold">
                  Analytics
                </span>
              </div>
              <h3 className="font-headline text-2xl font-bold text-foreground mb-3 uppercase tracking-wide">
                Operational Intelligence
              </h3>
              <p className="text-sm text-muted-foreground font-body leading-relaxed max-w-xs">
                Integrated Workflow, QC protocols, and real-time performance analytics.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom accent line */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-16 h-[1px] bg-primary/30"></div>
      </main>

      {/* Background blur decorations */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-[-1] opacity-20">
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent rounded-full blur-[180px]"></div>
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[600px] h-[600px] bg-primary rounded-full blur-[180px]"></div>
      </div>
    </>
  );
};

export default Index;

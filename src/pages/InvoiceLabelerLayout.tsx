import { Outlet, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { InvoiceAnnotationProvider } from "@/context/InvoiceAnnotationContext";
import { useLanguage } from "@/context/LanguageContext";

export default function InvoiceLabelerLayout() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const p = t.pages.invoice;

  return (
    <InvoiceAnnotationProvider>
      <div className="min-h-screen bg-background flex flex-col">
        {/* FABStudio sticky header */}
        <header className="sticky top-0 z-50 bg-[hsl(0,0%,5%)] w-full border-b border-border/20">
          <div className="flex items-center px-6 py-3 h-16 gap-3">
            <button
              onClick={() => navigate("/use-cases")}
              className="flex items-center justify-center p-2 hover:bg-muted rounded-full transition-colors"
              aria-label="Back to use cases"
            >
              <ArrowLeft className="w-4 h-4 text-foreground" />
            </button>
            <span
              className="text-sm font-bold tracking-wide text-white cursor-pointer"
              onClick={() => navigate("/use-cases")}
            >
              TP.ai <span style={{ color: "#9071f0" }}>FAB</span>Studio
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm text-foreground/80">{p.breadcrumb}</span>
          </div>
          <div className="absolute bottom-0 left-0 h-[2px] w-full progress-bar-gradient" />
        </header>

        {/* Page content via nested routes */}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    </InvoiceAnnotationProvider>
  );
}

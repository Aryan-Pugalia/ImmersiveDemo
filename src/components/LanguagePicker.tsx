import { useEffect, useRef, useState } from "react";
import { useLanguage, type Language } from "@/context/LanguageContext";

const OPTIONS: { code: Language; flag: string; label: string }[] = [
  { code: "en", flag: "🇺🇸", label: "EN" },
  { code: "ko", flag: "🇰🇷", label: "KO" },
  { code: "es", flag: "🇪🇸", label: "ES" },
  { code: "fr", flag: "🇫🇷", label: "FR" },
  { code: "ar", flag: "🇸🇦", label: "AR" },
  { code: "zh", flag: "🇨🇳", label: "ZH" },
];

interface Props {
  variant?: "pill" | "dropdown";
}

export function LanguagePicker({ variant = "pill" }: Props) {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  if (variant === "dropdown") {
    return (
      <select
        value={language}
        onChange={e => setLanguage(e.target.value as Language)}
        className="text-xs font-bold font-body bg-card border border-border/40 rounded-full px-3 py-1.5 text-foreground focus:outline-none focus:border-primary/60 cursor-pointer"
      >
        {OPTIONS.map(o => (
          <option key={o.code} value={o.code}>{o.flag} {o.label}</option>
        ))}
      </select>
    );
  }

  const current = OPTIONS.find(o => o.code === language) ?? OPTIONS[0];

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-border/30 bg-muted/30 hover:border-primary/50 hover:bg-primary/5 transition-colors text-xs font-bold font-body text-foreground/80 hover:text-foreground"
      >
        <span className="text-sm leading-none">{current.flag}</span>
        <span>{current.label}</span>
        <span className="text-[9px] opacity-50 -mr-0.5">▾</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 rounded-xl border border-border/30 bg-[hsl(0,0%,8%)] shadow-2xl overflow-hidden z-[200] min-w-[110px]"
          style={{ direction: "ltr" }}
        >
          {OPTIONS.map(o => (
            <button
              key={o.code}
              onClick={() => { setLanguage(o.code); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold font-body transition-colors hover:bg-primary/10 text-left ${
                language === o.code
                  ? "text-primary bg-primary/5"
                  : "text-foreground/60 hover:text-foreground"
              }`}
            >
              <span className="text-sm leading-none">{o.flag}</span>
              <span>{o.label}</span>
              {language === o.code && (
                <span className="ml-auto text-primary text-[10px]">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

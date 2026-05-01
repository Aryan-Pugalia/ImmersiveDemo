import { useEffect, useRef, useState } from "react";
import { useLanguage, type Language } from "@/context/LanguageContext";

interface Option {
  code: Language;
  /** ISO 3166-1 alpha-2 country code for flagcdn.com */
  flagCode: string;
  label: string;
  name: string;
}

const OPTIONS: Option[] = [
  { code: "en", flagCode: "us", label: "EN", name: "English"  },
  { code: "ar", flagCode: "sa", label: "AR", name: "Arabic"   },
  { code: "es", flagCode: "es", label: "ES", name: "Spanish"  },
  { code: "fr", flagCode: "fr", label: "FR", name: "French"   },
  { code: "ko", flagCode: "kr", label: "KO", name: "Korean"   },
  { code: "zh", flagCode: "cn", label: "ZH", name: "Chinese"  },
];

function FlagImg({ flagCode, name, className = "" }: { flagCode: string; name: string; className?: string }) {
  return (
    <img
      src={`https://flagcdn.com/20x15/${flagCode}.png`}
      srcSet={`https://flagcdn.com/40x30/${flagCode}.png 2x`}
      width={20}
      height={15}
      alt={name}
      className={`rounded-[2px] object-cover flex-shrink-0 ${className}`}
    />
  );
}

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
          <option key={o.code} value={o.code}>{o.label} – {o.name}</option>
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
        <FlagImg flagCode={current.flagCode} name={current.name} />
        <span>{current.label}</span>
        <span className="text-[9px] opacity-50 -mr-0.5">▾</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 rounded-xl border border-border shadow-2xl overflow-hidden z-[100] min-w-[120px] bg-card"
          style={{ direction: "ltr" }}
        >
          {OPTIONS.map(o => (
            <button
              key={o.code}
              onClick={() => { setLanguage(o.code); setOpen(false); }}
              className={`group w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold font-body transition-colors hover:bg-primary/10 text-left ${
                language === o.code
                  ? "text-primary bg-primary/5"
                  : "text-foreground/80 hover:text-foreground"
              }`}
            >
              <FlagImg flagCode={o.flagCode} name={o.name} />
              <span className="tracking-wide">{o.label}</span>
              {/* Full language name — fades in on hover */}
              <span className="ml-1 text-[10px] font-normal opacity-0 group-hover:opacity-70 transition-opacity duration-150 whitespace-nowrap">
                {o.name}
              </span>
              {language === o.code && (
                <span className="ml-auto text-primary text-[10px] flex-shrink-0">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

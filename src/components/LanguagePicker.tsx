import { useLanguage, type Language } from "@/context/LanguageContext";

const OPTIONS: { code: Language; flag: string; label: string }[] = [
  { code: "en", flag: "🇺🇸", label: "EN" },
  { code: "ko", flag: "🇰🇷", label: "KO" },
];

interface Props {
  /** "pill" = pill toggle (default, for headers); "dropdown" = select dropdown */
  variant?: "pill" | "dropdown";
}

export function LanguagePicker({ variant = "pill" }: Props) {
  const { language, setLanguage } = useLanguage();

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

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-border/30 bg-muted/30 p-0.5">
      {OPTIONS.map(o => (
        <button
          key={o.code}
          onClick={() => setLanguage(o.code)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all font-body ${
            language === o.code
              ? "bg-primary text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>{o.flag}</span>
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";

const LANGUAGES = [
  { code: "en", label: "English", short: "EN" },
  { code: "zh", label: "中文", short: "中" },
];

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const currentLang = LANGUAGES.find((l) => i18n.language.startsWith(l.code)) || LANGUAGES[0];

  const switchLanguage = (langCode) => {
    i18n.changeLanguage(langCode);
  };

  return (
    <div className="dropdown dropdown-end">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-ghost btn-circle btn-sm"
        onKeyDown={(e) => e.key === "Enter" && document.activeElement?.blur()}
      >
        <Languages className="h-5 w-5" />
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content z-[100] menu p-2 shadow-lg bg-base-200 rounded-box w-36 border border-base-300"
      >
        {LANGUAGES.map((lang) => (
          <li key={lang.code}>
            <button
              onClick={() => switchLanguage(lang.code)}
              className={`flex justify-between ${i18n.language.startsWith(lang.code) ? "active font-bold" : ""}`}
            >
              <span>{lang.label}</span>
              {i18n.language.startsWith(lang.code) && <span className="text-xs">✓</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

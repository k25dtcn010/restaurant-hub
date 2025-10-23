import { Globe } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "./ui/button"

/**
 * Language Toggle Component
 * Allows users to switch between English (en) and Vietnamese (vi)
 */
export function LanguageToggle() {
  const { i18n } = useTranslation()

  const toggleLanguage = () => {
    const newLang = i18n.language === "en" ? "vi" : "en"
    i18n.changeLanguage(newLang)
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggleLanguage} title="Change Language">
      <Globe className="h-5 w-5" />
      <span className="sr-only">Toggle language ({i18n.language})</span>
    </Button>
  )
}

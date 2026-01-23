export type Language = "it" | "en";

export const translations = {
  it: {
    loginEyebrow: "Bentornato",
    loginTitle: "Accedi al contest",
    loginSubtitle: "Gestisci le tue miniature con un design Material.",
    emailLabel: "Email",
    emailPlaceholder: "nome@email.it",
    passwordLabel: "Password",
    passwordPlaceholder: "Inserisci la password",
    loginButton: "Login",
    signupButton: "Crea account",
    themeToggle: "Tema",
    themeLight: "Light",
    themeDark: "Dark",
    languageToggle: "言語",
    languageIt: "Italiano",
    languageEn: "English",
    errorTitle: "Errore di accesso"
  },
  en: {
    loginEyebrow: "Welcome back",
    loginTitle: "Sign in to the contest",
    loginSubtitle: "Manage your miniatures with Material design style.",
    emailLabel: "Email",
    emailPlaceholder: "name@email.com",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter your password",
    loginButton: "Login",
    signupButton: "Create account",
    themeToggle: "Theme",
    themeLight: "Light",
    themeDark: "Dark",
    languageToggle: "言語",
    languageIt: "Italiano",
    languageEn: "English",
    errorTitle: "Login error"
  }
} as const;

export type TranslationKey = keyof typeof translations.it;

export function t(lang: Language, key: TranslationKey) {
  return translations[lang][key];
}

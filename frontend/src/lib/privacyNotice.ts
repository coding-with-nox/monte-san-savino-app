import type { Language } from "./i18n";

/**
 * Privacy notice (GDPR art. 13). Bump the version whenever the text changes in substance:
 * it is stored with each registration as proof of which notice the user acknowledged.
 *
 * Parts marked TODO depend on the organizer (controller identity, hosting, retention) and must be
 * completed and reviewed before going live.
 */
export const PRIVACY_POLICY_VERSION = "2026-11-26";

export type PrivacySection = { title: string; paragraphs: string[] };
export type PrivacyNotice = { title: string; intro: string; sections: PrivacySection[]; updated: string };

const it: PrivacyNotice = {
  title: "Informativa privacy",
  intro:
    "Questa informativa spiega quali dati personali raccogliamo quando ti iscrivi e partecipi al concorso, perché li usiamo e quali sono i tuoi diritti, ai sensi del Regolamento UE 2016/679 (GDPR).",
  updated: `Versione ${PRIVACY_POLICY_VERSION}`,
  sections: [
    {
      title: "1. Titolare del trattamento",
      paragraphs: ["[TODO: nome dell'organizzatore, indirizzo, email di contatto per la privacy]"]
    },
    {
      title: "2. Dati che trattiamo",
      paragraphs: [
        "Account: email e password (conservata solo in forma cifrata).",
        "Anagrafica: nome, cognome, telefono, nazione, città e, se lo indichi, indirizzo.",
        "Contatto di emergenza, se lo indichi: nome e telefono di una persona da avvisare. Informala che ci hai dato i suoi dati.",
        "Partecipazione: modelli iscritti, foto, categorie, coautori (nome, cognome ed eventuale email), voti e premi.",
        "Dati tecnici: registri del server (indirizzo IP, data e ora delle richieste) per sicurezza e funzionamento."
      ]
    },
    {
      title: "3. Perché li usiamo e su quale base",
      paragraphs: [
        "Gestire il tuo account, le iscrizioni, la giuria e i premi: è necessario per farti partecipare (art. 6.1.b GDPR).",
        "Contattare il contatto di emergenza durante l'evento: legittimo interesse alla sicurezza delle persone (art. 6.1.f).",
        "Adempiere a obblighi amministrativi e fiscali legati alle quote di iscrizione (art. 6.1.c).",
        "Mostrare nel profilo pubblico nazione e social: solo se attivi il profilo pubblico, cioè con il tuo consenso, che puoi revocare in ogni momento dal Profilo (art. 6.1.a).",
        "[TODO: pubblicazione di risultati, nomi dei premiati e foto dei modelli sul sito o sui social dell'evento, e relativa base giuridica]"
      ]
    },
    {
      title: "4. Chi può vedere i dati",
      paragraphs: [
        "L'organizzazione, lo staff e la giuria, solo per quanto serve al loro ruolo.",
        "Fornitori tecnici che ospitano il servizio, nominati responsabili del trattamento: [TODO: fornitore di hosting e paese dei server].",
        "Non vendiamo i tuoi dati e non li usiamo per pubblicità."
      ]
    },
    {
      title: "5. Trasferimenti fuori dall'UE",
      paragraphs: [
        "[TODO: indicare se i dati restano nell'UE. Se il server o un fornitore è fuori dall'UE, indicare le garanzie (decisione di adeguatezza o clausole contrattuali tipo).]"
      ]
    },
    {
      title: "6. Per quanto tempo",
      paragraphs: [
        "[TODO: per esempio, account finché non chiedi di cancellarlo; dati delle iscrizioni e dei pagamenti per il tempo richiesto dalla legge.]"
      ]
    },
    {
      title: "7. Partecipanti minorenni",
      paragraphs: [
        "Se il partecipante è minorenne (per esempio nella categoria Juniors), l'account deve essere creato o autorizzato da un genitore o da chi ne esercita la responsabilità."
      ]
    },
    {
      title: "8. Cookie e archiviazione nel browser",
      paragraphs: [
        "Non usiamo cookie di profilazione, pubblicità o statistiche di terze parti.",
        "Il browser conserva solo dati tecnici necessari: la sessione di accesso, la lingua, il tema, lo stato del menu e le guide già viste. Per questo non serve un banner dei cookie.",
        "I caratteri tipografici sono serviti dal nostro server. Solo le pagine dello staff con la mappa caricano dati da OpenStreetMap."
      ]
    },
    {
      title: "9. I tuoi diritti",
      paragraphs: [
        "Puoi chiedere l'accesso ai tuoi dati, la rettifica, la cancellazione, la limitazione, la portabilità, opporti al trattamento e revocare il consenso, scrivendo al titolare.",
        "Puoi anche presentare reclamo all'autorità di controllo, in Italia il Garante per la protezione dei dati personali (garanteprivacy.it), o a quella del tuo paese."
      ]
    }
  ]
};

const en: PrivacyNotice = {
  title: "Privacy notice",
  intro:
    "This notice explains which personal data we collect when you sign up and take part in the contest, why we use it and what your rights are, under the EU General Data Protection Regulation 2016/679 (GDPR).",
  updated: `Version ${PRIVACY_POLICY_VERSION}`,
  sections: [
    {
      title: "1. Data controller",
      paragraphs: ["[TODO: organizer name, address, privacy contact email]"]
    },
    {
      title: "2. Data we process",
      paragraphs: [
        "Account: email and password (stored only in encrypted form).",
        "Personal details: first name, last name, phone, country, city and, if you give it, address.",
        "Emergency contact, if you give it: name and phone of a person to notify. Please tell them you shared their details.",
        "Participation: enrolled models, photos, categories, coauthors (name, surname and optional email), votes and awards.",
        "Technical data: server logs (IP address, date and time of requests) for security and operation."
      ]
    },
    {
      title: "3. Why we use it and on what basis",
      paragraphs: [
        "Running your account, enrollments, judging and awards: necessary to let you take part (art. 6.1.b GDPR).",
        "Calling your emergency contact during the event: legitimate interest in people's safety (art. 6.1.f).",
        "Meeting administrative and tax obligations for entry fees (art. 6.1.c).",
        "Showing your country and social links on the public profile: only if you turn the public profile on, that is with your consent, which you can withdraw at any time in your Profile (art. 6.1.a).",
        "[TODO: publication of results, winners' names and model photos on the event website or social media, and its legal basis]"
      ]
    },
    {
      title: "4. Who can see the data",
      paragraphs: [
        "The organizers, staff and judges, only as far as their role requires.",
        "Technical providers hosting the service, appointed as processors: [TODO: hosting provider and server country].",
        "We do not sell your data and do not use it for advertising."
      ]
    },
    {
      title: "5. Transfers outside the EU",
      paragraphs: [
        "[TODO: state whether data stays in the EU. If a server or provider is outside the EU, state the safeguards (adequacy decision or standard contractual clauses).]"
      ]
    },
    {
      title: "6. How long we keep it",
      paragraphs: [
        "[TODO: for example, the account until you ask us to delete it; enrollment and payment data for as long as the law requires.]"
      ]
    },
    {
      title: "7. Minors",
      paragraphs: [
        "If the participant is a minor (for example in the Juniors category), the account must be created or authorized by a parent or legal guardian."
      ]
    },
    {
      title: "8. Cookies and browser storage",
      paragraphs: [
        "We use no profiling, advertising or third-party analytics cookies.",
        "Your browser stores only technical data that is needed: your sign-in session, language, theme, menu state and the guides you have already seen. This is why no cookie banner is needed.",
        "Fonts are served from our own server. Only the staff pages with a map load data from OpenStreetMap."
      ]
    },
    {
      title: "9. Your rights",
      paragraphs: [
        "You can ask for access to your data, rectification, erasure, restriction, portability, object to processing and withdraw consent by writing to the controller.",
        "You can also lodge a complaint with a supervisory authority: in Italy the Garante per la protezione dei dati personali (garanteprivacy.it), or the one in your country."
      ]
    }
  ]
};

export function privacyNotice(language: Language): PrivacyNotice {
  return language === "en" ? en : it;
}

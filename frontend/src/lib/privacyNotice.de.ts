import type { PrivacyNotice } from "./privacyNotice";
import { PRIVACY_POLICY_VERSION } from "./privacyVersion";

export const de: PrivacyNotice = {
  title: "Datenschutzerklärung",
  intro:
    "Diese Datenschutzerklärung erklärt, welche personenbezogenen Daten wir erheben, wenn du dich für den Wettbewerb anmeldest und daran teilnimmst, warum wir sie verwenden und welche Rechte du hast, gemäß der Verordnung (EU) 2016/679 (DSGVO).",
  updated: `Version ${PRIVACY_POLICY_VERSION}`,
  sections: [
    {
      title: "1. Verantwortlicher",
      paragraphs: ["[TODO: Name des Veranstalters, Anschrift, E-Mail-Kontakt für Datenschutzfragen]"]
    },
    {
      title: "2. Daten, die wir verarbeiten",
      paragraphs: [
        "Konto: E-Mail und Passwort (nur verschlüsselt gespeichert).",
        "Stammdaten: Vorname, Nachname, Telefon, Land, Stadt und, falls du sie angibst, Adresse.",
        "Notfallkontakt, falls du ihn angibst: Name und Telefonnummer einer Person, die benachrichtigt werden soll. Bitte informiere diese Person, dass du ihre Daten angegeben hast.",
        "Teilnahme: angemeldete Modelle, Fotos, Kategorien, Mitautoren (Name, Nachname und ggf. E-Mail), Stimmen und Preise.",
        "Technische Daten: Serverprotokolle (IP-Adresse, Datum und Uhrzeit der Anfragen) für Sicherheit und Betrieb."
      ]
    },
    {
      title: "3. Wofür wir sie verwenden und auf welcher Grundlage",
      paragraphs: [
        "Verwaltung deines Kontos, der Anmeldungen, der Bewertung und der Preise: erforderlich, damit du teilnehmen kannst (Art. 6 Abs. 1 lit. b DSGVO).",
        "Kontaktaufnahme mit dem Notfallkontakt während der Veranstaltung: berechtigtes Interesse an der Sicherheit von Personen (Art. 6 Abs. 1 lit. f DSGVO).",
        "Erfüllung verwaltungs- und steuerrechtlicher Pflichten im Zusammenhang mit den Anmeldegebühren (Art. 6 Abs. 1 lit. c DSGVO).",
        "Anzeige von Land und Social-Media-Links im öffentlichen Profil: nur wenn du das öffentliche Profil aktivierst, also mit deiner Einwilligung, die du jederzeit im Profil widerrufen kannst (Art. 6 Abs. 1 lit. a DSGVO).",
        "[TODO: Veröffentlichung von Ergebnissen, Namen der Preisträger und Fotos der Modelle auf der Website oder in den sozialen Medien der Veranstaltung sowie deren Rechtsgrundlage]"
      ]
    },
    {
      title: "4. Wer die Daten sehen kann",
      paragraphs: [
        "Der Veranstalter, das Personal und die Jury, nur soweit es ihre Rolle erfordert.",
        "Technische Dienstleister, die den Dienst hosten und als Auftragsverarbeiter (Art. 28 DSGVO) eingesetzt werden: [TODO: Hosting-Anbieter und Land der Server].",
        "Wir verkaufen deine Daten nicht und verwenden sie nicht für Werbung."
      ]
    },
    {
      title: "5. Übermittlungen außerhalb der EU",
      paragraphs: [
        "[TODO: angeben, ob die Daten in der EU bleiben. Befindet sich ein Server oder Dienstleister außerhalb der EU, sind die Garantien anzugeben (Angemessenheitsbeschluss oder Standardvertragsklauseln).]"
      ]
    },
    {
      title: "6. Wie lange wir sie speichern",
      paragraphs: [
        "[TODO: z. B. das Konto bis du seine Löschung verlangst; Anmelde- und Zahlungsdaten so lange, wie es das Gesetz verlangt.]"
      ]
    },
    {
      title: "7. Minderjährige Teilnehmer",
      paragraphs: [
        "Ist der Teilnehmer minderjährig (z. B. in der Kategorie Juniors), muss das Konto von einem Elternteil oder einer anderen sorgeberechtigten Person angelegt oder genehmigt werden."
      ]
    },
    {
      title: "8. Cookies und Speicherung im Browser",
      paragraphs: [
        "Wir verwenden keine Cookies von Dritten für Profiling, Werbung oder Statistik.",
        "Der Browser speichert nur die notwendigen technischen Daten: die Anmeldesitzung, die Sprache, das Design, den Zustand des Menüs und die bereits gesehenen Anleitungen. Deshalb ist kein Cookie-Banner erforderlich.",
        "Wenn die Anti-Bot-Prüfung aktiv ist, verwendet das Anmeldeformular Cloudflare Turnstile, das technische Daten wie IP-Adresse und Browser erhält.",
        "Schriftarten werden von unserem eigenen Server bereitgestellt. Nur die Seiten des Personals mit Karte laden Daten von OpenStreetMap."
      ]
    },
    {
      title: "9. Deine Rechte",
      paragraphs: [
        "Du kannst Auskunft über deine Daten, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit sowie Widerspruch gegen die Verarbeitung verlangen und deine Einwilligung widerrufen, indem du dich an den Verantwortlichen wendest.",
        "Du kannst außerdem Beschwerde bei einer Aufsichtsbehörde einreichen: in Italien beim Garante per la protezione dei dati personali (garanteprivacy.it) oder bei der Behörde deines Landes."
      ]
    }
  ]
};

import type { PrivacyNotice } from "./privacyNotice";
import { PRIVACY_POLICY_VERSION } from "./privacyVersion";

export const fr: PrivacyNotice = {
  title: "Notice de confidentialité",
  intro:
    "La présente notice explique quelles données personnelles nous collectons lorsque vous vous inscrivez et participez au concours, pourquoi nous les utilisons et quels sont vos droits, conformément au Règlement (UE) 2016/679 (RGPD).",
  updated: `Version ${PRIVACY_POLICY_VERSION}`,
  sections: [
    {
      title: "1. Responsable du traitement",
      paragraphs: ["[TODO : nom de l'organisateur, adresse, e-mail de contact pour la vie privée]"]
    },
    {
      title: "2. Données que nous traitons",
      paragraphs: [
        "Compte : e-mail et mot de passe (conservé uniquement sous forme chiffrée).",
        "Données personnelles : prénom, nom, téléphone, pays, ville et, si vous le indiquez, adresse.",
        "Contact d'urgence, si vous le indiquez : nom et téléphone d'une personne à prévenir. Veuillez l'informer que vous nous avez communiqué ses coordonnées.",
        "Participation : modèles inscrits, photos, catégories, coauteurs (nom, prénom et e-mail facultatif), votes et prix.",
        "Données techniques : journaux du serveur (adresse IP, date et heure des requêtes) pour la sécurité et le fonctionnement."
      ]
    },
    {
      title: "3. Pourquoi nous les utilisons et sur quelle base",
      paragraphs: [
        "Gérer votre compte, vos inscriptions, le jury et les prix : nécessaire pour vous permettre de participer (art. 6.1.b du RGPD).",
        "Contacter le contact d'urgence pendant l'événement : intérêt légitime à la sécurité des personnes (art. 6.1.f).",
        "Respecter les obligations administratives et fiscales liées aux frais d'inscription (art. 6.1.c).",
        "Afficher votre pays et vos réseaux sociaux sur le profil public : uniquement si vous activez le profil public, c'est-à-dire avec votre consentement, que vous pouvez retirer à tout moment depuis le Profil (art. 6.1.a).",
        "[TODO : publication des résultats, noms des lauréats et photos des modèles sur le site ou les réseaux sociaux de l'événement, et base juridique correspondante]"
      ]
    },
    {
      title: "4. Qui peut voir les données",
      paragraphs: [
        "L'organisation, le personnel et le jury, uniquement dans la mesure nécessaire à leur rôle.",
        "Les prestataires techniques qui hébergent le service, désignés comme sous-traitants : [TODO : prestataire d'hébergement et pays des serveurs].",
        "Nous ne vendons pas vos données et ne les utilisons pas à des fins publicitaires."
      ]
    },
    {
      title: "5. Transferts hors de l'UE",
      paragraphs: [
        "[TODO : indiquer si les données restent dans l'UE. Si un serveur ou un prestataire se situe hors de l'UE, indiquer les garanties (décision d'adéquation ou clauses contractuelles types).]"
      ]
    },
    {
      title: "6. Durée de conservation",
      paragraphs: [
        "[TODO : par exemple, le compte jusqu'à ce que vous demandiez sa suppression ; les données des inscriptions et des paiements pendant la durée imposée par la loi.]"
      ]
    },
    {
      title: "7. Participants mineurs",
      paragraphs: [
        "Si le participant est mineur (par exemple dans la catégorie Juniors), le compte doit être créé ou autorisé par un parent ou par la personne exerçant l'autorité parentale."
      ]
    },
    {
      title: "8. Cookies et stockage dans le navigateur",
      paragraphs: [
        "Nous n'utilisons aucun cookie de profilage, publicitaire ou de statistiques de tiers.",
        "Le navigateur ne conserve que les données techniques nécessaires : la session de connexion, la langue, le thème, l'état du menu et les guides déjà consultés. C'est pourquoi aucun bandeau de cookies n'est nécessaire.",
        "Lorsque la vérification anti-robot est active, le formulaire d'inscription utilise Cloudflare Turnstile, qui reçoit des données techniques telles que l'adresse IP et le navigateur.",
        "Les polices de caractères sont servies par notre propre serveur. Seules les pages du personnel affichant une carte chargent des données depuis OpenStreetMap."
      ]
    },
    {
      title: "9. Vos droits",
      paragraphs: [
        "Vous pouvez demander l'accès à vos données, leur rectification, leur effacement, leur limitation, leur portabilité, vous opposer au traitement et retirer votre consentement, en écrivant au responsable du traitement.",
        "Vous pouvez également introduire une réclamation auprès de l'autorité de contrôle : en Italie, le Garante per la protezione dei dati personali (garanteprivacy.it), ou celle de votre pays."
      ]
    }
  ]
};

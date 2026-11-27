import type { PrivacyNotice } from "./privacyNotice";
import { PRIVACY_POLICY_VERSION } from "./privacyVersion";

export const es: PrivacyNotice = {
  title: "Información sobre privacidad",
  intro:
    "Esta información explica qué datos personales recogemos cuando te inscribes y participas en el concurso, para qué los usamos y cuáles son tus derechos, de conformidad con el Reglamento (UE) 2016/679 (RGPD).",
  updated: `Versión ${PRIVACY_POLICY_VERSION}`,
  sections: [
    {
      title: "1. Responsable del tratamiento",
      paragraphs: ["[TODO: nombre del organizador, dirección, email de contacto para la privacidad]"]
    },
    {
      title: "2. Datos que tratamos",
      paragraphs: [
        "Cuenta: email y contraseña (guardada solo en forma cifrada).",
        "Datos personales: nombre, apellidos, teléfono, país, ciudad y, si lo indicas, dirección.",
        "Contacto de emergencia, si lo indicas: nombre y teléfono de una persona a la que avisar. Infórmala de que nos has facilitado sus datos.",
        "Participación: modelos inscritos, fotos, categorías, coautores (nombre, apellidos y, en su caso, email), votos y premios.",
        "Datos técnicos: registros del servidor (dirección IP, fecha y hora de las solicitudes) por seguridad y funcionamiento."
      ]
    },
    {
      title: "3. Para qué los usamos y con qué base jurídica",
      paragraphs: [
        "Gestionar tu cuenta, las inscripciones, el jurado y los premios: es necesario para permitirte participar (art. 6.1.b RGPD).",
        "Contactar con el contacto de emergencia durante el evento: interés legítimo en la seguridad de las personas (art. 6.1.f).",
        "Cumplir las obligaciones administrativas y fiscales relacionadas con las cuotas de inscripción (art. 6.1.c).",
        "Mostrar en el perfil público el país y las redes sociales: solo si activas el perfil público, es decir, con tu consentimiento, que puedes revocar en cualquier momento desde el Perfil (art. 6.1.a).",
        "[TODO: publicación de resultados, nombres de los premiados y fotos de los modelos en la web o en las redes sociales del evento, y su base jurídica]"
      ]
    },
    {
      title: "4. Quién puede ver los datos",
      paragraphs: [
        "La organización, el staff y el jurado, solo en la medida necesaria para su función.",
        "Proveedores técnicos que alojan el servicio, designados como encargados del tratamiento: [TODO: proveedor de alojamiento y país de los servidores].",
        "No vendemos tus datos ni los utilizamos para publicidad."
      ]
    },
    {
      title: "5. Transferencias fuera de la UE",
      paragraphs: [
        "[TODO: indicar si los datos permanecen en la UE. Si el servidor o un proveedor se encuentra fuera de la UE, indicar las garantías (decisión de adecuación o cláusulas contractuales tipo).]"
      ]
    },
    {
      title: "6. Durante cuánto tiempo",
      paragraphs: [
        "[TODO: por ejemplo, la cuenta hasta que solicites su eliminación; los datos de inscripciones y pagos durante el tiempo que exija la ley.]"
      ]
    },
    {
      title: "7. Participantes menores de edad",
      paragraphs: [
        "Si el participante es menor de edad (por ejemplo, en la categoría Juniors), la cuenta debe ser creada o autorizada por un padre, madre o tutor legal."
      ]
    },
    {
      title: "8. Cookies y almacenamiento en el navegador",
      paragraphs: [
        "No utilizamos cookies de perfilado, publicidad ni estadísticas de terceros.",
        "El navegador guarda solo los datos técnicos necesarios: la sesión de acceso, el idioma, el tema, el estado del menú y las guías ya vistas. Por eso no es necesario un aviso de cookies.",
        "Cuando la verificación anti-bots está activa, el formulario de inscripción utiliza Cloudflare Turnstile, que recibe datos técnicos como la dirección IP y el navegador.",
        "Las fuentes tipográficas se sirven desde nuestro propio servidor. Solo las páginas del staff con mapa cargan datos de OpenStreetMap."
      ]
    },
    {
      title: "9. Tus derechos",
      paragraphs: [
        "Puedes solicitar el acceso a tus datos, su rectificación, supresión, limitación, portabilidad, oponerte al tratamiento y retirar el consentimiento, escribiendo al responsable del tratamiento.",
        "También puedes presentar una reclamación ante la autoridad de control: en Italia, el Garante per la protezione dei dati personali (garanteprivacy.it), o la de tu país."
      ]
    }
  ]
};

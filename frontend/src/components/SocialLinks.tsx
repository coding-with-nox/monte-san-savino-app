import React from "react";
import { IconButton, Stack, Tooltip, Typography } from "@mui/material";
import InstagramIcon from "@mui/icons-material/Instagram";
import FacebookIcon from "@mui/icons-material/Facebook";
import LanguageIcon from "@mui/icons-material/Language";
import PinterestIcon from "@mui/icons-material/Pinterest";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import { Language, t } from "../lib/i18n";
import { SocialFields, safeHttpUrl } from "../lib/social";

interface SocialLinksProps extends SocialFields {
  language: Language;
}

/** Read-only brand icons that open the profile's social/website links (http/https only). */
export default function SocialLinks({ language, instagram, facebook, website, patreon, pinterest, tiktok }: SocialLinksProps) {
  const items = [
    { key: "instagram", label: t(language, "profileInstagram"), value: instagram, icon: <InstagramIcon /> },
    { key: "facebook", label: t(language, "profileFacebook"), value: facebook, icon: <FacebookIcon /> },
    { key: "website", label: t(language, "profileWebsite"), value: website, icon: <LanguageIcon /> },
    { key: "patreon", label: t(language, "profilePatreon"), value: patreon, icon: <VolunteerActivismIcon /> },
    { key: "pinterest", label: t(language, "profilePinterest"), value: pinterest, icon: <PinterestIcon /> },
    { key: "tiktok", label: t(language, "profileTiktok"), value: tiktok, icon: <MusicNoteIcon /> }
  ]
    .map((i) => ({ ...i, href: safeHttpUrl(i.value) }))
    .filter((i) => i.href !== null);

  if (items.length === 0) {
    return <Typography color="text.secondary">{t(language, "profileSocialNone")}</Typography>;
  }

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {items.map((i) => (
        <Tooltip key={i.key} title={`${i.label}: ${i.value}`}>
          <IconButton
            component="a"
            href={i.href as string}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={i.label}
            color="primary"
          >
            {i.icon}
          </IconButton>
        </Tooltip>
      ))}
    </Stack>
  );
}

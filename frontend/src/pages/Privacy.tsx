import React from "react";
import { Stack, Typography } from "@mui/material";
import PageContainer from "../components/PageContainer";
import SectionCard from "../components/SectionCard";
import type { Language } from "../lib/i18n";
import { privacyNotice } from "../lib/privacyNotice";

export default function Privacy({ language }: { language: Language }) {
  const notice = privacyNotice(language);
  return (
    <PageContainer maxWidth="md">
      <Stack spacing={3}>
        <div>
          <Typography variant="h4">{notice.title}</Typography>
          <Typography variant="body2" color="text.secondary">{notice.updated}</Typography>
        </div>
        <Typography variant="body1">{notice.intro}</Typography>
        {notice.sections.map((section) => (
          <SectionCard key={section.title} title={section.title}>
            <Stack spacing={1}>
              {section.paragraphs.map((p) => (
                <Typography key={p} variant="body2">{p}</Typography>
              ))}
            </Stack>
          </SectionCard>
        ))}
      </Stack>
    </PageContainer>
  );
}

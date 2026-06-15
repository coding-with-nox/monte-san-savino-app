import React from "react";
import { Container, ContainerProps } from "@mui/material";

interface PageContainerProps {
  children: React.ReactNode;
  maxWidth?: ContainerProps["maxWidth"];
}

export default function PageContainer({ children, maxWidth = "md" }: PageContainerProps) {
  return (
    <Container maxWidth={maxWidth} sx={{ py: { xs: 2, md: 4 } }}>
      {children}
    </Container>
  );
}

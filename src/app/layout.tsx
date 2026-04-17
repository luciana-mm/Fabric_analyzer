import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../index.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "TissueScope",
  description: "Análise de tecidos com controle operacional e gerencial.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
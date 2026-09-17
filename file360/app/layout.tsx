import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "File360 — resolva seu arquivo", template: "%s · File360" },
  description: "Converta imagens, organize PDFs, corte mídia e compacte arquivos diretamente no navegador.",
  applicationName: "File360",
  robots: process.env.NEXT_PUBLIC_PRODUCTION === "true" ? "index, follow" : "noindex, nofollow",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

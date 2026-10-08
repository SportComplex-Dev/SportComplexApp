import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "../styles/globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AKROS SportComplex — Reservas, Membresías y Acceso Deportivo",
  description:
    "Landing institucional, reservas de pádel, tenis, fútbol, piscinas y wellness con modelo 100% cashless Stripe y control de acceso QR.",
  icons: {
    icon: [
      { url: "/images/Akros-logo-bosque.png", media: "(prefers-color-scheme: light)" },
      { url: "/images/Akros-logo.png", media: "(prefers-color-scheme: dark)" },
      { url: "/favicon.ico" },
    ],
    apple: "/images/Akros-logo.png",
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#111815" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO" suppressHydrationWarning>
      <body
        className={`${plusJakartaSans.variable} ${jetBrainsMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}

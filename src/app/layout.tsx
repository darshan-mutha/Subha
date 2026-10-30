import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/Brand";
/* Styles load in this order; later files build on the tokens in the first. */
import "./styles/01-tokens-base.css";
import "./styles/02-type-forms-buttons.css";
import "./styles/03-start.css";
import "./styles/04-plan.css";
import "./styles/05-vendors-team.css";
import "./styles/06-print.css";
import "./styles/07-budget-personal.css";
import "./styles/08-invite-savings-events.css";
import "./styles/09-guests-nav.css";
import "./styles/10-traditions-ideas.css";
import "./styles/11-vendors-board.css";
import "./styles/12-guest-list.css";
import "./styles/13-wide.css";
import "./styles/14-high-contrast.css";

/** Pages render per request so each gets its own CSP nonce (see src/proxy.ts). */
export const dynamic = "force-dynamic";

/**
 * Fraunces "SuperSoft" (SOFT 100, WONK 0, 72pt optical size) at weight 600 for
 * headings and the wordmark. Self-hosted as one file covering Latin and
 * Latin Extended, so "ā" in Shubā is drawn by the font's own precomposed glyph.
 * Licence: src/app/fonts/OFL-Fraunces.txt.
 */
const fraunces = localFont({
  src: "./fonts/fraunces-600-soft.woff2",
  weight: "600",
  style: "normal",
  variable: "--font-display",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Shubā – Plan any celebration in minutes",
  description:
    "Shubā is an AI celebration planner for weddings, birthdays, festivals and community events: budget, timeline, vendors, ideas and auspicious timings.",
  applicationName: "Shubā",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F4EC" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1B1D" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="home-link" aria-label="Shubā home">
              <Logo />
            </Link>
            <p className="tagline">Plan any celebration in minutes</p>
          </div>
        </header>
        <main id="main" className="container">
          {children}
        </main>
        <footer className="site-footer">
          <div className="container">
            <p>
              Plans are AI-generated estimates. Please check prices with vendors and confirm muhurat timings with your
              priest.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}

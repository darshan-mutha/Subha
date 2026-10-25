import type { InviteFacts, InviteLook, InviteWording } from "./invite";

/**
 * Draws the invitation card on a canvas (1080 × 1350, the 4:5 shape that
 * WhatsApp and Instagram show well). The same drawing is used for the preview
 * and the downloaded image, so what the host sees is what guests get.
 */

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

interface Palette {
  bg: [string, string];
  border: string;
  heading: string;
  text: string;
  muted: string;
  petalA: string;
  petalB: string;
}

export const LOOK_PALETTES: Record<InviteLook, Palette> = {
  peacock: {
    bg: ["#0E5A63", "#093E44"],
    border: "#E2B657",
    heading: "#F7F4EC",
    text: "#EDE6D6",
    muted: "#A9BDBF",
    petalA: "#5FC2CC",
    petalB: "#E2B657",
  },
  ivory: {
    bg: ["#FBF8F1", "#F3EBDA"],
    border: "#C9962B",
    heading: "#0E5A63",
    text: "#162426",
    muted: "#4A5C5E",
    petalA: "#0E5A63",
    petalB: "#C9962B",
  },
  haldi: {
    bg: ["#F8E7B5", "#F1D58A"],
    border: "#9C3A26",
    heading: "#7A2E1F",
    text: "#3B2A10",
    muted: "#5E4410",
    petalA: "#9C3A26",
    petalB: "#0E5A63",
  },
};

/** Splits text into lines that fit `maxWidth`. Words longer than a line are broken by character. */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number, maxLines = 99): string[] {
  const lines: string[] = [];
  let line = "";
  const push = (l: string) => {
    if (l) lines.push(l);
  };
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      line = candidate;
      continue;
    }
    push(line);
    line = "";
    if (measure(word) <= maxWidth) {
      line = word;
      continue;
    }
    // A single very long word: break it between characters (keeps Indic letters whole).
    const parts =
      typeof Intl !== "undefined" && "Segmenter" in Intl
        ? [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(word)].map((s) => s.segment)
        : [...word];
    for (const ch of parts) {
      if (measure(line + ch) > maxWidth && line) {
        push(line);
        line = ch;
      } else line += ch;
    }
  }
  push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/\s+\S*$/, "")}…`;
    return kept;
  }
  return lines;
}

export interface CardFonts {
  display: string;
  body: string;
}

/** Reads the page's font families, with fallbacks that cover Indian scripts. */
export function cardFonts(): CardFonts {
  const style = getComputedStyle(document.documentElement);
  const indic = `"Noto Sans", "Nirmala UI", "Kohinoor Devanagari", sans-serif`;
  const display = style.getPropertyValue("--font-display").trim() || "Georgia, serif";
  const body = style.getPropertyValue("--font-body").trim() || "system-ui, sans-serif";
  return { display: `${display}, ${indic}`, body: `${body}, ${indic}` };
}

const PETAL = "M0 -6 C 7 -14, 7 -24, 0 -30 C -7 -24, -7 -14, 0 -6 Z";

function petal(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, angle: number, fill: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.fillStyle = fill;
  ctx.fill(new Path2D(PETAL));
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

interface Block {
  lines: string[];
  font: string;
  size: number;
  lineHeight: number;
  color: string;
  gapAfter: number;
}

/** Paints the whole card. Text is laid out to fit, shrinking the invitation if it is long. */
export function drawInviteCard(
  ctx: CanvasRenderingContext2D,
  wording: InviteWording,
  facts: InviteFacts,
  look: InviteLook,
  fonts: CardFonts,
): void {
  const p = LOOK_PALETTES[look];
  const W = CARD_WIDTH;
  const H = CARD_HEIGHT;
  const cx = W / 2;

  // Background and soft double border.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, p.bg[0]);
  grad.addColorStop(1, p.bg[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = p.border;
  ctx.lineWidth = 4;
  roundRect(ctx, 40, 40, W - 80, H - 80, 48);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  roundRect(ctx, 58, 58, W - 116, H - 116, 36);
  ctx.stroke();

  // Toran: a gentle string of petals across the top.
  ctx.strokeStyle = p.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(110, 82);
  ctx.quadraticCurveTo(cx, 150, W - 110, 82);
  ctx.stroke();
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const x = 110 + t * (W - 220);
    const y = (1 - t) * (1 - t) * 82 + 2 * (1 - t) * t * 150 + t * t * 82;
    petal(ctx, x, y + 2, 0.9, Math.PI, i % 2 ? p.petalA : p.petalB);
  }

  // Text blocks, centred in the space below the mark.
  const maxW = W - 260;
  const measureWith = (font: string) => (s: string) => {
    ctx.font = font;
    return ctx.measureText(s).width;
  };
  const block = (
    text: string,
    weight: number,
    family: string,
    size: number,
    color: string,
    gapAfter: number,
    maxLines = 99,
    lineHeight = 1.45,
  ): Block => {
    const font = `${weight} ${size}px ${family}`;
    return {
      lines: text ? wrapText(text, maxW, measureWith(font), maxLines) : [],
      font,
      size,
      lineHeight: size * lineHeight,
      color,
      gapAfter,
    };
  };

  // The rangoli mark sits just above the words; together they are centred on the card.
  const MARK = 150;
  const top = 190 + MARK;
  const bottom = H - 140;
  let messageSize = 40;
  let blocks: Block[] = [];
  for (; messageSize >= 26; messageSize -= 2) {
    blocks = [
      block(wording.heading, 600, fonts.display, Math.round(messageSize * 1.8), p.heading, 36, 3, 1.2),
      block(wording.message, 400, fonts.body, messageSize, p.text, 44, 9),
      block(facts.date, 700, fonts.body, Math.round(messageSize * 1.05), p.heading, 10, 2),
      block(facts.time, 500, fonts.body, messageSize, p.text, 10, 2),
      block(facts.venue, 500, fonts.body, messageSize, p.text, facts.note ? 28 : 44, 3),
      block(facts.note, 400, fonts.body, Math.round(messageSize * 0.85), p.muted, 44, 3),
      block(wording.closing, 600, fonts.display, Math.round(messageSize * 1.1), p.heading, 0, 2),
    ].filter((b) => b.lines.length > 0);
    const height = blocks.reduce((sum, b) => sum + b.lines.length * b.lineHeight + b.gapAfter, 0);
    if (height <= bottom - top) break;
  }

  const total = blocks.reduce((sum, b) => sum + b.lines.length * b.lineHeight + b.gapAfter, 0);
  let y = top + Math.max(0, (bottom - top - total) / 2);

  const markY = y - MARK / 2 - 20;
  for (let i = 0; i < 6; i++) petal(ctx, cx, markY, 2.1, (i * Math.PI) / 3, i % 2 ? p.petalA : p.petalB);
  ctx.fillStyle = p.border;
  ctx.beginPath();
  ctx.arc(cx, markY, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  blocks.forEach((b, index) => {
    ctx.font = b.font;
    ctx.fillStyle = b.color;
    for (const line of b.lines) {
      ctx.fillText(line, cx, y + b.lineHeight / 2);
      y += b.lineHeight;
    }
    // A small gold divider after the heading.
    if (index === 0) {
      ctx.strokeStyle = p.border;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 70, y + b.gapAfter / 2);
      ctx.lineTo(cx - 14, y + b.gapAfter / 2);
      ctx.moveTo(cx + 14, y + b.gapAfter / 2);
      ctx.lineTo(cx + 70, y + b.gapAfter / 2);
      ctx.stroke();
      ctx.fillStyle = p.border;
      ctx.beginPath();
      ctx.arc(cx, y + b.gapAfter / 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    y += b.gapAfter;
  });

  ctx.font = `400 22px ${fonts.body}`;
  ctx.fillStyle = p.muted;
  ctx.fillText("Made with Shubā", cx, H - 92);
}

/** Draws the card and returns it as a PNG, or null if the browser can't draw. */
export async function renderInviteCard(
  wording: InviteWording,
  facts: InviteFacts,
  look: InviteLook,
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    return null;
  }
  if (!ctx || typeof Path2D === "undefined") return null;
  const fonts = cardFonts();
  try {
    // Make sure the heading font is ready, so the first image isn't drawn in a fallback font.
    await Promise.all([
      document.fonts?.load(`600 72px ${fonts.display}`, wording.heading),
      document.fonts?.load(`400 40px ${fonts.body}`, wording.message),
    ]);
  } catch {
    /* draw with whatever fonts are available */
  }
  drawInviteCard(ctx, wording, facts, look, fonts);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

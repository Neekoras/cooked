import { useState, useRef, useMemo } from 'react';
import { percentToLetter } from '../math/gradeEngine';

// Resolved hex colors for both Canvas 2D and inline style usage.
// We use these directly instead of CSS variables so the share card
// preview and PNG both render correct colors without relying on
// CSS variable resolution (which doesn't work in canvas or inline styles).
const ACCENT_COLORS = {
  green:  '#4AAB7A',
  red:    '#D14545',
  amber:  '#C89A2C',
  yellow: '#C8912C',
};

function buildMessage(grade, targetPercent, inverseResults, courseName) {
  // Build a short course identifier (first 3-4 words max, ~25 chars)
  const shortCourse = courseName
    ? courseName.split(/\s+/).slice(0, 3).join(' ').slice(0, 25) + (courseName.length > 25 ? '…' : '')
    : null;

  if (inverseResults?.length > 0) {
    const allAchieved = inverseResults.every(r => r.isAchieved);
    const anyImpossible = inverseResults.some(r => r.isImpossible);
    const minRequired = inverseResults
      .filter(r => !r.isImpossible && !r.isAchieved)
      .sort((a, b) => a.requiredPercent - b.requiredPercent)[0];

    if (allAchieved) {
      const letter = percentToLetter(targetPercent);
      return {
        line1: `${letter} is locked in`,
        line2: shortCourse ? `${shortCourse}` : 'Target already achieved — not cooked',
        accentKey: 'green',
        accent: ACCENT_COLORS.green,
      };
    }
    if (minRequired) {
      const letter = percentToLetter(targetPercent);
      const pct = minRequired.requiredPercent.toFixed(0);
      return {
        line1: `I only need a ${pct}%`,
        line2: shortCourse ? `to get ${letter !== 'F' ? `an ${letter}` : 'a passing grade'} in ${shortCourse}` : `to get ${letter !== 'F' ? `an ${letter}` : 'a passing grade'} — not cooked`,
        accentKey: 'amber',
        accent: ACCENT_COLORS.amber,
      };
    }
    if (anyImpossible) {
      return {
        line1: 'Might be cooked',
        line2: shortCourse ? `${shortCourse} — target ${percentToLetter(targetPercent)} unreachable` : `Target ${percentToLetter(targetPercent)} isn't achievable anymore`,
        accentKey: 'red',
        accent: ACCENT_COLORS.red,
      };
    }
  }

  if (grade !== null) {
    return {
      line1: `Sitting at ${grade.toFixed(1)}%`,
      line2: shortCourse ? `${shortCourse} · ${percentToLetter(grade)}` : `${percentToLetter(grade)} — Cooked`,
      accentKey: 'amber',
      accent: ACCENT_COLORS.amber,
    };
  }

  return { line1: 'Grade not loaded yet', line2: 'Open a Canvas course to get started', accentKey: 'amber', accent: ACCENT_COLORS.amber };
}

/**
 * Draw a line of text with truncation if it exceeds maxWidth.
 * Falls back character-by-character to find a fitting substring.
 */
function drawTextClamped(ctx, text, x, y, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }
  // Binary-search for the longest prefix that fits (with "…" appended)
  let lo = 0, hi = text.length;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    const candidate = text.slice(0, mid) + '…';
    if (ctx.measureText(candidate).width <= maxWidth) lo = mid;
    else hi = mid;
  }
  ctx.fillText(text.slice(0, lo) + '…', x, y);
}

/**
 * Draw the share card onto a canvas element using the 2D API.
 * No external dependencies — just the browser Canvas API.
 */
function drawCard(message, canvas) {
  const W = 600, H = 280;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0C0A08';
  ctx.fillRect(0, 0, W, H);

  // Top amber line
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, 'transparent');
  grad.addColorStop(0.5, '#C89A2C');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 1);

  // Border
  ctx.strokeStyle = '#2C2720';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  // Logo — manual letter spacing since ctx.letterSpacing isn't standard
  ctx.fillStyle = '#665E55';
  ctx.font = '600 11px "DM Sans", system-ui, sans-serif';
  const logoText = 'COOKED';
  const logoSpacing = 1.8; // px between letters
  let logoX = 28;
  for (const ch of logoText) {
    ctx.fillText(ch, logoX, 42);
    logoX += ctx.measureText(ch).width + logoSpacing;
  }

  // Main headline
  ctx.fillStyle = message.accent;
  ctx.font = 'bold 36px "Fraunces", Georgia, serif';
  drawTextClamped(ctx, message.line1, 28, 120, W - 56);

  // Sub line
  ctx.fillStyle = '#9C9389';
  ctx.font = '400 15px "DM Sans", system-ui, sans-serif';
  drawTextClamped(ctx, message.line2, 28, 152, W - 56);

  // URL watermark
  ctx.fillStyle = '#665E55';
  ctx.font = '400 11px "DM Sans", system-ui, sans-serif';
  ctx.fillText('amIcooked.app', W - 28 - ctx.measureText('amIcooked.app').width, H - 18);
}

export default function ShareCard({ grade, targetPercent, inverseResults, courseName }) {
  const canvasRef = useRef(null);
  const [downloaded, setDownloaded] = useState(false);

  const message = useMemo(
    () => buildMessage(grade, targetPercent, inverseResults, courseName),
    [grade, targetPercent, inverseResults, courseName]
  );

  function handleDownload() {
    const canvas = document.createElement('canvas');
    drawCard(message, canvas);
    const link = document.createElement('a');
    link.download = 'cooked.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  }

  return (
    <div className="ck-share-body">
      <div className="ck-spacer-md" />

      {/* Preview — static DOM version of the card */}
      <div className="ck-card-preview">
        <div className="ck-card-logo">Cooked</div>
        <div className={`ck-card-headline ck-accent-${message.accentKey ?? 'amber'}`}>
          {message.line1}
        </div>
        <div className="ck-card-sub">{message.line2}</div>
        <div className="ck-card-url">amIcooked.app</div>
      </div>

      <div className="ck-btn-row">
        <button className="ck-btn" onClick={handleDownload} style={{ flex: 1 }}>
          {downloaded ? 'Downloaded ✓' : 'Download PNG'}
        </button>
      </div>

      <div className="ck-spacer-sm" />
      <p style={{ fontSize: '11px', color: 'var(--text-3)', textAlign: 'center' }}>
        Share wherever — TikTok, iMessage, group chat
      </p>
    </div>
  );
}

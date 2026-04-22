import { useState, useRef } from 'react';
import { percentToLetter } from '../math/gradeEngine';

function buildMessage(grade, targetPercent, inverseResults) {
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
        line2: 'Target already achieved — not cooked',
        accent: 'var(--green)',
      };
    }
    if (minRequired) {
      const letter = percentToLetter(targetPercent);
      const pct = minRequired.requiredPercent.toFixed(0);
      return {
        line1: `I only need a ${pct}%`,
        line2: `to get ${letter !== 'F' ? `an ${letter}` : 'a passing grade'} — not cooked`,
        accent: 'var(--accent)',
      };
    }
    if (anyImpossible) {
      return {
        line1: 'Might be cooked',
        line2: `Target ${percentToLetter(targetPercent)} isn't achievable anymore`,
        accent: 'var(--red)',
      };
    }
  }

  if (grade !== null) {
    return {
      line1: `Sitting at ${grade.toFixed(1)}%`,
      line2: `${percentToLetter(grade)} — Cooked`,
      accent: 'var(--accent)',
    };
  }

  return { line1: 'Check your grade', line2: 'Cooked', accent: 'var(--accent)' };
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

  // Logo
  ctx.fillStyle = '#665E55';
  ctx.font = '600 11px "DM Sans", system-ui, sans-serif';
  ctx.letterSpacing = '0.15em';
  ctx.fillText('COOKED', 28, 42);

  // Main headline
  ctx.fillStyle = message.accent.startsWith('var')
    ? message.accent === 'var(--green)' ? '#4AAB7A'
    : message.accent === 'var(--red)' ? '#D14545'
    : '#C89A2C'
    : message.accent;

  ctx.font = 'bold 36px "Fraunces", Georgia, serif';
  ctx.letterSpacing = '-0.02em';
  ctx.fillText(message.line1, 28, 120);

  // Sub line
  ctx.fillStyle = '#9C9389';
  ctx.font = '400 15px "DM Sans", system-ui, sans-serif';
  ctx.letterSpacing = '0';
  ctx.fillText(message.line2, 28, 152);

  // URL watermark
  ctx.fillStyle = '#665E55';
  ctx.font = '400 11px "DM Sans", system-ui, sans-serif';
  ctx.fillText('amIcooked.app', W - 28 - ctx.measureText('amIcooked.app').width, H - 18);
}

export default function ShareCard({ grade, targetPercent, inverseResults }) {
  const canvasRef = useRef(null);
  const [downloaded, setDownloaded] = useState(false);

  const message = buildMessage(grade, targetPercent, inverseResults);

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
        <div className="ck-card-headline" style={{ color: message.accent.startsWith('var') ? undefined : message.accent }}>
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

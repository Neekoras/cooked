import { useState, useEffect, useMemo } from 'react';
import { letterToPercentWithScheme, percentToLetterWithScheme } from '../math/gradeEngine';

export default function TargetInput({ onChange, gradingScheme }) {
  const [value, setValue] = useState('');
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (value.trim() === '') {
      setParsed(null);
      setError(false);
      onChange(null);
      return;
    }
    try {
      const pct = letterToPercentWithScheme(value, gradingScheme);
      if (pct === null || pct < 0 || pct > 105) {
        setParsed(null);
        setError(true);
        onChange(null);
      } else {
        setParsed(pct);
        setError(false);
        onChange(pct);
      }
    } catch {
      setParsed(null);
      setError(true);
      onChange(null);
    }
  }, [value, gradingScheme]);

  const hint = useMemo(() => {
    if (error) return 'Enter a letter grade (A, B+) or a number 0–105';
    if (parsed !== null) {
      try {
        return `${parsed}% — ${percentToLetterWithScheme(parsed, gradingScheme)}`;
      } catch {
        return `${parsed}%`;
      }
    }
    return 'e.g. B+ or 87';
  }, [parsed, error, gradingScheme]);

  return (
    <div className="ck-target-section">
      <label className="ck-label" htmlFor="ck-target">
        Target grade
      </label>
      <input
        id="ck-target"
        className="ck-input"
        type="text"
        placeholder="A, B+, 87…"
        value={value}
        onChange={e => setValue(e.target.value)}
        style={error ? { borderColor: 'var(--red)' } : undefined}
        autoComplete="off"
        spellCheck={false}
      />
      <p
        className="ck-input-hint"
        style={error ? { color: 'var(--red)' } : undefined}
        aria-live="polite"
      >
        {hint}
      </p>
    </div>
  );
}

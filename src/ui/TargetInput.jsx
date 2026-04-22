import { useState, useEffect } from 'react';
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

  let hint = 'e.g. B+ or 87';
  if (error) {
    hint = 'Enter a letter (A, B+) or a percentage (87)';
  } else if (parsed !== null) {
    try {
      hint = `${parsed}% — ${percentToLetterWithScheme(parsed, gradingScheme)}`;
    } catch {
      hint = `${parsed}%`;
    }
  }

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
      >
        {hint}
      </p>
    </div>
  );
}

import React, { useRef } from 'react';

interface HighlightedJsonTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  readOnly?: boolean;
}

function syntaxHighlightJson(raw: string): React.ReactNode[] {
  if (!raw) return [];
  // Tokenize JSON strings, keys, numbers, booleans, nulls, and template {{variables}}
  const tokenRegex = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?|\{\{[^}]+\}\})/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      elements.push(raw.slice(lastIndex, match.index));
    }
    const token = match[0];
    let cls = 'text-slate-200';
    if (token.startsWith('{{')) {
      cls = 'text-amber-300 font-semibold';
    } else if (token.startsWith('"')) {
      if (token.endsWith(':')) {
        cls = 'text-sky-400';
      } else {
        cls = 'text-emerald-300';
      }
    } else if (/^(true|false)$/.test(token)) {
      cls = 'text-purple-400 font-semibold';
    } else if (token === 'null') {
      cls = 'text-rose-400 italic';
    } else {
      cls = 'text-amber-400';
    }
    elements.push(
      <span key={match.index} className={cls}>
        {token}
      </span>
    );
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < raw.length) {
    elements.push(raw.slice(lastIndex));
  }

  return elements;
}

export const HighlightedJsonTextarea: React.FC<HighlightedJsonTextareaProps> = ({
  value,
  onChange,
  placeholder = '{\n  "key": "value"\n}',
  rows = 12,
  className = '',
  readOnly = false
}) => {
  const preRef = useRef<HTMLPreElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleScroll = () => {
    if (preRef.current && textareaRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  return (
    <div className={`relative w-full bg-slate-950 border border-slate-800 focus-within:border-sky-500 rounded-lg overflow-hidden ${className}`}>
      <pre
        ref={preRef}
        aria-hidden="true"
        className="m-0 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words pointer-events-none overflow-hidden text-slate-300"
        style={{ minHeight: `${rows * 1.5}rem` }}
      >
        {value ? syntaxHighlightJson(value) : <span className="text-slate-600">{placeholder}</span>}
        {value.endsWith('\n') ? ' ' : ''}
      </pre>
      <textarea
        ref={textareaRef}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        rows={rows}
        spellCheck={false}
        className="absolute inset-0 w-full h-full m-0 p-3 font-mono text-xs leading-relaxed bg-transparent text-transparent caret-sky-400 focus:outline-none resize-none selection:bg-sky-500/30"
      />
    </div>
  );
};

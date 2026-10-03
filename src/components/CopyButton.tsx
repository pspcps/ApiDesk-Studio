import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';

interface CopyButtonProps {
  textToCopy: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  iconSize?: string;
  showIconOnly?: boolean;
  title?: string;
  id?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  textToCopy,
  label = 'Copy',
  copiedLabel = 'Copied!',
  className = '',
  iconSize = 'w-3.5 h-3.5',
  showIconOnly = false,
  title = 'Copy to clipboard',
  id
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await copyToClipboard(textToCopy);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      id={id}
      type="button"
      onClick={handleCopy}
      title={title}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
        copied
          ? 'bg-emerald-950/80 border border-emerald-600 text-emerald-300'
          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700'
      } ${className}`}
    >
      {copied ? (
        <Check className={`${iconSize} text-emerald-400`} />
      ) : (
        <Copy className={`${iconSize}`} />
      )}
      {!showIconOnly && <span>{copied ? copiedLabel : label}</span>}
    </button>
  );
};

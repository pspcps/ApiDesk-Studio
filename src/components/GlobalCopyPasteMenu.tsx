import React, { useState, useEffect, useRef } from 'react';
import { Copy, ClipboardPaste, Scissors } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';

export const GlobalCopyPasteMenu: React.FC = () => {
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [targetElement, setTargetElement] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [selectedText, setSelectedText] = useState<string>('');
  const [isEditable, setIsEditable] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;

      const isInput = el instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'file', 'submit'].includes(el.type);
      const isTextarea = el instanceof HTMLTextAreaElement;
      const isCodePre = el.closest('pre') || el.closest('[data-copyable="true"]');

      if (isInput || isTextarea) {
        e.preventDefault();
        const inputEl = el as HTMLInputElement | HTMLTextAreaElement;
        setTargetElement(inputEl);
        const selStart = inputEl.selectionStart ?? 0;
        const selEnd = inputEl.selectionEnd ?? 0;
        const sel = selEnd > selStart ? inputEl.value.substring(selStart, selEnd) : inputEl.value;
        setSelectedText(sel);
        setIsEditable(!inputEl.readOnly && !inputEl.disabled);
        setMenuPos({
          x: Math.min(e.clientX, window.innerWidth - 160),
          y: Math.min(e.clientY, window.innerHeight - 120)
        });
      } else if (isCodePre) {
        const winSel = window.getSelection()?.toString() || '';
        if (winSel.trim()) {
          e.preventDefault();
          setTargetElement(null);
          setSelectedText(winSel);
          setIsEditable(false);
          setMenuPos({
            x: Math.min(e.clientX, window.innerWidth - 160),
            y: Math.min(e.clientY, window.innerHeight - 120)
          });
        }
      } else {
        setMenuPos(null);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuPos(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuPos(null);
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!menuPos) return null;

  const handleCopy = async () => {
    const textToCopy = selectedText || (targetElement ? targetElement.value : '');
    if (textToCopy) {
      await copyToClipboard(textToCopy);
    }
    setMenuPos(null);
  };

  const handleCut = async () => {
    if (!targetElement || !isEditable) return;
    const start = targetElement.selectionStart ?? 0;
    const end = targetElement.selectionEnd ?? 0;
    const val = targetElement.value;
    const cutText = end > start ? val.substring(start, end) : val;
    await copyToClipboard(cutText);

    const newVal = end > start ? val.slice(0, start) + val.slice(end) : '';
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set || Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(targetElement, newVal);
      targetElement.dispatchEvent(new Event('input', { bubbles: true }));
    }
    setMenuPos(null);
  };

  const handlePaste = async () => {
    if (!targetElement || !isEditable) return;
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText !== undefined) {
        const start = targetElement.selectionStart ?? targetElement.value.length;
        const end = targetElement.selectionEnd ?? targetElement.value.length;
        const val = targetElement.value;
        const newVal = val.slice(0, start) + clipText + val.slice(end);

        const proto = targetElement instanceof HTMLTextAreaElement
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(targetElement, newVal);
          targetElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
        targetElement.focus();
      }
    } catch {}
    setMenuPos(null);
  };

  return (
    <div
      ref={menuRef}
      style={{ top: menuPos.y, left: menuPos.x }}
      className="fixed z-[9999] w-36 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 text-xs text-slate-200 select-none"
    >
      <button
        type="button"
        onClick={handleCopy}
        className="w-full px-3 py-1.5 text-left hover:bg-sky-600/20 hover:text-sky-300 flex items-center gap-2 transition"
      >
        <Copy className="w-3.5 h-3.5 text-sky-400" />
        <span>Copy</span>
      </button>

      {isEditable && (
        <>
          <button
            type="button"
            onClick={handleCut}
            className="w-full px-3 py-1.5 text-left hover:bg-sky-600/20 hover:text-sky-300 flex items-center gap-2 transition"
          >
            <Scissors className="w-3.5 h-3.5 text-amber-400" />
            <span>Cut</span>
          </button>
          <button
            type="button"
            onClick={handlePaste}
            className="w-full px-3 py-1.5 text-left hover:bg-sky-600/20 hover:text-sky-300 flex items-center gap-2 transition"
          >
            <ClipboardPaste className="w-3.5 h-3.5 text-emerald-400" />
            <span>Paste</span>
          </button>
        </>
      )}
    </div>
  );
};

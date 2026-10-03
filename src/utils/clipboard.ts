/**
 * Resilient clipboard utility with fallback support for iframe environments,
 * non-HTTPS contexts, and browsers with restricted clipboard permissions.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text && text !== '') return false;

  // 1. Try modern navigator.clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard.writeText failed, attempting document.execCommand fallback:', err);
    }
  }

  // 2. Fallback using temporary textarea element and document.execCommand('copy')
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    // Prevent scrolling to bottom of page
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (fallbackErr) {
    console.error('Fallback clipboard copy failed:', fallbackErr);
    return false;
  }
}

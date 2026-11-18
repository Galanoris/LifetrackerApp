// Brief haptic "tick" on taps.
// - Android / Chrome: navigator.vibrate().
// - iOS Safari (18+, incl. home-screen PWAs) has no vibrate API, but toggling a native
//   <input type="checkbox" switch> via its <label> plays the system switch haptic.

let iosLabel: HTMLLabelElement | null = null;

function iosSwitch(): HTMLLabelElement {
  if (iosLabel) return iosLabel;
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.dataset.haptic = '';
  label.style.cssText =
    'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  return (iosLabel = label);
}

export function tap(): void {
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(10);
    } else {
      iosSwitch().click();
    }
  } catch {
    // Never let feedback break a click.
  }
}

const TARGETS = 'button, [role="button"], input[type="checkbox"]';

export function installHaptics(): void {
  document.addEventListener(
    'click',
    (e) => {
      const t = e.target as Element | null;
      if (!t || !(t instanceof Element) || t.closest('[data-haptic]')) return;
      const el = t.closest(TARGETS);
      if (!el || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return;
      tap();
    },
    { capture: true },
  );
}

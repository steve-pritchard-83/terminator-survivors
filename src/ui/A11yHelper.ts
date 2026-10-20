export interface ModalA11yOptions {
  onClose?: () => void;
  onNavigate?: (dir: { x: number; y: number }) => boolean;
  onConfirm?: () => boolean;
}

export class ModalA11y {
  private previousActiveElement: HTMLElement | null = null;
  private keydownListener?: (e: KeyboardEvent) => void;

  constructor(
    private readonly container: HTMLElement,
    private readonly options: ModalA11yOptions = {}
  ) {
    if (!this.container.hasAttribute('role')) {
      this.container.setAttribute('role', 'dialog');
    }
    this.container.setAttribute('aria-modal', 'true');
  }

  public activate(initialElement?: HTMLElement): void {
    // Re-activation (reroll, banish, tab switch) must not stack a second keydown listener
    // or overwrite the element that had focus before the modal opened.
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = undefined;
    } else {
      this.previousActiveElement = document.activeElement as HTMLElement | null;
    }

    this.keydownListener = (e: KeyboardEvent) => {
      if (this.container.style.display === 'none') return;

      if (e.key === 'Escape') {
        if (this.options.onClose) {
          e.preventDefault();
          e.stopPropagation();
          this.options.onClose();
        }
        return;
      }

      if (e.key === 'Tab') {
        const focusables = this.getFocusables();
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !this.container.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !this.container.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
        return;
      }

      let nx = 0;
      let ny = 0;
      if (e.key === 'ArrowUp') ny = -1;
      else if (e.key === 'ArrowDown') ny = 1;
      else if (e.key === 'ArrowLeft') nx = -1;
      else if (e.key === 'ArrowRight') nx = 1;

      if (nx !== 0 || ny !== 0) {
        if (this.options.onNavigate?.({ x: nx, y: ny })) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      if (e.key === 'Enter' || e.key === ' ') {
        // If an input is focused, let it naturally handle unless confirm handled
        if (document.activeElement instanceof HTMLInputElement && document.activeElement.type !== 'checkbox') {
          return;
        }
        if (this.options.onConfirm?.()) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    window.addEventListener('keydown', this.keydownListener);

    // Set initial focus
    setTimeout(() => {
      const focusables = this.getFocusables();
      const target = initialElement ?? focusables[0];
      if (target) {
        target.focus();
      }
    }, 10);
  }

  public deactivate(): void {
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = undefined;
    }
    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      try {
        this.previousActiveElement.focus();
      } catch {
        // Ignore detached element
      }
      this.previousActiveElement = null;
    }
  }

  public getFocusables(): HTMLElement[] {
    return Array.from(
      this.container.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => {
      return el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0;
    });
  }
}

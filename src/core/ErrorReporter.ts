import { APP_VERSION } from './version';

export interface FaultReport {
  timestamp: string;
  version: string;
  seed: number | null;
  userAgent: string;
  message: string;
  stack?: string;
  formattedText: string;
}

export interface ErrorReporterOptions {
  version?: string;
  getSeed?: () => number | null;
  container?: HTMLElement;
}

export class ErrorReporter {
  private static instance: ErrorReporter | null = null;
  private readonly version: string;
  private getSeed: () => number | null;
  private container: HTMLElement | null = null;
  private overlayEl: HTMLElement | null = null;
  private isInstalled = false;
  private lastReport: FaultReport | null = null;

  constructor(options: ErrorReporterOptions = {}) {
    this.version = options.version ?? APP_VERSION;
    this.getSeed = options.getSeed ?? (() => null);
    this.container = options.container ?? (typeof document !== 'undefined' ? document.body : null);
  }

  public static init(options?: ErrorReporterOptions): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter(options);
      ErrorReporter.instance.installGlobalHandlers();
    }
    return ErrorReporter.instance;
  }

  public setSeedProvider(getSeed: () => number | null): void {
    this.getSeed = getSeed;
  }

  public static getInstance(): ErrorReporter | null {
    return ErrorReporter.instance;
  }

  public installGlobalHandlers(): void {
    if (this.isInstalled || typeof window === 'undefined') return;
    this.isInstalled = true;

    window.addEventListener('error', (event: ErrorEvent) => {
      this.handleError(event.error || event.message);
    });

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      this.handleError(event.reason || 'Unhandled Promise Rejection');
    });
  }

  public generateReport(error: Error | string | unknown): FaultReport {
    const timestamp = new Date().toISOString();
    const seed = this.getSeed();
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';

    let message = 'Unknown runtime error';
    let stack: string | undefined;

    if (error instanceof Error) {
      message = error.message;
      stack = error.stack;
    } else if (typeof error === 'string') {
      message = error;
    } else if (error && typeof (error as any).toString === 'function') {
      message = (error as any).toString();
    }

    const lines = [
      '======================================================',
      '       TERMINATOR SURVIVORS - SYSTEM FAULT REPORT     ',
      '======================================================',
      `Timestamp:   ${timestamp}`,
      `App Version: ${this.version}`,
      `Run Seed:    ${seed !== null ? seed : 'None (Outside active run)'}`,
      `Platform:    ${userAgent}`,
      '------------------------------------------------------',
      `FAULT: ${message}`,
      stack ? `\nSTACK TRACE:\n${stack}` : '',
      '------------------------------------------------------',
      'NOTE: This report is local-only. Zero network telemetry transmitted.',
      '======================================================'
    ];

    const formattedText = lines.filter(Boolean).join('\n');
    const report: FaultReport = {
      timestamp,
      version: this.version,
      seed,
      userAgent,
      message,
      stack,
      formattedText
    };

    this.lastReport = report;
    return report;
  }

  public showFaultOverlay(error: Error | string | unknown): FaultReport {
    const report = this.generateReport(error);

    if (typeof document === 'undefined') return report;

    if (!this.overlayEl) {
      this.overlayEl = document.createElement('div');
      this.overlayEl.id = 'system-fault-overlay';
      this.overlayEl.setAttribute('role', 'alertdialog');
      this.overlayEl.setAttribute('aria-modal', 'true');
      this.overlayEl.setAttribute('aria-labelledby', 'fault-title');
      this.overlayEl.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 999999;
        background: rgba(5, 8, 14, 0.94);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        box-sizing: border-box;
        font-family: 'Share Tech Mono', monospace, monospace;
        color: #ff3344;
      `;

      const target = this.container || document.body;
      target.appendChild(this.overlayEl);
    }

    this.overlayEl.innerHTML = `
      <div style="
        max-width: 680px;
        width: 100%;
        background: #090e18;
        border: 2px solid #ff2233;
        box-shadow: 0 0 35px rgba(255, 34, 51, 0.35);
        border-radius: 4px;
        padding: 28px;
        box-sizing: border-box;
      ">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
          <div style="width:14px; height:14px; background:#ff2233; box-shadow:0 0 10px #ff2233; border-radius:50%; animation: pulse 1s infinite alternate;"></div>
          <h2 id="fault-title" style="margin:0; font-family:'Orbitron', sans-serif; font-size:1.4rem; letter-spacing:2px; color:#ff3344;">
            SYSTEM FAULT // RUNTIME EXCEPTION
          </h2>
        </div>
        <p style="margin:0 0 16px 0; color:#b0c0d0; font-size:0.95rem; line-height:1.4;">
          A critical system error occurred. Tactical telemetry has been captured in the fault report below:
        </p>

        <textarea id="fault-report-text" readonly style="
          width: 100%;
          height: 190px;
          background: #04060a;
          border: 1px solid #441820;
          color: #ff8899;
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.82rem;
          padding: 12px;
          box-sizing: border-box;
          border-radius: 3px;
          resize: none;
          outline: none;
        ">${this.escapeHtml(report.formattedText)}</textarea>

        <div style="display:flex; flex-wrap:wrap; gap:12px; margin-top:20px; justify-content:flex-end;">
          <button id="btn-copy-fault" style="
            background: #ff2233;
            color: #fff;
            border: none;
            padding: 10px 18px;
            font-family: 'Orbitron', sans-serif;
            font-size: 0.88rem;
            letter-spacing: 1px;
            font-weight: 700;
            border-radius: 3px;
            cursor: pointer;
          ">COPY REPORT</button>
          <button id="btn-reload-game" style="
            background: #1c2636;
            color: #70d8ff;
            border: 1px solid #00e5ff;
            padding: 10px 18px;
            font-family: 'Orbitron', sans-serif;
            font-size: 0.88rem;
            letter-spacing: 1px;
            border-radius: 3px;
            cursor: pointer;
          ">RELOAD SYSTEM</button>
          <button id="btn-dismiss-fault" style="
            background: transparent;
            color: #778899;
            border: 1px solid #334455;
            padding: 10px 18px;
            font-family: 'Orbitron', sans-serif;
            font-size: 0.88rem;
            border-radius: 3px;
            cursor: pointer;
          ">DISMISS</button>
        </div>
      </div>
    `;

    this.overlayEl.style.display = 'flex';

    const copyBtn = this.overlayEl.querySelector('#btn-copy-fault') as HTMLButtonElement | null;
    const reloadBtn = this.overlayEl.querySelector('#btn-reload-game') as HTMLButtonElement | null;
    const dismissBtn = this.overlayEl.querySelector('#btn-dismiss-fault') as HTMLButtonElement | null;

    if (copyBtn) {
      copyBtn.onclick = async () => {
        try {
          if (typeof navigator !== 'undefined' && navigator.clipboard) {
            await navigator.clipboard.writeText(report.formattedText);
          }
          copyBtn.innerText = 'REPORT COPIED!';
          setTimeout(() => {
            if (copyBtn) copyBtn.innerText = 'COPY REPORT';
          }, 2500);
        } catch {
          copyBtn.innerText = 'SELECT & CTRL+C';
        }
      };
    }

    if (reloadBtn) {
      reloadBtn.onclick = () => {
        if (typeof window !== 'undefined' && window.location) {
          window.location.reload();
        }
      };
    }

    if (dismissBtn) {
      dismissBtn.onclick = () => {
        this.hideFaultOverlay();
      };
    }

    return report;
  }

  public hideFaultOverlay(): void {
    if (this.overlayEl) {
      this.overlayEl.style.display = 'none';
    }
  }

  public isOverlayVisible(): boolean {
    return Boolean(this.overlayEl && this.overlayEl.style.display !== 'none');
  }

  public getLastReport(): FaultReport | null {
    return this.lastReport;
  }

  private handleError(error: unknown): void {
    try {
      this.showFaultOverlay(error);
    } catch (e) {
      console.error('[ErrorReporter] Critical failure while rendering fault overlay:', e);
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  public dispose(): void {
    if (this.overlayEl && this.overlayEl.parentNode) {
      this.overlayEl.parentNode.removeChild(this.overlayEl);
    }
    this.overlayEl = null;
    this.isInstalled = false;
  }
}

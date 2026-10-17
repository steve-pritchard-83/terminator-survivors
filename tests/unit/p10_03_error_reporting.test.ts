import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorReporter } from '../../src/core/ErrorReporter';

describe('P10-03 Error reporting (opt-in)', () => {
  let reporter: ErrorReporter;
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    reporter = new ErrorReporter({
      version: '1.10.0',
      getSeed: () => 987654321,
      container
    });
  });

  afterEach(() => {
    reporter.dispose();
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('generates a detailed diagnostic report with version, seed, message, and stack', () => {
    const error = new Error('Segmentation fault in neural net CPU');
    const report = reporter.generateReport(error);

    expect(report.version).toBe('1.10.0');
    expect(report.seed).toBe(987654321);
    expect(report.message).toBe('Segmentation fault in neural net CPU');
    expect(report.stack).toBeDefined();

    expect(report.formattedText).toContain('TERMINATOR SURVIVORS - SYSTEM FAULT REPORT');
    expect(report.formattedText).toContain('App Version: 1.10.0');
    expect(report.formattedText).toContain('Run Seed:    987654321');
    expect(report.formattedText).toContain('FAULT: Segmentation fault in neural net CPU');
    expect(report.formattedText).toContain('Zero network telemetry transmitted');
  });

  it('renders a friendly SYSTEM FAULT overlay in the DOM with accessible attributes', () => {
    expect(reporter.isOverlayVisible()).toBe(false);

    reporter.showFaultOverlay(new Error('Out of bounds plasma index'));

    expect(reporter.isOverlayVisible()).toBe(true);
    const overlay = container.querySelector('#system-fault-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay?.getAttribute('role')).toBe('alertdialog');
    expect(overlay?.getAttribute('aria-modal')).toBe('true');

    const textarea = overlay?.querySelector('#fault-report-text') as HTMLTextAreaElement | null;
    expect(textarea).not.toBeNull();
    expect(textarea?.readOnly).toBe(true);
    expect(textarea?.value).toContain('Out of bounds plasma index');
  });

  it('copies fault report to clipboard via COPY REPORT button', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    reporter.showFaultOverlay('HK Aerial laser matrix failure');

    const copyBtn = container.querySelector('#btn-copy-fault') as HTMLButtonElement | null;
    expect(copyBtn).not.toBeNull();

    await copyBtn?.onclick?.(new MouseEvent('click') as any);

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('HK Aerial laser matrix failure'));
  });

  it('hides overlay when DISMISS button is clicked', () => {
    reporter.showFaultOverlay('Transient warning');
    expect(reporter.isOverlayVisible()).toBe(true);

    const dismissBtn = container.querySelector('#btn-dismiss-fault') as HTMLButtonElement | null;
    expect(dismissBtn).not.toBeNull();

    dismissBtn?.onclick?.(new MouseEvent('click') as any);
    expect(reporter.isOverlayVisible()).toBe(false);
  });

  it('handles global window error events without making network calls', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    reporter.installGlobalHandlers();

    // Trigger synthetic error event
    const errorEvent = new ErrorEvent('error', {
      error: new Error('Simulated global uncaught error'),
      message: 'Simulated global uncaught error'
    });
    window.dispatchEvent(errorEvent);

    expect(reporter.isOverlayVisible()).toBe(true);
    const lastReport = reporter.getLastReport();
    expect(lastReport?.message).toBe('Simulated global uncaught error');

    // Asserts zero network telemetry is transmitted
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

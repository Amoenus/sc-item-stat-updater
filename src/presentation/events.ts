import cliProgress from 'cli-progress';
import type { CommandIO } from './cli';

export type CliEvent =
  | { type: 'phase'; message: string }
  | { type: 'progress:start'; id: string; label: string; total: number; value?: number }
  | { type: 'progress:update'; id: string; value: number; label?: string; total?: number }
  | { type: 'progress:stop'; id: string }
  | { type: 'activity:start'; id: string; label: string; detail?: string; unit?: string }
  | { type: 'activity:update'; id: string; detail?: string; count?: number; unit?: string }
  | { type: 'activity:stop'; id: string; detail?: string; count?: number; unit?: string }
  | { type: 'line'; message?: string }
  | { type: 'warning'; message: string }
  | { type: 'error'; message: string }
  | { type: 'summary'; message: string };

export interface CliEventRenderer {
  emit(event: CliEvent): void;
  stopAll(): void;
}

export function createCliEventRenderer(io: CommandIO): CliEventRenderer {
  const bars = new Map<string, cliProgress.SingleBar>();
  const activities = new Map<
    string,
    {
      label: string;
      detail?: string;
      count?: number;
      unit?: string;
      frameIndex: number;
      timer?: NodeJS.Timeout;
    }
  >();
  const spinnerFrames = ['-', '\\', '|', '/'];

  function write(message = ''): void {
    io.stdout.write(`${message}\n`);
  }

  function writeError(message = ''): void {
    io.stderr.write(`${message}\n`);
  }

  function activityDetail(activity: { detail?: string; count?: number; unit?: string }): string {
    if (activity.detail) return activity.detail;
    if (activity.count !== undefined) {
      const unit = activity.unit ? ` ${activity.unit}` : '';
      return `${activity.count.toLocaleString()}${unit}`;
    }
    return 'working...';
  }

  function renderActivity(id: string): void {
    const activity = activities.get(id);
    if (!activity || !io.stdout.isTTY) return;
    const frame = spinnerFrames[activity.frameIndex % spinnerFrames.length];
    activity.frameIndex++;
    io.stdout.write(`\r${activity.label} ${frame} ${activityDetail(activity)}`);
  }

  function stopActivity(id: string, event?: { detail?: string; count?: number; unit?: string }): void {
    const activity = activities.get(id);
    if (!activity) return;
    if (activity.timer) clearInterval(activity.timer);
    activities.delete(id);
    const finalDetail = activityDetail({ ...activity, ...event });
    if (io.stdout.isTTY) {
      io.stdout.write(`\r${activity.label} OK ${finalDetail}\n`);
    } else {
      write(`${activity.label}: ${finalDetail}`);
    }
  }

  return {
    emit(event) {
      switch (event.type) {
        case 'phase':
          write(event.message);
          return;
        case 'line':
          write(event.message ?? '');
          return;
        case 'warning':
          write(`WARNING: ${event.message}`);
          return;
        case 'error':
          writeError(event.message);
          return;
        case 'summary':
          write(event.message);
          return;
        case 'progress:start': {
          const bar = new cliProgress.SingleBar({
            format: `${event.label} {bar} {percentage}% | {value}/{total} | {detail}`,
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true,
          });
          bars.set(event.id, bar);
          bar.start(event.total, event.value ?? 0, { detail: '' });
          return;
        }
        case 'progress:update': {
          const bar = bars.get(event.id);
          if (!bar) return;
          if (event.total !== undefined) {
            bar.setTotal(event.total);
          }
          bar.update(event.value, { detail: event.label ?? '' });
          return;
        }
        case 'progress:stop': {
          const bar = bars.get(event.id);
          if (!bar) return;
          bar.stop();
          bars.delete(event.id);
          return;
        }
        case 'activity:start': {
          stopActivity(event.id);
          const activity: {
            label: string;
            detail?: string;
            unit?: string;
            frameIndex: number;
            timer?: NodeJS.Timeout;
          } = {
            label: event.label,
            detail: event.detail,
            unit: event.unit,
            frameIndex: 0,
          };
          activities.set(event.id, activity);
          if (io.stdout.isTTY) {
            renderActivity(event.id);
            activity.timer = setInterval(() => renderActivity(event.id), 120);
          } else {
            write(`${event.label}: ${activityDetail(event)}`);
          }
          return;
        }
        case 'activity:update': {
          const activity = activities.get(event.id);
          if (!activity) return;
          activity.detail = event.detail ?? activity.detail;
          activity.count = event.count ?? activity.count;
          activity.unit = event.unit ?? activity.unit;
          renderActivity(event.id);
          return;
        }
        case 'activity:stop':
          stopActivity(event.id, event);
          return;
      }
    },
    stopAll() {
      for (const bar of bars.values()) {
        bar.stop();
      }
      bars.clear();
      for (const id of [...activities.keys()]) {
        stopActivity(id);
      }
    },
  };
}

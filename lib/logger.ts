import { captureLog, LogLevel } from '@/app/actions/logActions';

export const Logger = {
  info: (source: string, message: string, metadata?: any) => {
    // We intentionally don't await this to avoid blocking the main thread
    captureLog('info', source, message, metadata).catch(console.error);
  },
  warn: (source: string, message: string, metadata?: any) => {
    captureLog('warning', source, message, metadata).catch(console.error);
  },
  error: (source: string, message: string, metadata?: any) => {
    captureLog('error', source, message, metadata).catch(console.error);
  },
  critical: (source: string, message: string, metadata?: any) => {
    captureLog('critical', source, message, metadata).catch(console.error);
  }
};

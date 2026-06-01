'use client';

import { useEffect } from 'react';
import { submitBugReport, captureLog } from '@/app/actions/logActions';

export default function ClientErrorCatcher() {
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      captureLog('error', 'client:window.onerror', event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        url: window.location.href,
        userAgent: navigator.userAgent
      }).catch(() => {});
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      let message = 'Unhandled Promise Rejection';
      if (event.reason instanceof Error) {
        message = event.reason.message;
      } else if (typeof event.reason === 'string') {
        message = event.reason;
      }
      
      captureLog('error', 'client:unhandledrejection', message, {
        reason: event.reason instanceof Error ? event.reason.stack : event.reason,
        url: window.location.href,
        userAgent: navigator.userAgent
      }).catch(() => {});
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}

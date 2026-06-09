'use client';

import { useEffect } from 'react';
import { submitBugReport, captureLog } from '@/app/actions/logActions';
import toast from 'react-hot-toast';

export default function ClientErrorCatcher() {
  useEffect(() => {
    // 1. Window Errors
    const handleGlobalError = (event: ErrorEvent) => {
      toast.error(`JS Error: ${event.message}`, { duration: 8000, id: 'global-error' });
      captureLog('error', 'client:window.onerror', event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        url: window.location.href,
        userAgent: navigator.userAgent
      }).catch(() => {});
    };

    // 2. Promise Rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      let message = 'Unhandled Promise Rejection';
      if (event.reason instanceof Error) {
        message = event.reason.message;
      } else if (typeof event.reason === 'string') {
        message = event.reason;
      }
      
      toast.error(`Promise Error: ${message}`, { duration: 8000, id: 'promise-error' });
      captureLog('error', 'client:unhandledrejection', message, {
        reason: event.reason instanceof Error ? event.reason.stack : event.reason,
        url: window.location.href,
        userAgent: navigator.userAgent
      }).catch(() => {});
    };

    // 3. Intercept console.error to catch silent SDK failures (like TonConnect)
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      // Call original first
      originalConsoleError.apply(console, args);
      
      // Extract message
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      
      // Avoid spamming too many toasts for known harmless errors, but log others
      if (!msg.includes('Warning: React') && !msg.includes('Hydration')) {
        toast.error(`Console Error: ${msg.substring(0, 100)}`, { duration: 6000 });
      }
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      console.error = originalConsoleError;
    };
  }, []);

  return null;
}

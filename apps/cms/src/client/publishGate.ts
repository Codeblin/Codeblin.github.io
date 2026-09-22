import { useCallback, useEffect, useRef, useState } from 'react';

const PUBLISH_DEBOUNCE_MS = 1000;

/**
 * Coalesce rapid publish/unpublish. Git mutations are serialized on the
 * server; this stops the client from firing a second commit while the first
 * is in flight or still queued.
 */
export function usePublishGate(): {
  busy: boolean;
  schedulePublish: (run: () => Promise<void>) => void;
  runUnpublish: (run: () => Promise<void>) => void;
} {
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const timer = useRef(0);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );

  const schedulePublish = useCallback((run: () => Promise<void>): void => {
    if (inFlight.current) return;
    window.clearTimeout(timer.current);
    setBusy(true);
    timer.current = window.setTimeout(() => {
      inFlight.current = true;
      void run()
        .catch(() => undefined)
        .finally(() => {
          inFlight.current = false;
          setBusy(false);
        });
    }, PUBLISH_DEBOUNCE_MS);
  }, []);

  const runUnpublish = useCallback((run: () => Promise<void>): void => {
    if (inFlight.current) return;
    window.clearTimeout(timer.current);
    inFlight.current = true;
    setBusy(true);
    void run()
      .catch(() => undefined)
      .finally(() => {
        inFlight.current = false;
        setBusy(false);
      });
  }, []);

  return { busy, schedulePublish, runUnpublish };
}

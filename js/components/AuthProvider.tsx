"use client";
import { SessionProvider, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Modal from "@/components/Modal";

const IDLE_TIMEOUT_MS = (() => {
  const mins = Number(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES ?? 15);
  const safe = Number.isFinite(mins) && mins > 0 ? mins : 15;
  return safe * 60_000;
})();

const WARNING_SECONDS = (() => {
  const secs = Number(process.env.NEXT_PUBLIC_IDLE_WARNING_SECONDS ?? 30);
  const safe = Number.isFinite(secs) && secs > 0 ? secs : 30;
  return safe;
})();

function IdleWarning({ onStayLoggedIn, secondsLeft }: { onStayLoggedIn: () => void; secondsLeft: number }) {
  return (
    <Modal open onClose={onStayLoggedIn} panelClassName="modal-panel-narrow">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Sitzung läuft ab</h2>
        <p className="text-gray-700">
          Keine Aktivität erkannt. Du wirst automatisch abgemeldet in{" "}
          <span className="font-semibold text-red-600">{secondsLeft}s</span>.
        </p>
        <div className="flex justify-end">
          <button className="btn btn-primary" type="button" onClick={onStayLoggedIn}>
            Eingeloggt bleiben
          </button>
        </div>
      </div>
    </Modal>
  );
}

function IdleManager({ children }: { children: ReactNode }) {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(WARNING_SECONDS);
  const logoutOnce = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resetRef = useRef<() => void>(() => {});

  useEffect(() => {
    const warningMs = Math.max(1_000, WARNING_SECONDS * 1000);
    const idleDelay = Math.max(0, IDLE_TIMEOUT_MS - warningMs);

    const clearAllTimers = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      idleTimer.current = null;
      countdownTimer.current = null;
    };

    const doLogout = () => {
      if (logoutOnce.current) return;
      logoutOnce.current = true;
      setShowWarning(false);
      void signOut({ callbackUrl: "/" });
    };

    const startWarning = () => {
      setShowWarning(true);
      setCountdown(WARNING_SECONDS);
      const endAt = Date.now() + warningMs;
      countdownTimer.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
        setCountdown(remaining);
        if (remaining <= 0) {
          clearAllTimers();
          doLogout();
        }
      }, 500);
    };

    const scheduleIdle = () => {
      clearAllTimers();
      setShowWarning(false);
      setCountdown(WARNING_SECONDS);
      logoutOnce.current = false;
      idleTimer.current = setTimeout(startWarning, idleDelay);
    };

    const activity = () => {
      if (logoutOnce.current) return;
      scheduleIdle();
    };

    resetRef.current = activity;
    const events: (keyof DocumentEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "visibilitychange",
    ];
    events.forEach((evt) => window.addEventListener(evt, activity, { passive: true }));
    scheduleIdle();

    return () => {
      clearAllTimers();
      events.forEach((evt) => window.removeEventListener(evt, activity));
    };
  }, []);

  const handleStayLoggedIn = () => {
    setShowWarning(false);
    setCountdown(WARNING_SECONDS);
    resetRef.current();
  };

  return (
    <>
      {children}
      {showWarning && <IdleWarning onStayLoggedIn={handleStayLoggedIn} secondsLeft={countdown} />}
    </>
  );
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <IdleManager>{children}</IdleManager>
    </SessionProvider>
  );
}

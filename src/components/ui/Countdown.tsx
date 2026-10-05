import { useEffect, useRef, useState } from "react";

interface CountdownProps {
  /** Date cible (Date, chaîne ISO/datetime-local ou timestamp) */
  targetDate: Date | string | number;
  /** Appelé une seule fois quand la date est atteinte */
  onExpire?: () => void;
}

interface TimeLeft {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Calcule le temps restant jusqu'à la date cible. */
function getTimeLeft(targetDate: Date | string | number): TimeLeft {
  const diff = new Date(targetDate).getTime() - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) {
    return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  return {
    total: diff,
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

/**
 * Compte à rebours (J h m s) mis à jour chaque seconde.
 * Le calcul démarre après le montage pour éviter un décalage entre
 * le rendu serveur et le navigateur.
 */
export default function Countdown({ targetDate, onExpire }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  // Référence vers le dernier callback, pour ne pas relancer l'intervalle
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    const tick = () => {
      const left = getTimeLeft(targetDate);
      setTimeLeft(left);
      if (left.total <= 0) {
        if (!firedRef.current) {
          firedRef.current = true;
          onExpireRef.current?.();
        }
        return true;
      }
      return false;
    };
    if (tick()) return;
    const timer = setInterval(() => {
      if (tick()) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  // Avant le montage : placeholder discret
  if (!timeLeft) return <span className="font-mono text-sm text-muted-foreground">…</span>;

  if (timeLeft.total <= 0) {
    return <span className="text-muted-foreground">Expiré</span>;
  }

  const parts: string[] = [];
  if (timeLeft.days > 0) parts.push(`${timeLeft.days}j`);
  if (timeLeft.days > 0 || timeLeft.hours > 0) parts.push(`${timeLeft.hours}h`);
  parts.push(`${timeLeft.minutes}m`, `${timeLeft.seconds}s`);

  return <span className="font-mono text-sm tabular-nums">{parts.join(" ")}</span>;
}

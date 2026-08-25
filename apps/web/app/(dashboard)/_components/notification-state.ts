export interface ShellNotification {
  body?: string | null;
  category?: string;
  channel?: string;
  created_at: string;
  entity_id?: string | null;
  entity_type?: string | null;
  href?: string | null;
  id: string;
  priority?: string;
  read_at?: string | null;
  title: string;
  type: string;
}

interface NotificationAudioContext {
  close?(): Promise<void>;
  createGain(): GainNode;
  createOscillator(): OscillatorNode;
  currentTime: number;
  destination: AudioNode;
  resume?(): Promise<void>;
  state: string;
}

interface NotificationAudioScope {
  AudioContext?: new () => NotificationAudioContext;
  webkitAudioContext?: new () => NotificationAudioContext;
}

export function playIncomingMessageSound(
  scope: NotificationAudioScope = typeof window === "undefined" ? {} : window as unknown as NotificationAudioScope,
): boolean {
  const AudioContextConstructor = scope.AudioContext ?? scope.webkitAudioContext;
  if (!AudioContextConstructor) return false;

  try {
    const context = new AudioContextConstructor();
    const scheduleChime = () => {
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(660, now);
      oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.onended = () => { void context.close?.(); };
      oscillator.start(now);
      oscillator.stop(now + 0.38);
    };

    if (context.state === "suspended" && context.resume) {
      void context.resume().then(scheduleChime).catch(() => { void context.close?.(); });
    } else {
      scheduleChime();
    }
    return true;
  } catch {
    return false;
  }
}

export function applyNotificationSnapshot(
  current: ShellNotification[],
  incoming: ShellNotification[],
  initialized: boolean,
) {
  const known = new Set(current.map((item) => item.id));
  return {
    items: incoming,
    previews: initialized ? incoming.filter((item) => !item.read_at && !known.has(item.id)) : [],
    unreadCount: incoming.reduce((total, item) => total + (item.read_at ? 0 : 1), 0),
  };
}

export function markNotificationRead(
  items: ShellNotification[],
  notificationId: string,
  readAt = new Date().toISOString(),
): ShellNotification[] {
  return items.map((item) => item.id === notificationId ? { ...item, read_at: readAt } : item);
}

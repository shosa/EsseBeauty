function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index += 1) outputArray[index] = rawData.charCodeAt(index);
  return outputArray;
}

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error: unknown) => { clearTimeout(timer); reject(error); });
  });
}

export async function subscribeToPush(apiBase: string, slug: string, vapidPublicKey: string): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  // iOS Safari can leave pushManager.subscribe() hanging forever instead of
  // rejecting when the service worker isn't fully ready to accept it yet — a
  // timeout turns that into a visible error instead of a silently stuck button.
  const registration = await withTimeout(navigator.serviceWorker.ready, 10_000, "service worker");
  const subscription = await withTimeout(registration.pushManager.subscribe({
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    userVisibleOnly: true,
  }), 10_000, "push subscription");
  const json = subscription.toJSON();
  const response = await fetch(`${apiBase}/api/public/${slug}/push-subscriptions`, {
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    credentials: "include",
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    // Don't leave a browser-side subscription the server never saved — it would report
    // as "subscribed" locally while silently never receiving anything.
    await subscription.unsubscribe();
    throw new Error(`Failed to save push subscription: HTTP ${response.status}`);
  }
  return subscription;
}

export async function unsubscribeFromPush(apiBase: string, slug: string): Promise<void> {
  const subscription = await getExistingPushSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await fetch(`${apiBase}/api/public/${slug}/push-subscriptions`, {
    body: JSON.stringify({ endpoint }),
    credentials: "include",
    headers: { "content-type": "application/json" },
    method: "DELETE",
  });
}

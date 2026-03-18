import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const ONESIGNAL_SDK_SRC = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";

type BrowserPermission = NotificationPermission | "unsupported";

declare global {
  interface Window {
    OneSignal?: unknown;
    OneSignalDeferred?: Array<(oneSignal: any) => void>;
    __naariOneSignalScriptPromise?: Promise<void>;
    __naariOneSignalInitPromise?: Promise<any>;
  }
}

const runWithOneSignal = <T,>(callback: (oneSignal: any) => Promise<T> | T) => {
  window.OneSignalDeferred = window.OneSignalDeferred || [];

  return new Promise<T>((resolve, reject) => {
    window.OneSignalDeferred?.push(async (oneSignal) => {
      try {
        resolve(await callback(oneSignal));
      } catch (error) {
        reject(error);
      }
    });
  });
};

const loadOneSignalScript = async () => {
  if (typeof window === "undefined") return;
  if (window.__naariOneSignalScriptPromise) return window.__naariOneSignalScriptPromise;

  window.__naariOneSignalScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${ONESIGNAL_SDK_SRC}"]`);
    if (existingScript) {
      if ((existingScript as HTMLScriptElement).dataset.loaded === "true") {
        resolve();
        return;
      }
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load OneSignal SDK")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = ONESIGNAL_SDK_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error("Failed to load OneSignal SDK")), { once: true });
    document.head.appendChild(script);
  });

  return window.__naariOneSignalScriptPromise;
};

const getOneSignalConfig = async () => {
  const { data, error } = await supabase.functions.invoke("notification-config", {
    body: {},
  });

  if (error) {
    throw error;
  }

  if (!data?.appId) {
    throw new Error("Missing OneSignal app id");
  }

  return data as { appId: string };
};

const initOneSignal = async () => {
  if (typeof window === "undefined") return null;
  if (window.__naariOneSignalInitPromise) return window.__naariOneSignalInitPromise;

  window.__naariOneSignalInitPromise = (async () => {
    await loadOneSignalScript();
    const { appId } = await getOneSignalConfig();

    return runWithOneSignal(async (oneSignal) => {
      await oneSignal.init({
        appId,
        allowLocalhostAsSecureOrigin: true,
        serviceWorkerPath: "OneSignalSDKWorker.js",
        serviceWorkerUpdaterPath: "OneSignalSDKUpdaterWorker.js",
        notifyButton: { enable: false },
        autoResubscribe: true,
        promptOptions: {
          slidedown: {
            prompts: [
              {
                type: "push",
                autoPrompt: false,
                text: {
                  actionMessage: "Turn on NaariCare reminders for friendly cycle updates?",
                  acceptButton: "Allow",
                  cancelButton: "Later",
                },
              },
            ],
          },
        },
      });

      return oneSignal;
    });
  })();

  return window.__naariOneSignalInitPromise;
};

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<BrowserPermission>(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const [initializing, setInitializing] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      setSubscribed(false);
      return;
    }

    setPermission(Notification.permission);

    try {
      const oneSignal = await initOneSignal();
      if (!oneSignal) return;
      setSubscribed(Boolean(oneSignal.User?.PushSubscription?.optedIn));
    } catch (error) {
      console.error("Unable to refresh push status:", error);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const syncUser = async () => {
      if (!user?.id) {
        setSubscribed(false);
        return;
      }

      try {
        setInitializing(true);
        const oneSignal = await initOneSignal();
        if (!oneSignal || !active) return;
        await oneSignal.login(user.id);
        setSubscribed(Boolean(oneSignal.User?.PushSubscription?.optedIn));
      } catch (error) {
        console.error("Unable to initialize push notifications:", error);
      } finally {
        if (active) setInitializing(false);
      }
    };

    syncUser();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const requestPermission = useCallback(async () => {
    if (!user?.id) {
      throw new Error("You need to be signed in to enable notifications.");
    }

    setInitializing(true);
    try {
      const oneSignal = await initOneSignal();
      if (!oneSignal) return false;
      await oneSignal.login(user.id);
      await oneSignal.Notifications.requestPermission();
      await oneSignal.login(user.id);
      setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
      const optedIn = Boolean(oneSignal.User?.PushSubscription?.optedIn);
      setSubscribed(optedIn);
      return optedIn;
    } finally {
      setInitializing(false);
    }
  }, [user?.id]);

  return {
    permission,
    initializing,
    subscribed,
    ready: permission !== "unsupported",
    requestPermission,
    refreshStatus,
    statusLabel: useMemo(() => {
      if (permission === "unsupported") return "Push not supported";
      if (permission === "granted" && subscribed) return "Notifications enabled";
      if (permission === "denied") return "Permission blocked";
      return "Permission needed";
    }, [permission, subscribed]),
  };
};

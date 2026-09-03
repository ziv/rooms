"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/** Registers the minimal service worker and shows an offline banner. */
export function Pwa() {
  const t = useTranslations("app");
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div role="status" className="fixed bottom-0 inset-x-0 z-50 bg-destructive text-white text-center text-sm py-2">
      {t("offline")}
    </div>
  );
}

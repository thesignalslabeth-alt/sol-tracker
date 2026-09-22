"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CheckCircle2Icon, DownloadIcon, MonitorIcon, SmartphoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Platform = "ios" | "android" | "desktop";

const GUIDES: { id: Platform; title: string; icon: typeof SmartphoneIcon; steps: string[] }[] = [
  {
    id: "ios",
    title: "iPhone & iPad",
    icon: SmartphoneIcon,
    steps: [
      "Open this site in Safari.",
      "Tap the Share button (on newer iOS, tap ••• first, then Share).",
      "Scroll down and tap Add to Home Screen.",
      "Tap Add. Trade Tracker now opens full screen from its icon.",
    ],
  },
  {
    id: "android",
    title: "Android",
    icon: SmartphoneIcon,
    steps: [
      "Open this site in Chrome.",
      "Tap the ⋮ menu at the top right.",
      "Tap Add to Home screen (or Install app).",
      "Tap Install or Add to confirm.",
    ],
  },
  {
    id: "desktop",
    title: "Computer",
    icon: MonitorIcon,
    steps: [
      "Open this site in Chrome or Edge.",
      "Click the install icon at the right end of the address bar.",
      "Click Install. It opens in its own window like an app.",
    ],
  },
];

// Chrome/Edge fire this when the page is installable; not part of the standard DOM types.
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support gives it away.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

const subscribeNoop = () => () => {};

export function InstallGuide() {
  // null during server render; the detected platform after hydration.
  const platform = useSyncExternalStore(subscribeNoop, detectPlatform, () => null);
  const installed = useSyncExternalStore(
    subscribeNoop,
    () => window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && navigator.standalone === true),
    () => false,
  );
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // show our own button instead of the browser's mini-bar
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  // Visitor's own platform first.
  const guides = platform ? [...GUIDES].sort((a, b) => Number(b.id === platform) - Number(a.id === platform)) : GUIDES;

  return (
    <div className="space-y-4">
      {installed ? (
        <p className="flex items-center gap-2 rounded-lg border border-gain/40 bg-gain/10 p-3 text-sm">
          <CheckCircle2Icon className="size-4 shrink-0 text-gain" aria-hidden />
          You&apos;re already using Trade Tracker from your home screen.
        </p>
      ) : (
        installEvent && (
          <Button className="h-12 w-full text-base sm:w-auto sm:px-6" onClick={install}>
            <DownloadIcon /> Install Trade Tracker
          </Button>
        )
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {guides.map((g) => {
          const mine = g.id === platform;
          return (
            <Card key={g.id} className={cn("gap-0 py-4", mine && "ring-2 ring-primary")}>
              <CardContent className="space-y-3 px-4">
                <div className="flex items-center gap-2">
                  <g.icon className="size-5 text-primary" aria-hidden />
                  <h3 className="font-medium">{g.title}</h3>
                  {mine && (
                    <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                      This device
                    </span>
                  )}
                </div>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  {g.steps.map((step, i) => (
                    <li key={step} className="flex gap-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

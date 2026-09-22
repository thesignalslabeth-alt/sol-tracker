"use client";

import { useState, useSyncExternalStore } from "react";
import { CheckIcon, CopyIcon, RefreshCwIcon, Share2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";

const subscribeNoop = () => () => {};

/** Lets a blocked user send their ID to the owner in one step. */
export function AccessRequest({ userId }: { userId: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = useSyncExternalStore(subscribeNoop, () => typeof navigator.share === "function", () => false);
  const message = `Hi! Please add me to Trade Tracker. My user ID is ${userId}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(userId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (e.g. insecure context): the ID stays visible to select by hand.
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: "Trade Tracker access", text: message });
    } catch {
      // User cancelled the share sheet.
    }
  };

  return (
    <div className="space-y-4">
      <code className="block rounded-md bg-muted p-3 font-mono text-sm break-all text-foreground select-all">
        {userId}
      </code>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button className="h-11" onClick={copy}>
          {copied ? <CheckIcon /> : <CopyIcon />} {copied ? "Copied" : "Copy ID"}
        </Button>
        {canShare && (
          <Button variant="outline" className="h-11" onClick={share}>
            <Share2Icon /> Send to owner
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Once you&apos;ve been added, come back and refresh. Your tracker opens straight away, empty and private to you.
      </p>
      <Button variant="ghost" className="h-10 w-full" onClick={() => window.location.reload()}>
        <RefreshCwIcon /> I&apos;ve been added, refresh
      </Button>
    </div>
  );
}

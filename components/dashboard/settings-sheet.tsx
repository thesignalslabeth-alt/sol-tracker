"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveSettings } from "@/app/actions";
import { Segmented } from "@/components/trade-form/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import { MAX_THRESHOLD, MIN_THRESHOLD, type Prefs } from "@/lib/prefs";

export function SettingsSheet({
  open,
  onOpenChange,
  prefs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefs: Prefs;
}) {
  const [insights, setInsights] = useState(prefs.insights);
  const [threshold, setThreshold] = useState(String(prefs.capitalThreshold));
  const [pending, startTransition] = useTransition();

  const parsed = Number(threshold);
  const valid = Number.isFinite(parsed) && parsed >= MIN_THRESHOLD && parsed <= MAX_THRESHOLD;

  const save = () => {
    if (!valid) return;
    startTransition(async () => {
      const r = await saveSettings({ insights, capitalThreshold: parsed });
      if (r.ok) {
        onOpenChange(false);
        toast.success("Settings saved");
      } else {
        toast.error(r.error);
      }
    });
  };

  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title="Settings">
      <div className="space-y-6 pb-4">
        <div className="space-y-2">
          <Label>Insights panel</Label>
          <Segmented
            label="Insights panel"
            value={insights ? "on" : "off"}
            onChange={(v) => setInsights(v === "on")}
            options={[
              { value: "off", label: "Off" },
              { value: "on", label: "On" },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            Off by default. When on, the dashboard shows plain observations worked out from your own trades.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="threshold">Capital preservation line</Label>
          <div className="flex items-center gap-2">
            <Input
              id="threshold"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={MIN_THRESHOLD}
              max={MAX_THRESHOLD}
              className="h-11 w-24 text-base"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
            <span className="text-sm text-muted-foreground">× the cost still in a holding</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Your own line. When a coin is worth this multiple of the money still in it, the panel says so and works
            out how much of it would sell at today&apos;s price to take your original stake back out. It never tells
            you to sell — that&apos;s your call. Between {MIN_THRESHOLD} and {MAX_THRESHOLD}; 2 is the default.
          </p>
          {!valid && (
            <p className="text-xs text-loss">
              Enter a number between {MIN_THRESHOLD} and {MAX_THRESHOLD}.
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="h-11 flex-1" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button className="h-11 flex-1" onClick={save} disabled={pending || !valid}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </ResponsiveSheet>
  );
}

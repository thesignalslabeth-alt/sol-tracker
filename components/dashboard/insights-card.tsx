"use client";

import { useTransition } from "react";
import { EyeOffIcon, LightbulbIcon, PiggyBankIcon } from "lucide-react";
import { setInsightsEnabled } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CAPITAL_PRESERVATION, type Insight } from "@/lib/insights";

const TONE = {
  gain: "text-gain",
  loss: "text-loss",
  neutral: "text-foreground",
} as const;

/** Only rendered when the user has turned insights on. */
export function InsightsCard({ insights }: { insights: Insight[] }) {
  const [pending, startTransition] = useTransition();
  const callouts = insights.filter((i) => i.highlight);
  const rest = insights.filter((i) => !i.highlight);

  return (
    <div className="space-y-4">
      {/* Positions past 2x lead, above everything else on the dashboard. */}
      {callouts.length > 0 && (
        <Card className="border-gain/50 bg-gain/5">
          <CardContent className="space-y-3 px-4 py-4 md:px-6">
            <div className="flex items-center gap-2">
              <PiggyBankIcon className="size-5 shrink-0 text-gain" aria-hidden />
              <h2 className="font-semibold">Capital preservation</h2>
            </div>
            <ul className="space-y-3">
              {callouts.map((i) => (
                <li key={i.id}>
                  <p className="text-base font-semibold text-gain">{i.title}</p>
                  <p className="text-sm text-foreground">{i.detail}</p>
                </li>
              ))}
            </ul>
            <p className="border-t border-gain/20 pt-3 text-sm text-muted-foreground">{CAPITAL_PRESERVATION}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-2">
            <LightbulbIcon className="size-5 text-primary" aria-hidden />
            <h2 className="font-semibold">Insights</h2>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-8 text-muted-foreground"
              disabled={pending}
              onClick={() => startTransition(() => void setInsightsEnabled(false))}
            >
              <EyeOffIcon /> Hide
            </Button>
          </div>

          {rest.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing else to point out yet. Log a few trades and this fills in.
            </p>
          ) : (
            <ul className="space-y-3">
              {rest.map((i) => (
                <li key={i.id} className="border-l-2 border-muted pl-3">
                  <p className={`text-sm font-medium ${TONE[i.tone]}`}>{i.title}</p>
                  <p className="text-sm text-muted-foreground">{i.detail}</p>
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs text-muted-foreground">
            Figures worked out from your own trades and today&apos;s prices. Not financial advice, and never a
            suggestion to buy or sell.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

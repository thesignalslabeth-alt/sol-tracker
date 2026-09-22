"use client";

import { cn } from "@/lib/utils";

type Option<T extends string> = { value: T; label: string; activeClass?: string };

/** Two-to-three option toggle with full-size tap targets. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Option<T>[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-10 rounded-md text-sm font-medium transition-colors",
              active ? (o.activeClass ?? "bg-background text-foreground shadow-sm") : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

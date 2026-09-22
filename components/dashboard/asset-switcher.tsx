import Link from "next/link";
import { cn } from "@/lib/utils";

/** Horizontally scrollable chips: All + each asset the user has traded. */
export function AssetSwitcher({ assets, selected }: { assets: string[]; selected: string }) {
  const items = ["ALL", ...assets];
  return (
    <nav aria-label="Assets" className="border-b bg-background">
      <ul className="mx-auto flex w-full max-w-6xl gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] md:px-6">
        {items.map((a) => {
          const active = a === selected;
          return (
            <li key={a} className="shrink-0">
              <Link
                href={a === "ALL" ? "/?asset=all" : `/?asset=${a}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors",
                  active ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {a === "ALL" ? "All" : a}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

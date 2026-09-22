"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CheckIcon, SearchIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fmtPrice } from "@/lib/format";

// Binance's ticker has symbols only; names for the most-traded coins make
// "bitcoin" or "solana" searchable too.
const NAMES: Record<string, string> = {
  BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", BNB: "BNB", XRP: "XRP", DOGE: "Dogecoin",
  ADA: "Cardano", TRX: "TRON", AVAX: "Avalanche", LINK: "Chainlink", DOT: "Polkadot", TON: "Toncoin",
  SUI: "Sui", LTC: "Litecoin", BCH: "Bitcoin Cash", NEAR: "NEAR Protocol", APT: "Aptos", UNI: "Uniswap",
  PEPE: "Pepe", SHIB: "Shiba Inu", ICP: "Internet Computer", ETC: "Ethereum Classic", HBAR: "Hedera",
  ARB: "Arbitrum", OP: "Optimism", ATOM: "Cosmos", FIL: "Filecoin", INJ: "Injective", SEI: "Sei",
  TIA: "Celestia", JUP: "Jupiter", WIF: "dogwifhat", BONK: "Bonk", RENDER: "Render", FET: "Fetch.ai",
  AAVE: "Aave", MKR: "Maker", POL: "Polygon", XLM: "Stellar", ALGO: "Algorand", VET: "VeChain",
  TAO: "Bittensor", ENA: "Ethena", ONDO: "Ondo", PYTH: "Pyth Network", JTO: "Jito", RAY: "Raydium",
  TRUMP: "Official Trump", WLD: "Worldcoin", STX: "Stacks", IMX: "Immutable", GRT: "The Graph",
};
const POPULAR = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "SUI", "LINK", "AVAX"];
const MAX_RESULTS = 50;

type Option = { symbol: string; name?: string; group: "Your assets" | "Popular" | "Results" };

export function AssetPicker({
  value,
  onChange,
  knownAssets,
  heldAssets,
  prices,
  invalid,
}: {
  value: string;
  onChange: (symbol: string) => void;
  knownAssets: string[];
  heldAssets: string[];
  prices: Record<string, number>;
  invalid?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const known = useMemo(() => new Set(knownAssets), [knownAssets]);

  const options = useMemo<Option[]>(() => {
    const q = query.trim().toUpperCase();
    if (!q) {
      const held = heldAssets.filter((s) => known.has(s) || known.size === 0);
      return [
        ...held.map((symbol) => ({ symbol, name: NAMES[symbol], group: "Your assets" as const })),
        ...POPULAR.filter((s) => !held.includes(s) && (known.has(s) || known.size === 0)).map((symbol) => ({
          symbol,
          name: NAMES[symbol],
          group: "Popular" as const,
        })),
      ];
    }
    // Rank: exact symbol, symbol prefix, name prefix, symbol contains, name contains.
    const score = (s: string) => {
      const name = (NAMES[s] ?? "").toUpperCase();
      if (s === q) return 0;
      if (s.startsWith(q)) return 1;
      if (name.startsWith(q)) return 2;
      if (s.includes(q)) return 3;
      if (name.includes(q)) return 4;
      return -1;
    };
    return knownAssets
      .map((s) => ({ s, rank: score(s) }))
      .filter((x) => x.rank >= 0)
      .sort(
        (a, b) =>
          a.rank - b.rank ||
          (NAMES[a.s] ?? a.s).length - (NAMES[b.s] ?? b.s).length ||
          a.s.localeCompare(b.s),
      )
      .slice(0, MAX_RESULTS)
      .map(({ s }) => ({ symbol: s, name: NAMES[s], group: "Results" as const }));
  }, [query, knownAssets, heldAssets, known]);

  const choose = (symbol: string) => {
    onChange(symbol);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (open && options[active]) {
        e.preventDefault();
        choose(options[active].symbol);
      }
    } else if (e.key === "Escape" && open) {
      e.stopPropagation(); // close the list, not the whole sheet
      setOpen(false);
    }
  };

  const price = prices[value];

  return (
    <div className="space-y-2">
      {/* Selected asset */}
      {value && !open && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          className={cn(
            "flex h-11 w-full items-center gap-3 rounded-lg border px-3 text-left",
            invalid ? "border-loss" : "hover:bg-muted/50",
          )}
          aria-label={`Asset: ${value}. Change`}
        >
          <span className="font-semibold">{value}</span>
          {NAMES[value] && <span className="truncate text-sm text-muted-foreground">{NAMES[value]}</span>}
          <span className="ml-auto text-sm tabular-nums text-muted-foreground">{price ? fmtPrice(price) : ""}</span>
          <span className="text-xs font-medium text-primary">Change</span>
        </button>
      )}

      {(open || !value) && (
        <div className="space-y-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
              aria-label="Search assets"
              placeholder="Search by symbol or name, e.g. BTC or bitcoin"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              enterKeyHint="search"
              className="h-11 pr-10 pl-9 text-base"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
            />
            {value && (
              <button
                type="button"
                aria-label="Cancel search"
                onClick={() => {
                  setQuery("");
                  setOpen(false);
                }}
                className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              >
                <XIcon className="size-4" />
              </button>
            )}
          </div>

          {open && (
            <ul id={listId} role="listbox" aria-label="Assets" className="max-h-64 overflow-y-auto rounded-lg border">
              {options.length === 0 ? (
                <li className="p-3 text-sm text-muted-foreground">
                  No coin matching &ldquo;{query.trim()}&rdquo; has a USDT pair on Binance.
                </li>
              ) : (
                options.map((o, i) => {
                  const header = i === 0 || options[i - 1].group !== o.group;
                  return (
                    <li key={`${o.group}-${o.symbol}`} role="presentation">
                      {header && o.group !== "Results" && (
                        <p className="sticky top-0 bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">{o.group}</p>
                      )}
                      <div
                        id={`${listId}-${i}`}
                        role="option"
                        aria-selected={o.symbol === value}
                        onPointerDown={(e) => e.preventDefault()} // keep focus so the tap registers
                        onClick={() => choose(o.symbol)}
                        onMouseEnter={() => setActive(i)}
                        className={cn(
                          "flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2",
                          i === active && "bg-muted",
                        )}
                      >
                        <span className="w-16 shrink-0 font-semibold">{o.symbol}</span>
                        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{o.name ?? ""}</span>
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {prices[o.symbol] ? fmtPrice(prices[o.symbol]) : ""}
                        </span>
                        {o.symbol === value && <CheckIcon className="size-4 text-primary" aria-hidden />}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

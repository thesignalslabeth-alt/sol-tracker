create table if not exists trades (
  id               text primary key,
  user_id          text not null,
  date             date not null,
  asset            text not null default 'SOL',
  side             text not null check (side in ('buy', 'sell')),
  quantity       numeric(20, 8) not null check (quantity > 0),
  total_usd        numeric(20, 8) not null check (total_usd > 0),
  fee_usd          numeric(20, 8) not null default 0 check (fee_usd >= 0),
  -- Allowed codes are kept in sync with lib/currencies.ts by `npm run db:seed`.
  quote_currency   text not null check (quote_currency in ('USD', 'SGD', 'MYR', 'IDR', 'THB', 'PHP', 'VND', 'HKD', 'JPY', 'KRW', 'CNY', 'TWD', 'INR')),
  quote_amount     numeric(20, 8),
  fx_usd_per_quote numeric(20, 8),
  note             text,
  created_at       timestamptz not null default now()
);

create index if not exists trades_user_id_idx on trades (user_id);

-- Per-user settings. A missing row means defaults: everything opt-in is off.
create table if not exists user_prefs (
  user_id    text primary key,
  insights   boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists trades (
  id               text primary key,
  user_id          text not null,
  date             date not null,
  side             text not null check (side in ('buy', 'sell')),
  sol_amount       numeric(20, 8) not null check (sol_amount > 0),
  total_usd        numeric(20, 8) not null check (total_usd > 0),
  fee_usd          numeric(20, 8) not null default 0 check (fee_usd >= 0),
  quote_currency   text not null check (quote_currency in ('USD', 'SGD')),
  quote_amount     numeric(20, 8),
  fx_usd_per_quote numeric(20, 8),
  note             text,
  created_at       timestamptz not null default now()
);

create index if not exists trades_user_id_idx on trades (user_id);

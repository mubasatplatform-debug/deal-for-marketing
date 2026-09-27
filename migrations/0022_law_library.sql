-- «مكتبة الأنظمة» — Saudi legislation published by the Ministry of Justice
-- (laws.moj.gov.sa), shared by every office: the assistant, questions and
-- drafts cite articles from here instead of from memory. Loaded on deploy by
-- scripts/seed-laws.mjs from data/laws/moj-laws.json.gz.

-- Arabic search form: no diacritics or tatweel, one alef, ya and ta marbuta
-- folded, and the article / attached prepositions dropped from word starts.
-- Kept in step with normalizeForSearch + searchTerms (src/lib/law/ai/arabic.ts).
create or replace function law_norm(t text) returns text
language sql immutable parallel safe
as $$
  select regexp_replace(
    translate(
      regexp_replace(lower(coalesce(t, '')), '[\u064B-\u065F\u0670\u0640]', '', 'g'),
      'أإآٱىةؤئ٠١٢٣٤٥٦٧٨٩',
      'اااايهوي0123456789'
    ),
    '(^|[^[:alnum:]])(وبال|وال|بال|كال|فال|ولل|لل|ال)([[:alnum:]]{2,})',
    '\1\3',
    'g'
  )
$$;

create table if not exists law_library_laws (
  serial text primary key,
  name text not null,
  type text not null default '',
  status text not null default '',
  classification text not null default '',
  issued text,
  tool text,
  summary text not null default '',
  url text not null,
  boe_url text,
  article_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists law_library_articles (
  id bigserial primary key,
  law_serial text not null references law_library_laws (serial) on delete cascade,
  ord integer not null,
  seq text not null,
  heading text not null default '',
  text text not null,
  -- The law's name, copied so a question naming the law finds its articles.
  law_name text not null default '',
  search tsvector generated always as (
    setweight(to_tsvector('simple', law_norm(law_name)), 'C') ||
    setweight(to_tsvector('simple', law_norm(seq || ' ' || heading)), 'B') ||
    setweight(to_tsvector('simple', law_norm(text)), 'A')
  ) stored,
  unique (law_serial, ord)
);
create index if not exists law_library_articles_search_idx on law_library_articles using gin (search);

-- Which data file is loaded (its hash), so a deploy only reloads on change.
create table if not exists law_library_meta (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

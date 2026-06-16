-- Phase 0 — knowledge base infrastructure (RAG over pgvector).
--
-- Scaffolded EMPTY in Phase 0 and populated in Phase 5. Grounds the reasoning
-- layer in EcoSphere's derived rules, MCS/CIBSE assumptions, manufacturer data
-- and past design patterns.
--
-- Embedding dimension 1536 matches common embedding models; revisit when the
-- Phase 5 embedding model is chosen (change requires a re-embed + migration).

create extension if not exists vector;

create table if not exists public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  -- Provenance, e.g. 'mcs', 'cibse', 'ecosphere_rules', 'manufacturer', 'past_design'.
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

-- Approximate nearest-neighbour index for cosine similarity search (used in
-- Phase 5). Safe to create now; it simply has nothing to index yet.
create index if not exists knowledge_base_embedding_idx
  on public.knowledge_base
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists knowledge_base_source_idx
  on public.knowledge_base (source);

-- The knowledge base is internal/server-side only. Enable RLS with no public
-- policies; access is via the service role until access rules are defined.
alter table public.knowledge_base enable row level security;

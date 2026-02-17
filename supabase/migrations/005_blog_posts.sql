-- ScrapCo - Blog Posts
-- Creates blog_posts table used by website blog.

-- Ensure gen_random_uuid() exists
create extension if not exists pgcrypto;

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null,
  excerpt text,
  content text not null default '',
  featured_image text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uniqueness + performance
create unique index if not exists blog_posts_slug_key on public.blog_posts (slug);
create index if not exists blog_posts_published_created_at_idx on public.blog_posts (is_published, created_at desc);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'blog_posts_set_updated_at'
  ) then
    create trigger blog_posts_set_updated_at
    before update on public.blog_posts
    for each row
    execute procedure public.set_updated_at();
  end if;
end $$;

-- RLS: public can read only published posts.
alter table public.blog_posts enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'blog_posts'
      and policyname = 'Public read published blog posts'
  ) then
    create policy "Public read published blog posts"
      on public.blog_posts
      for select
      using (is_published = true);
  end if;
end $$;

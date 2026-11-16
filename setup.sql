create table if not exists public.blog_posts (
  id text primary key,
  title text not null,
  summary text not null,
  body text not null,
  date text not null,
  image jsonb,
  video jsonb,
  created_at timestamptz not null default now()
);

grant select on table public.blog_posts to anon, authenticated;
grant insert, update, delete on table public.blog_posts to authenticated;

alter table public.blog_posts enable row level security;

create table if not exists public.blog_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

grant select on table public.blog_admins to authenticated;
alter table public.blog_admins enable row level security;

drop policy if exists "Admins can read their own access" on public.blog_admins;
create policy "Admins can read their own access"
  on public.blog_admins
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Public can read blog posts" on public.blog_posts;
create policy "Public can read blog posts"
  on public.blog_posts
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can manage blog posts" on public.blog_posts;
create policy "Admins can manage blog posts"
  on public.blog_posts
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.blog_admins
      where user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.blog_admins
      where user_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public)
values ('blog-media', 'blog-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can read blog media" on storage.objects;
create policy "Public can read blog media"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'blog-media');

drop policy if exists "Admins can manage blog media" on storage.objects;
create policy "Admins can manage blog media"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'blog-media'
    and exists (
      select 1
      from public.blog_admins
      where user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'blog-media'
    and exists (
      select 1
      from public.blog_admins
      where user_id = auth.uid()
    )
  );

-- After creating the Supabase Auth user, add its UUID to grant admin access:
-- insert into public.blog_admins (user_id) values ('YOUR-AUTH-USER-UUID');

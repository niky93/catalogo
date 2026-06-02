create table if not exists public.catalog_products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  category text not null check (char_length(trim(category)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  price numeric(12, 2) not null default 0 check (price >= 0),
  image_url text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.catalog_products enable row level security;

revoke all on table public.catalog_products from anon;
grant select on table public.catalog_products to anon;
grant select, insert, update, delete on table public.catalog_products to authenticated;

drop policy if exists "Anyone can read active catalog products" on public.catalog_products;
create policy "Anyone can read active catalog products"
  on public.catalog_products for select
  using (active = true);

drop policy if exists "Authenticated users can manage catalog products" on public.catalog_products;
create policy "Authenticated users can manage catalog products"
  on public.catalog_products for all
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

insert into storage.buckets (id, name, public)
values ('catalog-images', 'catalog-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Anyone can read catalog images" on storage.objects;
create policy "Anyone can read catalog images"
  on storage.objects for select
  using (bucket_id = 'catalog-images');

drop policy if exists "Authenticated users can upload catalog images" on storage.objects;
create policy "Authenticated users can upload catalog images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'catalog-images');

drop policy if exists "Authenticated users can update catalog images" on storage.objects;
create policy "Authenticated users can update catalog images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'catalog-images')
  with check (bucket_id = 'catalog-images');

drop policy if exists "Authenticated users can delete catalog images" on storage.objects;
create policy "Authenticated users can delete catalog images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'catalog-images');

notify pgrst, 'reload schema';

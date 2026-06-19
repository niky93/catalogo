alter table public.catalog_products
  add column if not exists image_urls text[] not null default '{}';

update public.catalog_products
set image_urls = array[image_url]
where coalesce(array_length(image_urls, 1), 0) = 0;

notify pgrst, 'reload schema';

-- RICOS 3D VIEWER - ejecutar una vez en Supabase > SQL Editor.
-- Requiere registrar un usuario mediante el botón "Administrar".
create extension if not exists pgcrypto;
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.app_admins enable row level security;
drop policy if exists "Admins may read own membership" on public.app_admins;
create policy "Admins may read own membership"
on public.app_admins for select to authenticated
using (user_id = (select auth.uid()));
grant select on public.app_admins to authenticated;

create table if not exists public.models (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  format text not null check (format in ('glb','obj','stl')),
  file_path text not null unique,
  file_size bigint not null check (file_size > 0 and file_size <= 52428800),
  created_at timestamptz not null default now()
);
alter table public.models enable row level security;
grant select on public.models to anon, authenticated;
grant insert, delete on public.models to authenticated;

drop policy if exists "Public can read models" on public.models;
create policy "Public can read models"
on public.models for select to anon, authenticated using (true);

drop policy if exists "Admins can insert models" on public.models;
create policy "Admins can insert models"
on public.models for insert to authenticated with check (
 exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
);

drop policy if exists "Admins can delete models" on public.models;
create policy "Admins can delete models"
on public.models for delete to authenticated using (
 exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('model-files','model-files',true,52428800,array['model/gltf-binary','application/octet-stream'])
on conflict(id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins upload 3D models" on storage.objects;
create policy "Admins upload 3D models" on storage.objects
for insert to authenticated with check (
 bucket_id='model-files'
 and exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
);
drop policy if exists "Admins remove 3D models" on storage.objects;
create policy "Admins remove 3D models" on storage.objects
for delete to authenticated using (
 bucket_id='model-files'
 and exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
);

-- DESPUÉS de iniciar sesión con el correo autorizado:
-- Reemplazar la dirección debajo y ejecutar solo ese INSERT:
-- insert into public.app_admins(user_id)
-- select id from auth.users where email = 'tu-correo@ejemplo.com'
-- on conflict do nothing;

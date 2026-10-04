-- Activa RLS en todas las tablas de public. Sin políticas: el rol anon/authenticated
-- del Data API de Supabase no ve nada; el backend usa la conexión directa de
-- Postgres (rol postgres), que ignora RLS. Ejecutar en el SQL Editor de Supabase
-- tras crear tablas nuevas.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- Verificación: todas deben salir con rowsecurity = true.
select tablename, rowsecurity from pg_tables where schemaname = 'public';

-- Vector types/operators are installed by `create extension vector;` into the
-- `extensions` schema (not `public`). The `public.match_knowledge_chunks`
-- RPC is SECURITY INVOKER, so it runs as the caller's role (service_role).
-- Without access to that schema the `<=>` distance operator inside the
-- function body fails with either:
--   "permission denied for schema extensions"
--   "operator does not exist: extensions.vector <=> extensions.vector"
-- GRANT USAGE makes the types reachable; GRANT EXECUTE lets the operator's
-- underlying functions run; ALTER FUNCTION ... SET search_path makes the bare
-- `<=>` operator resolvable inside the function body.

grant usage on schema extensions to service_role, anon, authenticated;
grant select on all tables in schema extensions to service_role, anon, authenticated;
grant execute on all functions in schema extensions to service_role, anon, authenticated;

alter function public.match_knowledge_chunks set search_path = extensions, public, pg_catalog;

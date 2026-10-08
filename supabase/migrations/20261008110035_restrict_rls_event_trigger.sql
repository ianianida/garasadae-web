-- This built-in event-trigger function enables RLS on new public tables.
-- Its owner still executes it as an event trigger; API roles need no RPC grant.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

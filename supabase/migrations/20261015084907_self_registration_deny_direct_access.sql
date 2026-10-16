-- Defense in depth: self-service registrations are accessed only by the server RPC.
create policy site_self_registrations_deny_client_access
  on public.site_self_registrations
  for all
  to anon, authenticated
  using (false)
  with check (false);

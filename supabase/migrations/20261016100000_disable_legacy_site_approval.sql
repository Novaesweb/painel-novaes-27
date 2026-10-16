-- Retire the former MASTER-approval workflow without deleting its historical requests.
revoke all on function public.novaesweb_create_site_registration_request(
  uuid, text, text, text, text, text, uuid
) from public, anon, authenticated, service_role;

revoke all on function public.novaesweb_review_site_registration(
  uuid, uuid, text, text
) from public, anon, authenticated, service_role;

-- Crie antes os usuários no painel Authentication.
-- Troque o nome do espaço e os e-mails pelos dados reais. Rode uma vez.
do $$
declare team uuid; ids uuid[]; chosen text[] := array['voce@exemplo.com','gabriel@exemplo.com'];
begin
  select array_agg(id) into ids from auth.users where lower(email)=any(chosen);
  if coalesce(cardinality(ids),0)<>cardinality(chosen) then
    raise exception 'Crie os dois usuários de Authentication e confira os e-mails.';
  end if;
  insert into public.ml_workspaces(name) values('Gabriel Honda') returning id into team;
  insert into public.ml_members(workspace_id,user_id) select team,unnest(ids);
end
$$;

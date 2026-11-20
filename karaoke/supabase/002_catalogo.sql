-- Repertório compartilhado. A ordem de inclusão mantém o primeiro link como padrão.
create function karaoke.chave_catalogo(valor text) returns text
language sql immutable strict set search_path = '' as $$
  select trim(regexp_replace(translate(lower(valor),'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn'),'[^[:alnum:]]+',' ','g'))
$$;
create table karaoke.playbacks (
  ordem bigint generated always as identity primary key,
  musica text not null, artista text not null, video text not null,
  titulo_video text not null,
  chave text generated always as (karaoke.chave_catalogo(musica)) stored,
  autor text generated always as (karaoke.chave_catalogo(artista)) stored,
  unique(chave,autor,video)
);
create index playbacks_consulta on karaoke.playbacks ((trim(chave || ' ' || autor)));
alter table karaoke.playbacks enable row level security;
revoke all on karaoke.playbacks from public,anon,authenticated;

create function public.karaoke_catalogo_salvar(p_musica text,p_artista text,p_video text,p_titulo text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_musica is null or length(p_musica) not between 1 and 160 or karaoke.chave_catalogo(p_musica)=''
    or length(coalesce(p_artista,''))>160 or p_video is null or p_video !~ '^[A-Za-z0-9_-]{11}$'
    or length(coalesce(p_titulo,''))>250 then raise exception 'Playback inválido'; end if;
  insert into karaoke.playbacks(musica,artista,video,titulo_video)
    values(trim(p_musica),trim(coalesce(p_artista,'')),p_video,coalesce(nullif(trim(p_titulo),''),trim(p_musica)))
    on conflict(chave,autor,video) do nothing;
end $$;

create function public.karaoke_catalogo_buscar(p_consulta text)
returns table(id text,titulo text,musica text,artista text)
language sql stable security definer set search_path='' as $$
  select p.video,p.titulo_video,p.musica,p.artista from karaoke.playbacks p
  where length(p_consulta) between 1 and 325 and
    (p.chave=karaoke.chave_catalogo(p_consulta) or trim(p.chave || ' ' || p.autor)=karaoke.chave_catalogo(p_consulta))
  order by p.ordem limit 12
$$;
revoke all on function public.karaoke_catalogo_salvar(text,text,text,text),public.karaoke_catalogo_buscar(text) from public;
grant execute on function public.karaoke_catalogo_salvar(text,text,text,text),public.karaoke_catalogo_buscar(text) to anon,authenticated;

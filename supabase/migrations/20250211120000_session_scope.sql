create or replace function match_document_sections(
  embedding vector(384),
  match_threshold float,
  document_ids bigint[] default null,
  match_count int default 5
)
returns setof document_sections
language plpgsql
as $$
begin
  return query
  select *
  from document_sections
  where document_sections.embedding is not null
    and (document_ids is null or document_sections.document_id = any(document_ids))
    and document_sections.embedding <#> embedding < -match_threshold
  order by document_sections.embedding <#> embedding
  limit greatest(coalesce(match_count, 5), 1);
end;
$$;

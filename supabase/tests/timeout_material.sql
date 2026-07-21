-- Disposable timeout-material contract checks. Run after migrations with:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/timeout_material.sql
-- The transaction never persists data.
begin;

do $timeout_material$
begin
  if private.timeout_result_from_fen(
    '7k/8/8/8/8/8/8/K7 w - - 0 1',
    'white'
  ) is distinct from '1/2-1/2' then
    raise exception 'bare kings must be a draw when White flags';
  end if;

  if private.timeout_result_from_fen(
    '7k/8/8/8/8/8/6b1/K7 w - - 0 1',
    'white'
  ) is distinct from '1/2-1/2' then
    raise exception 'a lone bishop against a bare king must be a timeout draw';
  end if;

  if private.timeout_result_from_fen(
    '7k/8/8/8/8/8/P5b1/K7 w - - 0 1',
    'white'
  ) is distinct from '0-1' then
    raise exception 'a bishop can mate when the flagging side has blocking material';
  end if;

  if private.timeout_result_from_fen(
    '7k/8/8/8/8/8/6r1/K7 w - - 0 1',
    'white'
  ) is distinct from '0-1' then
    raise exception 'Black rook material must produce a Black timeout win';
  end if;

  if private.timeout_result_from_fen(
    'k7/8/8/8/8/8/1R6/7K b - - 0 1',
    'black'
  ) is distinct from '1-0' then
    raise exception 'White rook material must produce a White timeout win';
  end if;
end;
$timeout_material$;

rollback;

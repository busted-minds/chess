-- Busted Minds Chess launch content. No Auth users or email identities are created here.
-- Stable IDs and ON CONFLICT/NOT EXISTS guards make this safe to rerun.

insert into public.house_players (
  id, slug, display_name, avatar_path, country_code, bio, public_label,
  estimated_rating, preferred_openings, playing_style, safe_messages, is_enabled, is_listed
)
values
  (
    '10000000-0000-4000-8000-000000000001', 'nova-knight', 'Nova Knight',
    '/avatars/house/nova-knight.svg', 'US',
    'A patient newcomer who develops every piece and keeps the position friendly.', 'House Player', 720,
    '["Italian Game","London System"]'::jsonb,
    '{"risk":"low","focus":"development","pace":"steady"}'::jsonb,
    array['Good game', 'Well played', 'Thanks for the game', 'Rematch?'], true, true
  ),
  (
    '10000000-0000-4000-8000-000000000002', 'mina-tempo', 'Mina Tempo',
    '/avatars/house/mina-tempo.svg', 'JP',
    'Quick and practical, Mina prefers simple plans and rarely spends too long on one move.', 'House Player', 940,
    '["Scotch Game","Caro-Kann Defense"]'::jsonb,
    '{"risk":"medium","focus":"initiative","pace":"fast"}'::jsonb,
    array['Good game', 'Nice move', 'Well played', 'Rematch?'], true, true
  ),
  (
    '10000000-0000-4000-8000-000000000003', 'rook-rivers', 'Rook Rivers',
    '/avatars/house/rook-rivers.svg', 'GB',
    'A classical player who likes open files, active rooks, and clean endgames.', 'House Player', 1130,
    '["Queen''s Gambit","French Defense"]'::jsonb,
    '{"risk":"low","focus":"open-files","pace":"balanced"}'::jsonb,
    array['Good game', 'Well played', 'Thanks for the game'], true, true
  ),
  (
    '10000000-0000-4000-8000-000000000004', 'tariq-tactics', 'Tariq Tactics',
    '/avatars/house/tariq-tactics.svg', 'EG',
    'Always scanning for forks and pins, Tariq turns loose pieces into immediate targets.', 'House Player', 1320,
    '["Vienna Game","Sicilian Defense"]'::jsonb,
    '{"risk":"high","focus":"tactics","pace":"bursty"}'::jsonb,
    array['Nice move', 'Good game', 'Well played', 'Rematch?'], true, true
  ),
  (
    '10000000-0000-4000-8000-000000000005', 'sofia-structure', 'Sofia Structure',
    '/avatars/house/sofia-structure.svg', 'ES',
    'Sofia builds durable pawn structures and is happiest improving a position one square at a time.', 'House Player', 1510,
    '["Catalan Opening","Caro-Kann Defense"]'::jsonb,
    '{"risk":"low","focus":"pawn-structure","pace":"deliberate"}'::jsonb,
    array['Good game', 'Well played', 'Thanks for the game'], true, true
  ),
  (
    '10000000-0000-4000-8000-000000000006', 'bruno-blitz', 'Bruno Blitz',
    '/avatars/house/bruno-blitz.svg', 'BR',
    'An energetic attacker who values momentum and keeps enough time for the final scramble.', 'House Player', 1690,
    '["King''s Indian Defense","Evans Gambit"]'::jsonb,
    '{"risk":"high","focus":"king-attack","pace":"fast"}'::jsonb,
    array['Nice move', 'Good game', 'That was sharp', 'Rematch?'], true, true
  ),
  (
    '10000000-0000-4000-8000-000000000007', 'mei-calculation', 'Mei Calculation',
    '/avatars/house/mei-calculation.svg', 'SG',
    'Mei likes concrete positions, forcing lines, and precise conversions when an advantage appears.', 'House Player', 1880,
    '["Nimzo-Indian Defense","Open Sicilian"]'::jsonb,
    '{"risk":"medium","focus":"calculation","pace":"balanced"}'::jsonb,
    array['Good game', 'Well played', 'Accurate game', 'Rematch?'], true, true
  ),
  (
    '10000000-0000-4000-8000-000000000008', 'viktor-endgame', 'Viktor Endgame',
    '/avatars/house/viktor-endgame.svg', 'CZ',
    'A demanding technical player who exchanges into endgames and makes every tempo matter.', 'House Player', 2110,
    '["Ruy Lopez","Queen''s Gambit Declined"]'::jsonb,
    '{"risk":"low","focus":"endgame","pace":"deliberate"}'::jsonb,
    array['Good game', 'Well played', 'Thanks for the game', 'Rematch?'], true, true
  )
on conflict (id) do nothing;
insert into private.house_player_configs (
  house_player_id, engine_profile, engine_version, difficulty, min_think_ms, max_think_ms,
  mistake_frequency, risk_level, tactical_tendency, positional_tendency, time_management,
  opening_weights, allow_matchmaking, allow_tournaments, allow_rated, rating_mode,
  deterministic_seed
)
values
  ('10000000-0000-4000-8000-000000000001', 'stockfish-lite', '18-lite-wasm', 2, 250, 900, 0.2600, 0.25, 0.30, 0.40, 'balanced', '{"italian":3,"london":2}', true, true, false, 'fixed', 100001),
  ('10000000-0000-4000-8000-000000000002', 'stockfish-lite', '18-lite-wasm', 4, 180, 800, 0.1900, 0.50, 0.50, 0.45, 'fast', '{"scotch":3,"caro-kann":2}', true, true, false, 'fixed', 100002),
  ('10000000-0000-4000-8000-000000000003', 'stockfish-lite', '18-lite-wasm', 6, 300, 1300, 0.1350, 0.30, 0.40, 0.70, 'balanced', '{"queens-gambit":3,"french":2}', true, true, false, 'fixed', 100003),
  ('10000000-0000-4000-8000-000000000004', 'stockfish-lite', '18-lite-wasm', 8, 250, 1600, 0.0950, 0.80, 0.85, 0.35, 'time-pressure', '{"vienna":2,"sicilian":3}', true, true, false, 'fixed', 100004),
  ('10000000-0000-4000-8000-000000000005', 'stockfish-lite', '18-lite-wasm', 10, 450, 2100, 0.0650, 0.25, 0.45, 0.90, 'deliberate', '{"catalan":3,"caro-kann":2}', true, true, false, 'fixed', 100005),
  ('10000000-0000-4000-8000-000000000006', 'stockfish-lite', '18-lite-wasm', 12, 180, 1500, 0.0450, 0.90, 0.85, 0.50, 'fast', '{"kings-indian":3,"evans":2}', true, true, false, 'fixed', 100006),
  ('10000000-0000-4000-8000-000000000007', 'stockfish-lite', '18-lite-wasm', 14, 500, 2600, 0.0250, 0.55, 0.90, 0.85, 'balanced', '{"nimzo-indian":3,"open-sicilian":3}', true, true, false, 'fixed', 100007),
  ('10000000-0000-4000-8000-000000000008', 'stockfish-lite', '18-lite-wasm', 16, 700, 3400, 0.0125, 0.25, 0.80, 0.95, 'deliberate', '{"ruy-lopez":3,"qgd":3}', true, true, false, 'fixed', 100008)
on conflict (house_player_id) do nothing;

with pools(pool) as (
  values ('bullet'), ('blitz'), ('rapid'), ('classical')
), players(id, rating) as (
  values
    ('10000000-0000-4000-8000-000000000001'::uuid, 720),
    ('10000000-0000-4000-8000-000000000002'::uuid, 940),
    ('10000000-0000-4000-8000-000000000003'::uuid, 1130),
    ('10000000-0000-4000-8000-000000000004'::uuid, 1320),
    ('10000000-0000-4000-8000-000000000005'::uuid, 1510),
    ('10000000-0000-4000-8000-000000000006'::uuid, 1690),
    ('10000000-0000-4000-8000-000000000007'::uuid, 1880),
    ('10000000-0000-4000-8000-000000000008'::uuid, 2110)
)
insert into public.ratings (
  owner_kind, house_player_id, pool, rating, rating_deviation, volatility,
  provisional, games_played, wins, draws, losses, peak_rating
)
select 'house', p.id, pools.pool, p.rating, 60, 0.03, false, 24, 12, 6, 6, p.rating
from players p cross join pools
where not exists (
  select 1 from public.ratings r where r.house_player_id = p.id and r.pool = pools.pool
);

insert into public.feature_flags (key, description, enabled, rollout_percent, minimum_population, public_config)
values
  ('online_play', 'Live online games and private invites.', true, 100, 0, '{}'),
  ('house_player_fallback', 'Offer compatible house players after the configured wait.', true, 100, 0, '{"casualOnly":true}'),
  ('tournaments', 'Arena, Swiss, private, and exhibition events.', true, 100, 1, '{"hideWhenEmpty":true}'),
  ('clubs', 'Player clubs and club events.', true, 100, 2, '{"hideWhenEmpty":true}'),
  ('direct_messages', 'Direct messages between permanent accounts.', true, 100, 2, '{}'),
  ('achievements', 'Competitive-integrity-neutral achievements and XP.', true, 100, 0, '{}'),
  ('missions', 'Daily and weekly progress missions.', true, 100, 0, '{}'),
  ('saved_analysis', 'Compact, user-requested engine summaries.', true, 100, 0, '{"maxBytes":65536}'),
  ('daily_puzzle', 'Daily featured tactical puzzle.', true, 100, 0, '{}'),
  ('opening_trainer', 'Curated opening-line trainer.', true, 100, 0, '{}'),
  ('chess960', 'Chess960 online play after rules-adapter validation.', false, 0, 0, '{"reason":"awaiting conformance validation"}'),
  ('rated_house_players', 'Deterministically verified rated house games.', false, 0, 0, '{"requiresServerVerifiedEngine":true}'),
  ('maintenance_mode', 'Temporarily block non-admin mutations.', false, 100, 0, '{"message":"We will be right back."}'),
  ('curated_activity', 'Compact launch activity and featured games.', true, 100, 0, '{}'),
  ('seasonal_rankings', 'Season-specific leaderboards.', true, 100, 1, '{}')
on conflict (key) do nothing;

insert into private.matchmaking_rules (
  pool, bot_fallback_enabled, fallback_wait_seconds, initial_rating_range,
  rating_range_growth_per_second, max_rating_range, casual_bots_enabled,
  rated_bots_enabled, tournament_bots_enabled, max_bot_game_ratio
)
values
  ('bullet', true, 6, 125, 25, 500, true, false, true, 0.80),
  ('blitz', true, 7, 150, 22, 550, true, false, true, 0.80),
  ('rapid', true, 8, 175, 18, 650, true, false, true, 0.75),
  ('classical', true, 10, 200, 15, 750, true, false, true, 0.70),
  ('custom', true, 8, 250, 20, 900, true, false, false, 0.80)
on conflict (pool) do nothing;

insert into public.announcements (
  id, slug, title, body, severity, starts_at, is_published
)
values (
  '20000000-0000-4000-8000-000000000001', 'welcome-to-busted-minds-chess',
  'Welcome to Busted Minds Chess',
  'Play online, challenge a house player, solve today''s puzzle, or sharpen an opening line.',
  'success', statement_timestamp(), true
)
on conflict (id) do nothing;

insert into public.seasons (id, slug, name, starts_at, ends_at, status, rules)
values (
  '20000000-0000-4000-8000-000000000010', 'launch-season', 'Launch Season',
  date_trunc('day', statement_timestamp()),
  date_trunc('day', statement_timestamp()) + interval '90 days',
  'active', '{"pools":["bullet","blitz","rapid","classical"],"botsIncluded":false}'
)
on conflict (id) do nothing;

insert into public.scheduled_events (
  id, slug, title, description, event_type, visibility, starts_at, ends_at, status, metadata
)
values
  (
    '30000000-0000-4000-8000-000000000001', 'launch-rapid-arena', 'Launch Rapid Arena',
    'A relaxed launch arena with a varied field of house players and room for late joins.',
    'tournament', 'public', date_trunc('day', statement_timestamp()) + interval '2 days 11 hours',
    date_trunc('day', statement_timestamp()) + interval '2 days 13 hours', 'scheduled',
    '{"featured":true,"housePlayerFill":true}'
  ),
  (
    '30000000-0000-4000-8000-000000000002', 'weekend-blitz-swiss', 'Weekend Blitz Swiss',
    'Five compact rounds with balanced pairings and house-player seats available.',
    'tournament', 'public', date_trunc('day', statement_timestamp()) + interval '5 days 10 hours',
    date_trunc('day', statement_timestamp()) + interval '5 days 12 hours', 'scheduled',
    '{"featured":true,"rounds":5,"housePlayerFill":true}'
  )
on conflict (id) do nothing;

insert into public.tournaments (
  id, slug, name, description, tournament_type, visibility, status, event_id,
  variant, rating_pool, rated, base_time_ms, increment_ms, starts_at,
  registration_closes_at, ends_at, min_players, max_players, allow_late_join,
  allow_house_players, total_rounds, rules
)
values
  (
    '40000000-0000-4000-8000-000000000001', 'launch-rapid-arena', 'Launch Rapid Arena',
    'Score as many points as possible in a two-hour rapid arena.', 'arena', 'public', 'registration',
    '30000000-0000-4000-8000-000000000001', 'standard', 'rapid', false, 600000, 5000,
    date_trunc('day', statement_timestamp()) + interval '2 days 11 hours',
    date_trunc('day', statement_timestamp()) + interval '2 days 10 hours 55 minutes',
    date_trunc('day', statement_timestamp()) + interval '2 days 13 hours',
    2, 32, true, true, null, '{"scoring":"arena","streakBonus":false,"berserk":false}'
  ),
  (
    '40000000-0000-4000-8000-000000000002', 'weekend-blitz-swiss', 'Weekend Blitz Swiss',
    'Five Swiss rounds with standard Buchholz tie-breaks.', 'swiss', 'public', 'registration',
    '30000000-0000-4000-8000-000000000002', 'standard', 'blitz', false, 180000, 2000,
    date_trunc('day', statement_timestamp()) + interval '5 days 10 hours',
    date_trunc('day', statement_timestamp()) + interval '5 days 9 hours 55 minutes',
    date_trunc('day', statement_timestamp()) + interval '5 days 12 hours',
    4, 32, false, true, 5, '{"pairing":"swiss","tieBreaks":["buchholz","sonnebornBerger"]}'
  )
on conflict (id) do nothing;

insert into public.tournament_entries (
  id, tournament_id, owner_kind, house_player_id, display_name_snapshot,
  rating_snapshot, status, seed, score
)
values
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'house', '10000000-0000-4000-8000-000000000002', 'Mina Tempo', 940, 'registered', 4, 0),
  ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 'house', '10000000-0000-4000-8000-000000000004', 'Tariq Tactics', 1320, 'registered', 3, 0),
  ('41000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001', 'house', '10000000-0000-4000-8000-000000000006', 'Bruno Blitz', 1690, 'registered', 2, 0),
  ('41000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000001', 'house', '10000000-0000-4000-8000-000000000008', 'Viktor Endgame', 2110, 'registered', 1, 0),
  ('42000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'house', '10000000-0000-4000-8000-000000000003', 'Rook Rivers', 1130, 'registered', 4, 0),
  ('42000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'house', '10000000-0000-4000-8000-000000000005', 'Sofia Structure', 1510, 'registered', 3, 0),
  ('42000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002', 'house', '10000000-0000-4000-8000-000000000006', 'Bruno Blitz', 1690, 'registered', 2, 0),
  ('42000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000002', 'house', '10000000-0000-4000-8000-000000000007', 'Mei Calculation', 1880, 'registered', 1, 0)
on conflict (id) do nothing;

insert into public.activity_feed_items (
  id, actor_kind, actor_house_player_id, actor_name_snapshot, activity_type,
  entity_type, entity_id, visibility, payload, curated, expires_at
)
values
  (
    '43000000-0000-4000-8000-000000000001', 'house',
    '10000000-0000-4000-8000-000000000004', 'Tariq Tactics', 'tournament.joined',
    'tournament', '40000000-0000-4000-8000-000000000001', 'public',
    '{"tournamentName":"Launch Rapid Arena"}', true, statement_timestamp() + interval '30 days'
  ),
  (
    '43000000-0000-4000-8000-000000000002', 'house',
    '10000000-0000-4000-8000-000000000007', 'Mei Calculation', 'tournament.joined',
    'tournament', '40000000-0000-4000-8000-000000000002', 'public',
    '{"tournamentName":"Weekend Blitz Swiss"}', true, statement_timestamp() + interval '30 days'
  )
on conflict (id) do nothing;

insert into public.opening_lines (
  id, slug, eco, name, variation, moves_uci, side, difficulty, tags
)
values
  ('50000000-0000-4000-8000-000000000001', 'italian-game-classical', 'C50', 'Italian Game', 'Classical Development', array['e2e4','e7e5','g1f3','b8c6','f1c4','g8f6'], 'both', 1, array['open-game','development']),
  ('50000000-0000-4000-8000-000000000002', 'ruy-lopez-morphy', 'C78', 'Ruy Lopez', 'Morphy Defense', array['e2e4','e7e5','g1f3','b8c6','f1b5','a7a6','b5a4','g8f6','e1g1'], 'both', 2, array['open-game','strategy']),
  ('50000000-0000-4000-8000-000000000003', 'queens-gambit-declined', 'D30', 'Queen''s Gambit Declined', 'Orthodox Setup', array['d2d4','d7d5','c2c4','e7e6','b1c3','g8f6'], 'both', 2, array['closed-game','pawn-structure']),
  ('50000000-0000-4000-8000-000000000004', 'london-system', 'D02', 'London System', 'Early Bishop Development', array['d2d4','g8f6','g1f3','e7e6','c1f4','d7d5'], 'white', 1, array['system','development']),
  ('50000000-0000-4000-8000-000000000005', 'caro-kann-classical', 'B18', 'Caro-Kann Defense', 'Classical Variation', array['e2e4','c7c6','d2d4','d7d5','b1c3','d5e4','c3e4'], 'black', 2, array['semi-open','solid']),
  ('50000000-0000-4000-8000-000000000006', 'sicilian-open', 'B50', 'Sicilian Defense', 'Open Sicilian Setup', array['e2e4','c7c5','g1f3','d7d6','d2d4','c5d4','f3d4'], 'both', 3, array['semi-open','tactical']),
  ('50000000-0000-4000-8000-000000000007', 'french-advance', 'C02', 'French Defense', 'Advance Variation', array['e2e4','e7e6','d2d4','d7d5','e4e5'], 'both', 2, array['semi-open','pawn-chain']),
  ('50000000-0000-4000-8000-000000000008', 'kings-indian-classical', 'E90', 'King''s Indian Defense', 'Classical Setup', array['d2d4','g8f6','c2c4','g7g6','b1c3','f8g7','e2e4','d7d6'], 'black', 3, array['closed-game','king-attack'])
on conflict (id) do nothing;

insert into public.puzzles (
  id, slug, fen, side_to_move, solution_uci, rating, themes, explanation, status
)
values
  (
    '60000000-0000-4000-8000-000000000001', 'launch-scholar-punish',
    'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    'white', array['h5f7'], 700, array['mateInOne','kingAttack'],
    'The queen lands on f7 with support from the bishop on c4.', 'published'
  ),
  (
    '60000000-0000-4000-8000-000000000002', 'launch-back-rank-white',
    '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
    'white', array['e1e8'], 900, array['mateInOne','backRankMate'],
    'The boxed-in king has no flight square after the rook reaches e8.', 'published'
  ),
  (
    '60000000-0000-4000-8000-000000000003', 'launch-back-rank-black',
    '4r1k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1',
    'black', array['e8e1'], 920, array['mateInOne','backRankMate'],
    'The rook uses the open e-file and the first rank to finish the game.', 'published'
  )
on conflict (id) do nothing;

update public.puzzles p set featured_on = current_date
where p.id = '60000000-0000-4000-8000-000000000001'
  and p.featured_on is null
  and not exists (select 1 from public.puzzles x where x.featured_on = current_date and x.id <> p.id);
update public.puzzles p set featured_on = current_date + 1
where p.id = '60000000-0000-4000-8000-000000000002'
  and p.featured_on is null
  and not exists (select 1 from public.puzzles x where x.featured_on = current_date + 1 and x.id <> p.id);
update public.puzzles p set featured_on = current_date + 2
where p.id = '60000000-0000-4000-8000-000000000003'
  and p.featured_on is null
  and not exists (select 1 from public.puzzles x where x.featured_on = current_date + 2 and x.id <> p.id);

insert into public.lessons (
  id, slug, title, summary, lesson_type, difficulty, estimated_minutes, content, position
)
values
  (
    '70000000-0000-4000-8000-000000000001', 'first-game-basics', 'Your First Complete Game',
    'Learn the board, legal movement, check, checkmate, and a simple game plan.', 'rules', 1, 8,
    '{"sections":[{"type":"text","title":"A simple plan","body":"Control the center, develop your pieces, and castle your king."},{"type":"position","fen":"start","prompt":"Begin with a central pawn move."}]}'::jsonb, 1
  ),
  (
    '70000000-0000-4000-8000-000000000002', 'tactical-patterns-forks', 'Tactical Patterns: Forks',
    'Spot one piece attacking two targets and calculate the cleanest follow-up.', 'tactics', 2, 7,
    '{"sections":[{"type":"text","title":"Two targets","body":"Checks, captures, and threats make the strongest forks."},{"type":"quiz","prompt":"Which pieces are especially effective at forking?","answers":["Knights and pawns","Only queens"],"correct":0}]}'::jsonb, 2
  ),
  (
    '70000000-0000-4000-8000-000000000003', 'king-and-pawn-endgames', 'King and Pawn Essentials',
    'Use opposition and key squares to convert the most important basic ending.', 'endgame', 2, 10,
    '{"sections":[{"type":"text","title":"Activate the king","body":"In pawn endings the king is an attacking piece."},{"type":"position","fen":"8/8/8/4k3/4P3/4K3/8/8 w - - 0 1","prompt":"Find the route toward the key squares."}]}'::jsonb, 3
  )
on conflict (id) do nothing;

insert into public.achievements (
  id, key, name, description, category, icon_key, xp_reward, criteria, is_hidden, is_active
)
values
  ('80000000-0000-4000-8000-000000000001', 'first_move', 'First Move', 'Complete your first saved game.', 'game', 'spark', 50, '{"gamesCompleted":1}', false, true),
  ('80000000-0000-4000-8000-000000000002', 'puzzle_streak_3', 'Pattern Finder', 'Solve puzzles on three consecutive days.', 'puzzle', 'target', 100, '{"dailyPuzzleStreak":3}', false, true),
  ('80000000-0000-4000-8000-000000000003', 'opening_explorer_5', 'Opening Explorer', 'Complete five opening trainer lines.', 'training', 'compass', 125, '{"openingLinesCompleted":5}', false, true),
  ('80000000-0000-4000-8000-000000000004', 'tournament_debut', 'Tournament Debut', 'Finish your first tournament.', 'tournament', 'trophy', 150, '{"tournamentsCompleted":1}', false, true),
  ('80000000-0000-4000-8000-000000000005', 'ai_climber', 'Engine Climber', 'Defeat three increasing AI difficulty levels.', 'ai', 'bot', 125, '{"distinctAiLevelsDefeated":3}', false, true),
  ('80000000-0000-4000-8000-000000000006', 'win_streak_5', 'Five in Flight', 'Win five rated games in a row.', 'streak', 'flame', 250, '{"ratedWinStreak":5}', false, true)
on conflict (id) do nothing;

insert into public.missions (
  id, key, name, description, cadence, mission_type, target, xp_reward, config, is_active
)
values
  ('90000000-0000-4000-8000-000000000001', 'daily_play_one', 'Make a Move', 'Complete one game in any mode and save it.', 'daily', 'play', 1, 30, '{"savedRequired":true}', true),
  ('90000000-0000-4000-8000-000000000002', 'daily_puzzles_three', 'Three Positions', 'Attempt three tactical puzzles.', 'daily', 'puzzle', 3, 40, '{}', true),
  ('90000000-0000-4000-8000-000000000003', 'weekly_openings_five', 'Opening Week', 'Complete five opening trainer lines.', 'weekly', 'opening', 5, 100, '{}', true),
  ('90000000-0000-4000-8000-000000000004', 'weekly_games_five', 'Full Schedule', 'Complete five online games this week.', 'weekly', 'play', 5, 120, '{"mode":"online"}', true),
  ('90000000-0000-4000-8000-000000000005', 'ai_first_win', 'Challenge Accepted', 'Win against any AI difficulty.', 'one_time', 'ai', 1, 60, '{}', true)
on conflict (id) do nothing;

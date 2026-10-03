-- =============================================================================
-- 03_views.sql -- Read models for the Kings Arena backend
--
-- Depends on: 01_tables.sql, 02_functions.sql
-- Run order:  01 -> 02 -> 03 -> 04
--
-- Three views:
--   1. public.tournament_standings     one row per non-withdrawn participant
--   2. public.player_tournament_stats  one row per individual participation
--   3. public.player_rankings          aggregate career stats + rank
--
-- All views are CREATE OR REPLACE so the files are re-runnable. The column
-- list/order below is therefore fixed and must not be changed in place.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. public.tournament_standings
--
-- One row per NON-withdrawn tournament participant. Matches count only when the
-- fixture has a completed result (both scores present). Participants with no
-- completed matches still appear, with zeros, thanks to the LEFT JOIN.
--
-- Points: league = 3/win + 1/draw; every other format (knockout, group_knockout)
-- scores on wins only.
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.tournament_standings;
CREATE OR REPLACE VIEW public.tournament_standings AS
WITH completed_results AS (
    SELECT
        f.tournament_id,
        f.home_participant_id,
        f.away_participant_id,
        r.home_score,
        r.away_score
    FROM public.fixtures f
    JOIN public.fixture_results r
      ON r.fixture_id = f.id
    WHERE r.home_score IS NOT NULL
      AND r.away_score IS NOT NULL
),
-- Two perspective rows per completed result: one from the home side, one from
-- the away side. UNION ALL keeps both rows (a participant never plays itself).
perspectives AS (
    SELECT
        c.tournament_id,
        c.home_participant_id                       AS participant_id,
        c.home_score::integer                       AS goals_for,
        c.away_score::integer                       AS goals_against,
        (c.home_score > c.away_score)               AS won,
        (c.home_score = c.away_score)               AS drew,
        (c.home_score < c.away_score)               AS lost
    FROM completed_results c

    UNION ALL

    SELECT
        c.tournament_id,
        c.away_participant_id                       AS participant_id,
        c.away_score::integer                       AS goals_for,
        c.home_score::integer                       AS goals_against,
        (c.away_score > c.home_score)               AS won,
        (c.home_score = c.away_score)               AS drew,
        (c.away_score < c.home_score)               AS lost
    FROM completed_results c
),
participant_totals AS (
    SELECT
        p.tournament_id,
        p.participant_id,
        count(*)::integer                                             AS played,
        count(*) FILTER (WHERE p.won)::integer                        AS won,
        count(*) FILTER (WHERE p.drew)::integer                       AS drew,
        count(*) FILTER (WHERE p.lost)::integer                       AS lost,
        COALESCE(sum(p.goals_for), 0)::integer                        AS goals_for,
        COALESCE(sum(p.goals_against), 0)::integer                    AS goals_against
    FROM perspectives p
    GROUP BY p.tournament_id, p.participant_id
)
SELECT
    tp.tournament_id,
    t.name                                       AS tournament_name,
    tp.id                                        AS participant_id,
    t.format                                     AS format,
    tp.status                                     AS status,
    COALESCE(a.played, 0)::integer                AS played,
    COALESCE(a.won, 0)::integer                   AS won,
    COALESCE(a.drew, 0)::integer                  AS drew,
    COALESCE(a.lost, 0)::integer                  AS lost,
    COALESCE(a.goals_for, 0)::integer             AS goals_for,
    COALESCE(a.goals_against, 0)::integer         AS goals_against,
    (COALESCE(a.goals_for, 0) - COALESCE(a.goals_against, 0))::integer AS goal_difference,
    CASE
        WHEN t.format = 'league' THEN (COALESCE(a.won, 0) * 3 + COALESCE(a.drew, 0))::integer
        ELSE COALESCE(a.won, 0)::integer
    END                                           AS points
FROM public.tournament_participants tp
JOIN public.tournaments t
  ON t.id = tp.tournament_id
LEFT JOIN participant_totals a
  ON a.tournament_id = tp.tournament_id
 AND a.participant_id = tp.id
WHERE tp.status <> 'withdrawn';


-- -----------------------------------------------------------------------------
-- 2. public.player_tournament_stats
--
-- One row per INDIVIDUAL participation (team entries excluded, so a user who
-- entered with a team is not double counted).
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.player_tournament_stats;
CREATE OR REPLACE VIEW public.player_tournament_stats AS
SELECT
    tp.user_id,
    p.id                                         AS profile_id,
    p.username,
    p.display_name,
    p.profile_picture,
    t.id                                         AS tournament_id,
    t.name                                       AS tournament_name,
    t.game,
    t.status                                     AS tournament_status,
    COALESCE(s.played, 0)::integer                AS played,
    COALESCE(s.won, 0)::integer                   AS won,
    COALESCE(s.drew, 0)::integer                  AS drew,
    COALESCE(s.lost, 0)::integer                  AS lost,
    COALESCE(s.goals_for, 0)::integer             AS goals_for,
    COALESCE(s.goals_against, 0)::integer         AS goals_against,
    COALESCE(s.goal_difference, 0)::integer       AS goal_difference,
    COALESCE(s.points, 0)::integer                AS points
FROM public.tournament_participants tp
JOIN public.profiles p
  ON p.id = tp.user_id
JOIN public.tournaments t
  ON t.id = tp.tournament_id
LEFT JOIN public.tournament_standings s
  ON s.participant_id = tp.id
 AND s.tournament_id = tp.tournament_id
WHERE tp.user_id IS NOT NULL
  AND tp.status <> 'withdrawn';


-- -----------------------------------------------------------------------------
-- 3. public.player_rankings
--
-- Career totals per user, ranked by points, then wins, then goal difference,
-- then goals scored. win_rate is a percentage rounded to 1 decimal.
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.player_rankings;
CREATE OR REPLACE VIEW public.player_rankings AS
WITH career AS (
    SELECT
        pts.user_id,
        max(pts.username)                          AS username,
        max(pts.display_name)                      AS display_name,
        max(pts.profile_picture)                   AS profile_picture,
        count(*)::integer                          AS tournaments_entered,
        COALESCE(sum(pts.played), 0)::integer       AS played,
        COALESCE(sum(pts.won), 0)::integer          AS won,
        COALESCE(sum(pts.drew), 0)::integer         AS drew,
        COALESCE(sum(pts.lost), 0)::integer         AS lost,
        COALESCE(sum(pts.goals_for), 0)::integer    AS goals_for,
        COALESCE(sum(pts.goals_against), 0)::integer AS goals_against,
        COALESCE(sum(pts.points), 0)::integer       AS points
    FROM public.player_tournament_stats pts
    GROUP BY pts.user_id
)
SELECT
    rank() OVER (
        ORDER BY
            points DESC,
            won DESC,
            (goals_for - goals_against) DESC,
            goals_for DESC
    )::integer                                    AS rank,
    user_id,
    username,
    display_name,
    profile_picture,
    tournaments_entered,
    played,
    won,
    drew,
    lost,
    goals_for,
    goals_against,
    (goals_for - goals_against)::integer          AS goal_difference,
    points,
    COALESCE(
        round(won::numeric / NULLIF(played, 0) * 100, 1),
        0
    )                                             AS win_rate
FROM career;


-- =============================================================================
-- End of 03_views.sql
-- View SELECT grants are issued in 04_rls_grants.sql, after this file runs.
-- =============================================================================

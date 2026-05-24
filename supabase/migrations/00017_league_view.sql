-- 00017_league_view.sql

CREATE OR REPLACE VIEW public.league_standings_view AS
SELECT 
    t.id AS team_id,
    t.name AS team_name,
    COUNT(m.id) AS matches_played,
    SUM(CASE WHEN (m.home_team_id = t.id AND m.home_score > m.away_score) OR (m.away_team_id = t.id AND m.away_score > m.home_score) THEN 1 ELSE 0 END)::INTEGER AS wins,
    SUM(CASE WHEN m.home_score = m.away_score AND m.id IS NOT NULL THEN 1 ELSE 0 END)::INTEGER AS draws,
    SUM(CASE WHEN (m.home_team_id = t.id AND m.home_score < m.away_score) OR (m.away_team_id = t.id AND m.away_score < m.home_score) THEN 1 ELSE 0 END)::INTEGER AS losses,
    SUM(
        CASE WHEN (m.home_team_id = t.id AND m.home_score > m.away_score) OR (m.away_team_id = t.id AND m.away_score > m.home_score) THEN 3
             WHEN m.home_score = m.away_score AND m.id IS NOT NULL THEN 1
             ELSE 0
        END
    )::INTEGER AS points
FROM public.teams t
LEFT JOIN public.matches m ON t.id = m.home_team_id OR t.id = m.away_team_id
GROUP BY t.id, t.name
ORDER BY points DESC, wins DESC, matches_played ASC;

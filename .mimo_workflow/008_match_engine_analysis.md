# Task 008: Match Engine Deep Dive & Mechanics Analysis

## Context
You are acting as the Lead Gameplay Engineer. The user wants a deep, focused analysis of the **Match Engine** logic ONLY. Do not look at UI, database schemas, or general project architecture right now.

## Objective
Do **NOT** write any code or make modifications to the codebase during this task. Your sole objective is to analyze the existing match simulation code and propose gameplay improvements.

## Areas to Analyze (Match Engine ONLY)
1. **Simulation Logic**: Where does the match simulation live? (e.g., `lib/matchEngine.ts`, `utils/gameLogic.ts`). Review the algorithms that determine goals, possession, and events.
2. **Player Attributes & RNG**: How are player stats (OVR, Attack, Defense, Stamina) currently factoring into the simulation? Is the randomness (RNG) balanced or does it feel arbitrary?
3. **Missing Mechanics**: What standard football manager mechanics are missing from our engine? (e.g., Formations impact, Tactical styles like 'Tiki-Taka' vs 'Counter Attack', Weather conditions, Player Morale, Stamina depletion during the match, Red/Yellow cards).
4. **Calculations**: Are the math formulas for calculating win probability sound?

## Output
Write a focused markdown report outlining your findings about the match engine and concrete proposals for upgrading the simulation logic. Save this report to `.mimo_workflow/008_engine_analysis_report.md`.

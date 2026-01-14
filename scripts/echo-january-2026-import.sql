-- ============================================
-- ECHO SCHEDULE JANUARY 2026 IMPORT
-- Run this in Supabase SQL Editor
-- ============================================

-- First, delete existing January 2025 data
DELETE FROM echo_schedule_assignments WHERE date >= '2025-01-01' AND date <= '2025-01-31';
DELETE FROM echo_pto WHERE date >= '2025-01-01' AND date <= '2025-01-31';

-- ============================================
-- WEEK 1: Jan 1-2, 2026 (Thu-Fri)
-- Jan 1 = Holiday (no assignments)
-- ============================================

-- Friday Jan 2, 2026
-- CVI Rooms
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-02', r.id, t.id, 'AM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'CVI' AND t.name = 'Lisa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-02', r.id, t.id, 'PM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'CVI' AND t.name = 'Lisa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-02', r.id, t.id, 'AM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Linda''s Room' AND t.name = 'Nancy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-02', r.id, t.id, 'PM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Linda''s Room' AND t.name = 'Nancy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-02', r.id, t.id, 'AM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Lisa/Nancy Room' AND t.name = 'Anna';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-02', r.id, t.id, 'PM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Lisa/Nancy Room' AND t.name = 'Anna';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-02', r.id, t.id, 'AM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Karina';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-02', r.id, t.id, 'PM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Karina';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-02', r.id, t.id, 'AM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Wendy Vascular Room' AND t.name = 'Wendy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-02', r.id, t.id, 'PM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Wendy Vascular Room' AND t.name = 'Wendy';

-- Fourth Floor Jan 2
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-02', r.id, t.id, 'AM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Room 1' AND t.name = 'Sonal';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-02', r.id, t.id, 'PM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Room 1' AND t.name = 'Sonal';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-02', r.id, t.id, 'AM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Room 4' AND t.name = 'Tomy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-02', r.id, t.id, 'PM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Room 4' AND t.name = 'Tomy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-02', r.id, t.id, 'AM'
FROM echo_rooms r, echo_techs t
WHERE r.name = 'Portables' AND t.name = 'Ewa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-02', r.id, t.id, 'PM'
FROM echo_rooms r, echo_techs t
WHERE r.name = 'Portables' AND t.name = 'Ewa';

-- PTO Jan 2: Linda
INSERT INTO echo_pto (date, echo_tech_id, time_block, reason)
SELECT '2026-01-02', t.id, 'AM', NULL
FROM echo_techs t WHERE t.name = 'Linda';

INSERT INTO echo_pto (date, echo_tech_id, time_block, reason)
SELECT '2026-01-02', t.id, 'PM', NULL
FROM echo_techs t WHERE t.name = 'Linda';

-- ============================================
-- WEEK 2: Jan 5-9, 2026 (Mon-Fri)
-- ============================================

-- Monday Jan 5
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-05', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'CVI' AND t.name = 'Lisa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-05', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Linda''s Room' AND t.name = 'Linda';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-05', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Lisa/Nancy Room' AND t.name = 'Nancy';

-- Anna/Karina both in Room 3
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-05', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Anna';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-05', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Karina';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-05', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Wendy Vascular Room' AND t.name = 'Wendy';

-- Fourth Floor Jan 5
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-05', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'Fourth Floor Lab' AND t.name = 'Ewa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-05', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Room 4' AND t.name = 'Tomy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-05', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.name = 'Portables' AND t.name = 'Sonal';

-- Tuesday Jan 6
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-06', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'CVI' AND t.name = 'Nancy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-06', r.id, t.id, 'AM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Linda''s Room' AND t.name = 'Lisa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-06', r.id, t.id, 'PM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Linda''s Room' AND t.name = 'Linda';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-06', r.id, t.id, 'AM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Lisa/Nancy Room' AND t.name = 'Anna';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-06', r.id, t.id, 'PM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Lisa/Nancy Room' AND t.name = 'Lisa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-06', r.id, t.id, 'AM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Karina';

-- Anna/Karina PM
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-06', r.id, t.id, 'PM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Anna';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-06', r.id, t.id, 'PM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Karina';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-06', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Wendy Vascular Room' AND t.name = 'Wendy';

-- Fourth Floor Jan 6
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-06', r.id, t.id, 'AM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Room 1' AND t.name = 'Linda';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-06', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'Fourth Floor Lab' AND t.name = 'Ewa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-06', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Room 4' AND t.name = 'Tomy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-06', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.name = 'Portables' AND t.name = 'Sonal';

-- PTO Jan 6: Karina (off)
INSERT INTO echo_pto (date, echo_tech_id, time_block, reason)
SELECT '2026-01-06', t.id, 'AM', 'off'
FROM echo_techs t WHERE t.name = 'Karina';

INSERT INTO echo_pto (date, echo_tech_id, time_block, reason)
SELECT '2026-01-06', t.id, 'PM', 'off'
FROM echo_techs t WHERE t.name = 'Karina';

-- Wednesday Jan 7
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-07', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'CVI' AND t.name = 'Anna';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-07', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Linda''s Room' AND t.name = 'Lisa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-07', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Lisa/Nancy Room' AND t.name = 'Nancy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-07', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Linda';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-07', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Wendy Vascular Room' AND t.name = 'Wendy';

-- Room 8: Wen
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-07', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Vascular/EP/echo' AND t.name = 'Wen';

-- Fourth Floor Jan 7
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-07', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'Fourth Floor Lab' AND t.name = 'Ewa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-07', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Room 4' AND t.name = 'Tomy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-07', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.name = 'Portables' AND t.name = 'Sonal';

-- PTO Jan 7: Lisa (sick)
INSERT INTO echo_pto (date, echo_tech_id, time_block, reason)
SELECT '2026-01-07', t.id, 'AM', 'sick'
FROM echo_techs t WHERE t.name = 'Lisa';

INSERT INTO echo_pto (date, echo_tech_id, time_block, reason)
SELECT '2026-01-07', t.id, 'PM', 'sick'
FROM echo_techs t WHERE t.name = 'Lisa';

-- Thursday Jan 8
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-08', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'CVI' AND t.name = 'Linda';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-08', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Linda''s Room' AND t.name = 'Anna';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-08', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Lisa/Nancy Room' AND t.name = 'Nancy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-08', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Karina';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-08', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Wendy Vascular Room' AND t.name = 'Wendy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-08', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Vascular/EP/echo' AND t.name = 'Wen';

-- Fourth Floor Jan 8
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-08', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'Fourth Floor Lab' AND t.name = 'Ewa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-08', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Room 4' AND t.name = 'Tomy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-08', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.name = 'Portables' AND t.name = 'Sonal';

-- PTO Jan 8: Lisa
INSERT INTO echo_pto (date, echo_tech_id, time_block, reason)
SELECT '2026-01-08', t.id, 'AM', NULL
FROM echo_techs t WHERE t.name = 'Lisa';

INSERT INTO echo_pto (date, echo_tech_id, time_block, reason)
SELECT '2026-01-08', t.id, 'PM', NULL
FROM echo_techs t WHERE t.name = 'Lisa';

-- Friday Jan 9
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-09', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'CVI' AND t.name = 'Linda';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-09', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Lisa/Nancy Room' AND t.name = 'Nancy';

-- Anna/Karina Room 3
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-09', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Anna';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-09', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Karina';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-09', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Wendy Vascular Room' AND t.name = 'Wendy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-09', r.id, t.id, 'PM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Vascular/EP/echo' AND t.name = 'Wen';

-- Fourth Floor Jan 9
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-09', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'Fourth Floor Lab' AND t.name = 'Ewa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-09', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Room 4' AND t.name = 'Tomy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-09', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.name = 'Portables' AND t.name = 'Sonal';

-- ============================================
-- WEEK 3: Jan 12-16, 2026
-- ============================================

-- Monday Jan 12
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-12', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'CVI' AND t.name = 'Lisa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-12', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Linda''s Room' AND t.name = 'Anna';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-12', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Lisa/Nancy Room' AND t.name = 'Nancy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-12', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Karina';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-12', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Wendy Vascular Room' AND t.name = 'Wendy';

-- Fourth Floor Jan 12
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-12', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Room 1' AND t.name = 'Sonal';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-12', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'Fourth Floor Lab' AND t.name = 'Ewa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-12', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.name = 'Portables' AND t.name = 'Tomy';

-- PTO Jan 12: Linda
INSERT INTO echo_pto (date, echo_tech_id, time_block, reason)
SELECT '2026-01-12', t.id, 'AM', NULL
FROM echo_techs t WHERE t.name = 'Linda';

INSERT INTO echo_pto (date, echo_tech_id, time_block, reason)
SELECT '2026-01-12', t.id, 'PM', NULL
FROM echo_techs t WHERE t.name = 'Linda';

-- Tuesday Jan 13
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-13', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'CVI' AND t.name = 'Nancy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-13', r.id, t.id, 'AM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Linda''s Room' AND t.name = 'Lisa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-13', r.id, t.id, 'PM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Linda''s Room' AND t.name = 'Linda';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-13', r.id, t.id, 'AM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Lisa/Nancy Room' AND t.name = 'Anna';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-13', r.id, t.id, 'PM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Lisa/Nancy Room' AND t.name = 'Lisa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-13', r.id, t.id, 'AM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Karina';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-13', r.id, t.id, 'PM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Anna';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-13', r.id, t.id, 'PM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Karina';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-13', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Wendy Vascular Room' AND t.name = 'Wendy';

-- Fourth Floor Jan 13
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-13', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Room 1' AND t.name = 'Sonal';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-13', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'Fourth Floor Lab' AND t.name = 'Ewa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-13', r.id, t.id, 'AM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Room 4' AND t.name = 'Linda';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-13', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.name = 'Portables' AND t.name = 'Tomy';

-- Wednesday Jan 14
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-14', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'CVI' AND t.name = 'Karina';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-14', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Linda''s Room' AND t.name = 'Lisa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-14', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Lisa/Nancy Room' AND t.name = 'Nancy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-14', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Linda';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-14', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Wendy Vascular Room' AND t.name = 'Wendy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-14', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Vascular/EP/echo' AND t.name = 'Wen';

-- Fourth Floor Jan 14
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-14', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Room 1' AND t.name = 'Sonal';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-14', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'Fourth Floor Lab' AND t.name = 'Ewa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-14', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.name = 'Portables' AND t.name = 'Tomy';

-- Thursday Jan 15
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-15', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'CVI' AND t.name = 'Linda';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-15', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Linda''s Room' AND t.name = 'Lisa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-15', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Lisa/Nancy Room' AND t.name = 'Nancy';

-- Anna/Karina Room 3
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-15', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Anna';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-15', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Karina';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-15', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Vascular/EP/echo' AND t.name = 'Wen';

-- Fourth Floor Jan 15
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-15', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Room 1' AND t.name = 'Sonal';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-15', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'Fourth Floor Lab' AND t.name = 'Ewa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-15', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.name = 'Portables' AND t.name = 'Tomy';

-- PTO Jan 15: Wendy
INSERT INTO echo_pto (date, echo_tech_id, time_block, reason)
SELECT '2026-01-15', t.id, 'AM', NULL
FROM echo_techs t WHERE t.name = 'Wendy';

INSERT INTO echo_pto (date, echo_tech_id, time_block, reason)
SELECT '2026-01-15', t.id, 'PM', NULL
FROM echo_techs t WHERE t.name = 'Wendy';

-- Friday Jan 16
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-16', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'CVI' AND t.name = 'Linda';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-16', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Linda''s Room' AND t.name = 'Lisa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-16', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Lisa/Nancy Room' AND t.name = 'Nancy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-16', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Anna';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-16', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Vascular/EP/echo' AND t.name = 'Wen';

-- Fourth Floor Jan 16
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-16', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Room 1' AND t.name = 'Sonal';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-16', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'Fourth Floor Lab' AND t.name = 'Ewa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-16', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.name = 'Portables' AND t.name = 'Tomy';

-- PTO Jan 16: Wendy, Karina (off)
INSERT INTO echo_pto (date, echo_tech_id, time_block, reason)
SELECT '2026-01-16', t.id, 'AM', NULL
FROM echo_techs t WHERE t.name = 'Wendy';

INSERT INTO echo_pto (date, echo_tech_id, time_block, reason)
SELECT '2026-01-16', t.id, 'PM', NULL
FROM echo_techs t WHERE t.name = 'Wendy';

INSERT INTO echo_pto (date, echo_tech_id, time_block, reason)
SELECT '2026-01-16', t.id, 'AM', 'off'
FROM echo_techs t WHERE t.name = 'Karina';

INSERT INTO echo_pto (date, echo_tech_id, time_block, reason)
SELECT '2026-01-16', t.id, 'PM', 'off'
FROM echo_techs t WHERE t.name = 'Karina';

-- ============================================
-- WEEK 4: Jan 19-23, 2026
-- Jan 19 = MLK Holiday
-- ============================================

-- Tuesday Jan 20
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-20', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'CVI' AND t.name = 'Nancy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-20', r.id, t.id, 'AM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Linda''s Room' AND t.name = 'Lisa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-20', r.id, t.id, 'PM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Linda''s Room' AND t.name = 'Linda';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-20', r.id, t.id, 'AM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Lisa/Nancy Room' AND t.name = 'Anna';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-20', r.id, t.id, 'PM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Lisa/Nancy Room' AND t.name = 'Lisa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-20', r.id, t.id, 'AM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Karina';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-20', r.id, t.id, 'PM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Anna';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-20', r.id, t.id, 'PM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Karina';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-20', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Wendy Vascular Room' AND t.name = 'Wendy';

-- Fourth Floor Jan 20
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-20', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Room 1' AND t.name = 'Sonal';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-20', r.id, t.id, 'AM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'Fourth Floor Lab' AND t.name = 'Linda';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-20', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Room 4' AND t.name = 'Tomy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-20', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.name = 'Portables' AND t.name = 'Ewa';

-- PTO Jan 20: Karina (off)
INSERT INTO echo_pto (date, echo_tech_id, time_block, reason)
SELECT '2026-01-20', t.id, 'AM', 'off'
FROM echo_techs t WHERE t.name = 'Karina';

INSERT INTO echo_pto (date, echo_tech_id, time_block, reason)
SELECT '2026-01-20', t.id, 'PM', 'off'
FROM echo_techs t WHERE t.name = 'Karina';

-- Wednesday Jan 21
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-21', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'CVI' AND t.name = 'Anna';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-21', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Linda''s Room' AND t.name = 'Lisa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-21', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Lisa/Nancy Room' AND t.name = 'Nancy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-21', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Linda';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-21', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Wendy Vascular Room' AND t.name = 'Wendy';

-- Fourth Floor Jan 21
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-21', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Room 1' AND t.name = 'Sonal';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-21', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Room 4' AND t.name = 'Tomy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-21', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.name = 'Portables' AND t.name = 'Ewa';

-- Thursday Jan 22
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-22', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'CVI' AND t.name = 'Linda';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-22', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Linda''s Room' AND t.name = 'Lisa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-22', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Lisa/Nancy Room' AND t.name = 'Nancy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-22', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Anna';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-22', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Karina';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-22', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Wendy Vascular Room' AND t.name = 'Wendy';

-- Fourth Floor Jan 22
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-22', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Room 1' AND t.name = 'Sonal';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-22', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'Fourth Floor Lab' AND t.name = 'Ewa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-22', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Room 4' AND t.name = 'Tomy';

-- Friday Jan 23
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-23', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'CVI' AND t.name = 'Linda';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-23', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Linda''s Room' AND t.name = 'Lisa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-23', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Lisa/Nancy Room' AND t.name = 'Nancy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-23', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Anna';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-23', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Karina';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-23', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Wendy Vascular Room' AND t.name = 'Wendy';

-- Fourth Floor Jan 23
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-23', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Room 1' AND t.name = 'Sonal';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-23', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Room 4' AND t.name = 'Tomy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-23', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.name = 'Portables' AND t.name = 'Ewa';

-- ============================================
-- WEEK 5: Jan 26-30, 2026
-- ============================================

-- Monday Jan 26
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-26', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'CVI' AND t.name = 'Lisa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-26', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Linda''s Room' AND t.name = 'Linda';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-26', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Lisa/Nancy Room' AND t.name = 'Nancy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-26', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Anna';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-26', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Karina';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-26', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Wendy Vascular Room' AND t.name = 'Wendy';

-- Fourth Floor Jan 26
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-26', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'Fourth Floor Lab' AND t.name = 'Ewa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-26', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Room 4' AND t.name = 'Tomy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-26', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.name = 'Portables' AND t.name = 'Sonal';

-- Tuesday Jan 27
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-27', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'CVI' AND t.name = 'Nancy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-27', r.id, t.id, 'AM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Linda''s Room' AND t.name = 'Lisa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-27', r.id, t.id, 'PM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Linda''s Room' AND t.name = 'Linda';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-27', r.id, t.id, 'AM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Lisa/Nancy Room' AND t.name = 'Anna';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-27', r.id, t.id, 'PM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Lisa/Nancy Room' AND t.name = 'Lisa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-27', r.id, t.id, 'AM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Karina';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-27', r.id, t.id, 'PM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Anna';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-27', r.id, t.id, 'PM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Karina';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-27', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Wendy Vascular Room' AND t.name = 'Wendy';

-- Fourth Floor Jan 27
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-27', r.id, t.id, 'AM'
FROM echo_rooms r, echo_techs t
WHERE r.short_name = 'Room 1' AND t.name = 'Linda';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-27', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'Fourth Floor Lab' AND t.name = 'Ewa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-27', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Room 4' AND t.name = 'Tomy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-27', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.name = 'Portables' AND t.name = 'Sonal';

-- Wednesday Jan 28
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-28', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'CVI' AND t.name = 'Anna';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-28', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Linda''s Room' AND t.name = 'Lisa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-28', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Lisa/Nancy Room' AND t.name = 'Nancy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-28', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Linda';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-28', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Wendy Vascular Room' AND t.name = 'Wendy';

-- Fourth Floor Jan 28
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-28', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'Fourth Floor Lab' AND t.name = 'Ewa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-28', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Room 4' AND t.name = 'Sukhjeet';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-28', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.name = 'Portables' AND t.name = 'Sonal';

-- PTO Jan 28: Karina (off), Tomy
INSERT INTO echo_pto (date, echo_tech_id, time_block, reason)
SELECT '2026-01-28', t.id, 'AM', 'off'
FROM echo_techs t WHERE t.name = 'Karina';

INSERT INTO echo_pto (date, echo_tech_id, time_block, reason)
SELECT '2026-01-28', t.id, 'PM', 'off'
FROM echo_techs t WHERE t.name = 'Karina';

INSERT INTO echo_pto (date, echo_tech_id, time_block, reason)
SELECT '2026-01-28', t.id, 'AM', NULL
FROM echo_techs t WHERE t.name = 'Tomy';

INSERT INTO echo_pto (date, echo_tech_id, time_block, reason)
SELECT '2026-01-28', t.id, 'PM', NULL
FROM echo_techs t WHERE t.name = 'Tomy';

-- Thursday Jan 29
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-29', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'CVI' AND t.name = 'Linda';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-29', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Linda''s Room' AND t.name = 'Lisa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-29', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Lisa/Nancy Room' AND t.name = 'Nancy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-29', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Anna';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-29', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Karina';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-29', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Wendy Vascular Room' AND t.name = 'Wendy';

-- Fourth Floor Jan 29
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-29', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'Fourth Floor Lab' AND t.name = 'Ewa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-29', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Room 4' AND t.name = 'Sukhjeet';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-29', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.name = 'Portables' AND t.name = 'Sonal';

-- PTO Jan 29: Tomy
INSERT INTO echo_pto (date, echo_tech_id, time_block, reason)
SELECT '2026-01-29', t.id, 'AM', NULL
FROM echo_techs t WHERE t.name = 'Tomy';

INSERT INTO echo_pto (date, echo_tech_id, time_block, reason)
SELECT '2026-01-29', t.id, 'PM', NULL
FROM echo_techs t WHERE t.name = 'Tomy';

-- Friday Jan 30
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-30', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'CVI' AND t.name = 'Linda';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-30', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Linda''s Room' AND t.name = 'Lisa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-30', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Lisa/Nancy Room' AND t.name = 'Nancy';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-30', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Anna';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-30', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Anna/Karina Room' AND t.name = 'Karina';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-30', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Wendy Vascular Room' AND t.name = 'Wendy';

-- Fourth Floor Jan 30
INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-30', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Stress Echo Room' AND r.category = 'Fourth Floor Lab' AND t.name = 'Ewa';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-30', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.short_name = 'Room 4' AND t.name = 'Sukhjeet';

INSERT INTO echo_schedule_assignments (date, echo_room_id, echo_tech_id, time_block)
SELECT '2026-01-30', r.id, t.id, tb.block
FROM echo_rooms r, echo_techs t, (VALUES ('AM'), ('PM')) AS tb(block)
WHERE r.name = 'Portables' AND t.name = 'Sonal';

-- PTO Jan 30: Tomy
INSERT INTO echo_pto (date, echo_tech_id, time_block, reason)
SELECT '2026-01-30', t.id, 'AM', NULL
FROM echo_techs t WHERE t.name = 'Tomy';

INSERT INTO echo_pto (date, echo_tech_id, time_block, reason)
SELECT '2026-01-30', t.id, 'PM', NULL
FROM echo_techs t WHERE t.name = 'Tomy';

-- ============================================
-- END OF JANUARY 2026 IMPORT
-- ============================================

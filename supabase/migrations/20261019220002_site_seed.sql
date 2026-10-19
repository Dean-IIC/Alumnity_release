-- The showcase as it was in the code until October 2026, loaded into the `site` schema once:
-- the gallery's albums, their parts, photos and videos (lib/gallery.ts and lib/gallery-*.json
-- then), and the text of the college's pages (lib/about-content.ts). The photo files stay in
-- the repo (public/assets/gallery), so each photo's src is its path there.
--
-- Runs once: every statement checks site.seeds for 'showcase-2026-10', and the last one
-- writes it. Run again (PGlite runs every migration on every start), it adds nothing, and an
-- album or photo the college desk has deleted doesn't come back.
-- Made by a one-off script from the code it replaces; edit the albums from the desk now.

insert into site.albums (slug, title, about, happened_on, when_text, cover_src, cover_sketch, cover_width, cover_height, sort, published, created_at, updated_at)
select v.slug, v.title, v.about, v.happened_on, v.when_text, v.cover_src, v.cover_sketch, v.cover_width::integer, v.cover_height::integer, 0, true, 1792411200000, 1792411200000
from (values
  ('graduation-day-2025', 'Graduation Day', 'The class of 2025 on their graduation day.', '2025-09-30', 'September 2025', '/assets/gallery/graduation-day-2025/cover.jpg', '/assets/gallery/graduation-day-2025/cover-sketch.jpg', 1000, 666),
  ('swagatha-2025', 'Swagatha ’25', 'Welcome day for the college’s new first-year engineering students.', '2025-09-29', 'September 2025', '/assets/gallery/swagatha-2025/cover.jpg', '/assets/gallery/swagatha-2025/cover-sketch.jpg', 1000, 666),
  ('onam-2025', 'Onam', 'Onam on campus: a dance on stage.', '2025-09-28', 'September 2025', '/assets/gallery/onam-2025/cover.jpg', '/assets/gallery/onam-2025/cover-sketch.jpg', 1000, 666),
  ('independence-day-2025', 'Independence Day', 'The 79th Independence Day: raising the flag, and celebrations on campus.', '2025-08-15', '15 August 2025', '/assets/gallery/independence-day-2025/cover.jpg', '/assets/gallery/independence-day-2025/cover-sketch.jpg', 1000, 666),
  ('around-campus-2024-25', 'Around campus', 'Yoga Day, a poster competition, practice interviews, a food carnival and a road safety show. Plus two films about the college.', '2025-06-21', '2024 – 2025', '/assets/gallery/around-campus-2024-25/cover.jpg', '/assets/gallery/around-campus-2024-25/cover-sketch.jpg', 1000, 562),
  ('cyber-security-conclave-2025', 'Cyber Security Conclave', 'ICSC 2025, the college’s International Cyber Security Conclave, at CMA Royal, Bengaluru. Talks on keeping computers and data safe.', '2025-02-06', '6 February 2025', '/assets/gallery/cyber-security-conclave-2025/cover.jpg', '/assets/gallery/cyber-security-conclave-2025/cover-sketch.jpg', 1000, 666),
  ('swachh-bharat-2024', 'Swachh Bharat', 'Fifty-seven final-year AIML students cleaned up the grounds of the government school in Nagawara.', '2024-12-11', '11 December 2024', '/assets/gallery/swachh-bharat-2024/cover.jpg', '/assets/gallery/swachh-bharat-2024/cover-sketch.jpg', 942, 1000),
  ('job-drives', 'Job drives', 'The Indian Army and the Indian Air Force came to the college to hire students.', '2011-01', '2010 and 2011', '/assets/gallery/job-drives/cover.jpg', '/assets/gallery/job-drives/cover-sketch.jpg', 800, 533),
  ('alumni-meets', 'Alumni meets', 'Past students come back to meet each other and today’s students.', '2009-01', '2008 and 2009', '/assets/gallery/alumni-meets/cover.jpg', '/assets/gallery/alumni-meets/cover-sketch.jpg', 800, 533),
  ('sports-day', 'Sports Day', 'Games and races on the college ground.', '', 'Before 2014', '/assets/gallery/sports-day/cover.jpg', '/assets/gallery/sports-day/cover-sketch.jpg', 800, 533),
  ('uninor-cup', 'The Uninor Cup', 'The college team in blue, and the prize-giving at the Uninor Cup.', '', 'Before 2014', '/assets/gallery/uninor-cup/cover.jpg', '/assets/gallery/uninor-cup/cover-sketch.jpg', 800, 533)
) as v(slug, title, about, happened_on, when_text, cover_src, cover_sketch, cover_width, cover_height)
where not exists (select 1 from site.seeds where name = 'showcase-2026-10')
on conflict (slug) do nothing;

insert into site.album_parts (album_id, key, title, when_text, source, sort)
select a.id, v.key, v.title, v.when_text, v.source, v.sort::integer
from (values
  ('graduation-day-2025', 'all', null, 'September 2025', 'portal', 0),
  ('swagatha-2025', 'all', null, 'September 2025', 'portal', 0),
  ('onam-2025', 'all', null, 'September 2025', 'portal', 0),
  ('independence-day-2025', 'all', null, '15 August 2025', 'portal', 0),
  ('around-campus-2024-25', 'yoga-day-2025', 'International Yoga Day', '21 June 2025', 'college-site', 0),
  ('around-campus-2024-25', 'cse-poster-competition-2024', 'Poster competition, Computer Science', '5 December 2024', 'college-site', 1),
  ('around-campus-2024-25', 'ece-mock-interviews-2024', 'Mock interviews, Electronics and Communication', '23 November 2024', 'college-site', 2),
  ('around-campus-2024-25', 'food-carnival-2024', 'Food Carnival', '14 November 2024', 'college-site', 3),
  ('around-campus-2024-25', 'vyom-2024', 'VYOM 2024, road safety show', '12 November 2024', 'college-site', 4),
  ('around-campus-2024-25', 'films', 'Films about the college', '2019 and 2025', 'socials', 5),
  ('cyber-security-conclave-2025', 'all', null, '6 February 2025', 'portal', 0),
  ('swachh-bharat-2024', 'all', null, '11 December 2024', 'portal', 0),
  ('job-drives', 'indian-air-force-2011', 'Indian Air Force', '2011', 'old-site', 0),
  ('job-drives', 'indian-army-2010', 'Indian Army', '2010', 'old-site', 1),
  ('alumni-meets', '2009', 'Alumni meet 2009', '2009', 'old-site', 0),
  ('alumni-meets', '2008', 'Alumni meet 2008', '2008', 'old-site', 1),
  ('alumni-meets', 'stories', 'Alumni stories', '2026', 'socials', 2),
  ('sports-day', 'all', null, 'Before 2014', 'old-site', 0),
  ('uninor-cup', 'all', null, 'Before 2014', 'old-site', 0)
) as v(slug, key, title, when_text, source, sort)
join site.albums a on a.slug = v.slug
where not exists (select 1 from site.seeds where name = 'showcase-2026-10')
on conflict (album_id, key) do nothing;

insert into site.photos (album_id, part_key, src, thumb, width, height, thumb_width, alt, caption, sort, created_at)
select a.id, v.part_key, v.src, v.thumb, v.width::integer, v.height::integer, v.thumb_width::integer, v.alt, v.caption, v.sort::integer, 1792411200000
from (values
  ('graduation-day-2025', 'all', '/assets/gallery/graduation-day-2025/01.jpg', '/assets/gallery/graduation-day-2025/01-thumb.jpg', 1600, 1066, 640, 'The class of 2025 throw their caps in the air', 'The class of 2025 throw their caps in the air', 0),
  ('swagatha-2025', 'all', '/assets/gallery/swagatha-2025/01.jpg', '/assets/gallery/swagatha-2025/01-thumb.jpg', 1600, 1066, 640, 'Swagatha ’25, September 2025', null, 0),
  ('swagatha-2025', 'all', '/assets/gallery/swagatha-2025/02.jpg', '/assets/gallery/swagatha-2025/02-thumb.jpg', 1600, 1066, 640, 'Swagatha ’25, September 2025', null, 1),
  ('swagatha-2025', 'all', '/assets/gallery/swagatha-2025/03.jpg', '/assets/gallery/swagatha-2025/03-thumb.jpg', 1600, 1066, 640, 'Swagatha ’25, September 2025', null, 2),
  ('swagatha-2025', 'all', '/assets/gallery/swagatha-2025/04.jpg', '/assets/gallery/swagatha-2025/04-thumb.jpg', 1600, 1066, 640, 'Swagatha ’25, September 2025', null, 3),
  ('swagatha-2025', 'all', '/assets/gallery/swagatha-2025/05.jpg', '/assets/gallery/swagatha-2025/05-thumb.jpg', 1600, 1066, 640, 'Swagatha ’25, September 2025', null, 4),
  ('swagatha-2025', 'all', '/assets/gallery/swagatha-2025/06.jpg', '/assets/gallery/swagatha-2025/06-thumb.jpg', 1600, 1066, 640, 'Swagatha ’25, September 2025', null, 5),
  ('swagatha-2025', 'all', '/assets/gallery/swagatha-2025/07.jpg', '/assets/gallery/swagatha-2025/07-thumb.jpg', 1600, 1066, 640, 'Swagatha ’25, September 2025', null, 6),
  ('swagatha-2025', 'all', '/assets/gallery/swagatha-2025/08.jpg', '/assets/gallery/swagatha-2025/08-thumb.jpg', 1600, 1066, 640, 'Swagatha ’25, September 2025', null, 7),
  ('swagatha-2025', 'all', '/assets/gallery/swagatha-2025/09.jpg', '/assets/gallery/swagatha-2025/09-thumb.jpg', 1600, 1066, 640, 'Swagatha ’25, September 2025', null, 8),
  ('onam-2025', 'all', '/assets/gallery/onam-2025/01.jpg', '/assets/gallery/onam-2025/01-thumb.jpg', 1600, 1066, 640, 'A dancer at the Onam celebration', 'A dancer at the Onam celebration', 0),
  ('independence-day-2025', 'all', '/assets/gallery/independence-day-2025/01.jpg', '/assets/gallery/independence-day-2025/01-thumb.jpg', 1600, 1066, 640, 'Independence Day, 15 August 2025', null, 0),
  ('independence-day-2025', 'all', '/assets/gallery/independence-day-2025/02.jpg', '/assets/gallery/independence-day-2025/02-thumb.jpg', 1600, 1066, 640, 'Independence Day, 15 August 2025', null, 1),
  ('independence-day-2025', 'all', '/assets/gallery/independence-day-2025/03.jpg', '/assets/gallery/independence-day-2025/03-thumb.jpg', 1600, 1066, 640, 'Independence Day, 15 August 2025', null, 2),
  ('independence-day-2025', 'all', '/assets/gallery/independence-day-2025/04.jpg', '/assets/gallery/independence-day-2025/04-thumb.jpg', 1600, 1066, 640, 'Independence Day, 15 August 2025', null, 3),
  ('independence-day-2025', 'all', '/assets/gallery/independence-day-2025/05.jpg', '/assets/gallery/independence-day-2025/05-thumb.jpg', 1600, 1066, 640, 'Independence Day, 15 August 2025', null, 4),
  ('independence-day-2025', 'all', '/assets/gallery/independence-day-2025/06.jpg', '/assets/gallery/independence-day-2025/06-thumb.jpg', 1600, 1066, 640, 'Independence Day, 15 August 2025', null, 5),
  ('independence-day-2025', 'all', '/assets/gallery/independence-day-2025/07.jpg', '/assets/gallery/independence-day-2025/07-thumb.jpg', 1600, 1066, 640, 'Independence Day, 15 August 2025', null, 6),
  ('independence-day-2025', 'all', '/assets/gallery/independence-day-2025/08.jpg', '/assets/gallery/independence-day-2025/08-thumb.jpg', 1600, 1066, 640, 'Independence Day, 15 August 2025', null, 7),
  ('independence-day-2025', 'all', '/assets/gallery/independence-day-2025/09.jpg', '/assets/gallery/independence-day-2025/09-thumb.jpg', 1600, 1066, 640, 'Independence Day, 15 August 2025', null, 8),
  ('around-campus-2024-25', 'yoga-day-2025', '/assets/gallery/around-campus-2024-25/01.jpg', '/assets/gallery/around-campus-2024-25/01-thumb.jpg', 1600, 900, 640, 'Students doing yoga on the college ground', 'Students doing yoga on the college ground', 0),
  ('around-campus-2024-25', 'cse-poster-competition-2024', '/assets/gallery/around-campus-2024-25/02.jpg', '/assets/gallery/around-campus-2024-25/02-thumb.jpg', 707, 630, 640, 'Winners getting their certificates', 'Winners getting their certificates', 1),
  ('around-campus-2024-25', 'ece-mock-interviews-2024', '/assets/gallery/around-campus-2024-25/03.jpg', '/assets/gallery/around-campus-2024-25/03-thumb.jpg', 1600, 900, 640, 'Final-year ECE students in a practice group discussion', 'Final-year ECE students in a practice group discussion', 2),
  ('around-campus-2024-25', 'food-carnival-2024', '/assets/gallery/around-campus-2024-25/04.jpg', '/assets/gallery/around-campus-2024-25/04-thumb.jpg', 1280, 960, 640, 'Third-semester students and teachers at the food stalls', 'Third-semester students and teachers at the food stalls', 3),
  ('around-campus-2024-25', 'vyom-2024', '/assets/gallery/around-campus-2024-25/05.jpg', '/assets/gallery/around-campus-2024-25/05-thumb.jpg', 960, 1280, 640, 'A stunt rider at the road safety show', 'A stunt rider at the road safety show', 4),
  ('cyber-security-conclave-2025', 'all', '/assets/gallery/cyber-security-conclave-2025/01.jpg', '/assets/gallery/cyber-security-conclave-2025/01-thumb.jpg', 1600, 1066, 640, 'Cyber Security Conclave, 6 February 2025', null, 0),
  ('cyber-security-conclave-2025', 'all', '/assets/gallery/cyber-security-conclave-2025/02.jpg', '/assets/gallery/cyber-security-conclave-2025/02-thumb.jpg', 1600, 1066, 640, 'Cyber Security Conclave, 6 February 2025', null, 1),
  ('cyber-security-conclave-2025', 'all', '/assets/gallery/cyber-security-conclave-2025/03.jpg', '/assets/gallery/cyber-security-conclave-2025/03-thumb.jpg', 1600, 1066, 640, 'Cyber Security Conclave, 6 February 2025', null, 2),
  ('cyber-security-conclave-2025', 'all', '/assets/gallery/cyber-security-conclave-2025/04.jpg', '/assets/gallery/cyber-security-conclave-2025/04-thumb.jpg', 1600, 1066, 640, 'Cyber Security Conclave, 6 February 2025', null, 3),
  ('cyber-security-conclave-2025', 'all', '/assets/gallery/cyber-security-conclave-2025/05.jpg', '/assets/gallery/cyber-security-conclave-2025/05-thumb.jpg', 1600, 1066, 640, 'Cyber Security Conclave, 6 February 2025', null, 4),
  ('cyber-security-conclave-2025', 'all', '/assets/gallery/cyber-security-conclave-2025/06.jpg', '/assets/gallery/cyber-security-conclave-2025/06-thumb.jpg', 1600, 1066, 640, 'Cyber Security Conclave, 6 February 2025', null, 5),
  ('swachh-bharat-2024', 'all', '/assets/gallery/swachh-bharat-2024/01.jpg', '/assets/gallery/swachh-bharat-2024/01-thumb.jpg', 1507, 1600, 640, 'AIML students clearing the school grounds', 'AIML students clearing the school grounds', 0),
  ('job-drives', 'indian-air-force-2011', '/assets/gallery/job-drives/01.jpg', '/assets/gallery/job-drives/01-thumb.jpg', 800, 533, 640, 'The college’s welcome sign for the Indian Air Force', 'The college’s welcome sign for the Indian Air Force', 0),
  ('job-drives', 'indian-air-force-2011', '/assets/gallery/job-drives/02.jpg', '/assets/gallery/job-drives/02-thumb.jpg', 800, 533, 640, 'Students gathering on the college ground', 'Students gathering on the college ground', 1),
  ('job-drives', 'indian-air-force-2011', '/assets/gallery/job-drives/03.jpg', '/assets/gallery/job-drives/03-thumb.jpg', 800, 533, 640, 'Students lining up past the college buses', 'Students lining up past the college buses', 2),
  ('job-drives', 'indian-air-force-2011', '/assets/gallery/job-drives/04.jpg', '/assets/gallery/job-drives/04-thumb.jpg', 800, 533, 640, 'The queue beside the college buses', 'The queue beside the college buses', 3),
  ('job-drives', 'indian-air-force-2011', '/assets/gallery/job-drives/05.jpg', '/assets/gallery/job-drives/05-thumb.jpg', 800, 533, 640, 'An interview with the selection panel', 'An interview with the selection panel', 4),
  ('job-drives', 'indian-air-force-2011', '/assets/gallery/job-drives/06.jpg', '/assets/gallery/job-drives/06-thumb.jpg', 800, 533, 640, 'Students waiting under the shelter', 'Students waiting under the shelter', 5),
  ('job-drives', 'indian-army-2010', '/assets/gallery/job-drives/07.jpg', '/assets/gallery/job-drives/07-thumb.jpg', 800, 533, 640, 'The college’s welcome sign for the Indian Army', 'The college’s welcome sign for the Indian Army', 6),
  ('job-drives', 'indian-army-2010', '/assets/gallery/job-drives/08.jpg', '/assets/gallery/job-drives/08-thumb.jpg', 800, 533, 640, 'In the college office', 'In the college office', 7),
  ('job-drives', 'indian-army-2010', '/assets/gallery/job-drives/09.jpg', '/assets/gallery/job-drives/09-thumb.jpg', 800, 533, 640, 'Army officers in the college office', 'Army officers in the college office', 8),
  ('job-drives', 'indian-army-2010', '/assets/gallery/job-drives/10.jpg', '/assets/gallery/job-drives/10-thumb.jpg', 800, 533, 640, 'A packed talk in the big tent', 'A packed talk in the big tent', 9),
  ('job-drives', 'indian-army-2010', '/assets/gallery/job-drives/11.jpg', '/assets/gallery/job-drives/11-thumb.jpg', 800, 533, 640, 'Students at the talk', 'Students at the talk', 10),
  ('job-drives', 'indian-army-2010', '/assets/gallery/job-drives/12.jpg', '/assets/gallery/job-drives/12-thumb.jpg', 800, 533, 640, 'Students waiting their turn', 'Students waiting their turn', 11),
  ('job-drives', 'indian-army-2010', '/assets/gallery/job-drives/13.jpg', '/assets/gallery/job-drives/13-thumb.jpg', 800, 533, 640, 'Waiting in the hall', 'Waiting in the hall', 12),
  ('job-drives', 'indian-army-2010', '/assets/gallery/job-drives/14.jpg', '/assets/gallery/job-drives/14-thumb.jpg', 800, 533, 640, 'The interview panel', 'The interview panel', 13),
  ('alumni-meets', '2009', '/assets/gallery/alumni-meets/01.jpg', '/assets/gallery/alumni-meets/01-thumb.jpg', 800, 533, 640, 'Alumni meet 2009, 2009', null, 0),
  ('alumni-meets', '2009', '/assets/gallery/alumni-meets/02.jpg', '/assets/gallery/alumni-meets/02-thumb.jpg', 800, 533, 640, 'Alumni meet 2009, 2009', null, 1),
  ('alumni-meets', '2009', '/assets/gallery/alumni-meets/03.jpg', '/assets/gallery/alumni-meets/03-thumb.jpg', 800, 533, 640, 'Alumni meet 2009, 2009', null, 2),
  ('alumni-meets', '2009', '/assets/gallery/alumni-meets/04.jpg', '/assets/gallery/alumni-meets/04-thumb.jpg', 800, 533, 640, 'Alumni meet 2009, 2009', null, 3),
  ('alumni-meets', '2008', '/assets/gallery/alumni-meets/05.jpg', '/assets/gallery/alumni-meets/05-thumb.jpg', 800, 533, 640, 'Alumni meet 2008, 2008', null, 4),
  ('alumni-meets', '2008', '/assets/gallery/alumni-meets/06.jpg', '/assets/gallery/alumni-meets/06-thumb.jpg', 800, 533, 640, 'Alumni meet 2008, 2008', null, 5),
  ('alumni-meets', '2008', '/assets/gallery/alumni-meets/07.jpg', '/assets/gallery/alumni-meets/07-thumb.jpg', 800, 533, 640, 'Alumni meet 2008, 2008', null, 6),
  ('alumni-meets', '2008', '/assets/gallery/alumni-meets/08.jpg', '/assets/gallery/alumni-meets/08-thumb.jpg', 800, 533, 640, 'Alumni meet 2008, 2008', null, 7),
  ('alumni-meets', '2008', '/assets/gallery/alumni-meets/09.jpg', '/assets/gallery/alumni-meets/09-thumb.jpg', 800, 533, 640, 'Alumni meet 2008, 2008', null, 8),
  ('alumni-meets', '2008', '/assets/gallery/alumni-meets/10.jpg', '/assets/gallery/alumni-meets/10-thumb.jpg', 800, 533, 640, 'Alumni meet 2008, 2008', null, 9),
  ('alumni-meets', '2008', '/assets/gallery/alumni-meets/11.jpg', '/assets/gallery/alumni-meets/11-thumb.jpg', 800, 533, 640, 'Alumni meet 2008, 2008', null, 10),
  ('alumni-meets', '2008', '/assets/gallery/alumni-meets/12.jpg', '/assets/gallery/alumni-meets/12-thumb.jpg', 800, 533, 640, 'Alumni meet 2008, 2008', null, 11),
  ('alumni-meets', '2008', '/assets/gallery/alumni-meets/13.jpg', '/assets/gallery/alumni-meets/13-thumb.jpg', 800, 533, 640, 'Alumni meet 2008, 2008', null, 12),
  ('alumni-meets', '2008', '/assets/gallery/alumni-meets/14.jpg', '/assets/gallery/alumni-meets/14-thumb.jpg', 800, 533, 640, 'Alumni meet 2008, 2008', null, 13),
  ('alumni-meets', '2008', '/assets/gallery/alumni-meets/15.jpg', '/assets/gallery/alumni-meets/15-thumb.jpg', 800, 533, 640, 'Alumni meet 2008, 2008', null, 14),
  ('alumni-meets', '2008', '/assets/gallery/alumni-meets/16.jpg', '/assets/gallery/alumni-meets/16-thumb.jpg', 800, 533, 640, 'Alumni meet 2008, 2008', null, 15),
  ('sports-day', 'all', '/assets/gallery/sports-day/01.jpg', '/assets/gallery/sports-day/01-thumb.jpg', 800, 533, 640, 'Sports Day, Before 2014', null, 0),
  ('sports-day', 'all', '/assets/gallery/sports-day/02.jpg', '/assets/gallery/sports-day/02-thumb.jpg', 800, 533, 640, 'Sports Day, Before 2014', null, 1),
  ('sports-day', 'all', '/assets/gallery/sports-day/03.jpg', '/assets/gallery/sports-day/03-thumb.jpg', 800, 533, 640, 'Sports Day, Before 2014', null, 2),
  ('sports-day', 'all', '/assets/gallery/sports-day/04.jpg', '/assets/gallery/sports-day/04-thumb.jpg', 800, 533, 640, 'Sports Day, Before 2014', null, 3),
  ('sports-day', 'all', '/assets/gallery/sports-day/05.jpg', '/assets/gallery/sports-day/05-thumb.jpg', 800, 533, 640, 'Sports Day, Before 2014', null, 4),
  ('uninor-cup', 'all', '/assets/gallery/uninor-cup/01.jpg', '/assets/gallery/uninor-cup/01-thumb.jpg', 800, 533, 640, 'The Uninor Cup, Before 2014', null, 0),
  ('uninor-cup', 'all', '/assets/gallery/uninor-cup/02.jpg', '/assets/gallery/uninor-cup/02-thumb.jpg', 800, 533, 640, 'The Uninor Cup, Before 2014', null, 1),
  ('uninor-cup', 'all', '/assets/gallery/uninor-cup/03.jpg', '/assets/gallery/uninor-cup/03-thumb.jpg', 800, 533, 640, 'The Uninor Cup, Before 2014', null, 2),
  ('uninor-cup', 'all', '/assets/gallery/uninor-cup/04.jpg', '/assets/gallery/uninor-cup/04-thumb.jpg', 800, 533, 640, 'The Uninor Cup, Before 2014', null, 3),
  ('uninor-cup', 'all', '/assets/gallery/uninor-cup/05.jpg', '/assets/gallery/uninor-cup/05-thumb.jpg', 800, 533, 640, 'The Uninor Cup, Before 2014', null, 4)
) as v(slug, part_key, src, thumb, width, height, thumb_width, alt, caption, sort)
join site.albums a on a.slug = v.slug
where not exists (select 1 from site.seeds where name = 'showcase-2026-10')
on conflict (album_id, src) do nothing;

update site.albums a set cover_photo_id = p.id
from (values
  ('graduation-day-2025', '/assets/gallery/graduation-day-2025/01.jpg'),
  ('swagatha-2025', '/assets/gallery/swagatha-2025/01.jpg'),
  ('onam-2025', '/assets/gallery/onam-2025/01.jpg'),
  ('independence-day-2025', '/assets/gallery/independence-day-2025/05.jpg'),
  ('around-campus-2024-25', '/assets/gallery/around-campus-2024-25/01.jpg'),
  ('cyber-security-conclave-2025', '/assets/gallery/cyber-security-conclave-2025/02.jpg'),
  ('swachh-bharat-2024', '/assets/gallery/swachh-bharat-2024/01.jpg'),
  ('job-drives', '/assets/gallery/job-drives/10.jpg'),
  ('alumni-meets', '/assets/gallery/alumni-meets/09.jpg'),
  ('sports-day', '/assets/gallery/sports-day/03.jpg'),
  ('uninor-cup', '/assets/gallery/uninor-cup/01.jpg')
) as v(slug, src)
join site.photos p on p.src = v.src
where a.slug = v.slug and p.album_id = a.id and a.cover_photo_id is null and not exists (select 1 from site.seeds where name = 'showcase-2026-10');

insert into site.videos (album_id, part_key, url, title, poster_src, poster_width, poster_height, sort)
select a.id, v.part_key, v.url, v.title, v.poster_src, v.poster_width::integer, v.poster_height::integer, v.sort::integer
from (values
  ('around-campus-2024-25', 'films', 'https://www.youtube.com/watch?v=GnUL3E4oDRs', 'More than just a degree: the college’s film', '/assets/gallery/around-campus-2024-25/video-GnUL3E4oDRs.jpg', 640, 360, 0),
  ('around-campus-2024-25', 'films', 'https://www.youtube.com/watch?v=Ma5MbZ-Y9wM', 'The campus', '/assets/gallery/around-campus-2024-25/video-Ma5MbZ-Y9wM.jpg', 640, 360, 1),
  ('alumni-meets', 'stories', 'https://www.instagram.com/hkbkgroupofficial/reel/DeQqbNPDHXE/', 'From the first AIML batch to V2SOFT: Mohammed Hussein Junaid', '/assets/gallery/alumni-meets/video-DeQqbNPDHXE.jpg', 640, 1138, 0)
) as v(slug, part_key, url, title, poster_src, poster_width, poster_height, sort)
join site.albums a on a.slug = v.slug
where not exists (select 1 from site.seeds where name = 'showcase-2026-10')
on conflict (album_id, url) do nothing;

insert into site.pages (slug, title, body, signer_name, signer_role, updated_at)
select v.slug, v.title, v.body, v.signer_name, v.signer_role, 1792411200000
from (values
  ('director-letter', 'The director''s message', 'Dear Esteemed Alumni,

It fills my heart with immense pride and gratitude to address you, the torchbearers of HKBK’s legacy spanning over two remarkable decades. As I reflect on the journeys each of you has undertaken since your time at HKBK, I am deeply inspired by the dedication, resilience, and excellence you continue to embody in every corner of the world.

Your achievements are not just personal milestones; they stand as beacons of inspiration for generations of HKBKians to come. Through your success stories, you illuminate the path for others, demonstrating the values, education, and spirit that define our institution. Truly, you are among our greatest sources of pride.

This message is more than an invitation to reunite; it is a heartfelt celebration of the unbreakable bond that connects us all. While life may have taken you across diverse geographies and careers, the spirit of HKBK lives on within you. In your growth and well-being, our institution finds its strength and purpose.

Today, we live in an era where technology bridges distances and connects hearts, no matter how far apart. I often picture the many faces of our alumni, trailblazers who have travelled countless miles and decades, yet remain connected by an enduring commitment to excellence. To each of you, who continues to chase new opportunities and strive for greater heights, I extend my warmest invitation to reconnect with your alma mater, a place that cherishes your achievements, values your insights, and stands ready to celebrate your journey.

I also recognise that every journey has its share of challenges and triumphs. In your stories of success, setbacks, and perseverance lie invaluable lessons for the HKBKians of today and tomorrow. I sincerely encourage you to share your experiences and wisdom, so they may guide and inspire our students as they prepare to navigate life and career with courage and grace.

Looking ahead, the prospect of welcoming you back fills me with hope and anticipation. Your voice, your mentorship, and your ideas are vital to shaping HKBK’s next chapter. Together, we can elevate our institution to greater heights, strengthening the timeless bond that unites our past, present, and future.

This is our collective journey, one that thrives on meaningful relationships, collaborative growth, and a shared vision for excellence. My team and I are committed to supporting you in every way, fostering connections that enrich our legacy and create opportunities for generations to come.

To each of you, I extend a warm and heartfelt welcome back home. HKBK will always remain your home away from home, a place where your contributions, your memories, and your dreams will always be cherished. Let us come together to honour our shared past, inspire the present, and build a future where HKBK and its alumni community shine brighter than ever before.

Welcome home!', 'Shri C M Faiz Mohammed', 'Director'),
  ('about-intro', 'About: opening words', 'Alumnity is for everyone who studied or taught at HKBK College of Engineering, Bengaluru. Find each other, help each other and stay in touch.', null, null),
  ('community-intro', 'Community: opening words', 'Who can join, what anyone can see, and what members get.', null, null),
  ('community-lead', 'Community: first paragraph', 'Here, students and alumni of HKBK College of Engineering help each other.

Students get real interview stories, quick answers and referrals from seniors. Alumni keep in touch with their batch and college, and help when they can.', null, null),
  ('committee-office-bearers', 'Committee: office bearers', 'President: To be announced
Vice President: To be announced
Secretary: To be announced
Joint Secretary: To be announced
Treasurer: To be announced', null, null),
  ('committee-members', 'Committee: members', 'Faculty coordinator: To be announced
Department representative · CSE: To be announced
Department representative · ISE: To be announced
Department representative · ECE: To be announced
Department representative · EEE: To be announced
Department representative · MECH: To be announced
Department representative · CIVIL: To be announced
Student representative: To be announced', null, null)
) as v(slug, title, body, signer_name, signer_role)
where not exists (select 1 from site.seeds where name = 'showcase-2026-10')
on conflict (slug) do nothing;

insert into site.seeds (name, ran_at) values ('showcase-2026-10', 1792411200000) on conflict (name) do nothing;

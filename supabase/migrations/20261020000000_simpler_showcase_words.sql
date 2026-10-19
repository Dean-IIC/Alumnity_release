-- The showcase's own words, made simpler (docs/simple-english-changes.md). The seed
-- (20261019220002) runs once, so a database seeded before the change keeps the old words:
-- each row is updated only while it still holds exactly the old text, so anything the
-- college desk has already edited is left alone. Safe to run again.

update site.albums set about = 'Welcome day for the college’s new first-year engineering students.' where slug = 'swagatha-2025' and about = 'Engineering orientation day: the college welcomes its new first-year students.';
update site.albums set about = 'Yoga Day, a poster competition, practice interviews, a food carnival and a road safety show. Plus two films about the college.' where slug = 'around-campus-2024-25' and about = 'Yoga Day, a poster competition, mock interviews, a food carnival and a road safety show, and two films about the college.';
update site.albums set about = 'ICSC 2025, the college’s International Cyber Security Conclave, at CMA Royal, Bengaluru. Talks on keeping computers and data safe.' where slug = 'cyber-security-conclave-2025' and about = 'ICSC 2025, the college’s International Cyber Security Conclave at CMA Royal, Bengaluru: talks and panels on keeping computers and data safe.';
update site.albums set about = 'The Indian Army and the Indian Air Force came to the college to hire students.' where slug = 'job-drives' and about = 'The days the Indian Army and the Indian Air Force came to the college to hire students.';
update site.albums set about = 'Past students come back to meet each other and today’s students.' where slug = 'alumni-meets' and about = 'Former students back at the college to meet each other and today’s students.';
update site.photos set alt = 'Winners getting their certificates' where src = '/assets/gallery/around-campus-2024-25/02.jpg' and alt = 'Winners receiving their certificates';
update site.photos set caption = 'Winners getting their certificates' where src = '/assets/gallery/around-campus-2024-25/02.jpg' and caption = 'Winners receiving their certificates';
update site.pages set body = 'Alumnity is for everyone who studied or taught at HKBK College of Engineering, Bengaluru. Find each other, help each other and stay in touch.' where slug = 'about-intro' and body = 'The alumni and student network of HKBK College of Engineering, Bengaluru. It is one place for everyone who studied or taught here to find each other, help each other and stay in touch.';
update site.pages set body = 'Who can join, what anyone can see, and what members get.' where slug = 'community-intro' and body = 'Who Alumnity is for, what is open to everyone, and what members get.';
update site.pages set body = 'Here, students and alumni of HKBK College of Engineering help each other.

Students get real interview stories, quick answers and referrals from seniors. Alumni keep in touch with their batch and college, and help when they can.' where slug = 'community-lead' and body = 'Alumnity is where students and alumni of HKBK College of Engineering help each other. Students get honest interview experiences, quick answers and referrals from seniors. Alumni stay in touch with their batch and the college, and help students when they have time.';

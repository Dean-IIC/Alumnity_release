/**
 * Content kept from alpha 1 (the About, Community, Committee and Developers pages), word for word except
 * the sentences that would be untrue of this Alumnity (how you join, what members get, what's
 * private), which say what alpha 4 actually does. The college wrote the Director's message;
 * don't edit it.
 */

export const DIRECTOR_MESSAGE = {
  name: "Mr. C M Faiz",
  role: "Director",
  greeting: "Dear Esteemed Alumni,",
  paragraphs: [
    "It fills my heart with immense pride and gratitude to address you, the torchbearers of HKBK’s legacy spanning over two remarkable decades. As I reflect on the journeys each of you has undertaken since your time at HKBK, I am deeply inspired by the dedication, resilience, and excellence you continue to embody in every corner of the world.",
    "Your achievements are not just personal milestones; they stand as beacons of inspiration for generations of HKBKians to come. Through your success stories, you illuminate the path for others, demonstrating the values, education, and spirit that define our institution. Truly, you are among our greatest sources of pride.",
    "This message is more than an invitation to reunite; it is a heartfelt celebration of the unbreakable bond that connects us all. While life may have taken you across diverse geographies and careers, the spirit of HKBK lives on within you. In your growth and well-being, our institution finds its strength and purpose.",
    "Today, we live in an era where technology bridges distances and connects hearts, no matter how far apart. I often picture the many faces of our alumni, trailblazers who have travelled countless miles and decades, yet remain connected by an enduring commitment to excellence. To each of you, who continues to chase new opportunities and strive for greater heights, I extend my warmest invitation to reconnect with your alma mater, a place that cherishes your achievements, values your insights, and stands ready to celebrate your journey.",
    "I also recognise that every journey has its share of challenges and triumphs. In your stories of success, setbacks, and perseverance lie invaluable lessons for the HKBKians of today and tomorrow. I sincerely encourage you to share your experiences and wisdom, so they may guide and inspire our students as they prepare to navigate life and career with courage and grace.",
    "Looking ahead, the prospect of welcoming you back fills me with hope and anticipation. Your voice, your mentorship, and your ideas are vital to shaping HKBK’s next chapter. Together, we can elevate our institution to greater heights, strengthening the timeless bond that unites our past, present, and future.",
    "This is our collective journey, one that thrives on meaningful relationships, collaborative growth, and a shared vision for excellence. My team and I are committed to supporting you in every way, fostering connections that enrich our legacy and create opportunities for generations to come.",
    "To each of you, I extend a warm and heartfelt welcome back home. HKBK will always remain your home away from home, a place where your contributions, your memories, and your dreams will always be cherished. Let us come together to honour our shared past, inspire the present, and build a future where HKBK and its alumni community shine brighter than ever before.",
    "Welcome home!",
  ],
} as const;

/** The students who built Alumnity, and the faculty member who guided them (the Developers page). */
export const DEVELOPERS = {
  team: [
    { name: "Mohammed Rumaan", usn: "1HK24CS160" },
    { name: "Moin Ahmed", usn: "1HK24CS166" },
    { name: "Mohammed Touseef", usn: "1HK24CS145" },
  ],
  department: "Computer Science and Engineering",
  guide: {
    name: "Prof. Sumaiya Banu",
    roles: ["Head of Department, Humanities"],
  },
} as const;

export const ABOUT = {
  intro: `The alumni and student network of HKBK College of Engineering, Bengaluru. It is one place for everyone who studied or taught here to find each other, help each other and stay in touch.`,
  privacy: [
    { title: "Private by default", text: "Your USN and email are never shown to other members. Nothing about you appears on any public page." },
    { title: "You choose who sees what", text: "Every part of your page has its own setting: everyone on Alumnity, your batch, your connections, or only you." },
    { title: "Only HKBK people", text: "Every member is checked against the college register. Members can search the register to invite people, but they only see a name, branch and year, never a USN. Messages are only between connections." }
  ]
};

export const COMMUNITY = {
  intro: `Who Alumnity is for, what is open to everyone, and what members get.`,
  lead: `Alumnity is where students and alumni of HKBK College of Engineering help each other. Students get honest interview experiences, quick answers and referrals from seniors. Alumni stay in touch with their batch and the college, and give back in the time they have.`,
  open: ["What Alumnity is, and how to join", "The gallery of college photos", "The About, Community, Committee and Developers pages"],
  members: [
    "The people directory, profiles, connections and messages",
    "Home: posts, photos, stories and what your batch is up to",
    "Groups for your class, your club, your city or your field",
    "Ask a senior, and the college's events",
    "Causes members propose and the college approves, with gifts through the college's account"
  ],
  joining: [
    "Students and alumni show they are from HKBK by finding their name in the college register. They use their name and USN, or their name, branch and joining year.",
    "Teachers and college staff join by an invitation from the college desk.",
    "Everyone signs up with a personal email, so the account stays theirs after graduation."
  ]
};

export const DEVELOPERS_INTRO = {
  intro: `Alumnity was designed and built by students of HKBK College of Engineering.`,
  body: `Alumnity started as a student project in the Department of Computer Science and Engineering. The aim: one place where HKBK's students and alumni help each other, with questions answered by seniors, referrals, events, and keeping in touch with your batch.`,
};

/** The alumni committee. Names are placeholders until the college confirms them. */
export const OFFICE_BEARERS: { role: string; name: string }[] = [
  { role: "President", name: "To be announced" },
  { role: "Vice President", name: "To be announced" },
  { role: "Secretary", name: "To be announced" },
  { role: "Joint Secretary", name: "To be announced" },
  { role: "Treasurer", name: "To be announced" },
];

export const COMMITTEE: { role: string; name: string }[] = [
  { role: "Faculty coordinator", name: "To be announced" },
  { role: "Department representative · CSE", name: "To be announced" },
  { role: "Department representative · ISE", name: "To be announced" },
  { role: "Department representative · ECE", name: "To be announced" },
  { role: "Department representative · EEE", name: "To be announced" },
  { role: "Department representative · MECH", name: "To be announced" },
  { role: "Department representative · CIVIL", name: "To be announced" },
  { role: "Student representative", name: "To be announced" },
];

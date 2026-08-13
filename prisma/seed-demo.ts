import { config as loadEnv } from 'dotenv';

// Fictional demo content for local development and manual QA — every person, venue and award
// below is invented. Separate from `seed.ts` (which provisions the real admin account and is what
// `prisma.seed` runs): this one is opt-in via `npm run db:seed:demo`, so it never fires as a side
// effect of `prisma migrate dev`.
//
// Additive and idempotent. Each section is skipped when its table already has rows, so re-running
// can't duplicate content, and nothing here deletes anything — appointments in particular are
// never hard-deleted anywhere in this codebase. `npm run db:seed:demo -- --undo` removes exactly
// what this script created (matched by name — see DEMO_APPOINTMENT_NAMES below).

loadEnv({ path: '.env.local' });
loadEnv();

// Imported dynamically, AFTER the env files are loaded: the shared Prisma client builds its pg
// adapter from `process.env.DATABASE_URL` at module scope, and a static `import` would be hoisted
// above the `loadEnv()` calls — the connection string would still be undefined and the pool would
// fail authentication before a single query ran.
const { prisma } = await import('../src/modules/shared/lib/prisma');

const DEMO_PROFILE = {
  fullName: 'Dr. Amara Osei',
  title: 'Professor of Information Security',
  bio: 'Amara Osei studies how large systems fail under adversarial pressure, and how the people who operate them can be given better tools to notice when they are failing. Her group works across applied cryptography, systems security and the human factors that decide whether a defence actually holds in practice.',
  positionAffiliation: 'Chair of Applied Security · Department of Computing, Northgate University',
  researchStatement:
    'Security properties that hold only on paper are not security properties. My research programme is built on measuring real deployments — protocol implementations, key-management workflows, incident-response practice — and feeding what breaks there back into designs that survive contact with production.',
  education: [
    { title: 'PhD, Computer Science', subtitle: 'Northgate University', year: '2009' },
    { title: 'MSc, Cryptography', subtitle: 'University of Rhyswick', year: '2005' },
    { title: 'BSc, Mathematics', subtitle: 'University of Rhyswick', year: '2003' },
  ],
  fellowshipsVisiting: [
    { title: 'Visiting Researcher', subtitle: 'Institute for Secure Systems, Aalborg', year: '2021' },
    { title: 'Senior Fellow', subtitle: 'National Cyber Resilience Programme', year: '2018–2020' },
  ],
  teachingRoles: [
    { title: 'Applied Cryptography', subtitle: 'Postgraduate core module', year: '2014–present' },
    { title: 'Secure Systems Engineering', subtitle: 'Undergraduate, final year', year: '2011–present' },
    { title: 'Incident Response Practicum', subtitle: 'Postgraduate elective', year: '2019–present' },
  ],
  teachingAwards: [
    { title: 'Faculty Teaching Prize', subtitle: 'Northgate University', year: '2022' },
    { title: 'Student-Nominated Supervisor of the Year', subtitle: 'Department of Computing', year: '2019' },
  ],
  scholarshipsTravelAwards: [
    { title: 'Doctoral Scholarship', subtitle: 'Rhyswick Trust', year: '2005–2009' },
    { title: 'Conference Travel Award', subtitle: 'European Security Forum', year: '2016' },
  ],
  researchInterests: [
    { title: 'Applied cryptography', description: 'Protocol design and the gap between specification and implementation.' },
    { title: 'Systems security', description: 'Isolation, supply-chain integrity and trustworthy build pipelines.' },
    { title: 'Human factors', description: 'How operators and developers actually make security decisions under load.' },
    { title: 'Security measurement', description: 'Large-scale empirical study of deployed defences.' },
  ],
  invitedTalks: [
    { title: 'Why Your Threat Model Is a Wish List', subtitle: 'European Security Forum', year: '2024' },
    { title: 'Key Rotation Nobody Performs', subtitle: 'Northgate Industry Day', year: '2023' },
    { title: 'Measuring Defences That Were Never Tested', subtitle: 'Institute for Secure Systems', year: '2022' },
  ],
};

const DEMO_RESEARCH = [
  {
    title: 'Verifiable Build Pipelines for Critical Infrastructure',
    summary:
      'A reproducible-build toolchain that lets an operator prove a deployed binary corresponds to reviewed source, with attestations that survive vendor handover.',
    area: 'Systems Security',
    sortOrder: 1,
  },
  {
    title: 'Key Management as an Operational Practice',
    summary:
      'A longitudinal study of rotation, escrow and revocation in mid-size organisations, and why documented procedures diverge from what operators do at 3am.',
    area: 'Applied Cryptography',
    sortOrder: 2,
  },
  {
    title: 'Adversarial Load Testing for Detection Pipelines',
    summary:
      'Techniques for stress-testing SIEM and detection rules against attackers who know the rules exist, including measurement of alert fatigue thresholds.',
    area: 'Security Measurement',
    sortOrder: 3,
  },
  {
    title: 'Consent and Comprehension in Security Warnings',
    summary:
      'Field work on whether interstitial warnings change behaviour, and what a warning has to say to be acted on rather than dismissed.',
    area: 'Human Factors',
    sortOrder: 4,
  },
];

const DEMO_PUBLICATIONS = [
  {
    title: 'Reproducible Builds in Practice: A Four-Year Field Study',
    authors: 'A. Osei, R. Lindqvist, T. Meyer',
    venue: 'Transactions on Secure Computing',
    year: 2025,
    link: 'https://example.org/publications/reproducible-builds-field-study',
  },
  {
    title: 'The Rotation Gap: Key Management Between Policy and Practice',
    authors: 'A. Osei, N. Haddad',
    venue: 'International Conference on Applied Cryptography',
    year: 2024,
    link: 'https://example.org/publications/rotation-gap',
  },
  {
    title: 'Detection Rules Under Adversarial Load',
    authors: 'P. Ferreira, A. Osei',
    venue: 'Symposium on Security Measurement',
    year: 2023,
    link: 'https://example.org/publications/detection-rules-adversarial-load',
  },
  {
    title: 'What Operators Actually Read: Warning Comprehension at Scale',
    authors: 'A. Osei, S. Whitcombe, J. Park',
    venue: 'Conference on Human Factors in Computing Security',
    year: 2022,
    link: 'https://example.org/publications/warning-comprehension',
  },
  {
    title: 'Supply-Chain Attestations Without a Trusted Vendor',
    authors: 'R. Lindqvist, A. Osei',
    venue: 'Workshop on Trustworthy Systems',
    year: 2021,
    link: 'https://example.org/publications/attestations-without-trusted-vendor',
  },
];

const DEMO_GROUPS = [
  {
    name: 'Applied Cryptography Lab',
    description:
      'Protocol design, implementation review and the long tail of key-management practice in deployed systems.',
    members: [
      { name: 'Nadia Haddad', role: 'Senior Researcher', bio: 'Works on key escrow and revocation in federated deployments.', sortOrder: 1 },
      { name: 'Tobias Meyer', role: 'PhD Candidate', bio: 'Studying formal verification of TLS implementations.', sortOrder: 2 },
      { name: 'Yuki Tanaka', role: 'PhD Candidate', bio: 'Post-quantum migration paths for long-lived signing keys.', sortOrder: 3 },
    ],
  },
  {
    name: 'Secure Systems Group',
    description:
      'Isolation, supply-chain integrity and reproducible builds for infrastructure that cannot be taken offline.',
    members: [
      { name: 'Rasmus Lindqvist', role: 'Postdoctoral Researcher', bio: 'Builds attestation tooling for air-gapped deployments.', sortOrder: 1 },
      { name: 'Chidi Nwosu', role: 'PhD Candidate', bio: 'Container escape analysis in multi-tenant clusters.', sortOrder: 2 },
    ],
  },
  {
    name: 'Security & Human Factors Unit',
    description:
      'Empirical study of how developers and operators make security decisions, and what tooling changes those decisions.',
    members: [
      { name: 'Sophie Whitcombe', role: 'Senior Researcher', bio: 'Field studies of incident-response teams under time pressure.', sortOrder: 1 },
      { name: 'Jae-won Park', role: 'Research Assistant', bio: 'Instrumentation and analysis for large-scale warning studies.', sortOrder: 2 },
    ],
  },
];

/** No research group — exercises the Team Members tab's ungrouped section. */
const DEMO_UNGROUPED_MEMBERS = [
  { name: 'Prof. Elena Vasquez', role: 'Visiting Professor', bio: 'On sabbatical from the Institute for Secure Systems, Aalborg.', sortOrder: 1 },
  { name: 'Dr. Marcus Bell', role: 'Industry Fellow', bio: 'Splits time between the department and a national CERT.', sortOrder: 2 },
];

function daysFromNow(days: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function seed() {
  // Profile is a singleton: overwrite whatever placeholder row exists rather than skipping, since
  // an empty auto-created row is exactly what demo content is meant to replace.
  const existingProfile = await prisma.profile.findFirst();
  if (existingProfile) {
    await prisma.profile.update({ where: { id: existingProfile.id }, data: DEMO_PROFILE });
  } else {
    await prisma.profile.create({ data: DEMO_PROFILE });
  }
  console.log('profile: seeded');

  if ((await prisma.research.count()) === 0) {
    await prisma.research.createMany({ data: DEMO_RESEARCH });
    console.log(`research: ${DEMO_RESEARCH.length} created`);
  } else {
    console.log('research: rows already present — skipped');
  }

  if ((await prisma.publication.count()) === 0) {
    await prisma.publication.createMany({ data: DEMO_PUBLICATIONS });
    console.log(`publications: ${DEMO_PUBLICATIONS.length} created`);
  } else {
    console.log('publications: rows already present — skipped');
  }

  if ((await prisma.researchGroup.count()) === 0) {
    for (const { members, ...group } of DEMO_GROUPS) {
      await prisma.researchGroup.create({
        data: { ...group, teamMembers: { create: members } },
      });
    }
    await prisma.teamMember.createMany({ data: DEMO_UNGROUPED_MEMBERS });
    const grouped = DEMO_GROUPS.reduce((n, g) => n + g.members.length, 0);
    console.log(
      `research groups: ${DEMO_GROUPS.length} created, ${grouped} grouped + ${DEMO_UNGROUPED_MEMBERS.length} ungrouped members`,
    );
  } else {
    console.log('research groups: rows already present — skipped');
  }

  if ((await prisma.appointment.count()) === 0) {
    // Every row here is what the admin would type into "Add appointment" by hand — there is no
    // Calendly-sourced path anymore. Mixed statuses on purpose: three of the four `scheduled`
    // rows are `isPublic: true` (what the public Upcoming Events tab lists), one is kept private
    // to demonstrate the toggle; the two `cancelled` rows exercise the status pill / cancellation
    // reason as retained (soft-cancelled), never-deleted seed data.
    await prisma.appointment.createMany({
      data: [
        {
          requesterName: 'Priya Raman',
          requesterEmail: 'priya.raman@example.org',
          researchGroup: 'Applied Cryptography Lab',
          scheduledAt: daysFromNow(4, 10),
          topic: 'Collaboration on post-quantum key rotation tooling.',
          status: 'scheduled',
          isPublic: true,
        },
        {
          requesterName: 'Daniel Okonkwo',
          requesterEmail: 'd.okonkwo@example.org',
          researchGroup: 'Secure Systems Group',
          scheduledAt: daysFromNow(9, 14),
          topic: 'Reproducible build attestations for a national registry.',
          status: 'scheduled',
          isPublic: true,
        },
        {
          requesterName: 'Lena Fischer',
          requesterEmail: 'lena.fischer@example.org',
          researchGroup: 'Security & Human Factors Unit',
          scheduledAt: daysFromNow(16, 11),
          topic: 'Joint study on warning comprehension in banking apps.',
          status: 'scheduled',
          isPublic: true,
        },
        {
          requesterName: 'Omar Haddadi',
          requesterEmail: 'omar.haddadi@example.org',
          researchGroup: 'Applied Cryptography Lab',
          scheduledAt: daysFromNow(6, 9),
          topic: 'MSc supervision enquiry.',
          status: 'scheduled',
          isPublic: false,
        },
        {
          requesterName: 'Grace Adeyemi',
          scheduledAt: daysFromNow(2, 15),
          topic: 'Vendor pitch.',
          status: 'cancelled',
          cancelReason: 'Not relevant to current research priorities.',
        },
        {
          requesterName: 'Henrik Solberg',
          requesterEmail: 'h.solberg@example.org',
          researchGroup: 'Secure Systems Group',
          scheduledAt: daysFromNow(-3, 13),
          topic: 'Rescheduling — clashed with a conference.',
          status: 'cancelled',
          cancelReason: 'Requester asked to move the meeting.',
        },
      ],
    });
    console.log(
      'appointments: 6 created (4 scheduled — 3 public, 1 private — + 2 cancelled)',
    );
  } else {
    console.log('appointments: rows already present — skipped');
  }
}

const DEMO_APPOINTMENT_NAMES = [
  'Priya Raman',
  'Daniel Okonkwo',
  'Lena Fischer',
  'Omar Haddadi',
  'Grace Adeyemi',
  'Henrik Solberg',
];

async function undo() {
  const appointments = await prisma.appointment.deleteMany({
    where: { requesterName: { in: DEMO_APPOINTMENT_NAMES } },
  });
  const members = await prisma.teamMember.deleteMany({
    where: {
      OR: [
        { researchGroup: { name: { in: DEMO_GROUPS.map((g) => g.name) } } },
        { name: { in: DEMO_UNGROUPED_MEMBERS.map((m) => m.name) } },
      ],
    },
  });
  const groups = await prisma.researchGroup.deleteMany({
    where: { name: { in: DEMO_GROUPS.map((g) => g.name) } },
  });
  const publications = await prisma.publication.deleteMany({
    where: { title: { in: DEMO_PUBLICATIONS.map((p) => p.title) } },
  });
  const research = await prisma.research.deleteMany({
    where: { title: { in: DEMO_RESEARCH.map((r) => r.title) } },
  });

  console.log(
    `undo: ${research.count} research, ${publications.count} publications, ${groups.count} groups, ` +
      `${members.count} team members, ${appointments.count} appointments removed. ` +
      'Profile left as-is (edit it in the admin UI).',
  );
}

const shouldUndo = process.argv.includes('--undo');

(shouldUndo ? undo() : seed())
  .catch((error) => {
    console.error(shouldUndo ? 'Demo undo failed:' : 'Demo seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

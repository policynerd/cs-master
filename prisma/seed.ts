/**
 * Sample data for local development and demos.
 *
 * Everything here is fictional: the Town of Alder Creek, its boards and its
 * members do not exist. Meeting dates are relative to today so the portal
 * always has upcoming and past meetings to show.
 *
 * Run with: npm run db:seed   (wipes and reloads all tables)
 */
import { PrismaClient, type AgendaSection, type SeatRole, type VoteChoice } from "@prisma/client";

const prisma = new PrismaClient();
const DAY = 24 * 60 * 60 * 1000;

const TZ = "America/New_York";

/** Offset of `tz` from UTC at instant `d`, in minutes. */
function tzOffsetMinutes(d: Date, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return (asUtc - d.getTime()) / 60000;
}

/** A date `days` from today at a wall-clock time in the town's timezone. */
function at(days: number, hour: number, minute = 0): Date {
  const base = new Date(Date.now() + days * DAY);
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(base).split("-").map(Number);
  const guess = new Date(Date.UTC(ymd[0], ymd[1] - 1, ymd[2], hour, minute));
  return new Date(guess.getTime() - tzOffsetMinutes(guess, TZ) * 60000);
}

/** The weekday (0 = Sunday) on or after `days` from today, so meetings land on a fixed night. */
function nextWeekday(days: number, weekday: number, hour: number): Date {
  for (let i = 0; i < 7; i++) {
    const d = at(days + i, hour);
    const wd = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(d);
    if (["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd) === weekday) return d;
  }
  throw new Error("unreachable");
}

async function reset() {
  await prisma.$transaction([
    prisma.publicComment.deleteMany(),
    prisma.voteRecord.deleteMany(),
    prisma.motion.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.agendaItem.deleteMany(),
    prisma.attendance.deleteMany(),
    prisma.minutes.deleteMany(),
    prisma.meeting.deleteMany(),
    prisma.seat.deleteMany(),
    prisma.person.deleteMany(),
    prisma.body.deleteMany(),
    prisma.organization.deleteMany(),
  ]);
}

type ItemInput = {
  section: AgendaSection;
  title: string;
  kind?: "ACTION" | "DISCUSSION" | "INFORMATION" | "CEREMONIAL";
  summary?: string;
  recommendedAction?: string;
  fiscalImpact?: string;
  presenter?: string;
  department?: string;
  isConfidential?: boolean;
  legalCitation?: string;
  attachments?: { title: string; url: string; mimeType?: string; sizeBytes?: number; isPublic?: boolean }[];
};

async function addAgenda(meetingId: string, items: ItemInput[]) {
  const positions = new Map<AgendaSection, number>();
  const created = [];
  for (const it of items) {
    const position = (positions.get(it.section) ?? 0) + 1;
    positions.set(it.section, position);
    const { attachments, ...rest } = it;
    created.push(
      await prisma.agendaItem.create({
        data: {
          meetingId,
          position,
          kind: it.kind ?? (["CALL_TO_ORDER", "ROLL_CALL", "PLEDGE", "ADJOURNMENT"].includes(it.section) ? "CEREMONIAL" : "ACTION"),
          ...rest,
          attachments: attachments ? { create: attachments } : undefined,
        },
      }),
    );
  }
  return created;
}

const opening: ItemInput[] = [
  { section: "CALL_TO_ORDER", title: "Call to order" },
  { section: "ROLL_CALL", title: "Roll call" },
];

async function main() {
  await reset();

  await prisma.organization.create({
    data: {
      name: "Town of Alder Creek",
      shortName: "Alder Creek",
      timezone: TZ,
      regularNoticeHours: 72,
      specialNoticeHours: 24,
      emergencyNoticeHours: 1,
    },
  });

  // -- Bodies ---------------------------------------------------------------
  const council = await prisma.body.create({
    data: {
      slug: "town-council",
      name: "Town Council",
      type: "COUNCIL",
      accent: "navy",
      seatCount: 7,
      authority: "Town Charter, Article II",
      description:
        "The Town Council is the legislative body of Alder Creek. It adopts the budget, passes ordinances and appoints members of most boards and commissions.",
    },
  });
  const finance = await prisma.body.create({
    data: {
      slug: "finance-audit-committee",
      name: "Finance & Audit Committee",
      type: "COMMITTEE",
      accent: "gold",
      seatCount: 3,
      parentId: council.id,
      authority: "Council Resolution 2019-14",
      description:
        "A standing committee of the Council that reviews the budget, quarterly financial reports and the annual independent audit before they go to the full Council.",
    },
  });
  const planning = await prisma.body.create({
    data: {
      slug: "planning-commission",
      name: "Planning Commission",
      type: "COMMISSION",
      accent: "forest",
      seatCount: 5,
      authority: "Town Code § 4-201",
      description:
        "The Planning Commission reviews site plans, subdivisions and rezoning requests, holds public hearings on land use, and recommends updates to the Comprehensive Plan.",
    },
  });
  const capital = await prisma.body.create({
    data: {
      slug: "capital-improvements-board",
      name: "Capital Improvements Board",
      type: "BOARD",
      accent: "crimson",
      seatCount: 5,
      authority: "Town Code § 2-310",
      description:
        "Ranks proposed roads, facilities and utility projects and prepares the five-year Capital Improvement Program for Council adoption.",
    },
  });
  const parks = await prisma.body.create({
    data: {
      slug: "parks-recreation-board",
      name: "Parks & Recreation Board",
      type: "BOARD",
      accent: "slate",
      seatCount: 7,
      authority: "Town Code § 2-330",
      description:
        "Advises the Council on parks, trails, recreation programs and fees, and reviews park master plans.",
    },
  });

  // -- People and seats ------------------------------------------------------
  const p = async (firstName: string, lastName: string, title?: string, honorific?: string) =>
    prisma.person.create({ data: { firstName, lastName, title, honorific } });

  const mayor = await p("Renée", "Castellano", "Mayor", "Mayor");
  const cm = [
    mayor,
    await p("Darnell", "Okafor", "Vice Mayor, District 1"),
    await p("Priya", "Raman", "District 2"),
    await p("Thomas", "Whitfield", "District 3"),
    await p("Lucia", "Ferreira", "District 4"),
    await p("Graham", "Holt", "At-Large"),
  ];
  const pc = [
    await p("Marisol", "Vega", "Chair"),
    await p("Ben", "Achterberg"),
    await p("Hannah", "Lindqvist"),
    await p("Samuel", "Ortiz"),
    await p("Ada", "Nwosu"),
  ];
  const cib = [await p("Walter", "Briggs"), await p("Keiko", "Tanaka"), await p("Femi", "Adeyemi"), await p("Rosa", "Delgado")];
  const prb = [
    await p("Claire", "Dunmore"),
    await p("Jamal", "Pierce"),
    await p("Ingrid", "Solberg"),
    await p("Mateo", "Rinaldi"),
    await p("Grace", "Whitaker"),
    await p("Owen", "Mackey"),
  ];

  const seat = (
    bodyId: string,
    personId: string,
    role: SeatRole,
    seatLabel: string | null,
    startYears: number,
    endYears: number | null,
    appointedBy: string | null,
  ) =>
    prisma.seat.create({
      data: {
        bodyId,
        personId,
        role,
        seatLabel,
        appointedBy,
        termStart: at(-365 * startYears, 0),
        termEnd: endYears === null ? null : at(365 * endYears, 0),
      },
    });

  // Council: 7 seats, 6 filled (one vacancy after a resignation).
  await seat(council.id, cm[0].id, "CHAIR", "Mayor", 2, 2, "Elected");
  await seat(council.id, cm[1].id, "VICE_CHAIR", "District 1", 3, 1, "Elected");
  await seat(council.id, cm[2].id, "MEMBER", "District 2", 1, 3, "Elected");
  await seat(council.id, cm[3].id, "MEMBER", "District 3", 3, 1, "Elected");
  await seat(council.id, cm[4].id, "MEMBER", "District 4", 1, 3, "Elected");
  await seat(council.id, cm[5].id, "MEMBER", "At-Large", 2, 2, "Elected");
  const resigned = await p("Victor", "Ashby");
  await prisma.seat.create({
    data: {
      bodyId: council.id,
      personId: resigned.id,
      role: "MEMBER",
      seatLabel: "District 5",
      appointedBy: "Elected",
      termStart: at(-365 * 2, 0),
      termEnd: at(365 * 2, 0),
      endedAt: at(-40, 0),
    },
  });

  await seat(finance.id, cm[1].id, "CHAIR", null, 1, 1, "Council");
  await seat(finance.id, cm[3].id, "MEMBER", null, 1, 1, "Council");
  await seat(finance.id, cm[5].id, "MEMBER", null, 1, 1, "Council");

  await seat(planning.id, pc[0].id, "CHAIR", "Seat A", 3, 1, "Council");
  await seat(planning.id, pc[1].id, "VICE_CHAIR", "Seat B", 2, 2, "Council");
  await seat(planning.id, pc[2].id, "MEMBER", "Seat C", 1, 3, "Council");
  await seat(planning.id, pc[3].id, "MEMBER", "Seat D", 4, 0.08, "Council"); // term ends in ~30 days
  await seat(planning.id, pc[4].id, "MEMBER", "Seat E", 1, 3, "Council");

  await seat(capital.id, cib[0].id, "CHAIR", null, 2, 1, "Council");
  await seat(capital.id, cib[1].id, "MEMBER", null, 2, 1, "Council");
  await seat(capital.id, cib[2].id, "MEMBER", null, 1, 2, "Council");
  await seat(capital.id, cib[3].id, "MEMBER", null, 1, 2, "Council");
  await seat(capital.id, cm[3].id, "EX_OFFICIO", "Council Liaison", 1, 1, "Council");
  await prisma.seat.updateMany({ where: { role: "EX_OFFICIO" }, data: { isVoting: false } });

  for (const [i, person] of prb.entries()) {
    await seat(parks.id, person.id, i === 0 ? "CHAIR" : i === 1 ? "VICE_CHAIR" : "MEMBER", null, 1 + (i % 3), 1 + (i % 2), "Council");
  }

  // -- Meetings ----------------------------------------------------------------
  const vote = async (agendaItemId: string, text: string, movedById: string, secondedById: string, choices: [string, VoteChoice][], result: "PASSED" | "FAILED" | "TABLED" = "PASSED", requiredVotes?: number) =>
    prisma.motion.create({
      data: {
        agendaItemId,
        text,
        movedById,
        secondedById,
        result,
        requiredVotes,
        votes: { create: choices.map(([personId, choice]) => ({ personId, choice })) },
      },
    });

  // Past council meeting, minutes approved.
  const pastCouncilAt = nextWeekday(-30, 2, 19);
  const pastCouncil = await prisma.meeting.create({
    data: {
      bodyId: council.id,
      type: "REGULAR",
      status: "ADJOURNED",
      startsAt: pastCouncilAt,
      endsAt: new Date(pastCouncilAt.getTime() + 2.5 * 3600 * 1000),
      location: "Council Chambers, Town Hall",
      address: "100 Main Street, Alder Creek",
      livestreamUrl: "https://example.org/live/alder-creek",
      recordingUrl: "https://example.org/video/alder-creek/council-regular",
      noticePostedAt: new Date(pastCouncilAt.getTime() - 5 * DAY),
      agendaPublishedAt: new Date(pastCouncilAt.getTime() - 5 * DAY),
    },
  });
  const pci = await addAgenda(pastCouncil.id, [
    ...opening,
    { section: "PLEDGE", title: "Pledge of Allegiance" },
    {
      section: "PRESENTATIONS",
      kind: "CEREMONIAL",
      title: "Proclamation recognizing the Alder Creek Volunteer Fire Company's 100th anniversary",
      presenter: "Mayor Castellano",
    },
    {
      section: "CONSENT",
      title: "Approve the minutes of the previous regular meeting",
    },
    {
      section: "CONSENT",
      title: "Award contract for annual street sweeping services to Valley Sweep Co. ($84,600)",
      department: "Public Works",
      fiscalImpact: "$84,600 from the Streets Maintenance fund, within the adopted budget.",
      recommendedAction: "Award the contract and authorize the Town Manager to sign.",
      attachments: [{ title: "Bid tabulation", url: "https://example.org/docs/sweeping-bid-tab.pdf", mimeType: "application/pdf", sizeBytes: 182_000 }],
    },
    {
      section: "PUBLIC_HEARINGS",
      title: "Ordinance 2026-11: Amend Chapter 12 to allow accessory dwelling units in residential districts (second reading)",
      department: "Planning & Zoning",
      summary:
        "Allows one accessory dwelling unit on single-family lots of 6,000 square feet or more, subject to setback, parking and owner-occupancy standards. The Planning Commission recommended approval 4–1.",
      recommendedAction: "Hold the public hearing and adopt Ordinance 2026-11 on second reading.",
      attachments: [
        { title: "Ordinance 2026-11 (redline)", url: "https://example.org/docs/ord-2026-11.pdf", mimeType: "application/pdf", sizeBytes: 412_000 },
        { title: "Planning Commission recommendation", url: "https://example.org/docs/pc-adu-memo.pdf", mimeType: "application/pdf", sizeBytes: 96_000 },
      ],
    },
    {
      section: "NEW_BUSINESS",
      title: "Resolution 2026-48: Apply for a state Safe Routes to School grant for Elm Street sidewalks",
      department: "Public Works",
      fiscalImpact: "20% local match ($62,000) from the Capital Projects fund if awarded.",
      recommendedAction: "Adopt Resolution 2026-48.",
    },
    {
      section: "CLOSED_SESSION",
      title: "Conference with legal counsel regarding pending litigation",
      isConfidential: true,
      legalCitation: "Open Meetings Act § 2(c)(11): pending litigation",
      summary: "Internal: Harlan v. Town of Alder Creek",
    },
    { section: "ADJOURNMENT", title: "Adjournment" },
  ]);
  const byTitle = (items: { id: string; title: string }[], start: string) => items.find((i) => i.title.startsWith(start))!.id;
  const presentPast = cm;
  await prisma.attendance.createMany({
    data: [
      ...presentPast.slice(0, 5).map((m) => ({ meetingId: pastCouncil.id, personId: m.id, status: "PRESENT" as const })),
      { meetingId: pastCouncil.id, personId: cm[5].id, status: "EXCUSED" as const },
    ],
  });
  const allYes = (members: { id: string }[]) => members.map((m) => [m.id, "YES"] as [string, VoteChoice]);
  await vote(byTitle(pci, "Approve the minutes"), "Approve the consent agenda as presented.", cm[1].id, cm[2].id, [...allYes(cm.slice(0, 5)), [cm[5].id, "ABSENT"]]);
  await vote(byTitle(pci, "Award contract"), "Approve the consent agenda as presented.", cm[1].id, cm[2].id, [...allYes(cm.slice(0, 5)), [cm[5].id, "ABSENT"]]);
  await vote(
    byTitle(pci, "Ordinance 2026-11"),
    "Adopt Ordinance 2026-11 on second reading.",
    cm[2].id,
    cm[4].id,
    [[cm[0].id, "YES"], [cm[1].id, "YES"], [cm[2].id, "YES"], [cm[3].id, "NO"], [cm[4].id, "YES"], [cm[5].id, "ABSENT"]],
  );
  await vote(byTitle(pci, "Resolution 2026-48"), "Adopt Resolution 2026-48.", cm[3].id, cm[1].id, [...allYes(cm.slice(0, 5)), [cm[5].id, "ABSENT"]]);
  await prisma.minutes.create({
    data: {
      meetingId: pastCouncil.id,
      status: "APPROVED",
      approvedAt: at(-16, 20),
      body: [
        "Mayor Castellano called the meeting to order at 7:00 p.m. in Council Chambers. A quorum was present.",
        "",
        "**Presentations.** The Mayor read a proclamation recognizing the Alder Creek Volunteer Fire Company's 100th anniversary. Chief Ellen Marsh accepted on behalf of the company.",
        "",
        "**Consent agenda.** Approved as presented.",
        "",
        "**Public hearing on Ordinance 2026-11.** Planning Director Kim Saeed summarized the ordinance. The Mayor opened the hearing at 7:24 p.m. Eight residents spoke: five in support and three opposed, citing parking on narrow streets. The hearing closed at 7:58 p.m. Councilmember Whitfield asked staff to report back in one year on the number of permits issued and any parking complaints. The ordinance was adopted.",
        "",
        "**Resolution 2026-48.** Adopted after brief discussion of the local match.",
        "",
        "**Closed session.** The Council recessed to closed session at 8:41 p.m. and returned at 9:20 p.m. The Town Attorney reported that no reportable action was taken.",
        "",
        "The meeting adjourned at 9:22 p.m.",
      ].join("\n"),
    },
  });

  // Upcoming council meeting, agenda published, notice met.
  const nextCouncilAt = nextWeekday(6, 2, 19);
  const nextCouncil = await prisma.meeting.create({
    data: {
      bodyId: council.id,
      type: "REGULAR",
      status: "SCHEDULED",
      startsAt: nextCouncilAt,
      location: "Council Chambers, Town Hall",
      address: "100 Main Street, Alder Creek",
      virtualUrl: "https://example.org/join/alder-creek-council",
      livestreamUrl: "https://example.org/live/alder-creek",
      noticePostedAt: at(-1, 10),
      agendaPublishedAt: at(-1, 10),
    },
  });
  const nci = await addAgenda(nextCouncil.id, [
    ...opening,
    { section: "PLEDGE", title: "Pledge of Allegiance" },
    { section: "PUBLIC_COMMENT", kind: "INFORMATION", title: "Public comment on items not on the agenda (3 minutes per speaker)" },
    { section: "CONSENT", title: "Approve the minutes of the previous regular meeting" },
    {
      section: "CONSENT",
      title: "Accept the first-quarter financial report",
      department: "Finance",
      presenter: "Finance Director Alan Pryce",
      attachments: [{ title: "Q1 financial report", url: "https://example.org/docs/q1-report.pdf", mimeType: "application/pdf", sizeBytes: 640_000 }],
    },
    {
      section: "CONSENT",
      title: "Approve a special event permit for the Harvest Festival on Main Street",
      department: "Town Clerk",
    },
    {
      section: "PUBLIC_HEARINGS",
      title: "Adopt the Fiscal Year 2027 budget and set the property tax rate",
      department: "Finance",
      presenter: "Town Manager Ruth Okonkwo",
      summary:
        "The proposed budget totals $48.2 million across all funds, a 3.1% increase. It keeps the tax rate at $0.412 per $100 of assessed value and adds two firefighter positions funded by a federal grant.",
      recommendedAction: "Hold the public hearing, adopt the budget ordinance and the tax-rate resolution.",
      fiscalImpact: "Sets total appropriations of $48.2 million for FY2027.",
      attachments: [
        { title: "Proposed FY2027 budget", url: "https://example.org/docs/fy27-budget.pdf", mimeType: "application/pdf", sizeBytes: 4_800_000 },
        { title: "Budget ordinance", url: "https://example.org/docs/fy27-ordinance.pdf", mimeType: "application/pdf", sizeBytes: 120_000 },
        { title: "Staff working notes", url: "https://example.org/docs/internal-notes.pdf", isPublic: false },
      ],
    },
    {
      section: "NEW_BUSINESS",
      title: "Appoint a member to the Planning Commission, Seat D (term ending in four years)",
      kind: "ACTION",
      department: "Town Clerk",
      summary: "The current term for Seat D expires next month. Three applications were received.",
      recommendedAction: "Make an appointment by motion.",
    },
    {
      section: "NEW_BUSINESS",
      title: "Discuss options to fill the District 5 Council vacancy",
      kind: "DISCUSSION",
      summary:
        "Under the Town Charter the Council may appoint a qualified resident to serve until the next general election, or call a special election.",
    },
    {
      section: "REPORTS",
      kind: "INFORMATION",
      title: "Town Manager's report",
      presenter: "Town Manager Ruth Okonkwo",
    },
    {
      section: "CLOSED_SESSION",
      title: "Real property negotiations: 14 Mill Road",
      isConfidential: true,
      legalCitation: "Open Meetings Act § 2(c)(5): purchase or lease of real property",
    },
    { section: "ADJOURNMENT", title: "Adjournment" },
  ]);
  await prisma.publicComment.createMany({
    data: [
      {
        meetingId: nextCouncil.id,
        agendaItemId: byTitle(nci, "Adopt the Fiscal Year 2027"),
        name: "Patricia Lowe",
        city: "Alder Creek",
        position: "SUPPORT",
        status: "ACCEPTED",
        body: "Thank you for keeping the tax rate flat while adding firefighters. Response times on the east side have been a concern for our neighborhood.",
      },
      {
        meetingId: nextCouncil.id,
        agendaItemId: byTitle(nci, "Adopt the Fiscal Year 2027"),
        name: "Unreviewed submission",
        position: "OPPOSE",
        status: "PENDING",
        body: "This comment is pending clerk review and must not appear on the public portal.",
      },
    ],
  });

  // Upcoming planning commission meeting with a public hearing.
  const pcAt = nextWeekday(9, 4, 18);
  const pcMeeting = await prisma.meeting.create({
    data: {
      bodyId: planning.id,
      type: "REGULAR",
      status: "SCHEDULED",
      startsAt: pcAt,
      location: "Room 201, Town Hall",
      address: "100 Main Street, Alder Creek",
      livestreamUrl: "https://example.org/live/alder-creek",
      noticePostedAt: at(0, 9),
      agendaPublishedAt: at(0, 9),
    },
  });
  await addAgenda(pcMeeting.id, [
    ...opening,
    { section: "APPROVAL_OF_MINUTES", title: "Minutes of the previous regular meeting" },
    {
      section: "PUBLIC_HEARINGS",
      title: "SP-26-07: Site plan for Creekside Commons, 48 townhomes at 2200 River Road",
      department: "Planning & Zoning",
      summary:
        "The applicant proposes 48 townhomes on 6.1 acres zoned R-3 with a new public street connection to River Road and a 50-foot stream buffer.",
      recommendedAction: "Approve with the 14 conditions listed in the staff report.",
      attachments: [
        { title: "Staff report SP-26-07", url: "https://example.org/docs/sp-26-07.pdf", mimeType: "application/pdf", sizeBytes: 1_250_000 },
        { title: "Traffic impact study", url: "https://example.org/docs/sp-26-07-traffic.pdf", mimeType: "application/pdf", sizeBytes: 2_900_000 },
      ],
    },
    { section: "UNFINISHED_BUSINESS", kind: "DISCUSSION", title: "Comprehensive Plan update: land use chapter, draft 2" },
    { section: "ADJOURNMENT", title: "Adjournment" },
  ]);

  // Finance committee: upcoming special meeting, agenda published.
  const finAt = at(3, 16);
  const finMeeting = await prisma.meeting.create({
    data: {
      bodyId: finance.id,
      type: "SPECIAL",
      status: "SCHEDULED",
      startsAt: finAt,
      location: "Conference Room A, Town Hall",
      noticePostedAt: at(-1, 15),
      agendaPublishedAt: at(-1, 15),
    },
  });
  await addAgenda(finMeeting.id, [
    ...opening,
    {
      section: "NEW_BUSINESS",
      title: "Review the draft FY2026 independent audit with the external auditor",
      kind: "DISCUSSION",
      presenter: "Brightwater & Lane CPAs",
    },
    { section: "ADJOURNMENT", title: "Adjournment" },
  ]);

  // Capital board: past meeting, minutes still in draft (not shown publicly).
  const cibPastAt = nextWeekday(-14, 3, 17);
  const cibPast = await prisma.meeting.create({
    data: {
      bodyId: capital.id,
      type: "REGULAR",
      status: "ADJOURNED",
      startsAt: cibPastAt,
      location: "Room 201, Town Hall",
      noticePostedAt: new Date(cibPastAt.getTime() - 4 * DAY),
      agendaPublishedAt: new Date(cibPastAt.getTime() - 4 * DAY),
    },
  });
  const cibItems = await addAgenda(cibPast.id, [
    ...opening,
    {
      section: "NEW_BUSINESS",
      title: "Rank FY2027–2031 capital project requests",
      summary: "Twenty-three requests totaling $31.4 million were scored against the adopted criteria.",
      attachments: [{ title: "Project scoring matrix", url: "https://example.org/docs/cip-scoring.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", sizeBytes: 88_000 }],
    },
    { section: "ADJOURNMENT", title: "Adjournment" },
  ]);
  await vote(
    byTitle(cibItems, "Rank FY2027"),
    "Forward the ranked list to the Town Council with a recommendation to fund the top nine projects.",
    cib[1].id,
    cib[2].id,
    [[cib[0].id, "YES"], [cib[1].id, "YES"], [cib[2].id, "YES"], [cib[3].id, "ABSTAIN"]],
  );
  await prisma.minutes.create({ data: { meetingId: cibPast.id, status: "DRAFT", body: "Draft minutes. Not for public release." } });

  // Parks board: one cancelled, one draft (never public).
  await prisma.meeting.create({
    data: {
      bodyId: parks.id,
      type: "REGULAR",
      status: "CANCELLED",
      startsAt: nextWeekday(12, 1, 18),
      location: "Community Center, Room B",
      cancelledReason: "Lack of quorum. Items move to next month's meeting.",
      noticePostedAt: at(-2, 9),
    },
  });
  await prisma.meeting.create({
    data: {
      bodyId: parks.id,
      type: "WORKSHOP",
      status: "DRAFT",
      title: "DRAFT — Trail master plan workshop (internal, do not publish)",
      startsAt: nextWeekday(20, 1, 18),
    },
  });

  // Planning commission: past meeting with approved minutes.
  const pcPastAt = nextWeekday(-21, 4, 18);
  const pcPast = await prisma.meeting.create({
    data: {
      bodyId: planning.id,
      type: "PUBLIC_HEARING",
      status: "ADJOURNED",
      startsAt: pcPastAt,
      location: "Council Chambers, Town Hall",
      recordingUrl: "https://example.org/video/alder-creek/pc-hearing",
      noticePostedAt: new Date(pcPastAt.getTime() - 15 * DAY),
      agendaPublishedAt: new Date(pcPastAt.getTime() - 6 * DAY),
    },
  });
  const pcPastItems = await addAgenda(pcPast.id, [
    ...opening,
    {
      section: "PUBLIC_HEARINGS",
      title: "Recommendation on Ordinance 2026-11: accessory dwelling units",
      summary: "Text amendment to Chapter 12 allowing accessory dwelling units in residential districts.",
    },
    { section: "ADJOURNMENT", title: "Adjournment" },
  ]);
  await prisma.attendance.createMany({ data: pc.map((m) => ({ meetingId: pcPast.id, personId: m.id, status: "PRESENT" as const })) });
  await vote(
    byTitle(pcPastItems, "Recommendation on Ordinance"),
    "Recommend that the Town Council adopt Ordinance 2026-11.",
    pc[2].id,
    pc[4].id,
    [[pc[0].id, "YES"], [pc[1].id, "NO"], [pc[2].id, "YES"], [pc[3].id, "YES"], [pc[4].id, "YES"]],
  );
  await prisma.minutes.create({
    data: {
      meetingId: pcPast.id,
      status: "APPROVED",
      approvedAt: at(-7, 19),
      body:
        "Chair Vega opened the public hearing at 6:05 p.m. Eleven speakers addressed the Commission. After deliberation the Commission voted to recommend adoption. The meeting adjourned at 8:15 p.m.",
    },
  });

  const counts = {
    bodies: await prisma.body.count(),
    people: await prisma.person.count(),
    meetings: await prisma.meeting.count(),
    agendaItems: await prisma.agendaItem.count(),
  };
  console.log("Seeded sample data:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

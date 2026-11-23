# Board Portal

Meeting and agenda management for public bodies: councils, boards, commissions and their committees.

The goal is a self-hosted platform that covers what public agencies typically buy from vendors such as Granicus: a public meeting portal, agenda building and publication, open-meeting notice compliance, roll-call votes, minutes, written public comment, and appointments to boards and commissions.

## What works today

**Public portal**

- **Home:** upcoming meetings, recently approved minutes and open seats.
- **Meetings:** upcoming and past meetings, filterable by body. Cancelled meetings stay listed with the reason.
- **Meeting page:** the agenda in statutory section order with automatic numbering (`7.A`, `7.B`), staff summaries, recommended actions, fiscal impact and attachments; motions with mover, seconder, result and roll-call votes; attendance; approved minutes; links to the livestream, recording and remote attendance.
- **Public notice status:** each meeting shows the required notice period, when notice was posted and whether the requirement was met.
- **Written public comment:** residents can comment on the meeting or a specific agenda item until it starts. Comments are held for clerk review before they are published.
- **Boards & Commissions:** each body's members, roles, seats and term end dates, vacancies, quorum, terms expiring within 90 days, committees and upcoming meetings.

**Clerk workspace** (`/admin`, staff only)

- **Sign-in:** Microsoft Entra ID, invite-only. Only emails on the staff list can get in, and deactivating someone locks them out on their next click. Two roles: clerks run meetings; admins also manage staff access.
- **Dashboard:** agendas due this week, minutes still to finish, comments waiting for review, and meetings left open past their start time.
- **Scheduling:** meetings start as private drafts. Times are entered in the organization's timezone. Once notice is posted, the time is locked; moving a noticed meeting means cancelling it and scheduling a new one.
- **Agenda builder:** add, edit, reorder and remove items by section; attach public or staff-only documents; closed-session items require their legal authority.
- **Publishing:** publishing is blocked when the notice deadline has passed (emergency meetings excepted). The clerk sees the exact deadline beforehand.
- **Meeting record:** call to order, attendance with a live quorum count, motions with mover and seconder, roll-call votes (every member must be recorded), tabled and withdrawn motions, adjournment.
- **Minutes:** a draft is generated from the record (attendance, quorum, each motion with its tally and roll call), edited by the clerk, kept private until approved, then locked along with the votes and attendance.
- **Public comment review:** accept or reject written comments before they appear publicly.
- **Activity log:** every change is recorded with who made it and when.

Every workspace action re-checks the signed-in user's role on the server, not just the page.

**Publication rules** (enforced in one place, [`src/lib/public.ts`](src/lib/public.ts))

- Draft meetings are never shown, even by direct link.
- An agenda appears only after its publish time.
- Closed-session items show only their title and legal citation.
- Private attachments, member email and phone numbers, pending comments and draft minutes never leave the server.

**Rules engine** (plain functions with unit tests in [`src/lib`](src/lib))

- Notice deadlines by meeting type, configurable per jurisdiction (defaults: 72 hours regular, 24 special, 1 emergency).
- Active seats, vacancies, quorum and expiring terms.
- Vote tallies with simple-majority or fixed-vote (supermajority) rules.
- Agenda section ordering and numbering.
- Timezone-correct dates: every time is shown in the organization's timezone, across daylight-saving changes.

## Roadmap

1. **Boards and members:** manage bodies, seats, appointments and terms in the workspace (today they come from the database).
2. **Document storage:** upload files to S3 or Azure Blob instead of linking, combined agenda packets, and search across agendas and minutes.
3. **Printable output:** PDF agendas, packets and minutes.
4. **Item workflow:** departments submit agenda items for clerk review.
5. **Boards & Commissions applications:** public application forms for open seats and an appointment queue.
6. **Notifications:** email and calendar (ICS) subscriptions per body.
7. **Accessibility and records:** WCAG 2.1 AA audits (required for state and local government websites under the ADA Title II rule) and records-retention settings.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, React Server Components, Server Actions), TypeScript
- PostgreSQL with [Prisma](https://www.prisma.io) ORM
- Zod for input validation, Vitest for tests
- Plain CSS design tokens (Tailwind available), carried over from the Blevins brand palette

## Running locally

Requires Node.js 20.9+ and PostgreSQL 14+.

```bash
cp .env.example .env          # set DATABASE_URL
npm install
npm run db:migrate            # create tables
npm run db:seed               # load sample data (fictional Town of Alder Creek)
npm run dev                   # http://localhost:3000
```

To use the clerk workspace locally, set `DEV_LOGIN="true"` and a `NEXTAUTH_SECRET` in `.env`, run `npm run dev`, open `/signin`, and sign in as `clerk@aldercreek.example` or `admin@aldercreek.example`. Development sign-in needs no password, so it is ignored in production builds.

For production, register an app in Microsoft Entra ID with the redirect URI `<NEXTAUTH_URL>/api/auth/callback/azure-ad`, set the `AZURE_AD_*` variables from `.env.example`, and add the first admin directly in the `User` table.

The seed **deletes all data** before loading. Its dates are relative to today, so there are always upcoming and past meetings to look at.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit tests |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript checks |
| `npm run db:migrate` | Create and apply a migration in development |
| `npm run db:deploy` | Apply migrations in production |
| `npm run db:studio` | Browse the database |

## Project layout

```
prisma/
  schema.prisma     Data model: bodies, seats, meetings, agenda items, motions, votes, minutes, comments
  seed.ts           Sample data
src/
  app/              Routes: public portal, /signin, /admin (clerk workspace)
  app/admin/_actions/  Server actions; each checks the user's role and writes the audit log
  components/       Shared UI
  lib/
    public.ts       All public reads, with the publication rules
    notice.ts       Open-meeting notice rules
    seats.ts        Seats, vacancies, quorum
    votes.ts        Vote tallies
    agenda.ts       Agenda sections and numbering
    format.ts       Timezone-aware formatting
    zoned.ts        Wall-clock date entry in the organization's timezone
    minutes.ts      Draft minutes from the meeting record
    auth.ts         Sign-in, roles and the requireUser() guard
    admin-data.ts   Workspace reads (drafts and private data included)
```

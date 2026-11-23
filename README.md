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

1. **Clerk workspace:** sign-in (Microsoft Entra ID or other OIDC), roles (clerk, staff, member, admin), meeting creation, a drag-and-drop agenda builder, item submission and approval workflow, and publishing gated by the notice check.
2. **Live meeting tools:** attendance, quorum tracking and roll-call vote entry during the meeting, so minutes draft themselves from the structured record.
3. **Minutes workflow:** draft, review and approval at a later meeting, with PDF export of agendas, packets and minutes.
4. **Document storage:** uploads to S3 or Azure Blob, combined agenda packets and search across agendas and minutes.
5. **Boards & Commissions applications:** public application forms for open seats, a clerk review queue and appointment tracking.
6. **Notifications and integrations:** email and calendar (ICS) subscriptions per body, plus livestream embeds.
7. **Accessibility and records:** WCAG 2.1 AA audits (required for state and local government websites under the ADA Title II rule), an audit log and records-retention settings.

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
  app/              Routes (public portal)
  components/       Shared UI
  lib/
    public.ts       All public reads, with the publication rules
    notice.ts       Open-meeting notice rules
    seats.ts        Seats, vacancies, quorum
    votes.ts        Vote tallies
    agenda.ts       Agenda sections and numbering
    format.ts       Timezone-aware formatting
```

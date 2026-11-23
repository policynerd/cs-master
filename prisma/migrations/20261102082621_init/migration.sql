-- CreateEnum
CREATE TYPE "BodyType" AS ENUM ('COUNCIL', 'BOARD', 'COMMISSION', 'COMMITTEE', 'AUTHORITY', 'TASK_FORCE');

-- CreateEnum
CREATE TYPE "SeatRole" AS ENUM ('CHAIR', 'VICE_CHAIR', 'MEMBER', 'SECRETARY', 'EX_OFFICIO', 'ALTERNATE');

-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('REGULAR', 'SPECIAL', 'EMERGENCY', 'WORKSHOP', 'PUBLIC_HEARING');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'ADJOURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AgendaSection" AS ENUM ('CALL_TO_ORDER', 'ROLL_CALL', 'PLEDGE', 'APPROVAL_OF_AGENDA', 'APPROVAL_OF_MINUTES', 'PUBLIC_COMMENT', 'CONSENT', 'PRESENTATIONS', 'PUBLIC_HEARINGS', 'UNFINISHED_BUSINESS', 'NEW_BUSINESS', 'REPORTS', 'CLOSED_SESSION', 'ADJOURNMENT');

-- CreateEnum
CREATE TYPE "AgendaItemKind" AS ENUM ('ACTION', 'DISCUSSION', 'INFORMATION', 'CEREMONIAL');

-- CreateEnum
CREATE TYPE "MotionResult" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'TABLED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "VoteChoice" AS ENUM ('YES', 'NO', 'ABSTAIN', 'RECUSED', 'ABSENT');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'REMOTE', 'ABSENT', 'EXCUSED', 'LATE');

-- CreateEnum
CREATE TYPE "MinutesStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateEnum
CREATE TYPE "CommentPosition" AS ENUM ('SUPPORT', 'OPPOSE', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "regularNoticeHours" INTEGER NOT NULL DEFAULT 72,
    "specialNoticeHours" INTEGER NOT NULL DEFAULT 24,
    "emergencyNoticeHours" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Body" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BodyType" NOT NULL,
    "description" TEXT,
    "authority" TEXT,
    "seatCount" INTEGER NOT NULL,
    "quorum" INTEGER,
    "accent" TEXT NOT NULL DEFAULT 'navy',
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Body_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "honorific" TEXT,
    "title" TEXT,
    "bio" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seat" (
    "id" TEXT NOT NULL,
    "bodyId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" "SeatRole" NOT NULL DEFAULT 'MEMBER',
    "seatLabel" TEXT,
    "isVoting" BOOLEAN NOT NULL DEFAULT true,
    "appointedBy" TEXT,
    "termStart" TIMESTAMP(3) NOT NULL,
    "termEnd" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "bodyId" TEXT NOT NULL,
    "title" TEXT,
    "type" "MeetingType" NOT NULL DEFAULT 'REGULAR',
    "status" "MeetingStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "location" TEXT,
    "address" TEXT,
    "virtualUrl" TEXT,
    "livestreamUrl" TEXT,
    "recordingUrl" TEXT,
    "noticePostedAt" TIMESTAMP(3),
    "agendaPublishedAt" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgendaItem" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "section" "AgendaSection" NOT NULL,
    "position" INTEGER NOT NULL,
    "number" TEXT,
    "kind" "AgendaItemKind" NOT NULL DEFAULT 'ACTION',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "recommendedAction" TEXT,
    "fiscalImpact" TEXT,
    "presenter" TEXT,
    "department" TEXT,
    "isConfidential" BOOLEAN NOT NULL DEFAULT false,
    "legalCitation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgendaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "agendaItemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Motion" (
    "id" TEXT NOT NULL,
    "agendaItemId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "movedById" TEXT,
    "secondedById" TEXT,
    "result" "MotionResult" NOT NULL DEFAULT 'PENDING',
    "requiredVotes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Motion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoteRecord" (
    "id" TEXT NOT NULL,
    "motionId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "choice" "VoteChoice" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoteRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "arrivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Minutes" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "status" "MinutesStatus" NOT NULL DEFAULT 'DRAFT',
    "body" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedAtMeetingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Minutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicComment" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "agendaItemId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "city" TEXT,
    "position" "CommentPosition" NOT NULL DEFAULT 'NEUTRAL',
    "body" TEXT NOT NULL,
    "status" "CommentStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "PublicComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Body_slug_key" ON "Body"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Person_email_key" ON "Person"("email");

-- CreateIndex
CREATE INDEX "Seat_bodyId_termEnd_idx" ON "Seat"("bodyId", "termEnd");

-- CreateIndex
CREATE INDEX "Meeting_bodyId_startsAt_idx" ON "Meeting"("bodyId", "startsAt");

-- CreateIndex
CREATE INDEX "Meeting_startsAt_idx" ON "Meeting"("startsAt");

-- CreateIndex
CREATE INDEX "AgendaItem_meetingId_section_position_idx" ON "AgendaItem"("meetingId", "section", "position");

-- CreateIndex
CREATE UNIQUE INDEX "VoteRecord_motionId_personId_key" ON "VoteRecord"("motionId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_meetingId_personId_key" ON "Attendance"("meetingId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "Minutes_meetingId_key" ON "Minutes"("meetingId");

-- CreateIndex
CREATE INDEX "PublicComment_meetingId_status_idx" ON "PublicComment"("meetingId", "status");

-- AddForeignKey
ALTER TABLE "Body" ADD CONSTRAINT "Body_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Body"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_bodyId_fkey" FOREIGN KEY ("bodyId") REFERENCES "Body"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_bodyId_fkey" FOREIGN KEY ("bodyId") REFERENCES "Body"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaItem" ADD CONSTRAINT "AgendaItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_agendaItemId_fkey" FOREIGN KEY ("agendaItemId") REFERENCES "AgendaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Motion" ADD CONSTRAINT "Motion_agendaItemId_fkey" FOREIGN KEY ("agendaItemId") REFERENCES "AgendaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Motion" ADD CONSTRAINT "Motion_movedById_fkey" FOREIGN KEY ("movedById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Motion" ADD CONSTRAINT "Motion_secondedById_fkey" FOREIGN KEY ("secondedById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteRecord" ADD CONSTRAINT "VoteRecord_motionId_fkey" FOREIGN KEY ("motionId") REFERENCES "Motion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteRecord" ADD CONSTRAINT "VoteRecord_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Minutes" ADD CONSTRAINT "Minutes_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Minutes" ADD CONSTRAINT "Minutes_approvedAtMeetingId_fkey" FOREIGN KEY ("approvedAtMeetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicComment" ADD CONSTRAINT "PublicComment_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicComment" ADD CONSTRAINT "PublicComment_agendaItemId_fkey" FOREIGN KEY ("agendaItemId") REFERENCES "AgendaItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

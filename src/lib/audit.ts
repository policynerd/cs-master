import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { StaffUser } from "./auth";

type Tx = Prisma.TransactionClient | typeof prisma;

/** Appends one entry to the audit trail. Pass `tx` to record inside a transaction. */
export async function audit(
  user: StaffUser,
  entry: { action: string; entityType: string; entityId: string; summary: string; data?: Prisma.InputJsonValue },
  tx: Tx = prisma,
) {
  await tx.auditEvent.create({ data: { userId: user.id, ...entry } });
}

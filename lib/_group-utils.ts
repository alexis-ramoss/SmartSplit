import { db } from "../firebase";
import {
  calculateMemberBalances,
  type ExpenseEntry,
  generateDueRecurringExpenses,
  formatDate,
} from "./_expense-utils";

export type GroupMemberRecord = {
  userId: string;
  name: string;
  email: string;
  role: "owner" | "member";
  joinedAt: string;
};

export type LoadedGroup = {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  members: GroupMemberRecord[];
  expenses: ExpenseEntry[];
};

type GroupDoc = {
  name?: string;
  inviteCode?: string;
  ownerId?: string;
  ownerName?: string;
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string | null;
};

type MemberDoc = {
  userId?: string;
  name?: string;
  email?: string;
  role?: "owner" | "member";
  joinedAt?: string;
};

type ExpenseDoc = {
  name?: string;
  amount?: number;
  date?: string;
  payer?: string;
  participants?: ExpenseEntry["participants"];
  createdAt?: string;
  createdBy?: string;
  createdByName?: string;
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
  recurrence?: ExpenseEntry["recurrence"];
  recurringSourceId?: string | null;
};

function requireDb() {
  if (!db) {
    throw new Error("Firestore is not available.");
  }

  return db;
}

function normalizeText(value: string) {
  return value.trim();
}

function generateInviteCode(groupName: string) {
  const prefix = normalizeText(groupName).replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase() || "GRP";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}${suffix}`;
}

async function loadGroupDetails(groupId: string): Promise<LoadedGroup | null> {
  const firestore = requireDb();
  const groupSnapshot = await firestore.collection("groups").doc(groupId).get();

  if (!groupSnapshot.exists) {
    return null;
  }

  const groupData = groupSnapshot.data() as GroupDoc | undefined;

  if (!groupData || groupData.archivedAt) {
    return null;
  }

  const [membersSnapshot, expensesSnapshot] = await Promise.all([
    groupSnapshot.ref.collection("members").get(),
    groupSnapshot.ref.collection("expenses").get(),
  ]);

  const members = membersSnapshot.docs.map((memberSnapshot) => {
    const memberData = memberSnapshot.data() as MemberDoc;

    return {
      userId: memberSnapshot.id,
      name: memberData.name || memberSnapshot.id,
      email: memberData.email || "",
      role: memberData.role || "member",
      joinedAt: memberData.joinedAt || "",
    } satisfies GroupMemberRecord;
  });

  const expenses = expensesSnapshot.docs.map((expenseSnapshot) => {
    const expenseData = expenseSnapshot.data() as ExpenseDoc;

    return {
      id: expenseSnapshot.id,
      groupId,
      name: expenseData.name || "",
      amount: Number(expenseData.amount || 0),
      date: expenseData.date || "",
      payer: expenseData.payer || "",
      participants: expenseData.participants || [],
      createdAt: expenseData.createdAt || new Date().toISOString(),
      createdBy: expenseData.createdBy || "",
      createdByName: expenseData.createdByName || "",
      updatedAt: expenseData.updatedAt,
      updatedBy: expenseData.updatedBy,
      updatedByName: expenseData.updatedByName,
      recurrence: expenseData.recurrence ?? null,
      recurringSourceId: expenseData.recurringSourceId ?? null,
    } satisfies ExpenseEntry;
  });

  return {
    id: groupSnapshot.id,
    name: groupData.name || "",
    inviteCode: groupData.inviteCode || "",
    ownerId: groupData.ownerId || "",
    ownerName: groupData.ownerName || "",
    createdAt: groupData.createdAt || "",
    updatedAt: groupData.updatedAt || "",
    archivedAt: groupData.archivedAt ?? null,
    members,
    expenses,
  };
}

export async function loadGroupMembers(groupId: string) {
  const group = await loadGroupDetails(groupId);
  return group?.members ?? [];
}

export async function loadGroupData(groupId: string) {
  return loadGroupDetails(groupId);
}

export async function loadGroupExpenses(groupId: string) {
  const group = await loadGroupDetails(groupId);
  return group?.expenses ?? [];
}

export async function loadAccessibleGroups(userId: string) {
  const firestore = requireDb();
  const groupIds = new Set<string>();

  const ownedGroupsSnapshot = await firestore.collection("groups").where("ownerId", "==", userId).get();
  ownedGroupsSnapshot.docs.forEach((groupDoc) => groupIds.add(groupDoc.id));

  try {
    const membershipSnapshot = await firestore.collectionGroup("members").where("userId", "==", userId).get();
    membershipSnapshot.docs.forEach((memberDoc) => {
      const groupRef = memberDoc.ref.parent.parent;
      if (groupRef) {
        groupIds.add(groupRef.id);
      }
    });
  } catch {
    // Fallback path for projects where collectionGroup("members") is blocked by broader rule topology.
    const allGroupsSnapshot = await firestore.collection("groups").get();
    const allGroups = await Promise.all(allGroupsSnapshot.docs.map((groupDoc) => loadGroupDetails(groupDoc.id)));
    allGroups.forEach((group) => {
      if (!group) {
        return;
      }
      if (group.ownerId === userId || group.members.some((member) => member.userId === userId)) {
        groupIds.add(group.id);
      }
    });
  }

  const groups = await Promise.all(Array.from(groupIds).map((groupId) => loadGroupDetails(groupId)));
  return groups.filter((group): group is LoadedGroup => Boolean(group));
}

export async function loadOwnedGroupData(userId: string) {
  const groups = await loadAccessibleGroups(userId);
  return groups[0] || null;
}

export function calculateMemberBalance(memberName: string, expenses: ExpenseEntry[]) {
  const balances = calculateMemberBalances(expenses, [memberName]);
  return balances[0]?.balance || 0;
}

export function canRemoveMember(group: LoadedGroup, memberName: string) {
  const balances = calculateMemberBalances(group.expenses, group.members.map((member) => member.name));
  const memberBalance = balances.find((balance) => balance.name === memberName)?.balance || 0;
  const member = group.members.find((item) => item.name === memberName);

  if (!member) {
    return { canRemove: false, reason: "Member not found" };
  }

  if (Math.abs(memberBalance) > 0.01) {
    return {
      canRemove: false,
      reason: `Cannot remove ${memberName}: unsettled balance of EUR ${Math.abs(memberBalance).toFixed(2)}`,
    };
  }

  return { canRemove: true as const };
}

async function saveGroupMember(groupId: string, member: GroupMemberRecord) {
  const firestore = requireDb();
  await firestore.collection("groups").doc(groupId).collection("members").doc(member.userId).set(member, { merge: true });
}

export async function createGroup(input: {
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  name: string;
}) {
  const firestore = requireDb();
  const groupRef = firestore.collection("groups").doc();
  const now = new Date().toISOString();
  const inviteCode = generateInviteCode(input.name);

  await groupRef.set({
    name: normalizeText(input.name),
    inviteCode,
    ownerId: input.ownerId,
    ownerName: input.ownerName,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  });

  await saveGroupMember(groupRef.id, {
    userId: input.ownerId,
    name: input.ownerName,
    email: input.ownerEmail,
    role: "owner",
    joinedAt: now,
  });

  return loadGroupDetails(groupRef.id);
}

export async function joinGroupByInviteCode(input: {
  userId: string;
  userName: string;
  userEmail: string;
  inviteCode: string;
}) {
  const firestore = requireDb();
  const normalizedCode = normalizeText(input.inviteCode).toUpperCase();
  const snapshot = await firestore.collection("groups").where("inviteCode", "==", normalizedCode).limit(1).get();

  if (snapshot.empty) {
    throw new Error("No group was found for that invite code.");
  }

  const groupSnapshot = snapshot.docs[0];
  const groupData = groupSnapshot.data() as GroupDoc;

  if (groupData.archivedAt) {
    throw new Error("This group is no longer available.");
  }

  await saveGroupMember(groupSnapshot.id, {
    userId: input.userId,
    name: input.userName,
    email: input.userEmail,
    role: "member",
    joinedAt: new Date().toISOString(),
  });

  return loadGroupDetails(groupSnapshot.id);
}

export async function saveExpenseToGroup(input: {
  groupId: string;
  expense: ExpenseEntry;
  userId: string;
  userName: string;
}) {
  const firestore = requireDb();
  const expenseRef = firestore.collection("groups").doc(input.groupId).collection("expenses").doc(input.expense.id);
  const now = new Date().toISOString();
  const existingSnapshot = await expenseRef.get();
  const existingData = existingSnapshot.exists ? (existingSnapshot.data() as ExpenseDoc) : null;

  await expenseRef.set(
    {
      ...input.expense,
      createdAt: existingData?.createdAt || input.expense.createdAt || now,
      createdBy: existingData?.createdBy || input.userId,
      createdByName: existingData?.createdByName || input.userName,
      updatedAt: now,
      updatedBy: input.userId,
      updatedByName: input.userName,
    },
    { merge: true }
  );

  await firestore.collection("groups").doc(input.groupId).set({ updatedAt: now }, { merge: true });
  return loadGroupDetails(input.groupId);
}

export async function processDueRecurringExpensesForGroup(groupId: string) {
  const group = await loadGroupDetails(groupId);
  if (!group) return null;

  const result = generateDueRecurringExpenses(group.expenses, formatDate(new Date()));

  if (result.generatedExpenses.length === 0 && result.updatedTemplates.length === 0) {
    return group;
  }

  const firestore = requireDb();
  const batch = firestore.batch();
  const now = new Date().toISOString();

  result.generatedExpenses.forEach((expense) => {
    const ref = firestore.collection("groups").doc(groupId).collection("expenses").doc(expense.id);
    batch.set(ref, {
      ...expense,
      updatedAt: now,
    });
  });

  result.updatedTemplates.forEach((expense) => {
    const ref = firestore.collection("groups").doc(groupId).collection("expenses").doc(expense.id);
    batch.set(ref, {
      ...expense,
      updatedAt: now,
    });
  });

  batch.set(firestore.collection("groups").doc(groupId), { updatedAt: now }, { merge: true });

  await batch.commit();
  return loadGroupDetails(groupId);
}

export async function removeMemberFromGroup(groupId: string, memberId: string) {
  const firestore = requireDb();
  const groupSnapshot = await firestore.collection("groups").doc(groupId).get();

  if (!groupSnapshot.exists) {
    throw new Error("Group not found.");
  }

  const groupData = groupSnapshot.data() as GroupDoc;
  if (groupData.ownerId === memberId) {
    throw new Error("The owner cannot be removed. Delete the group instead.");
  }

  await groupSnapshot.ref.collection("members").doc(memberId).delete();
  await groupSnapshot.ref.set({ updatedAt: new Date().toISOString() }, { merge: true });
  return loadGroupDetails(groupId);
}

export async function leaveGroupFromGroup(groupId: string, memberId: string) {
  const firestore = requireDb();
  const groupSnapshot = await firestore.collection("groups").doc(groupId).get();

  if (!groupSnapshot.exists) {
    throw new Error("Group not found.");
  }

  const groupData = groupSnapshot.data() as GroupDoc;
  if (groupData.ownerId === memberId) {
    throw new Error("The owner must delete the group instead of leaving it.");
  }

  const group = await loadGroupDetails(groupId);
  if (!group) {
    throw new Error("Group not found.");
  }

  const balances = calculateMemberBalances(group.expenses, group.members.map((member) => member.name));
  const memberBalance = balances.find((balance) => balance.name === group.members.find((member) => member.userId === memberId)?.name)?.balance || 0;

  if (Math.abs(memberBalance) > 0.01) {
    throw new Error(`Cannot leave the group until your balance is settled: EUR ${Math.abs(memberBalance).toFixed(2)}`);
  }

  await groupSnapshot.ref.collection("members").doc(memberId).delete();
  await groupSnapshot.ref.set({ updatedAt: new Date().toISOString() }, { merge: true });
  return loadGroupDetails(groupId);
}

export async function deleteGroup(groupId: string, memberId: string) {
  const firestore = requireDb();
  const groupSnapshot = await firestore.collection("groups").doc(groupId).get();

  if (!groupSnapshot.exists) {
    throw new Error("Group not found.");
  }

  const groupData = groupSnapshot.data() as GroupDoc;
  if (groupData.ownerId !== memberId) {
    throw new Error("Only the group owner can delete the group.");
  }

  const group = await loadGroupDetails(groupId);
  if (!group) {
    throw new Error("Group not found.");
  }

  const balances = calculateMemberBalances(group.expenses, group.members.map((member) => member.name));
  const hasOutstandingBalances = balances.some((balance) => Math.abs(balance.balance) > 0.01);

  if (hasOutstandingBalances) {
    throw new Error("Cannot delete the group until all balances are settled.");
  }

  const membersSnapshot = await groupSnapshot.ref.collection("members").get();
  const expensesSnapshot = await groupSnapshot.ref.collection("expenses").get();
  const batch = firestore.batch();

  membersSnapshot.docs.forEach((memberDoc) => batch.delete(memberDoc.ref));
  expensesSnapshot.docs.forEach((expenseDoc) => batch.delete(expenseDoc.ref));
  batch.delete(groupSnapshot.ref);

  await batch.commit();
  return null;
}

export function isGroupOwner(group: LoadedGroup | null | undefined, uid: string) {
  return Boolean(group && group.ownerId === uid);
}

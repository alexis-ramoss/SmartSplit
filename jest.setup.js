jest.mock("./auth-context", () => ({
  useAuth: () => ({
    user: {
      uid: "test-user",
      email: "person1@example.com",
      displayName: "Person 1",
      photoURL: null,
    },
    loading: false,
    firebaseReady: true,
    firestoreWritable: true,
    signOutUser: jest.fn(),
  }),
}));

function mockCreateGroupFixture(overrides = {}) {
  return {
    id: "group-1",
    name: "Household",
    inviteCode: "HOME123",
    ownerId: "owner-1",
    ownerName: "Owner",
    createdAt: "2026-05-12T00:00:00.000Z",
    updatedAt: "2026-05-12T00:00:00.000Z",
    archivedAt: null,
    members: [
      {
        userId: "test-user",
        name: "Person 1",
        email: "person1@example.com",
        role: "member",
        joinedAt: "2026-05-12T00:00:00.000Z",
      },
      {
        userId: "member-2",
        name: "Person 2",
        email: "person2@example.com",
        role: "member",
        joinedAt: "2026-05-12T00:00:00.000Z",
      },
      {
        userId: "member-3",
        name: "Person 3",
        email: "person3@example.com",
        role: "member",
        joinedAt: "2026-05-12T00:00:00.000Z",
      },
    ],
    expenses: [
      {
        id: "expense-1",
        groupId: "group-1",
        name: "Groceries",
        amount: 24.5,
        category: "Rent",
        date: "12/05/2026",
        payer: "Person 1",
        participants: [
          { name: "Person 1", percentage: 50 },
          { name: "Person 2", percentage: 50 },
        ],
        createdAt: "2026-05-12T00:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

function mockCloneGroup(group) {
  return JSON.parse(JSON.stringify(group));
}

let mockGroups = [mockCreateGroupFixture()];

globalThis.__SMARTSPLIT_TEST_GROUPS__ = () => mockGroups;

beforeEach(() => {
  mockGroups = [mockCreateGroupFixture()];
});

jest.mock("./lib/_group-utils", () => ({
  canRemoveMember: jest.fn((group, memberName) => {
    const balances = new Map();

    group.members.forEach((member) => balances.set(member.name, 0));
    group.expenses.forEach((expense) => {
      const share = expense.amount / expense.participants.length;
      expense.participants.forEach((participant) => {
        balances.set(participant.name, (balances.get(participant.name) || 0) - share);
      });
      balances.set(expense.payer, (balances.get(expense.payer) || 0) + expense.amount);
    });

    const balance = balances.get(memberName) || 0;
    if (Math.abs(balance) > 0.01) {
      return {
        canRemove: false,
        reason: `Cannot remove ${memberName}: unsettled balance of EUR ${Math.abs(balance).toFixed(2)}`,
      };
    }

    return { canRemove: true };
  }),
  createGroup: jest.fn(async ({ ownerId, ownerName, ownerEmail, name }) => {
    const created = mockCreateGroupFixture({
      id: `group-${mockGroups.length + 1}`,
      name,
      inviteCode: "NEWWEB",
      ownerId,
      ownerName,
      members: [
        {
          userId: ownerId,
          name: ownerName,
          email: ownerEmail,
          role: "owner",
          joinedAt: "2026-05-12T00:00:00.000Z",
        },
      ],
      expenses: [],
    });
    mockGroups = [created, ...mockGroups];
    return mockCloneGroup(created);
  }),
  deleteGroup: jest.fn(async (groupId, memberId) => {
    const group = mockGroups.find((item) => item.id === groupId);
    if (!group || group.ownerId !== memberId) {
      throw new Error("Only the group owner can delete the group.");
    }
    
    // Calculate member balances using the same logic as the real app
    const balances = new Map();
    group.members.forEach((member) => balances.set(member.name, 0));
    group.expenses.forEach((expense) => {
      const share = expense.amount / expense.participants.length;
      expense.participants.forEach((participant) => {
        balances.set(participant.name, (balances.get(participant.name) || 0) - share);
      });
      balances.set(expense.payer, (balances.get(expense.payer) || 0) + expense.amount);
    });
    
    const hasOutstandingBalances = Array.from(balances.values()).some((balance) => Math.abs(balance) > 0.01);
    if (hasOutstandingBalances) {
      throw new Error("Cannot delete the group until all balances are settled.");
    }
    
    mockGroups = mockGroups.filter((item) => item.id !== groupId);
    return null;
  }),
  joinGroupByInviteCode: jest.fn(async ({ userId, userName, userEmail, inviteCode }) => {
    const group = mockGroups.find((item) => item.inviteCode === inviteCode);
    if (!group) {
      throw new Error("No group was found for that invite code.");
    }

    if (!group.members.some((member) => member.userId === userId)) {
      group.members.push({
        userId,
        name: userName,
        email: userEmail,
        role: "member",
        joinedAt: "2026-05-12T00:00:00.000Z",
      });
    }

    return mockCloneGroup(group);
  }),
  leaveGroupFromGroup: jest.fn(async (groupId, memberId) => {
    const group = mockGroups.find((item) => item.id === groupId);
    if (!group) {
      throw new Error("Group not found.");
    }

    if (group.ownerId === memberId) {
      throw new Error("The owner must delete the group instead of leaving it.");
    }

    const member = group.members.find((item) => item.userId === memberId);
    const balances = new Map();
    group.members.forEach((item) => balances.set(item.name, 0));
    group.expenses.forEach((expense) => {
      const share = expense.amount / expense.participants.length;
      expense.participants.forEach((participant) => {
        balances.set(participant.name, (balances.get(participant.name) || 0) - share);
      });
      balances.set(expense.payer, (balances.get(expense.payer) || 0) + expense.amount);
    });

    const memberBalance = member ? balances.get(member.name) || 0 : 0;
    if (Math.abs(memberBalance) > 0.01) {
      throw new Error(`Cannot leave the group until your balance is settled: EUR ${Math.abs(memberBalance).toFixed(2)}`);
    }

    group.members = group.members.filter((item) => item.userId !== memberId);
    return mockCloneGroup(group);
  }),
  loadAccessibleGroups: jest.fn(async () =>
    mockGroups
      .filter(
        (group) =>
          group.ownerId === "test-user" || group.members.some((member) => member.userId === "test-user")
      )
      .map((group) => mockCloneGroup(group))
  ),
  processDueRecurringExpensesForGroup: jest.fn(async (groupId) => {
    const group = mockGroups.find((item) => item.id === groupId);
    return group ? mockCloneGroup(group) : null;
  }),
  loadOwnedGroupData: jest.fn(async () => {
    const accessibleGroup = mockGroups.find(
      (group) => group.ownerId === "test-user" || group.members.some((member) => member.userId === "test-user")
    );

    return accessibleGroup ? mockCloneGroup(accessibleGroup) : null;
  }),
  removeMemberFromGroup: jest.fn(async (groupId, memberName) => {
    const group = mockGroups.find((item) => item.id === groupId);
    if (!group) {
      throw new Error("Group not found.");
    }
    if (memberName !== "Person 1") {
      group.members = group.members.filter((item) => item.name !== memberName);
    }
    return mockCloneGroup(group);
  }),
  saveExpenseToGroup: jest.fn(async ({ groupId, expense, userId, userName }) => {
    const group = mockGroups.find((item) => item.id === groupId);
    if (!group) {
      throw new Error("Group not found.");
    }
    const index = group.expenses.findIndex((item) => item.id === expense.id);
    const now = new Date().toISOString();
    const expenseWithMetadata = {
      ...expense,
      createdAt: index >= 0 ? group.expenses[index].createdAt : expense.createdAt || now,
      createdBy: index >= 0 ? group.expenses[index].createdBy : userId,
      createdByName: index >= 0 ? group.expenses[index].createdByName : userName,
      updatedAt: now,
      updatedBy: userId,
      updatedByName: userName,
    };
    if (index >= 0) {
      group.expenses[index] = expenseWithMetadata;
    } else {
      group.expenses.unshift(expenseWithMetadata);
    }
    return mockCloneGroup(group);
  }),
  deleteExpenseFromGroup: jest.fn(async ({ groupId, expenseId }) => {
    const group = mockGroups.find((item) => item.id === groupId);
    if (!group) {
      throw new Error("Group not found.");
    }
    const index = group.expenses.findIndex((item) => item.id === expenseId);
    if (index < 0) {
      throw new Error("Expense not found.");
    }
    group.expenses.splice(index, 1);
    group.updatedAt = new Date().toISOString();
    return mockCloneGroup(group);
  }),
  updateGroupSettings: jest.fn(async (groupId, settings) => {
    const group = mockGroups.find((item) => item.id === groupId);
    if (!group) {
      throw new Error("Group not found.");
    }
    Object.assign(group, settings);
    group.updatedAt = new Date().toISOString();
    return mockCloneGroup(group);
  }),
}));

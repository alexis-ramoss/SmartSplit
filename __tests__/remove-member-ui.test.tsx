import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import Index from "../app/index";

const currentUser = {
  uid: "test-user",
  email: "test@example.com",
  displayName: "Person 1",
};

function mockCreateGroupFixture(overrides: Partial<any> = {}) {
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
        email: "test@example.com",
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
        date: "12/05/2026",
        payer: "Person 1",
        participants: [
          { name: "Person 1", percentage: 50 },
          { name: "Person 2", percentage: 50 },
        ],
        createdAt: "2026-05-12T00:00:00.000Z",
        createdBy: "test-user",
        createdByName: "Person 1",
        updatedAt: "2026-05-12T00:00:00.000Z",
        updatedBy: "test-user",
        updatedByName: "Person 1",
      },
    ],
    ...overrides,
  };
}

function mockCloneGroup(group: any) {
  return JSON.parse(JSON.stringify(group));
}

let mockGroups: any[] = [];

jest.mock("../auth-context", () => ({
  useAuth: () => ({
    user: currentUser,
    loading: false,
    firestoreWritable: true,
    signOutUser: jest.fn(),
  }),
}));

jest.mock("../lib/_group-utils", () => ({
  canRemoveMember: jest.fn((group, memberName) => {
    const balances = new Map<string, number>();

    group.members.forEach((member: any) => balances.set(member.name, 0));
    group.expenses.forEach((expense: any) => {
      const share = expense.amount / expense.participants.length;
      expense.participants.forEach((participant: any) => {
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
    group.members.forEach((member: any) => balances.set(member.name, 0));
    group.expenses.forEach((expense: any) => {
      const share = expense.amount / expense.participants.length;
      expense.participants.forEach((participant: any) => {
        balances.set(participant.name, (balances.get(participant.name) || 0) - share);
      });
      balances.set(expense.payer, (balances.get(expense.payer) || 0) + expense.amount);
    });
    
    const hasOutstandingBalances = Array.from(balances.values()).some((balance: any) => Math.abs(balance) > 0.01);
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

    if (!group.members.some((member: any) => member.userId === userId)) {
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

    const member = group.members.find((item: any) => item.userId === memberId);
    const balances = new Map<string, number>();
    group.members.forEach((item: any) => balances.set(item.name, 0));
    group.expenses.forEach((expense: any) => {
      const share = expense.amount / expense.participants.length;
      expense.participants.forEach((participant: any) => {
        balances.set(participant.name, (balances.get(participant.name) || 0) - share);
      });
      balances.set(expense.payer, (balances.get(expense.payer) || 0) + expense.amount);
    });

    const memberBalance = member ? balances.get(member.name) || 0 : 0;
    if (Math.abs(memberBalance) > 0.01) {
      throw new Error(`Cannot leave the group until your balance is settled: EUR ${Math.abs(memberBalance).toFixed(2)}`);
    }

    group.members = group.members.filter((item: any) => item.userId !== memberId);
    return mockCloneGroup(group);
  }),
  loadAccessibleGroups: jest.fn(async () =>
    mockGroups
      .filter(
        (group) =>
          group.ownerId === currentUser.uid ||
          group.members.some((member: any) => member.userId === currentUser.uid)
      )
      .map((group) => mockCloneGroup(group))
  ),
  loadOwnedGroupData: jest.fn(async () => {
    const accessibleGroup = mockGroups.find(
      (group) =>
        group.ownerId === currentUser.uid ||
        group.members.some((member: any) => member.userId === currentUser.uid)
    );

    return accessibleGroup ? mockCloneGroup(accessibleGroup) : null;
  }),
  removeMemberFromGroup: jest.fn(async (groupId, memberName) => {
    const group = mockGroups.find((item) => item.id === groupId);
    if (!group) {
      throw new Error("Group not found.");
    }
    const member = group.members.find((item: any) => item.name === memberName);
    if (member && member.name !== "Person 1") {
      group.members = group.members.filter((item: any) => item.name !== memberName);
    }
    return mockCloneGroup(group);
  }),
  saveExpenseToGroup: jest.fn(async ({ groupId, expense }) => {
    const group = mockGroups.find((item) => item.id === groupId);
    if (!group) {
      throw new Error("Group not found.");
    }
    const index = group.expenses.findIndex((item: any) => item.id === expense.id);
    if (index >= 0) {
      group.expenses[index] = expense;
    } else {
      group.expenses.unshift(expense);
    }
    return mockCloneGroup(group);
  }),
}));

describe("Group flows with Firebase-backed data", () => {
  beforeEach(() => {
    mockGroups = [mockCreateGroupFixture()];
    jest.clearAllMocks();
  });

  describe("Remove member flow", () => {
    it("shows the members list and the removable member", async () => {
      render(<Index />);

      const initialButtons = screen.queryAllByTestId(/remove-member-/);
      expect(initialButtons.length).toBe(0);

      fireEvent.press(screen.getByTestId("toggle-members-button"));

      await waitFor(() => {
        expect(screen.getByTestId("remove-member-Person 3")).toBeTruthy();
      });
    });

    it("removes Person 3 from the group", async () => {
      render(<Index />);

      fireEvent.press(screen.getByTestId("toggle-members-button"));
      await waitFor(() => expect(screen.getByTestId("remove-member-Person 3")).toBeTruthy());

      fireEvent.press(screen.getByTestId("remove-member-Person 3"));
      await waitFor(() => expect(screen.getByText(/Remove Person 3\?/)).toBeTruthy());

      fireEvent.press(screen.getByTestId("confirm-remove-member"));
      await waitFor(() => expect(screen.queryByTestId("remove-member-Person 3")).toBeNull());
      expect(mockGroups[0].members.some((member) => member.name === "Person 3")).toBe(false);
    });

    it("prevents removing the current user", async () => {
      render(<Index />);

      fireEvent.press(screen.getByTestId("toggle-members-button"));
      await waitFor(() => expect(screen.getByText("Person 1 (You)")).toBeTruthy());

      expect(screen.queryByTestId("remove-member-Person 1")).toBeNull();
    });

    it("prevents removing a member with unsettled balance", async () => {
      mockGroups = [
        mockCreateGroupFixture({
          expenses: [
            {
              id: "expense-1",
              groupId: "group-1",
              name: "Dinner",
              amount: 30,
              date: "12/05/2026",
              payer: "Person 1",
              participants: [
                { name: "Person 1", percentage: 50 },
                { name: "Person 2", percentage: 50 },
              ],
              createdAt: "2026-05-12T00:00:00.000Z",
            },
          ],
        }),
      ];

      render(<Index />);

      fireEvent.press(screen.getByTestId("toggle-members-button"));
      await waitFor(() => expect(screen.getByTestId("remove-member-Person 3")).toBeTruthy());

      expect(screen.queryByTestId("remove-member-Person 2")).toBeNull();
    });
  });

  describe("Leave group flow", () => {
    it("allows a member with settled balances to leave", async () => {
      mockGroups = [mockCreateGroupFixture({ expenses: [] })];
      render(<Index />);

      fireEvent.press(screen.getByTestId("leave-group-button"));
      await waitFor(() => expect(screen.getByText(/Leave Household\?/)).toBeTruthy());

      fireEvent.press(screen.getByText("Confirm"));
      await waitFor(() => expect(screen.getByText("You left the group.")).toBeTruthy(), { timeout: 3000 });
      await waitFor(() => expect(screen.getByText("No active group")).toBeTruthy(), { timeout: 3000 });
      expect(mockGroups[0].members.some((member) => member.userId === currentUser.uid)).toBe(false);
    });

    it("prevents leaving when balances are unsettled", async () => {
      mockGroups = [
        mockCreateGroupFixture({
          ownerId: "owner-1",
          expenses: [
            {
              id: "expense-1",
              groupId: "group-1",
              name: "Dinner",
              amount: 30,
              date: "12/05/2026",
              payer: "Person 2",
              participants: [
                { name: "Person 1", percentage: 50 },
                { name: "Person 2", percentage: 50 },
              ],
              createdAt: "2026-05-12T00:00:00.000Z",
            },
          ],
        }),
      ];

      render(<Index />);

      fireEvent.press(screen.getByTestId("leave-group-button"));
      await waitFor(() => expect(screen.getByText(/Leave Household\?/)).toBeTruthy());

      fireEvent.press(screen.getByText("Confirm"));
      await waitFor(() => {
        expect(screen.getByText(/Cannot leave the group until your balance is settled/)).toBeTruthy();
      });
    });
  });

  describe("Delete group flow", () => {
    it("allows the owner to delete a settled group", async () => {
      mockGroups = [mockCreateGroupFixture({ ownerId: currentUser.uid, ownerName: currentUser.displayName, expenses: [] })];
      render(<Index />);

      await waitFor(() => expect(screen.getByTestId("delete-group-button")).toBeTruthy());

      fireEvent.press(screen.getByTestId("delete-group-button"));
      await waitFor(() => expect(screen.getByText(/Delete Household\?/)).toBeTruthy());

      fireEvent.press(screen.getByText("Confirm"));
      // After delete, wait for the "No active group" state to render
      await waitFor(() => expect(screen.getByText("No active group")).toBeTruthy(), { timeout: 3000 });
      expect(mockGroups.length).toBe(0);
    });

    it("prevents deleting a group with unsettled balances", async () => {
      mockGroups = [
        mockCreateGroupFixture({
          ownerId: currentUser.uid,
          ownerName: currentUser.displayName,
          expenses: [
            {
              id: "expense-1",
              groupId: "group-1",
              name: "Dinner",
              amount: 30,
              date: "12/05/2026",
              payer: "Person 2",
              participants: [
                { name: "Person 1", percentage: 50 },
                { name: "Person 2", percentage: 50 },
              ],
              createdAt: "2026-05-12T00:00:00.000Z",
            },
          ],
        }),
      ];

      render(<Index />);

      await waitFor(() => expect(screen.getByTestId("delete-group-button")).toBeTruthy());

      fireEvent.press(screen.getByTestId("delete-group-button"));
      await waitFor(() => expect(screen.getByText(/Delete Household\?/)).toBeTruthy());

      fireEvent.press(screen.getByText("Confirm"));
      await waitFor(() => {
        expect(screen.getByText(/Cannot delete the group until all balances are settled/)).toBeTruthy();
      });
      expect(mockGroups.length).toBe(1);
    });
  });
});

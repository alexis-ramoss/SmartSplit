import { fireEvent, render, waitFor } from "@testing-library/react-native";
import Index from "../app/index";
import { loadAccessibleGroups } from "../lib/_group-utils";

declare global {
  var __SMARTSPLIT_TEST_GROUPS__:
    | (() => any[])
    | undefined;
}

jest.mock("../lib/_group-utils", () => ({
  loadAccessibleGroups: jest.fn(),
  canRemoveMember: jest.fn(() => ({ canRemove: true })),
  createGroup: jest.fn(),
  deleteGroup: jest.fn(),
  leaveGroupFromGroup: jest.fn(),
  removeMemberFromGroup: jest.fn(),
  saveExpenseToGroup: jest.fn(),
  deleteExpenseFromGroup: jest.fn(),
}));

describe("Switch Between Groups Acceptance Tests", () => {
  const mockGroups = [
    {
      id: "group-1",
      name: "Apartment",
      inviteCode: "APT123",
      ownerId: "1",
      ownerName: "Clara",
      createdAt: "",
      updatedAt: "",
      archivedAt: null,
      members: [
        {
          userId: "1",
          name: "Clara",
          email: "clara@test.com",
          role: "owner",
          joinedAt: "",
        },
      ],
      expenses: [
        {
          id: "expense-1",
          name: "Rent",
          amount: 1000,
          date: "01/03/2026",
          payer: "Clara",
          participants: [
            {
              name: "Clara",
              percentage: 100,
            },
          ],
          groupId: "group-1",
          createdAt: "",
          createdBy: "1",
          createdByName: "Clara",
        },
      ],
    },

    {
      id: "group-2",
      name: "Vacation",
      inviteCode: "VAC123",
      ownerId: "1",
      ownerName: "Clara",
      createdAt: "",
      updatedAt: "",
      archivedAt: null,
      members: [
        {
          userId: "1",
          name: "Clara",
          email: "clara@test.com",
          role: "owner",
          joinedAt: "",
        },
      ],
      expenses: [
        {
          id: "expense-2",
          name: "Hotel",
          amount: 300,
          date: "05/03/2026",
          payer: "Clara",
          participants: [
            {
              name: "Clara",
              percentage: 100,
            },
          ],
          groupId: "group-2",
          createdAt: "",
          createdBy: "1",
          createdByName: "Clara",
        },
      ],
    },
  ];

  beforeEach(() => {
    global.__SMARTSPLIT_TEST_GROUPS__ = () => mockGroups;
    (loadAccessibleGroups as jest.Mock).mockResolvedValue(mockGroups);
  });

  afterEach(() => {
    delete global.__SMARTSPLIT_TEST_GROUPS__;
    jest.clearAllMocks();
  });

  it("shows a list of user groups", async () => {
    const { getAllByText, getByText } = render(<Index />);

    await waitFor(() => {
      expect(getAllByText("Apartment").length).toBeGreaterThanOrEqual(1);
      expect(getByText("Vacation")).toBeTruthy();
    });
  });

  it("switches groups and updates displayed expenses", async () => {
    const { getByText, getByTestId, queryByText } =
      render(<Index />);

    await waitFor(() => {
      expect(getByText("Rent")).toBeTruthy();
    });

    fireEvent.press(
      getByTestId("switch-group-group-2")
    );

    await waitFor(() => {
      expect(getByText("Hotel")).toBeTruthy();
    });

    expect(queryByText("Rent")).toBeNull();
  });

  it("shows empty state when user has no groups", async () => {
    global.__SMARTSPLIT_TEST_GROUPS__ = () => [];
    (loadAccessibleGroups as jest.Mock).mockResolvedValue([]);

    const { getAllByText } = render(<Index />);

    await waitFor(() => {
      expect(
        getAllByText("No active group")
      ).toBeTruthy();

      expect(
        getAllByText(
          "Create or join a group to start tracking expenses."
        )
      ).toBeTruthy();
    });
  });
});

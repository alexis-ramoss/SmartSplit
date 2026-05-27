import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import App from "../app/index";
import { useAuth } from "../auth-context";

jest.mock("../auth-context", () => ({
  useAuth: jest.fn(),
}));

const mockUser = { uid: "user1", email: "user@example.com", displayName: "Clara" };

const mockGroups = [
  {
    id: "group1",
    name: "Group 1",
    inviteCode: "G1",
    ownerId: "user1",
    ownerName: "Clara",
    members: [{ userId: "user1", name: "Clara" }, { userId: "user2", name: "John" }],
    expenses: [
      {
        id: "exp1",
        name: "Lunch",
        amount: 20,
        date: "2026-05-27",
        payer: "John",
        participants: [{ name: "Clara", percentage: 50 }, { name: "John", percentage: 50 }],
      },
    ],
  },
  {
    id: "group2",
    name: "Group 2",
    inviteCode: "G2",
    ownerId: "user2",
    ownerName: "John",
    members: [{ userId: "user1", name: "Clara" }, { userId: "user2", name: "John" }],
    expenses: [
      {
        id: "exp2",
        name: "Dinner",
        amount: 40,
        date: "2026-05-27",
        payer: "Clara",
        participants: [{ name: "Clara", percentage: 50 }, { name: "John", percentage: 50 }],
      },
    ],
  },
];

(globalThis as any).__SMARTSPLIT_TEST_GROUPS__ = () => mockGroups;

describe("Global Balance Breakdown", () => {
  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      loading: false,
      signOutUser: jest.fn(),
      firestoreWritable: true,
    });
  });

  it("aggregates balances across all groups", async () => {
    render(<App />);

    // Open Global Overview
    fireEvent.press(screen.getByTestId("toggle-global-overview"));

    expect(screen.getByText("Global Balance Overview")).toBeTruthy();

    // Group 1: Clara owes John 10 (Lunch 20, John paid)
    // Group 2: John owes Clara 20 (Dinner 40, Clara paid)
    // Net: John owes Clara 10
    
    await waitFor(() => {
      expect(screen.getByText("Total Receivable")).toBeTruthy();
      expect(screen.getByText("EUR 10.00")).toBeTruthy();
      expect(screen.getByText("John")).toBeTruthy();
      expect(screen.getByText("+ EUR 10.00")).toBeTruthy();
    });
  });

  it("shows no outstanding balances when everything is settled", async () => {
    // Modify mock to be settled
    mockGroups[0].expenses = [];
    mockGroups[1].expenses = [];
    
    render(<App />);
    fireEvent.press(screen.getByTestId("toggle-global-overview"));

    await waitFor(() => {
      expect(screen.getByText("No outstanding balances.")).toBeTruthy();
      // There should be at least two 0.00 values (Total Owed and Total Receivable)
      const zeroValues = screen.getAllByText("EUR 0.00");
      expect(zeroValues.length).toBeGreaterThanOrEqual(2);
    });
  });
});

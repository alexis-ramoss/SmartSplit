import {
  calculateDebtBreakdownForMember,
  calculateMemberBalances,
  calculateSettlementSuggestions,
  createExpenseEntry,
  validateExpenseInput,
} from "../app/expense-utils";

const baseInput = {
  name: "Pizza",
  amount: "20",
  date: "08/04/2026",
  payer: "Person 1",
  participants: [
    { name: "Person 1", selected: true, percentage: "50" },
    { name: "Person 2", selected: true, percentage: "50" },
    { name: "Person 3", selected: false, percentage: "0" },
  ],
};

describe("expense-utils", () => {
  it("rejects invalid expense amounts", () => {
    expect(
      validateExpenseInput({
        ...baseInput,
        amount: "",
      })
    ).toBe("Please enter a valid expense amount.");

    expect(
      validateExpenseInput({
        ...baseInput,
        amount: "-10",
      })
    ).toBe("Please enter a valid expense amount.");
  });

  it("rejects participant weights when total is not 100%", () => {
    expect(
      validateExpenseInput({
        ...baseInput,
        participants: [
          { name: "Person 1", selected: true, percentage: "70" },
          { name: "Person 2", selected: true, percentage: "20" },
          { name: "Person 3", selected: false, percentage: "0" },
        ],
      })
    ).toBe("Participant percentages must total 100%.");
  });

  it("creates an expense entry when input is valid", () => {
    const result = createExpenseEntry(baseInput);

    expect(result.error).toBeNull();
    expect(result.expense).toMatchObject({
      name: "Pizza",
      amount: 20,
      date: "08/04/2026",
      payer: "Person 1",
      participants: [
        { name: "Person 1", percentage: 50 },
        { name: "Person 2", percentage: 50 },
      ],
    });
  });

  it("calculates member balances and settlement suggestions", () => {
    const balances = calculateMemberBalances(
      [
        {
          id: "expense-1",
          name: "Dinner",
          amount: 30,
          date: "08/04/2026",
          payer: "Person 1",
          participants: [
            { name: "Person 1", percentage: 50 },
            { name: "Person 2", percentage: 50 },
          ],
          createdAt: "2026-04-08T12:00:00.000Z",
        },
      ],
      ["Person 1", "Person 2", "Person 3"]
    );

    expect(balances).toEqual([
      { name: "Person 1", balance: 15 },
      { name: "Person 2", balance: -15 },
      { name: "Person 3", balance: 0 },
    ]);
    expect(calculateSettlementSuggestions(balances)).toEqual([
      { from: "Person 2", to: "Person 1", amount: 15 },
    ]);
  });

  it("calculates plus and minus debt breakdown items for a member", () => {
    const breakdown = calculateDebtBreakdownForMember(
      [
        {
          id: "expense-1",
          name: "Dinner",
          amount: 30,
          date: "08/04/2026",
          payer: "Person 1",
          participants: [
            { name: "Person 1", percentage: 50 },
            { name: "Person 2", percentage: 50 },
          ],
          createdAt: "2026-04-08T12:00:00.000Z",
        },
        {
          id: "expense-2",
          name: "Taxi",
          amount: 18,
          date: "08/04/2026",
          payer: "Person 2",
          participants: [
            { name: "Person 1", percentage: 50 },
            { name: "Person 2", percentage: 50 },
          ],
          createdAt: "2026-04-08T13:00:00.000Z",
        },
      ],
      "Person 1"
    );

    expect(breakdown).toEqual([
      {
        id: "expense-1",
        expenseName: "Dinner",
        payer: "Person 1",
        amount: 15,
        direction: "plus",
      },
      {
        id: "expense-2",
        expenseName: "Taxi",
        payer: "Person 2",
        amount: 9,
        direction: "minus",
      },
    ]);
  });
});

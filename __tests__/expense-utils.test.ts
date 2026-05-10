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

describe("Feature: Validate and calculate expenses", () => {
  it("Scenario: Given expense details contain a blank or negative amount, When the expense is validated, Then the user receives an amount-specific validation message", () => {
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

  it("Scenario: Given participant percentages add up to less than 100, When the expense is validated, Then the user receives a split-total validation message", () => {
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

  it("Scenario: Given valid expense details, When an expense entry is created, Then the saved expense contains normalized numeric values and selected participants only", () => {
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

  it("Scenario: Given one member paid for a shared expense, When balances and settlements are calculated, Then the payer is credited, the participant is debited, and the settlement clears the debt", () => {
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

  it("Scenario: Given the current member both paid for and benefited from shared expenses, When their debt breakdown is calculated, Then covered amounts are marked positive and amounts owed to others are marked negative", () => {
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

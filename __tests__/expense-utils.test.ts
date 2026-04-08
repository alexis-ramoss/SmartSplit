import { createExpenseEntry, validateExpenseInput } from "../app/expense-utils";

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
});

import { fireEvent, render } from "@testing-library/react-native";
import Index from "../app/index";

describe("Feature: View group balances", () => {
  it("Scenario: Given the active group has expenses, When the dashboard is opened, Then the current balance panel shows the user's net balance and the settlement needed to square the group", () => {
    // Given the active group already has shared expenses
    // When the dashboard is opened
    const { getAllByText, getByTestId, getByText } = render(<Index />);

    // Then the dashboard shows the current net balance and settlement instruction
    expect(getByTestId("balance-breakdown")).toBeTruthy();
    expect(getByText("+ EUR 12.25.")).toBeTruthy();
    expect(getAllByText("+ EUR 12.25").length).toBeGreaterThan(0);
    expect(getByText("Person 2 pays Person 1 EUR 12.25")).toBeTruthy();
  });

  it("Scenario: Given the active group has an expense, When the expense amount is edited, Then the dashboard recalculates the net balance and settlement instruction from the updated amount", () => {
    // Given the dashboard shows the original balance
    const { getAllByText, getByTestId, getByText } = render(<Index />);

    expect(getByText("+ EUR 12.25.")).toBeTruthy();

    // When the seeded expense amount is changed
    fireEvent.press(getByTestId("edit-expense-seed-1"));
    fireEvent.changeText(getByTestId("expense-amount-input"), "40");
    fireEvent.press(getByTestId("save-expense-button"));

    // Then all balance outputs reflect the updated expense amount
    expect(getByText("+ EUR 20.00.")).toBeTruthy();
    expect(getAllByText("+ EUR 20.00").length).toBeGreaterThan(0);
    expect(getByText("Person 2 pays Person 1 EUR 20.00")).toBeTruthy();
  });

  it("Scenario: Given a newly created group has no expenses, When it becomes active, Then the dashboard hides the balance panel because there is no debt to summarize", () => {
    // Given the user is creating a new group
    const { getByPlaceholderText, getByTestId, queryByTestId } = render(<Index />);

    // When the empty group becomes active
    fireEvent.press(getByTestId("open-create-group-button"));
    fireEvent.changeText(getByPlaceholderText("e.g., Apartment 2B"), "Apartment 2B");
    fireEvent.press(getByTestId("save-group-button"));

    // Then no balance breakdown is shown for the empty group
    expect(queryByTestId("balance-breakdown")).toBeNull();
  });
});

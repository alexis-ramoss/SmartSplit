import { fireEvent, render } from "@testing-library/react-native";
import Index from "../app/index";

describe("Feature: Identify who paid for an expense", () => {
  it("Scenario: Given the user is adding an expense, When they select a payer, Then the saved expense names that payer and does not show a missing-payer validation error", () => {
    // Given the user is on the add expense form
    const { getByPlaceholderText, getByTestId, getByText, queryByText } = render(
      <Index />
    );

    fireEvent.press(getByText("Add expense"));

    // When they complete the expense and choose Person 2 as payer
    fireEvent.changeText(getByPlaceholderText("e.g., Coffee"), "Internet bill");
    fireEvent.changeText(getByPlaceholderText("0.00"), "29.99");
    fireEvent.changeText(getByPlaceholderText("08/03/2026"), "08/04/2026");
    fireEvent.press(getByTestId("payer-option-Person 2"));
    fireEvent.press(getByTestId("save-expense-button"));

    // Then the saved expense identifies Person 2 as the payer
    expect(queryByText("Please enter who paid for the expense.")).toBeNull();
    expect(getByText("Internet bill")).toBeTruthy();
    expect(getByText("Paid by Person 2")).toBeTruthy();
  });

  it("Scenario: Given an existing expense has a payer, When the payer is changed while editing, Then the expenses list reflects the new payer for that existing expense", () => {
    // Given an existing expense is ready to edit
    const { getByDisplayValue, getByTestId, getByText } = render(<Index />);

    // When the user changes the payer and saves
    fireEvent.press(getByTestId("edit-expense-seed-1"));

    expect(getByText("Edit Expense")).toBeTruthy();
    expect(getByDisplayValue("Groceries")).toBeTruthy();

    fireEvent.press(getByTestId("payer-option-Person 2"));
    fireEvent.press(getByTestId("save-expense-button"));

    // Then the existing expense displays the newly selected payer
    expect(getByText("Paid by Person 2")).toBeTruthy();
  });
});

import { fireEvent, render } from "@testing-library/react-native";
import Index from "../app/index";

describe("Feature: Edit an expense", () => {
  it("Scenario: Given a saved expense exists, When the user edits and saves it, Then the expenses list shows the corrected details and no longer shows the outdated entry", () => {
    // Given the user has an existing saved expense
    const { getAllByText, getByDisplayValue, getByTestId, getByText, queryByText } = render(
      <Index />
    );

    // When they open the expense for editing and save corrected values
    fireEvent.press(getByTestId("edit-expense-expense-1"));

    expect(getByText("Edit Expense")).toBeTruthy();
    expect(getByDisplayValue("Groceries")).toBeTruthy();

    fireEvent.changeText(getByTestId("expense-name-input"), "Corrected groceries");
    fireEvent.changeText(getByTestId("expense-amount-input"), "30");
    fireEvent.press(getByTestId("save-expense-button"));

    // Then the old expense text is gone and the corrected expense is displayed
    expect(queryByText("Groceries")).toBeNull();
    expect(getByText("Corrected groceries")).toBeTruthy();
    expect(getAllByText("EUR 30.00").length).toBeGreaterThan(0);
  });
});

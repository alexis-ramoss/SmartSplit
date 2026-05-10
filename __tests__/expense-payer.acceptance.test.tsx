import { fireEvent, render } from "@testing-library/react-native";
import Index from "../app/index";

describe("Expense payer identification acceptance", () => {
  it("Given the user is adding an expense, When they select a payer, Then the expense is saved with that payer", () => {
    // Given
    const { getByPlaceholderText, getByTestId, getByText, queryByText } = render(
      <Index />
    );

    fireEvent.press(getByText("Add expense"));

    // When
    fireEvent.changeText(getByPlaceholderText("e.g., Coffee"), "Internet bill");
    fireEvent.changeText(getByPlaceholderText("0.00"), "29.99");
    fireEvent.changeText(getByPlaceholderText("08/03/2026"), "08/04/2026");
    fireEvent.press(getByTestId("payer-option-Person 2"));
    fireEvent.press(getByTestId("save-expense-button"));

    // Then
    expect(queryByText("Please enter who paid for the expense.")).toBeNull();
    expect(getByText("Internet bill")).toBeTruthy();
    expect(getByText("Paid by Person 2")).toBeTruthy();
  });

  it("Given an existing expense has a payer, When the payer is changed while editing, Then the expense shows the new payer", () => {
    // Given
    const { getByDisplayValue, getByTestId, getByText } = render(<Index />);

    // When
    fireEvent.press(getByTestId("edit-expense-seed-1"));

    expect(getByText("Edit Expense")).toBeTruthy();
    expect(getByDisplayValue("Groceries")).toBeTruthy();

    fireEvent.press(getByTestId("payer-option-Person 2"));
    fireEvent.press(getByTestId("save-expense-button"));

    // Then
    expect(getByText("Paid by Person 2")).toBeTruthy();
  });
});

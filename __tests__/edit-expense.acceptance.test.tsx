import { fireEvent, render } from "@testing-library/react-native";
import Index from "../app/index";

describe("Edit expense acceptance", () => {
  it("Given a saved expense exists, When the user edits and saves it, Then the updated expense replaces the old one", () => {
    // Given
    const { getAllByText, getByDisplayValue, getByTestId, getByText, queryByText } = render(
      <Index />
    );

    // When
    fireEvent.press(getByTestId("edit-expense-seed-1"));

    expect(getByText("Edit Expense")).toBeTruthy();
    expect(getByDisplayValue("Groceries")).toBeTruthy();

    fireEvent.changeText(getByTestId("expense-name-input"), "Corrected groceries");
    fireEvent.changeText(getByTestId("expense-amount-input"), "30");
    fireEvent.press(getByTestId("save-expense-button"));

    // Then
    expect(queryByText("Groceries")).toBeNull();
    expect(getByText("Corrected groceries")).toBeTruthy();
    expect(getAllByText("EUR 30.00").length).toBeGreaterThan(0);
  });
});

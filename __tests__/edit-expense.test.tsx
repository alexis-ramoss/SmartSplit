import { fireEvent, render } from "@testing-library/react-native";
import Index from "../app/index";

describe("Edit expense", () => {
  it("updates the saved expense details and removes the old values", () => {
    const { getAllByText, getByDisplayValue, getByTestId, getByText, queryByText } = render(
      <Index />
    );

    fireEvent.press(getByTestId("edit-expense-expense-1"));

    expect(getByText("Edit Expense")).toBeTruthy();
    expect(getByDisplayValue("Groceries")).toBeTruthy();

    fireEvent.changeText(getByTestId("expense-name-input"), "Corrected groceries");
    fireEvent.changeText(getByTestId("expense-amount-input"), "30");
    fireEvent.press(getByTestId("save-expense-button"));

    expect(queryByText("Groceries")).toBeNull();
    expect(getByText("Corrected groceries")).toBeTruthy();
    expect(getAllByText("EUR 30.00").length).toBeGreaterThan(0);
  });
});

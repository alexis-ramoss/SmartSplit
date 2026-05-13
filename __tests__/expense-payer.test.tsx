import { fireEvent, render } from "@testing-library/react-native";
import Index from "../app/index";

describe("Expense payer", () => {
  it("saves the selected payer on a new expense", () => {
    const { getAllByText, getByPlaceholderText, getByTestId, getByText, queryByText } = render(
      <Index />
    );

    fireEvent.press(getByText("Add expense"));

    fireEvent.changeText(getByPlaceholderText("e.g., Coffee"), "Internet bill");
    fireEvent.changeText(getByPlaceholderText("0.00"), "29.99");
    fireEvent.changeText(getByPlaceholderText("08/03/2026"), "08/04/2026");
    fireEvent.press(getByTestId("payer-option-Person 2"));
    fireEvent.press(getByTestId("save-expense-button"));

    expect(queryByText("Please enter who paid for the expense.")).toBeNull();
    expect(getAllByText("Internet bill").length).toBeGreaterThan(0);
    expect(getAllByText("Paid by Person 2").length).toBeGreaterThan(0);
  });

  it("updates the payer when editing an existing expense", () => {
    const { getByDisplayValue, getByTestId, getByText } = render(<Index />);

    fireEvent.press(getByTestId("edit-expense-expense-1"));

    expect(getByText("Edit Expense")).toBeTruthy();
    expect(getByDisplayValue("Groceries")).toBeTruthy();

    fireEvent.press(getByTestId("payer-option-Person 2"));
    fireEvent.press(getByTestId("save-expense-button"));

    expect(getByText("Paid by Person 2")).toBeTruthy();
  });
});

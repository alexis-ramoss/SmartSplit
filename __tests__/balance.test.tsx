import { fireEvent, render } from "@testing-library/react-native";
import Index from "../app/index";

describe("Balance summary", () => {
  it("shows the current balance and settlement suggestion for the seeded group", () => {
    const { getAllByText, getByTestId, getByText } = render(<Index />);

    expect(getByTestId("balance-breakdown")).toBeTruthy();
    expect(getByText("+ EUR 12.25.")).toBeTruthy();
    expect(getAllByText("+ EUR 12.25").length).toBeGreaterThan(0);
    expect(getByText("Person 2 pays Person 1 EUR 12.25")).toBeTruthy();
  });

  it("recalculates the summary after editing an expense amount", () => {
    const { getAllByText, getByTestId, getByText } = render(<Index />);

    expect(getByText("+ EUR 12.25.")).toBeTruthy();

    fireEvent.press(getByTestId("edit-expense-expense-1"));
    fireEvent.changeText(getByTestId("expense-amount-input"), "40");
    fireEvent.press(getByTestId("save-expense-button"));

    expect(getByText("+ EUR 20.00.")).toBeTruthy();
    expect(getAllByText("+ EUR 20.00").length).toBeGreaterThan(0);
    expect(getByText("Person 2 pays Person 1 EUR 20.00")).toBeTruthy();
  });

  it("hides the balance summary for a new group with no expenses", () => {
    const { getByPlaceholderText, getByTestId, queryByTestId } = render(<Index />);

    fireEvent.press(getByTestId("open-create-group-button"));
    fireEvent.changeText(getByPlaceholderText("e.g., Apartment 2B"), "Apartment 2B");
    fireEvent.press(getByTestId("save-group-button"));

    expect(queryByTestId("balance-breakdown")).toBeNull();
  });
});

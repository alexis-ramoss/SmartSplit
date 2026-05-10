import { fireEvent, render } from "@testing-library/react-native";
import Index from "../app/index";

describe("Balance acceptance", () => {
  it("Given the active group has expenses, When the dashboard is opened, Then the balance breakdown is shown", () => {
    // Given / When
    const { getAllByText, getByTestId, getByText } = render(<Index />);

    // Then
    expect(getByTestId("balance-breakdown")).toBeTruthy();
    expect(getByText("+ EUR 12.25.")).toBeTruthy();
    expect(getAllByText("+ EUR 12.25").length).toBeGreaterThan(0);
    expect(getByText("Person 2 pays Person 1 EUR 12.25")).toBeTruthy();
  });

  it("Given the active group has an expense, When the expense amount is edited, Then the current balance is recalculated", () => {
    // Given
    const { getAllByText, getByTestId, getByText } = render(<Index />);

    expect(getByText("+ EUR 12.25.")).toBeTruthy();

    // When
    fireEvent.press(getByTestId("edit-expense-seed-1"));
    fireEvent.changeText(getByTestId("expense-amount-input"), "40");
    fireEvent.press(getByTestId("save-expense-button"));

    // Then
    expect(getByText("+ EUR 20.00.")).toBeTruthy();
    expect(getAllByText("+ EUR 20.00").length).toBeGreaterThan(0);
    expect(getByText("Person 2 pays Person 1 EUR 20.00")).toBeTruthy();
  });

  it("Given a newly created group has no expenses, When it becomes active, Then the balance breakdown is hidden", () => {
    // Given
    const { getByPlaceholderText, getByTestId, queryByTestId } = render(<Index />);

    // When
    fireEvent.press(getByTestId("open-create-group-button"));
    fireEvent.changeText(getByPlaceholderText("e.g., Apartment 2B"), "Apartment 2B");
    fireEvent.press(getByTestId("save-group-button"));

    // Then
    expect(queryByTestId("balance-breakdown")).toBeNull();
  });
});

import { fireEvent, render } from "@testing-library/react-native";
import Index from "../app/index";

describe("Debt breakdown acceptance", () => {
  it("Given the current user is part of shared expenses, When the dashboard is viewed, Then the debt breakdown shows owed and covered amounts", () => {
    // Given
    const { getAllByText, getByPlaceholderText, getByTestId, getByText } = render(
      <Index />
    );

    // Then
    expect(getByTestId("debt-breakdown-list")).toBeTruthy();
    expect(getByText("Your debt breakdown")).toBeTruthy();
    expect(getByText("For Groceries")).toBeTruthy();
    expect(getByText("Paid by you")).toBeTruthy();
    expect(getAllByText("+ EUR 12.25").length).toBeGreaterThan(0);

    // When
    fireEvent.press(getByText("Add expense"));
    fireEvent.changeText(getByPlaceholderText("e.g., Coffee"), "Taxi");
    fireEvent.changeText(getByPlaceholderText("0.00"), "18");
    fireEvent.press(getByTestId("payer-option-Person 2"));
    fireEvent.press(getByTestId("save-expense-button"));

    // Then
    expect(getByText("For Taxi")).toBeTruthy();
    expect(getByText("Covered by Person 2")).toBeTruthy();
    expect(getByText("- EUR 9.00")).toBeTruthy();
  });
});

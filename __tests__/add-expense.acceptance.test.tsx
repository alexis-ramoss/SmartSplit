import { fireEvent, render } from "@testing-library/react-native";
import Index from "../app/index";

describe("Add Expense screen acceptance", () => {
  it("Given the user is adding an expense, When they submit valid details, Then the expense appears in the group list", () => {
    // Given
    const { getAllByText, getByPlaceholderText, getByText, queryByText } = render(
      <Index />
    );

    fireEvent.press(getByText("Add expense"));

    // When
    fireEvent.changeText(getByPlaceholderText("e.g., Coffee"), "Internet bill");
    fireEvent.changeText(getByPlaceholderText("0.00"), "29.99");
    fireEvent.changeText(getByPlaceholderText("08/03/2026"), "08/04/2026");
    fireEvent.press(getByText("Add"));

    // Then
    expect(queryByText("Please enter a valid expense amount.")).toBeNull();
    expect(getByText("Internet bill")).toBeTruthy();
    expect(getAllByText("Paid by Person 1").length).toBeGreaterThan(0);
    expect(getByText("EUR 29.99")).toBeTruthy();
  });

  it("Given the user is adding an expense, When they submit an invalid amount, Then an error is shown and the expense is not saved", () => {
    // Given
    const { getByPlaceholderText, getByTestId, getByText, queryByText } = render(
      <Index />
    );

    fireEvent.press(getByText("Add expense"));

    // When
    fireEvent.changeText(getByPlaceholderText("e.g., Coffee"), "Shared lunch");
    fireEvent.changeText(getByPlaceholderText("0.00"), "");
    fireEvent.press(getByTestId("save-expense-button"));

    // Then
    expect(getByText("Please enter a valid expense amount.")).toBeTruthy();
    expect(queryByText("Shared lunch")).toBeNull();
  });
});

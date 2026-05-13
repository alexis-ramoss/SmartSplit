import { fireEvent, render } from "@testing-library/react-native";
import Index from "../app/index";

describe("Feature: Add an expense to a group", () => {
  it("Scenario: Given the user is adding an expense, When they submit valid details, Then the group expense list includes the new expense with the submitted amount and payer", () => {
    // Given the user is on the add expense form
    const { getAllByText, getByPlaceholderText, getByText, queryByText } = render(
      <Index />
    );

    fireEvent.press(getByText("Add expense"));

    // When they submit a complete expense
    fireEvent.changeText(getByPlaceholderText("e.g., Coffee"), "Internet bill");
    fireEvent.changeText(getByPlaceholderText("0.00"), "29.99");
    fireEvent.changeText(getByPlaceholderText("08/03/2026"), "08/04/2026");
    fireEvent.press(getByText("Add"));

    // Then the new expense is visible with no amount validation error
    expect(queryByText("Please enter a valid expense amount.")).toBeNull();
    expect(getAllByText("Internet bill").length).toBeGreaterThan(0);
    expect(getAllByText("Paid by Person 1").length).toBeGreaterThan(0);
    expect(getAllByText("EUR 29.99").length).toBeGreaterThan(0);
  });

  it("Scenario: Given the user is adding an expense, When they submit an invalid amount, Then the form explains the amount problem and prevents the expense from being added", () => {
    // Given the user is on the add expense form
    const { getByPlaceholderText, getByTestId, getByText, queryByText } = render(
      <Index />
    );

    fireEvent.press(getByText("Add expense"));

    // When they leave the amount empty and try to save
    fireEvent.changeText(getByPlaceholderText("e.g., Coffee"), "Shared lunch");
    fireEvent.changeText(getByPlaceholderText("0.00"), "");
    fireEvent.press(getByTestId("save-expense-button"));

    // Then the validation message is shown and the expense list is unchanged
    expect(getByText("Please enter a valid expense amount.")).toBeTruthy();
    expect(queryByText("Shared lunch")).toBeNull();
  });
});

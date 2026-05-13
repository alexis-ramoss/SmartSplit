import { fireEvent, render } from "@testing-library/react-native";
import Index from "../app/index";

describe("Feature: View debt breakdown", () => {
  it("Scenario: Given the current user is part of shared expenses, When the dashboard is viewed and a new expense paid by someone else is added, Then the breakdown separates money the user covered from money the user owes", () => {
  // Given the active group has an expense paid by the current user
  const { getAllByText, getByPlaceholderText, getByTestId } = render(
      <Index />
    );

    // Then the breakdown shows money the current user covered for others
    expect(getByTestId("debt-breakdown-list")).toBeTruthy();
  expect(getAllByText("Your debt breakdown").length).toBeGreaterThan(0);
  expect(getAllByText("For Groceries").length).toBeGreaterThan(0);
  expect(getAllByText("Paid by you").length).toBeGreaterThan(0);
    expect(getAllByText("+ EUR 12.25").length).toBeGreaterThan(0);

    // When another member pays for a new shared expense
  fireEvent.press(getAllByText("Add expense")[0]);
    fireEvent.changeText(getByPlaceholderText("e.g., Coffee"), "Taxi");
    fireEvent.changeText(getByPlaceholderText("0.00"), "18");
    fireEvent.press(getByTestId("payer-option-Person 2"));
    fireEvent.press(getByTestId("save-expense-button"));

    // Then the breakdown adds the amount the current user owes that payer
  // Taxi (18) split among participants contributes to the breakdown
  expect(getAllByText("For Taxi").length).toBeGreaterThan(0);
  });
});

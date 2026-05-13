import { fireEvent, render } from "@testing-library/react-native";
import Index from "../app/index";

describe("Debt breakdown", () => {
  it("shows money covered by the current user and money owed after another member adds an expense", () => {
    const { getAllByText, getByPlaceholderText, getByTestId, getByText } = render(
      <Index />
    );

    expect(getByTestId("debt-breakdown-list")).toBeTruthy();
    expect(getAllByText("Your debt breakdown").length).toBeGreaterThan(0);
    expect(getAllByText("For Groceries").length).toBeGreaterThan(0);
    expect(getAllByText("Paid by you").length).toBeGreaterThan(0);
    expect(getAllByText("+ EUR 12.25").length).toBeGreaterThan(0);

    fireEvent.press(getByText("Add expense"));
    fireEvent.changeText(getByPlaceholderText("e.g., Coffee"), "Taxi");
    fireEvent.changeText(getByPlaceholderText("0.00"), "18");
    fireEvent.press(getByTestId("payer-option-Person 2"));
    fireEvent.press(getByTestId("save-expense-button"));

    expect(getAllByText("For Taxi").length).toBeGreaterThan(0);
    expect(getAllByText("Covered by Person 2").length).toBeGreaterThan(0);
    expect(getAllByText("- EUR 9.00").length).toBeGreaterThan(0);
  });
});

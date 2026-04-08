import { fireEvent, render } from "@testing-library/react-native";
import Index from "../app/index";

describe("Add Expense screen acceptance", () => {
  it("saves a valid expense and shows it in the group list", () => {
    const { getByTestId, getByPlaceholderText, getByText, queryByText } = render(
      <Index />
    );

    fireEvent.press(getByText("Add expense"));
    fireEvent.changeText(getByPlaceholderText("e.g., Coffee"), "Internet bill");
    fireEvent.changeText(getByPlaceholderText("0.00"), "29.99");
    fireEvent.changeText(getByPlaceholderText("08/03/2026"), "08/04/2026");
    fireEvent.press(getByTestId("payer-option-Person 2"));
    fireEvent.press(getByTestId("save-expense-button"));

    expect(queryByText("Please enter a valid expense amount.")).toBeNull();
    expect(getByText("Internet bill")).toBeTruthy();
    expect(getByText("Paid by Person 2")).toBeTruthy();
    expect(getByText("EUR 29.99")).toBeTruthy();
  });

  it("shows an error and does not save an invalid amount", () => {
    const { getByPlaceholderText, getByTestId, getByText, queryByText } = render(
      <Index />
    );

    fireEvent.press(getByText("Add expense"));
    fireEvent.changeText(getByPlaceholderText("e.g., Coffee"), "Shared lunch");
    fireEvent.changeText(getByPlaceholderText("0.00"), "");
    fireEvent.press(getByTestId("save-expense-button"));

    expect(getByText("Please enter a valid expense amount.")).toBeTruthy();
    expect(queryByText("Shared lunch")).toBeNull();
  });

  it("shows an error when participant percentages do not total 100", () => {
    const { getByPlaceholderText, getByTestId, getByText } = render(<Index />);

    fireEvent.press(getByText("Add expense"));
    fireEvent.changeText(getByPlaceholderText("e.g., Coffee"), "Streaming plan");
    fireEvent.changeText(getByPlaceholderText("0.00"), "12.00");
    fireEvent.changeText(getByTestId("participant-weight-Person 1"), "70");
    fireEvent.changeText(getByTestId("participant-weight-Person 2"), "20");
    fireEvent.press(getByTestId("save-expense-button"));

    expect(getByText("Participant percentages must total 100%.")).toBeTruthy();
    expect(String(getByTestId("participants-total").props.children)).toContain("90");
  });
});

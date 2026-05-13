import { fireEvent, render } from "@testing-library/react-native";
import Index from "../app/index";

describe("Expense participants", () => {
  it("saves only the selected participants with the updated split", () => {
    const { getAllByText, getByPlaceholderText, getByTestId, getByText, queryByText } = render(
      <Index />
    );

    fireEvent.press(getByText("Add expense"));

    fireEvent.changeText(getByPlaceholderText("e.g., Coffee"), "Museum tickets");
    fireEvent.changeText(getByPlaceholderText("0.00"), "80");
    fireEvent.press(getByTestId("participant-toggle-Person 2"));
    fireEvent.press(getByTestId("participant-toggle-Person 3"));
    fireEvent.changeText(getByTestId("participant-weight-Person 1"), "75");
    fireEvent.changeText(getByTestId("participant-weight-Person 3"), "25");
    fireEvent.press(getByTestId("save-expense-button"));

    expect(getAllByText("Museum tickets").length).toBeGreaterThan(0);
    expect(getAllByText("Split: Person 1 75%, Person 3 25%").length).toBeGreaterThan(0);
    expect(queryByText("Split: Person 1 75%, Person 2 50%")).toBeNull();
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

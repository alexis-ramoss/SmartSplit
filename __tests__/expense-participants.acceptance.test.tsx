import { fireEvent, render } from "@testing-library/react-native";
import Index from "../app/index";

describe("Expense participants acceptance", () => {
  it("Given the user is adding an expense, When they choose participants and split percentages, Then only the selected split is saved", () => {
    // Given
    const { getByPlaceholderText, getByTestId, getByText, queryByText } = render(
      <Index />
    );

    fireEvent.press(getByText("Add expense"));

    // When
    fireEvent.changeText(getByPlaceholderText("e.g., Coffee"), "Museum tickets");
    fireEvent.changeText(getByPlaceholderText("0.00"), "80");
    fireEvent.press(getByTestId("participant-toggle-Person 2"));
    fireEvent.press(getByTestId("participant-toggle-Person 3"));
    fireEvent.changeText(getByTestId("participant-weight-Person 1"), "75");
    fireEvent.changeText(getByTestId("participant-weight-Person 3"), "25");
    fireEvent.press(getByTestId("save-expense-button"));

    // Then
    expect(getByText("Museum tickets")).toBeTruthy();
    expect(getByText("Split: Person 1 75%, Person 3 25%")).toBeTruthy();
    expect(queryByText("Split: Person 1 75%, Person 2 50%")).toBeNull();
  });

  it("Given the user is adding an expense, When selected participant percentages do not total 100, Then a validation error is shown", () => {
    // Given
    const { getByPlaceholderText, getByTestId, getByText } = render(<Index />);

    fireEvent.press(getByText("Add expense"));

    // When
    fireEvent.changeText(getByPlaceholderText("e.g., Coffee"), "Streaming plan");
    fireEvent.changeText(getByPlaceholderText("0.00"), "12.00");
    fireEvent.changeText(getByTestId("participant-weight-Person 1"), "70");
    fireEvent.changeText(getByTestId("participant-weight-Person 2"), "20");
    fireEvent.press(getByTestId("save-expense-button"));

    // Then
    expect(getByText("Participant percentages must total 100%.")).toBeTruthy();
    expect(String(getByTestId("participants-total").props.children)).toContain("90");
  });
});

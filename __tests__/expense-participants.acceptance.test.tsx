import { fireEvent, render } from "@testing-library/react-native";
import Index from "../app/index";

describe("Feature: Choose expense participants", () => {
  it("Scenario: Given the user is adding an expense, When they choose participants and split percentages, Then the saved expense shows only the selected participants and their final percentage split", () => {
    // Given the user is on the add expense form
    const { getByPlaceholderText, getByTestId, getByText, queryByText } = render(
      <Index />
    );

    fireEvent.press(getByText("Add expense"));

    // When they exclude one participant and adjust the remaining split
    fireEvent.changeText(getByPlaceholderText("e.g., Coffee"), "Museum tickets");
    fireEvent.changeText(getByPlaceholderText("0.00"), "80");
    fireEvent.press(getByTestId("participant-toggle-Person 2"));
    fireEvent.press(getByTestId("participant-toggle-Person 3"));
    fireEvent.changeText(getByTestId("participant-weight-Person 1"), "75");
    fireEvent.changeText(getByTestId("participant-weight-Person 3"), "25");
    fireEvent.press(getByTestId("save-expense-button"));

    // Then the saved split names the selected participants and omits the removed one
    expect(getByText("Museum tickets")).toBeTruthy();
    expect(getByText("Split: Person 1 75%, Person 3 25%")).toBeTruthy();
    expect(queryByText("Split: Person 1 75%, Person 2 50%")).toBeNull();
  });

  it("Scenario: Given the user is adding an expense, When selected participant percentages do not total 100, Then the form reports the invalid total and keeps the user in the participant split flow", () => {
    // Given the user is on the add expense form
    const { getByPlaceholderText, getByTestId, getByText } = render(<Index />);

    fireEvent.press(getByText("Add expense"));

    // When they submit participant percentages that add up to 90
    fireEvent.changeText(getByPlaceholderText("e.g., Coffee"), "Streaming plan");
    fireEvent.changeText(getByPlaceholderText("0.00"), "12.00");
    fireEvent.changeText(getByTestId("participant-weight-Person 1"), "70");
    fireEvent.changeText(getByTestId("participant-weight-Person 2"), "20");
    fireEvent.press(getByTestId("save-expense-button"));

    // Then the user sees why the split cannot be saved yet
    expect(getByText("Participant percentages must total 100%.")).toBeTruthy();
    expect(String(getByTestId("participants-total").props.children)).toContain("90");
  });
});

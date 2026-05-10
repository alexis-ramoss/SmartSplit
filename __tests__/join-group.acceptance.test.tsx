import { fireEvent, render } from "@testing-library/react-native";
import Index from "../app/index";

describe("Feature: Join a group", () => {
  it("Scenario: Given another group is active, When the user enters an existing invite code, Then the app switches them into the invited group and confirms the join", () => {
    // Given the user is currently in a different active group
    const { getByPlaceholderText, getByTestId, getByText } = render(<Index />);

    fireEvent.press(getByTestId("open-create-group-button"));
    fireEvent.changeText(getByPlaceholderText("e.g., Apartment 2B"), "Apartment 2B");
    fireEvent.press(getByTestId("save-group-button"));

    expect(getByText("Apartment 2B")).toBeTruthy();

    // When they submit an invite code for an existing group
    fireEvent.press(getByTestId("open-join-group-button"));
    fireEvent.changeText(getByPlaceholderText("HOME123"), "HOME123");
    fireEvent.press(getByTestId("join-group-button"));

    // Then the invited group is active and the user gets join confirmation
    expect(getByText("Household")).toBeTruthy();
    expect(getByText("Joined Household.")).toBeTruthy();
  });
});

import { fireEvent, render } from "@testing-library/react-native";
import Index from "../app/index";

describe("Feature: Create a group", () => {
  it("Scenario: Given the user wants a new group, When they submit a group name, Then the app activates that group, gives the user a share code, and starts with no balance summary", () => {
    // Given the user opens the create group form
    const { getByPlaceholderText, getByTestId, getByText, queryByTestId } = render(
      <Index />
    );

    fireEvent.press(getByTestId("open-create-group-button"));

    // When they submit a group name
    fireEvent.changeText(getByPlaceholderText("e.g., Apartment 2B"), "Apartment 2B");
    fireEvent.press(getByTestId("save-group-button"));

    // Then the new group is active, shareable, and has no balances yet
    expect(getByText("Apartment 2B")).toBeTruthy();
    expect(getByTestId("group-status-message").props.children).toContain(
      "Created Apartment 2B."
    );
    expect(getByTestId("group-status-message").props.children).toContain(
      "Share code"
    );
    expect(queryByTestId("balance-breakdown")).toBeNull();
  });
});

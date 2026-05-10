import { fireEvent, render } from "@testing-library/react-native";
import Index from "../app/index";

describe("Create group acceptance", () => {
  it("Given the user wants a new group, When they submit a group name, Then the group is created and made active", () => {
    // Given
    const { getByPlaceholderText, getByTestId, getByText, queryByTestId } = render(
      <Index />
    );

    fireEvent.press(getByTestId("open-create-group-button"));

    // When
    fireEvent.changeText(getByPlaceholderText("e.g., Apartment 2B"), "Apartment 2B");
    fireEvent.press(getByTestId("save-group-button"));

    // Then
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

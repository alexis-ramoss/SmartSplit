import { fireEvent, render } from "@testing-library/react-native";
import Index from "../app/index";

describe("Join group acceptance", () => {
  it("Given another group is active, When the user enters an existing invite code, Then they join that group", () => {
    // Given
    const { getByPlaceholderText, getByTestId, getByText } = render(<Index />);

    fireEvent.press(getByTestId("open-create-group-button"));
    fireEvent.changeText(getByPlaceholderText("e.g., Apartment 2B"), "Apartment 2B");
    fireEvent.press(getByTestId("save-group-button"));

    expect(getByText("Apartment 2B")).toBeTruthy();

    // When
    fireEvent.press(getByTestId("open-join-group-button"));
    fireEvent.changeText(getByPlaceholderText("HOME123"), "HOME123");
    fireEvent.press(getByTestId("join-group-button"));

    // Then
    expect(getByText("Household")).toBeTruthy();
    expect(getByText("Joined Household.")).toBeTruthy();
  });
});

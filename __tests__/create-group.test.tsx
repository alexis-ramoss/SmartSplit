import { fireEvent, render } from "@testing-library/react-native";
import Index from "../app/index";

describe("Create group", () => {
  it("activates the new group, shows a share code, and starts without balances", () => {
    const { getByPlaceholderText, getByTestId, getByText, queryByTestId } = render(
      <Index />
    );

    fireEvent.press(getByTestId("open-create-group-button"));

    fireEvent.changeText(getByPlaceholderText("e.g., Apartment 2B"), "Apartment 2B");
    fireEvent.press(getByTestId("save-group-button"));

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

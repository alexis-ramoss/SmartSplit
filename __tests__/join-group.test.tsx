import { fireEvent, render } from "@testing-library/react-native";
import Index from "../app/index";

describe("Join group", () => {
  it("switches to the invited group and shows a confirmation message", () => {
    const { getAllByText, getByPlaceholderText, getByTestId, getByText } = render(<Index />);

    fireEvent.press(getByTestId("open-create-group-button"));
    fireEvent.changeText(getByPlaceholderText("e.g., Apartment 2B"), "Apartment 2B");
    fireEvent.press(getByTestId("save-group-button"));

    expect(getAllByText("Apartment 2B").length).toBeGreaterThanOrEqual(1);

    fireEvent.press(getByTestId("open-join-group-button"));
    fireEvent.changeText(getByPlaceholderText("HOME123"), "HOME123");
    fireEvent.press(getByTestId("join-group-button"));

    expect(getAllByText("Household").length).toBeGreaterThanOrEqual(1);
    expect(getByText("Joined Household.")).toBeTruthy();
  });
});

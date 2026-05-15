import { fireEvent, render } from "@testing-library/react-native";
import Index from "../app/index";

jest.mock("../auth-context", () => ({
  useAuth: () => ({
    user: { uid: "123", email: "test@example.com" },
    loading: false,
    signOutUser: jest.fn(),
  }),
}));

describe("Add expense", () => {
  it("adds an expense to the list when the form is valid", () => {
    const { getAllByText, getByPlaceholderText, getByText, queryByText } = render(
      <Index />
    );

    fireEvent.press(getByText("Add expense"));

    fireEvent.changeText(getByPlaceholderText("e.g., Coffee"), "Internet bill");
    fireEvent.changeText(getByPlaceholderText("0.00"), "29.99");
    fireEvent.changeText(getByPlaceholderText("08/03/2026"), "08/04/2026");
    fireEvent.press(getByText("Add"));

    expect(queryByText("Please enter a valid expense amount.")).toBeNull();
    expect(getAllByText("Internet bill").length).toBeGreaterThan(0);
    expect(getAllByText("Paid by Person 1").length).toBeGreaterThan(0);
    expect(getAllByText("EUR 29.99").length).toBeGreaterThan(0);
  });

  it("shows a validation error and does not add the expense when the amount is missing", () => {
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
});

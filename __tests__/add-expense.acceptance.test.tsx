import { fireEvent, render } from "@testing-library/react-native";
import Index from "../app/index";

jest.mock("../auth-context", () => ({
  useAuth: () => ({
    user: { uid: "123", email: "test@example.com" },
    loading: false,
    signOutUser: jest.fn(),
  }),
}));

describe("Add Expense screen acceptance", () => {
  it("saves a valid expense and shows it in the group list", () => {
    const { getByTestId, getByPlaceholderText, getByText, queryByText } = render(
      <Index />
    );

    fireEvent.press(getByText("Add expense"));
    fireEvent.changeText(getByPlaceholderText("e.g., Coffee"), "Internet bill");
    fireEvent.changeText(getByPlaceholderText("0.00"), "29.99");
    fireEvent.changeText(getByPlaceholderText("08/03/2026"), "08/04/2026");
    fireEvent.press(getByTestId("payer-option-Person 2"));
    fireEvent.press(getByTestId("save-expense-button"));

    expect(queryByText("Please enter a valid expense amount.")).toBeNull();
    expect(getByText("Internet bill")).toBeTruthy();
    expect(getByText("Paid by Person 2")).toBeTruthy();
    expect(getByText("EUR 29.99")).toBeTruthy();
  });

  it("shows an error and does not save an invalid amount", () => {
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

  it("edits a saved expense after it was created", () => {
    const { getAllByText, getByDisplayValue, getByTestId, getByText, queryByText } = render(
      <Index />
    );

    fireEvent.press(getByTestId("edit-expense-seed-1"));

    expect(getByText("Edit Expense")).toBeTruthy();
    expect(getByDisplayValue("Groceries")).toBeTruthy();

    fireEvent.changeText(getByTestId("expense-name-input"), "Corrected groceries");
    fireEvent.changeText(getByTestId("expense-amount-input"), "30");
    fireEvent.press(getByTestId("save-expense-button"));

    expect(queryByText("Groceries")).toBeNull();
    expect(getByText("Corrected groceries")).toBeTruthy();
    expect(getAllByText("EUR 30.00").length).toBeGreaterThan(0);
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

  it("creates and joins groups by invite code", () => {
    const { getByPlaceholderText, getByTestId, getByText } = render(<Index />);

    fireEvent.press(getByTestId("open-create-group-button"));
    fireEvent.changeText(getByPlaceholderText("e.g., Apartment 2B"), "Apartment 2B");
    fireEvent.press(getByTestId("save-group-button"));

    expect(getByText("Apartment 2B")).toBeTruthy();
    expect(getByTestId("group-status-message").props.children).toContain(
      "Created Apartment 2B."
    );

    fireEvent.press(getByTestId("open-join-group-button"));
    fireEvent.changeText(getByPlaceholderText("HOME123"), "HOME123");
    fireEvent.press(getByTestId("join-group-button"));

    expect(getByText("Household")).toBeTruthy();
    expect(getByText("Joined Household.")).toBeTruthy();
  });

  it("shows the group balance breakdown", () => {
    const { getAllByText, getByTestId, getByText, queryByText } = render(<Index />);

    expect(getByTestId("balance-breakdown")).toBeTruthy();
    expect(getByTestId("debt-breakdown-list")).toBeTruthy();
    expect(getByText("+ EUR 12.25.")).toBeTruthy();
    expect(getByText("Your debt breakdown")).toBeTruthy();
    expect(getAllByText("+ EUR 12.25").length).toBeGreaterThan(0);
    expect(getByText("Person 2 pays Person 1 EUR 12.25")).toBeTruthy();
    expect(queryByText("Person 3")).toBeNull();
  });

  it("hides the balance breakdown until the active group has participants", () => {
    const { getByPlaceholderText, getByTestId, queryByTestId } = render(<Index />);

    fireEvent.press(getByTestId("open-create-group-button"));
    fireEvent.changeText(getByPlaceholderText("e.g., Apartment 2B"), "Apartment 2B");
    fireEvent.press(getByTestId("save-group-button"));

    expect(queryByTestId("balance-breakdown")).toBeNull();
  });
});

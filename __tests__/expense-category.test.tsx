import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import Index from "../app/index";
import { useAuth } from "../auth-context";

jest.mock("../auth-context", () => ({
  useAuth: jest.fn(),
}));

const mockUser = { uid: "user1", email: "user@example.com", displayName: "Clara" };

describe("Expense categorization", () => {
  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      loading: false,
      signOutUser: jest.fn(),
      firestoreWritable: true,
    });
  });

  it("successfully assigns a category to a new expense", async () => {
    render(<Index />);

    fireEvent.press(screen.getByText("Add expense"));

    fireEvent.changeText(screen.getByPlaceholderText("e.g., Coffee"), "Grocery Shopping");
    fireEvent.changeText(screen.getByPlaceholderText("0.00"), "50");
    
    fireEvent.press(screen.getByTestId("category-option-Food"));
    fireEvent.press(screen.getByTestId("save-expense-button"));

    await waitFor(() => {
      expect(screen.getByText("Grocery Shopping")).toBeTruthy();
      // Match the icon + text pattern
      expect(screen.getByText(/🍴\s+FOOD/)).toBeTruthy();
    });
  });

  it("edits an existing expense category", async () => {
    render(<Index />);

    fireEvent.press(screen.getByText("Add expense"));
    fireEvent.changeText(screen.getByPlaceholderText("e.g., Coffee"), "Bus Ticket");
    fireEvent.changeText(screen.getByPlaceholderText("0.00"), "2");
    fireEvent.press(screen.getByTestId("category-option-General"));
    fireEvent.press(screen.getByTestId("save-expense-button"));

    await waitFor(() => expect(screen.getByText("Bus Ticket")).toBeTruthy());

    fireEvent.press(screen.getAllByText("Edit")[0]);

    fireEvent.press(screen.getByTestId("category-option-Transport"));
    fireEvent.press(screen.getByTestId("save-expense-button"));

    await waitFor(() => {
      expect(screen.getByText(/🚗\s+TRANSPORT/)).toBeTruthy();
    });
  });

  it("defaults to General category when none is explicitly selected", async () => {
    render(<Index />);

    fireEvent.press(screen.getByText("Add expense"));
    fireEvent.changeText(screen.getByPlaceholderText("e.g., Coffee"), "New Thing");
    fireEvent.changeText(screen.getByPlaceholderText("0.00"), "10");
    
    fireEvent.press(screen.getByTestId("save-expense-button"));

    await waitFor(() => {
      expect(screen.getByText("New Thing")).toBeTruthy();
      expect(screen.getByText(/📦\s+GENERAL/)).toBeTruthy();
    });
  });
});

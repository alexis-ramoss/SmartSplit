import { fireEvent, render, waitFor } from "@testing-library/react-native";
import Index from "../app/index";

describe("Recurring Expenses Acceptance Tests", () => {
  it("creates a monthly recurring expense and shows repeats metadata", async () => {
    const { getByText, getByPlaceholderText, getByTestId, getAllByText } = render(<Index />);

    // Open form
    fireEvent.press(getByText("Add expense"));

    // Fill basic details
    fireEvent.changeText(getByTestId("expense-name-input"), "Monthly Rent");
    fireEvent.changeText(getByTestId("expense-amount-input"), "1000");
    
    // Select Date via Calendar
    fireEvent.press(getByTestId("expense-date-input"));
    fireEvent.press(getByTestId("calendar-day-1")); // Select 1st of current month

    // Enable recurrence
    fireEvent.press(getByTestId("recurrence-toggle"));

    // Select Monthly (it should be default)
    fireEvent.press(getByTestId("frequency-option-Monthly"));
    fireEvent.changeText(getByTestId("recurrence-every-input"), "1");

    // Select Start Date via Calendar
    fireEvent.press(getByTestId("recurrence-start-date-input"));
    fireEvent.press(getByTestId("calendar-day-1"));

    // Save
    fireEvent.press(getByTestId("save-expense-button"));

    // Verify it appears in the list with recurrence metadata
    await waitFor(() => {
      expect(getAllByText("Monthly Rent").length).toBeGreaterThan(0);
      expect(getByText("Repeats monthly")).toBeTruthy();
    });
  });

  it("stops a recurring expense when edited and recurrence is disabled", async () => {
     const { getByText, getByTestId, queryByText, getAllByText } = render(<Index />);

     fireEvent.press(getByText("Add expense"));
     fireEvent.changeText(getByTestId("expense-name-input"), "Netflix");
     fireEvent.changeText(getByTestId("expense-amount-input"), "15");
     fireEvent.press(getByTestId("recurrence-toggle"));

     fireEvent.press(getByTestId("recurrence-start-date-input"));
     fireEvent.press(getByTestId("calendar-day-1"));

     fireEvent.press(getByTestId("save-expense-button"));

     await waitFor(() => {
        expect(getByText("Netflix")).toBeTruthy();
        expect(getByText("Repeats monthly")).toBeTruthy();
     });

     const editButtons = getAllByText("Edit");
     fireEvent.press(editButtons[0]);
     
     expect(getByText("Edit Expense")).toBeTruthy();
     
     fireEvent.press(getByTestId("recurrence-toggle"));

     fireEvent.press(getByTestId("save-expense-button"));

     await waitFor(() => {
        expect(queryByText("Repeats monthly")).toBeNull();
     });
  });

  it("shows warning for monthly recurrence on 31st", async () => {
    const { getByText, getByTestId } = render(<Index />);

    fireEvent.press(getByText("Add expense"));

    fireEvent.press(getByTestId("recurrence-toggle"));

    fireEvent.press(getByTestId("frequency-option-Monthly"));

    fireEvent.press(getByTestId("recurrence-start-date-input"));

    fireEvent.press(getByTestId("calendar-day-31"));

    expect(
      getByText(
        "Shorter months will use the last available day."
      )
    ).toBeTruthy();
  });
});

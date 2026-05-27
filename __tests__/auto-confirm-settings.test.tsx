import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import App from "../app/index";

// The mocks for useAuth and group-utils are already in jest.setup.js
// We can access the mocked functions via require if needed, but let's try 
// to verify via UI first.

describe("Automatic Confirmation Settings", () => {
  it("hides Settings button for non-owners", () => {
    // By default jest.setup.js mocks the user as 'test-user' who is NOT the owner of the default group 'group-1' (owner-1)
    render(<App />);
    expect(screen.queryByTestId("open-group-settings-button")).toBeNull();
  });

  it("shows Settings button for the owner", () => {
    const mockGroups = (globalThis as any).__SMARTSPLIT_TEST_GROUPS__();
    mockGroups[0].ownerId = "test-user"; // Make the test-user the owner
    
    render(<App />);
    expect(screen.getByTestId("open-group-settings-button")).toBeTruthy();
  });

  it("toggles automatic confirmation setting", async () => {
    const mockGroups = (globalThis as any).__SMARTSPLIT_TEST_GROUPS__();
    mockGroups[0].ownerId = "test-user";
    
    render(<App />);
    
    fireEvent.press(screen.getByTestId("open-group-settings-button"));
    expect(screen.getByText("Automatic Confirmation")).toBeTruthy();

    const toggle = screen.getByTestId("toggle-auto-confirm");
    fireEvent.press(toggle);

    await waitFor(() => {
      expect(screen.getByText("Settings updated successfully.")).toBeTruthy();
    });
    
    expect(mockGroups[0].autoConfirmExpenses).toBe(true);
  });

  it("automatically confirms new expenses when setting is enabled", async () => {
    const mockGroups = (globalThis as any).__SMARTSPLIT_TEST_GROUPS__();
    mockGroups[0].ownerId = "test-user";
    mockGroups[0].autoConfirmExpenses = true;

    render(<App />);

    // Open Add Expense form
    fireEvent.press(screen.getByTestId("open-add-expense-button"));

    // Fill the form
    fireEvent.changeText(screen.getByPlaceholderText("e.g., Coffee"), "Dinner");
    fireEvent.changeText(screen.getByPlaceholderText("0.00"), "20");
    
    // Save expense
    fireEvent.press(screen.getByTestId("save-expense-button"));

    await waitFor(() => {
      expect(screen.getByText("Dinner")).toBeTruthy();
    });

    // Verify the expense in the mock groups
    const dinnerExpense = mockGroups[0].expenses.find((e: any) => e.name === "Dinner");
    expect(dinnerExpense).toBeTruthy();
    expect(dinnerExpense.confirmed).toBe(true);
  });
});

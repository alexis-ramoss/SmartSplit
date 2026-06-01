import { fireEvent, render, waitFor } from "@testing-library/react-native";
import Index from "../app/index";

describe("Delete expense", () => {
  it("removes an expense from the group and recalculates totals", async () => {
    const { getAllByText, getByTestId, getByText, queryByTestId, queryByText } = render(<Index />);

    expect(getByText("Groceries")).toBeTruthy();
    expect(getByText("Group total")).toBeTruthy();
    expect(getAllByText("EUR 24.50").length).toBeGreaterThan(0);
    expect(queryByTestId("delete-expense-button")).toBeNull();

    fireEvent.press(getByTestId("edit-expense-expense-1"));
    fireEvent.press(getByTestId("delete-expense-button"));
    expect(getByText("Delete Groceries?")).toBeTruthy();

    fireEvent.press(getByTestId("confirm-delete-expense"));

    await waitFor(() => {
      expect(queryByText("Groceries")).toBeNull();
      expect(getByText("EUR 0.00")).toBeTruthy();
    });
  });
});

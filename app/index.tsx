import { useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  createExpenseEntry,
  ExpenseEntry,
  ParticipantInput,
} from "./expense-utils";

const GROUP_MEMBERS = ["Person 1", "Person 2", "Person 3"];

const defaultParticipants: ParticipantInput[] = [
  { name: "Person 1", selected: true, percentage: "50" },
  { name: "Person 2", selected: true, percentage: "50" },
  { name: "Person 3", selected: false, percentage: "0" },
];

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

const initialExpenses: ExpenseEntry[] = [
  {
    id: "seed-1",
    name: "Groceries",
    amount: 24.5,
    date: formatDate(new Date()),
    payer: "Person 1",
    participants: [
      { name: "Person 1", percentage: 50 },
      { name: "Person 2", percentage: 50 },
    ],
    createdAt: new Date().toISOString(),
  },
];

export default function Index() {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(formatDate(new Date()));
  const [payer, setPayer] = useState("Person 1");
  const [participants, setParticipants] = useState(defaultParticipants);
  const [error, setError] = useState<string | null>(null);

  const totalSpent = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.amount, 0),
    [expenses]
  );

  const selectedPercentageTotal = useMemo(
    () =>
      participants
        .filter((participant) => participant.selected)
        .reduce((sum, participant) => sum + (Number(participant.percentage) || 0), 0),
    [participants]
  );

  function resetForm() {
    setName("");
    setAmount("");
    setDate(formatDate(new Date()));
    setPayer("Person 1");
    setParticipants(defaultParticipants);
    setError(null);
  }

  function updateParticipantSelection(member: string) {
    setParticipants((current) =>
      current.map((participant) =>
        participant.name === member
          ? {
              ...participant,
              selected: !participant.selected,
              percentage: participant.selected ? "0" : participant.percentage === "0" ? "25" : participant.percentage,
            }
          : participant
      )
    );

    if (payer === member) {
      const fallback = GROUP_MEMBERS.find((person) => person !== member) || "Person 1";
      setPayer(fallback);
    }

    if (error) {
      setError(null);
    }
  }

  function updateParticipantWeight(member: string, value: string) {
    const sanitized = value.replace(/[^0-9.]/g, "");
    setParticipants((current) =>
      current.map((participant) =>
        participant.name === member
          ? { ...participant, percentage: sanitized }
          : participant
      )
    );
    if (error) {
      setError(null);
    }
  }

  function handleSaveExpense() {
    const result = createExpenseEntry({
      name,
      amount,
      date,
      payer,
      participants,
    });

    if (result.error || !result.expense) {
      setError(result.error);
      return;
    }

    setExpenses((current) => [result.expense as ExpenseEntry, ...current]);
    setShowForm(false);
    resetForm();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerCard}>
          <Text style={styles.kicker}>SmartSplit</Text>
          <Text style={styles.title}>Shared expenses, in one place</Text>
          <Text style={styles.subtitle}>
            Add a new expense with participants and split percentages in one flow.
          </Text>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Group total</Text>
              <Text style={styles.summaryValue}>EUR {totalSpent.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Recorded</Text>
              <Text style={styles.summaryValue}>{expenses.length}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Group expenses</Text>
              <Text style={styles.sectionSubtitle}>Latest entries from the house.</Text>
            </View>
            <Pressable
              accessibilityLabel="Add expense"
              testID="open-add-expense-button"
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => setShowForm((value) => !value)}
            >
              <Text style={styles.primaryButtonText}>
                {showForm ? "Close form" : "Add expense"}
              </Text>
            </Pressable>
          </View>

          {showForm ? (
            <View style={styles.form}>
              <Text style={styles.formTitle}>Add New Expense</Text>

              <Text style={styles.formLabel}>Expense Name</Text>
              <TextInput
                accessibilityLabel="Expense name"
                placeholder="e.g., Coffee"
                placeholderTextColor="#8B95A7"
                style={styles.input}
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  if (error) {
                    setError(null);
                  }
                }}
                testID="expense-name-input"
              />

              <Text style={styles.formLabel}>Amount (EUR)</Text>
              <TextInput
                accessibilityLabel="Total amount"
                placeholder="0.00"
                placeholderTextColor="#8B95A7"
                keyboardType="numeric"
                style={styles.input}
                value={amount}
                onChangeText={(value) => {
                  setAmount(value);
                  if (error) {
                    setError(null);
                  }
                }}
                testID="expense-amount-input"
              />

              <Text style={styles.formLabel}>Date</Text>
              <TextInput
                accessibilityLabel="Expense date"
                placeholder="08/03/2026"
                placeholderTextColor="#8B95A7"
                style={styles.input}
                value={date}
                onChangeText={(value) => {
                  setDate(value);
                  if (error) {
                    setError(null);
                  }
                }}
                testID="expense-date-input"
              />

              <Text style={styles.formLabel}>Paid By</Text>
              <View style={styles.payerRow}>
                {GROUP_MEMBERS.map((member) => (
                  <Pressable
                    key={member}
                    testID={`payer-option-${member}`}
                    style={({ pressed }) => [
                      styles.payerChip,
                      payer === member && styles.payerChipSelected,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => {
                      setPayer(member);
                      if (error) {
                        setError(null);
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.payerChipText,
                        payer === member && styles.payerChipTextSelected,
                      ]}
                    >
                      {member}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.formLabel}>Participants</Text>
              <View style={styles.participantsCard}>
                {participants.map((participant) => (
                  <View key={participant.name} style={styles.participantRow}>
                    <Pressable
                      testID={`participant-toggle-${participant.name}`}
                      style={styles.checkboxRow}
                      onPress={() => updateParticipantSelection(participant.name)}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          participant.selected && styles.checkboxSelected,
                        ]}
                      >
                        {participant.selected ? (
                          <Text style={styles.checkboxTick}>X</Text>
                        ) : null}
                      </View>
                      <Text style={styles.participantName}>{participant.name}</Text>
                    </Pressable>

                    {participant.selected ? (
                      <View style={styles.weightContainer}>
                        <TextInput
                          accessibilityLabel={`${participant.name} percentage`}
                          keyboardType="numeric"
                          style={styles.weightInput}
                          value={participant.percentage}
                          onChangeText={(value) =>
                            updateParticipantWeight(participant.name, value)
                          }
                          testID={`participant-weight-${participant.name}`}
                        />
                        <Text style={styles.percentLabel}>%</Text>
                      </View>
                    ) : (
                      <Text style={styles.notSelectedText}>Not selected</Text>
                    )}
                  </View>
                ))}

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Selected total</Text>
                  <Text style={styles.totalValue} testID="participants-total">
                    {selectedPercentageTotal.toFixed(0)}%
                  </Text>
                </View>
              </View>

              {error ? (
                <Text style={styles.errorText} testID="expense-error-message">
                  {error}
                </Text>
              ) : null}

              <View style={styles.actionsRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.cancelButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>

                <Pressable
                  accessibilityLabel="Save expense"
                  testID="save-expense-button"
                  style={({ pressed }) => [
                    styles.saveButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleSaveExpense}
                >
                  <Text style={styles.saveButtonText}>Add</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.list} testID="expense-list">
            {expenses.map((expense) => (
              <View key={expense.id} style={styles.expenseItem}>
                <View style={styles.expenseTextArea}>
                  <Text style={styles.expenseName}>{expense.name}</Text>
                  <Text style={styles.expenseMeta}>Date: {expense.date}</Text>
                  <Text style={styles.expenseMeta}>Paid by {expense.payer}</Text>
                  <Text style={styles.expenseMeta}>
                    Split: {expense.participants.map((p) => `${p.name} ${p.percentage}%`).join(", ")}
                  </Text>
                </View>
                <Text style={styles.expenseAmount}>EUR {expense.amount.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },
  container: {
    padding: 20,
    gap: 16,
  },
  headerCard: {
    backgroundColor: "#12324C",
    borderRadius: 24,
    padding: 24,
  },
  kicker: {
    color: "#B7C9D8",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "800",
    marginTop: 10,
    lineHeight: 33,
  },
  subtitle: {
    color: "#D8E5EF",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 14,
  },
  summaryLabel: {
    color: "#B7C9D8",
    fontSize: 13,
  },
  summaryValue: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 8,
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    color: "#152B3C",
    fontSize: 22,
    fontWeight: "800",
  },
  sectionSubtitle: {
    color: "#5F6C7B",
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: "#2B6CB0",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  buttonPressed: {
    opacity: 0.88,
  },
  form: {
    marginTop: 18,
    backgroundColor: "#F7F8FA",
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  formTitle: {
    color: "#152B3C",
    fontSize: 32,
    fontWeight: "800",
    marginBottom: 2,
  },
  formLabel: {
    color: "#34495E",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D7E0EA",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#152B3C",
    backgroundColor: "#FFFFFF",
  },
  payerRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  payerChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#C8D4E1",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
  },
  payerChipSelected: {
    backgroundColor: "#0A0D2D",
    borderColor: "#0A0D2D",
  },
  payerChipText: {
    color: "#25384D",
    fontWeight: "700",
  },
  payerChipTextSelected: {
    color: "#FFFFFF",
  },
  participantsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E1E8EF",
    padding: 12,
    gap: 8,
  },
  participantRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#9AA7B7",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  checkboxSelected: {
    backgroundColor: "#596477",
    borderColor: "#596477",
  },
  checkboxTick: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  participantName: {
    color: "#152B3C",
    fontSize: 16,
    fontWeight: "600",
  },
  weightContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  weightInput: {
    width: 66,
    borderWidth: 1,
    borderColor: "#D7E0EA",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    textAlign: "center",
    backgroundColor: "#FFFFFF",
  },
  percentLabel: {
    color: "#5F6C7B",
    fontWeight: "700",
  },
  notSelectedText: {
    color: "#9AA7B7",
    fontSize: 13,
  },
  totalRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E9EEF5",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalLabel: {
    color: "#34495E",
    fontWeight: "700",
  },
  totalValue: {
    color: "#152B3C",
    fontWeight: "800",
  },
  errorText: {
    color: "#B42318",
    fontSize: 14,
    fontWeight: "600",
    backgroundColor: "#FFF1F0",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#DDE2E8",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#1E2A39",
    fontSize: 18,
    fontWeight: "700",
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#020427",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  list: {
    marginTop: 20,
    gap: 12,
  },
  expenseItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#F7FAFD",
    gap: 10,
  },
  expenseTextArea: {
    flex: 1,
  },
  expenseName: {
    color: "#152B3C",
    fontSize: 16,
    fontWeight: "700",
  },
  expenseMeta: {
    color: "#5F6C7B",
    marginTop: 3,
    fontSize: 13,
  },
  expenseAmount: {
    color: "#12324C",
    fontSize: 17,
    fontWeight: "800",
  },
});

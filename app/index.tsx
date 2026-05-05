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
  calculateDebtBreakdownForMember,
  calculateMemberBalances,
  calculateSettlementSuggestions,
  createExpenseEntry,
  ExpenseEntry,
  ParticipantInput,
} from "./expense-utils";
import { Redirect } from "expo-router";
import { useAuth } from "../auth-context";

const GROUP_MEMBERS = ["Person 1", "Person 2", "Person 3"];
const CURRENT_USER = "Person 1";

type Group = {
  id: string;
  name: string;
  inviteCode: string;
  members: string[];
};

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

function formatSignedCurrency(amount: number): string {
  const sign = amount > 0 ? "+" : "-";
  return `${sign} EUR ${Math.abs(amount).toFixed(2)}`;
}

const initialExpenses: ExpenseEntry[] = [
  {
    id: "seed-1",
    groupId: "home",
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

const initialGroups: Group[] = [
  {
    id: "home",
    name: "Household",
    inviteCode: "HOME123",
    members: GROUP_MEMBERS,
  },
];

export default function Index() {
  const { user, loading, signOutUser } = useAuth();
  const [groups, setGroups] = useState(initialGroups);
  const [activeGroupId, setActiveGroupId] = useState(initialGroups[0].id);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [showForm, setShowForm] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [groupMessage, setGroupMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(formatDate(new Date()));
  const [payer, setPayer] = useState("Person 1");
  const [participants, setParticipants] = useState(defaultParticipants);
  const [error, setError] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const activeGroup = groups.find((group) => group.id === activeGroupId) || groups[0];
  const activeExpenses = useMemo(
    () => expenses.filter((expense) => expense.groupId === activeGroup.id),
    [activeGroup.id, expenses]
  );
  const memberBalances = useMemo(
    () => calculateMemberBalances(activeExpenses, activeGroup.members),
    [activeExpenses, activeGroup.members]
  );
  const participatingMemberNames = useMemo(() => {
    const names = new Set<string>();

    activeExpenses.forEach((expense) => {
      names.add(expense.payer);
      expense.participants.forEach((participant) => names.add(participant.name));
    });

    return names;
  }, [activeExpenses]);
  const visibleMemberBalances = useMemo(
    () => memberBalances.filter((balance) => participatingMemberNames.has(balance.name)),
    [memberBalances, participatingMemberNames]
  );
  const settlementSuggestions = useMemo(
    () => calculateSettlementSuggestions(visibleMemberBalances),
    [visibleMemberBalances]
  );
  const currentUserDebtBreakdown = useMemo(
    () => calculateDebtBreakdownForMember(activeExpenses, CURRENT_USER),
    [activeExpenses]
  );
  const currentUserBalance =
    visibleMemberBalances.find((balance) => balance.name === CURRENT_USER)?.balance || 0;
  const shouldShowBalanceBreakdown = visibleMemberBalances.length > 0;

  const totalSpent = useMemo(
    () => activeExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [activeExpenses]
  );

  if (loading) {
    return <SafeAreaView style={styles.safeArea} />;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

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
    setEditingExpenseId(null);
  }

  function getParticipantInputsFromExpense(expense: ExpenseEntry): ParticipantInput[] {
    return GROUP_MEMBERS.map((member) => {
      const existingParticipant = expense.participants.find(
        (participant) => participant.name === member
      );

      return {
        name: member,
        selected: Boolean(existingParticipant),
        percentage: existingParticipant ? String(existingParticipant.percentage) : "0",
      };
    });
  }

  function handleOpenAddExpense() {
    if (showForm) {
      setShowForm(false);
      resetForm();
      return;
    }

    resetForm();
    setShowForm(true);
  }

  function handleEditExpense(expense: ExpenseEntry) {
    setName(expense.name);
    setAmount(String(expense.amount));
    setDate(expense.date);
    setPayer(expense.payer);
    setParticipants(getParticipantInputsFromExpense(expense));
    setEditingExpenseId(expense.id);
    setError(null);
    setShowForm(true);
  }

  function generateInviteCode(groupNameValue: string) {
    const prefix = groupNameValue.replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase() || "GRP";
    return `${prefix}${groups.length + 1}${Date.now().toString().slice(-2)}`;
  }

  function handleCreateGroup() {
    const trimmedName = groupName.trim();

    if (!trimmedName) {
      setGroupMessage("Enter a group name to create a group.");
      return;
    }

    const group: Group = {
      id: `${Date.now()}`,
      name: trimmedName,
      inviteCode: generateInviteCode(trimmedName),
      members: GROUP_MEMBERS,
    };

    setGroups((current) => [group, ...current]);
    setActiveGroupId(group.id);
    setGroupName("");
    setShowCreateGroup(false);
    setGroupMessage(`Created ${group.name}. Share code ${group.inviteCode}.`);
  }

  function handleJoinGroup() {
    const normalizedCode = joinCode.trim().toUpperCase();

    if (!normalizedCode) {
      setGroupMessage("Enter an invite code to join a group.");
      return;
    }

    const matchingGroup = groups.find((group) => group.inviteCode === normalizedCode);

    if (!matchingGroup) {
      setGroupMessage("No group was found for that invite code.");
      return;
    }

    setActiveGroupId(matchingGroup.id);
    setJoinCode("");
    setShowJoinGroup(false);
    setGroupMessage(`Joined ${matchingGroup.name}.`);
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

    if (editingExpenseId) {
      setExpenses((current) =>
        current.map((expense) =>
          expense.id === editingExpenseId
            ? {
                ...(result.expense as ExpenseEntry),
                id: expense.id,
                groupId: expense.groupId,
                createdAt: expense.createdAt,
              }
            : expense
        )
      );
    } else {
      setExpenses((current) => [
        { ...(result.expense as ExpenseEntry), groupId: activeGroup.id },
        ...current,
      ]);
    }

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
            Create or join a household group, record shared expenses, and see balances.
          </Text>

          <Pressable
            accessibilityLabel="Sign out"
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={async () => {
              try {
                await signOutUser();
              } catch {
                setGroupMessage("Could not sign out. Please try again.");
              }
            }}
          >
            <Text style={styles.signOutButtonText}>Sign out</Text>
          </Pressable>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Group total</Text>
              <Text style={styles.summaryValue}>EUR {totalSpent.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Recorded</Text>
              <Text style={styles.summaryValue}>{activeExpenses.length}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>{activeGroup.name}</Text>
              <Text style={styles.sectionSubtitle}>
                Invite code: {activeGroup.inviteCode}
              </Text>
            </View>
          </View>

          <View style={styles.groupActionsRow}>
            <Pressable
              accessibilityLabel="Create group"
              testID="open-create-group-button"
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => {
                setShowCreateGroup((value) => !value);
                setShowJoinGroup(false);
                setGroupMessage(null);
              }}
            >
              <Text style={styles.secondaryButtonText}>Create group</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Join group"
              testID="open-join-group-button"
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => {
                setShowJoinGroup((value) => !value);
                setShowCreateGroup(false);
                setGroupMessage(null);
              }}
            >
              <Text style={styles.secondaryButtonText}>Join group</Text>
            </Pressable>
          </View>

          {showCreateGroup ? (
            <View style={styles.inlineForm}>
              <Text style={styles.formLabel}>Group name</Text>
              <TextInput
                accessibilityLabel="Group name"
                placeholder="e.g., Apartment 2B"
                placeholderTextColor="#8B95A7"
                style={styles.input}
                value={groupName}
                onChangeText={(value) => {
                  setGroupName(value);
                  setGroupMessage(null);
                }}
                testID="group-name-input"
              />
              <Pressable
                accessibilityLabel="Save group"
                testID="save-group-button"
                style={({ pressed }) => [
                  styles.saveButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleCreateGroup}
              >
                <Text style={styles.saveButtonText}>Create</Text>
              </Pressable>
            </View>
          ) : null}

          {showJoinGroup ? (
            <View style={styles.inlineForm}>
              <Text style={styles.formLabel}>Invite code</Text>
              <TextInput
                accessibilityLabel="Invite code"
                autoCapitalize="characters"
                placeholder="HOME123"
                placeholderTextColor="#8B95A7"
                style={styles.input}
                value={joinCode}
                onChangeText={(value) => {
                  setJoinCode(value.toUpperCase());
                  setGroupMessage(null);
                }}
                testID="join-code-input"
              />
              <Pressable
                accessibilityLabel="Join saved group"
                testID="join-group-button"
                style={({ pressed }) => [
                  styles.saveButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleJoinGroup}
              >
                <Text style={styles.saveButtonText}>Join</Text>
              </Pressable>
            </View>
          ) : null}

          {groupMessage ? (
            <Text style={styles.infoText} testID="group-status-message">
              {groupMessage}
            </Text>
          ) : null}
        </View>

        {shouldShowBalanceBreakdown ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Balance breakdown</Text>
                <Text style={styles.sectionSubtitle}>
                  {currentUserBalance > 0.01
                    ? `${formatSignedCurrency(currentUserBalance)}.`
                    : currentUserBalance < -0.01
                      ? `${formatSignedCurrency(currentUserBalance)}.`
                      : "You are settled up."}
                </Text>
              </View>
            </View>

            <View style={styles.balanceList} testID="balance-breakdown">
              {currentUserDebtBreakdown.length > 0 ? (
                <View style={styles.debtBreakdownBox} testID="debt-breakdown-list">
                  <Text style={styles.debtBreakdownTitle}>Your debt breakdown</Text>
                  {currentUserDebtBreakdown.map((item) => (
                    <View key={item.id} style={styles.debtBreakdownRow}>
                      <View style={styles.debtBreakdownTextArea}>
                        <Text style={styles.debtBreakdownName}>
                          For {item.expenseName}
                        </Text>
                        <Text style={styles.debtBreakdownMeta}>
                          {item.direction === "plus"
                            ? "Paid by you"
                            : `Covered by ${item.payer}`}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.debtBreakdownAmount,
                          item.direction === "plus"
                            ? styles.positiveBalance
                            : styles.negativeBalance,
                        ]}
                      >
                        {`${item.direction === "plus" ? "+" : "-"} EUR ${item.amount.toFixed(2)}`}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {visibleMemberBalances.map((balance) => (
                <View key={balance.name} style={styles.balanceRow}>
                  <Text style={styles.balanceName}>
                    {balance.name === CURRENT_USER ? "You" : balance.name}
                  </Text>
                  <Text
                    style={[
                      styles.balanceAmount,
                      balance.balance > 0.01 && styles.positiveBalance,
                      balance.balance < -0.01 && styles.negativeBalance,
                    ]}
                  >
                    {balance.balance > 0.01
                      ? formatSignedCurrency(balance.balance)
                      : balance.balance < -0.01
                        ? formatSignedCurrency(balance.balance)
                        : "Settled"}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.settlementBox}>
              <Text style={styles.settlementTitle}>Suggested payments</Text>
              {settlementSuggestions.length > 0 ? (
                settlementSuggestions.map((settlement) => (
                  <Text key={`${settlement.from}-${settlement.to}`} style={styles.settlementText}>
                    {settlement.from} pays {settlement.to} EUR {settlement.amount.toFixed(2)}
                  </Text>
                ))
              ) : (
                <Text style={styles.settlementText}>No payments needed.</Text>
              )}
            </View>
          </View>
        ) : null}

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
              onPress={handleOpenAddExpense}
            >
              <Text style={styles.primaryButtonText}>
                {showForm ? "Close form" : "Add expense"}
              </Text>
            </Pressable>
          </View>

          {showForm ? (
            <View style={styles.form}>
              <Text style={styles.formTitle}>
                {editingExpenseId ? "Edit Expense" : "Add New Expense"}
              </Text>

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
                  <Text style={styles.saveButtonText}>
                    {editingExpenseId ? "Save" : "Add"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.list} testID="expense-list">
            {activeExpenses.map((expense) => (
              <View key={expense.id} style={styles.expenseItem}>
                <View style={styles.expenseTextArea}>
                  <Text style={styles.expenseName}>{expense.name}</Text>
                  <Text style={styles.expenseMeta}>Date: {expense.date}</Text>
                  <Text style={styles.expenseMeta}>Paid by {expense.payer}</Text>
                  <Text style={styles.expenseMeta}>
                    Split: {expense.participants.map((p) => `${p.name} ${p.percentage}%`).join(", ")}
                  </Text>
                </View>
                <View style={styles.expenseActions}>
                  <Text style={styles.expenseAmount}>EUR {expense.amount.toFixed(2)}</Text>
                  <Pressable
                    accessibilityLabel={`Edit ${expense.name}`}
                    testID={`edit-expense-${expense.id}`}
                    style={({ pressed }) => [
                      styles.editButton,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => handleEditExpense(expense)}
                  >
                    <Text style={styles.editButtonText}>Edit</Text>
                  </Pressable>
                </View>
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
  signOutButton: {
    alignSelf: "flex-start",
    marginTop: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  signOutButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
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
  secondaryButton: {
    flex: 1,
    backgroundColor: "#E9F1F8",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#12324C",
    fontSize: 14,
    fontWeight: "800",
  },
  buttonPressed: {
    opacity: 0.88,
  },
  groupActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  inlineForm: {
    marginTop: 14,
    gap: 8,
  },
  infoText: {
    color: "#12324C",
    fontSize: 14,
    fontWeight: "700",
    backgroundColor: "#E9F1F8",
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  balanceList: {
    marginTop: 16,
    gap: 8,
  },
  debtBreakdownBox: {
    backgroundColor: "#F7F8FA",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  debtBreakdownTitle: {
    color: "#34495E",
    fontSize: 14,
    fontWeight: "800",
  },
  debtBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#E4EAF1",
    paddingTop: 8,
  },
  debtBreakdownTextArea: {
    flex: 1,
  },
  debtBreakdownName: {
    color: "#152B3C",
    fontSize: 15,
    fontWeight: "800",
  },
  debtBreakdownMeta: {
    color: "#5F6C7B",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  debtBreakdownAmount: {
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F7FAFD",
    borderRadius: 12,
    padding: 12,
  },
  balanceName: {
    color: "#152B3C",
    fontSize: 16,
    fontWeight: "700",
  },
  balanceAmount: {
    color: "#5F6C7B",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
  },
  positiveBalance: {
    color: "#087443",
  },
  negativeBalance: {
    color: "#B42318",
  },
  settlementBox: {
    marginTop: 12,
    backgroundColor: "#F7F8FA",
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  settlementTitle: {
    color: "#34495E",
    fontSize: 14,
    fontWeight: "800",
  },
  settlementText: {
    color: "#5F6C7B",
    fontSize: 13,
    fontWeight: "600",
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
    textAlign: "right",
  },
  expenseActions: {
    alignItems: "flex-end",
    gap: 8,
  },
  editButton: {
    backgroundColor: "#E9F1F8",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editButtonText: {
    color: "#12324C",
    fontSize: 13,
    fontWeight: "800",
  },
});

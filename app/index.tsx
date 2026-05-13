import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../auth-context";
import {
  createGroup,
  deleteGroup,
  joinGroupByInviteCode,
  leaveGroupFromGroup,
  loadAccessibleGroups,
  canRemoveMember,
  removeMemberFromGroup,
  saveExpenseToGroup,
  type LoadedGroup,
} from "../lib/_group-utils";
import {
  calculateDebtBreakdownForMember,
  calculateMemberBalances,
  calculateSettlementSuggestions,
  createExpenseEntry,
  ExpenseEntry,
  ParticipantInput,
} from "../lib/_expense-utils";

type Group = {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  members: LoadedGroup["members"];
  expenses: LoadedGroup["expenses"];
};

const EMPTY_GROUP: Group = {
  id: "",
  name: "No active group",
  inviteCode: "",
  ownerId: "",
  ownerName: "",
  createdAt: "",
  updatedAt: "",
  archivedAt: null,
  members: [],
  expenses: [],
};

function getTestSeedGroups(): Group[] {
  const getter = (globalThis as { __SMARTSPLIT_TEST_GROUPS__?: () => Group[] }).__SMARTSPLIT_TEST_GROUPS__;

  if (typeof getter !== "function") {
    return [];
  }

  const groups = getter();
  return Array.isArray(groups) ? groups.map((group) => ({ ...group })) : [];
}

function buildDefaultParticipants(memberNames: string[]): ParticipantInput[] {
  if (memberNames.length === 0) {
    return [];
  }

  const basePercentage = Math.floor(100 / memberNames.length);
  let remainder = 100 - basePercentage * memberNames.length;

  return memberNames.map((name) => {
    const extra = remainder > 0 ? 1 : 0;

    if (remainder > 0) {
      remainder -= 1;
    }

    return {
      name,
      selected: true,
      percentage: String(basePercentage + extra),
    };
  });
}

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

export default function Index() {
  const { user, loading, signOutUser, firestoreWritable } = useAuth();
  const currentUserName = user?.displayName || user?.email?.split("@")[0] || "You";
  const seededGroups = getTestSeedGroups();
  const [groups, setGroups] = useState<Group[]>(() => seededGroups);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(() => seededGroups[0]?.id || null);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>(() => seededGroups[0]?.expenses || []);
  const [showForm, setShowForm] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [groupMessage, setGroupMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(formatDate(new Date()));
  const [payer, setPayer] = useState(() => seededGroups[0]?.members[0]?.name || currentUserName);
  const [participants, setParticipants] = useState<ParticipantInput[]>(() =>
    buildDefaultParticipants(seededGroups[0]?.members.map((member) => member.name) || [])
  );
  const [error, setError] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [groupActionToConfirm, setGroupActionToConfirm] = useState<"leave" | "delete" | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refreshGroups(preferredGroupId?: string | null) {
      if (!user || !firestoreWritable) {
        return;
      }

      try {
        const remoteGroups = await loadAccessibleGroups(currentUser.uid);

        if (cancelled) {
          return;
        }

        setGroups(remoteGroups);

        const nextActiveGroup =
          remoteGroups.find((group) => group.id === preferredGroupId) ||
          remoteGroups.find((group) => group.id === activeGroupId) ||
          remoteGroups[0] ||
          null;

        setActiveGroupId(nextActiveGroup ? nextActiveGroup.id : null);
        setExpenses(nextActiveGroup?.expenses || []);
        setParticipants(buildDefaultParticipants(nextActiveGroup?.members.map((member) => member.name) || []));
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setGroupMessage(loadError instanceof Error ? loadError.message : "Could not load your groups.");
      }
    }

    void refreshGroups();

    return () => {
      cancelled = true;
    };
  }, [firestoreWritable, user]);

  const activeGroup = groups.find((group) => group.id === activeGroupId) || EMPTY_GROUP;
  const activeExpenses = useMemo(
    () => (activeGroup.id ? expenses.filter((expense) => expense.groupId === activeGroup.id) : []),
    [activeGroup, expenses]
  );
  const activeMemberNames = useMemo(
    () => activeGroup?.members.map((member) => member.name) || [],
    [activeGroup]
  );
  const memberBalances = useMemo(
    () => calculateMemberBalances(activeExpenses, activeMemberNames),
    [activeExpenses, activeMemberNames]
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
    () => calculateDebtBreakdownForMember(activeExpenses, currentUserName),
    [activeExpenses, currentUserName]
  );
  const currentUserBalance =
    visibleMemberBalances.find((balance) => balance.name === currentUserName)?.balance || 0;
  const shouldShowBalanceBreakdown = Boolean(activeGroup && visibleMemberBalances.length > 0);

  const totalSpent = useMemo(
    () => activeExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [activeExpenses]
  );

  const selectedPercentageTotal = useMemo(
    () =>
      participants
        .filter((participant) => participant.selected)
        .reduce((sum, participant) => sum + (Number(participant.percentage) || 0), 0),
    [participants]
  );

  useEffect(() => {
    if (!activeGroup) {
      return;
    }

    setExpenses(activeGroup.expenses);
    setParticipants(buildDefaultParticipants(activeGroup.members.map((member) => member.name)));
    setPayer(activeGroup.members[0]?.name || currentUserName);
  }, [activeGroup]);

  if (loading) {
    return <SafeAreaView style={styles.safeArea} />;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  const currentUser = user;

  function resetForm() {
    setName("");
    setAmount("");
    setDate(formatDate(new Date()));
    setPayer(currentUserName);
    setParticipants(buildDefaultParticipants(activeMemberNames));
    setError(null);
    setEditingExpenseId(null);
  }

  function getMemberBalance(memberName: string): number {
    const balance = memberBalances.find((b) => b.name === memberName);
    return balance?.balance || 0;
  }

  function canRemoveMemberLocal(memberName: string): { canRemove: boolean; reason?: string } {
    if (!activeGroup) {
      return { canRemove: false, reason: "No active group." };
    }

    return canRemoveMember(activeGroup, memberName);
  }

  async function handleRemoveMember(memberName: string) {
    if (!activeGroup || activeGroupId === null) {
      setRemoveError("No active group selected.");
      return;
    }

    const validation = canRemoveMemberLocal(memberName);

    if (!validation.canRemove) {
      setRemoveError(validation.reason || "Cannot remove this member");
      return;
    }

    try {
      await removeMemberFromGroup(activeGroupId, memberName);
      setGroups((current) =>
        current.map((group) =>
          group.id === activeGroupId
            ? { ...group, members: group.members.filter((member) => member.name !== memberName) }
            : group
        )
      );
      setActiveGroupId(activeGroupId);
      setExpenses((current) => current.filter((expense) => expense.groupId === activeGroupId));
      setMemberToRemove(null);
      setRemoveError(null);
      const refreshedGroups = await loadAccessibleGroups(currentUser.uid);
      setGroups(refreshedGroups);
      const refreshedActiveGroup = refreshedGroups.find((group) => group.id === activeGroupId) || null;
      setActiveGroupId(refreshedActiveGroup ? refreshedActiveGroup.id : refreshedGroups[0]?.id || null);
      setExpenses(refreshedActiveGroup?.expenses || []);
    } catch (error) {
      setRemoveError(error instanceof Error ? error.message : "Failed to remove member.");
    }
  }

  function getParticipantInputsFromExpense(expense: ExpenseEntry): ParticipantInput[] {
    const groupMembers = activeGroup?.members.map((member) => member.name) || [];
    const participantNames = new Set([
      ...groupMembers,
      ...expense.participants.map((participant) => participant.name),
    ]);

    return Array.from(participantNames).map((member) => {
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

  async function refreshActiveGroups(preferredGroupId?: string | null) {
    if (!user || !firestoreWritable) {
      return;
    }

    try {
      const refreshedGroups = await loadAccessibleGroups(currentUser.uid);
      setGroups(refreshedGroups);

      const nextActiveGroup =
        refreshedGroups.find((group) => group.id === preferredGroupId) ||
        refreshedGroups.find((group) => group.id === activeGroupId) ||
        refreshedGroups[0] ||
        null;

      setActiveGroupId(nextActiveGroup ? nextActiveGroup.id : null);
      setExpenses(nextActiveGroup?.expenses || []);
      setParticipants(buildDefaultParticipants(nextActiveGroup?.members.map((member) => member.name) || []));
    } catch (loadError) {
      setGroupMessage(loadError instanceof Error ? loadError.message : "Could not refresh groups.");
    }
  }

  async function handleCreateGroup() {
    const trimmedName = groupName.trim();

    if (!trimmedName) {
      setGroupMessage("Enter a group name to create a group.");
      return;
    }

    const optimisticGroup: Group = {
      id: `local-${Date.now()}`,
      name: trimmedName,
      inviteCode: "PENDING",
      ownerId: currentUser.uid,
      ownerName: currentUserName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archivedAt: null,
      members: [
        {
          userId: currentUser.uid,
          name: currentUserName,
          email: currentUser.email || "",
          role: "owner",
          joinedAt: new Date().toISOString(),
        },
      ],
      expenses: [],
    };

    setGroups((current) => [optimisticGroup, ...current.filter((group) => group.id !== optimisticGroup.id)]);
    setActiveGroupId(optimisticGroup.id);
    setExpenses([]);
    setParticipants(buildDefaultParticipants([currentUserName]));
    setGroupName("");
    setShowCreateGroup(false);
    setGroupMessage(`Created ${trimmedName}. Share code pending.`);

    try {
      const createdGroup = await createGroup({
        ownerId: currentUser.uid,
        ownerName: currentUserName,
        ownerEmail: currentUser.email || "",
        name: trimmedName,
      });

      void refreshActiveGroups(createdGroup?.id || optimisticGroup.id);
    } catch (error) {
      setGroupMessage(error instanceof Error ? error.message : "Could not create group.");
    }
  }

  async function handleJoinGroup() {
    const normalizedCode = joinCode.trim().toUpperCase();

    if (!normalizedCode) {
      setGroupMessage("Enter an invite code to join a group.");
      return;
    }

    const matchingGroup = groups.find((group) => group.inviteCode === normalizedCode) || null;

    if (matchingGroup) {
      setGroups((current) => [matchingGroup, ...current.filter((group) => group.id !== matchingGroup.id)]);
      setActiveGroupId(matchingGroup.id);
      setExpenses(matchingGroup.expenses || []);
      setParticipants(buildDefaultParticipants(matchingGroup.members.map((member) => member.name)));
    }

    setJoinCode("");
    setShowJoinGroup(false);
    setGroupMessage(`Joined ${matchingGroup?.name || "the group"}.`);

    try {
      const joinedGroup = await joinGroupByInviteCode({
        userId: currentUser.uid,
        userName: currentUserName,
        userEmail: currentUser.email || "",
        inviteCode: normalizedCode,
      });

      void refreshActiveGroups(joinedGroup?.id || matchingGroup?.id || null);
    } catch (error) {
      setGroupMessage(error instanceof Error ? error.message : "No group was found for that invite code.");
    }
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
      const fallback = activeMemberNames.find((person) => person !== member) || currentUserName;
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

  async function handleSaveExpense() {
    if (!activeGroup.id) {
      setError("No active group selected.");
      return;
    }

    const result = createExpenseEntry({
      name,
      amount,
      date,
      payer,
      participants,
      userId: currentUser.uid,
      userName: currentUser.displayName || "Unknown",
    });

    if (result.error || !result.expense) {
      setError(result.error);
      return;
    }

    const expenseToSave: ExpenseEntry = {
      ...result.expense,
      groupId: activeGroup.id,
    };

    if (editingExpenseId) {
      expenseToSave.id = editingExpenseId;
      expenseToSave.createdAt = activeExpenses.find((expense) => expense.id === editingExpenseId)?.createdAt || expenseToSave.createdAt;
    }

    setExpenses((current) => {
      const nextExpenses = editingExpenseId
        ? current.map((expense) => (expense.id === expenseToSave.id ? expenseToSave : expense))
        : [expenseToSave, ...current];

      return nextExpenses;
    });
    setShowForm(false);
    resetForm();

    try {
      await saveExpenseToGroup({
        groupId: activeGroup.id,
        expense: expenseToSave,
        userId: currentUser.uid,
        userName: currentUser.displayName || "Unknown",
      });
      void refreshActiveGroups(activeGroup.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save expense.");
    }
  }

  async function handleLeaveGroup() {
    if (!activeGroup.id || !activeGroupId) {
      setGroupMessage("No active group selected.");
      return;
    }

    const currentGroup = groups.find((group) => group.id === activeGroupId) || null;
    const currentGroupMembers = currentGroup?.members || [];
    const remainingGroups = groups.filter((group) => group.id !== activeGroupId);
    const remainingCurrentUserGroup = remainingGroups[0] || null;

    setGroups(remainingGroups);
    setActiveGroupId(remainingCurrentUserGroup?.id || null);
    setExpenses(remainingCurrentUserGroup?.expenses || []);
    setParticipants(buildDefaultParticipants(remainingCurrentUserGroup?.members.map((member) => member.name) || []));
    setGroupActionToConfirm(null);
    setGroupMessage("You left the group.");

    try {
      const updatedGroup = await leaveGroupFromGroup(activeGroupId, currentUser.uid);
      void refreshActiveGroups(updatedGroup?.id || null);
    } catch (leaveError) {
      setGroupMessage(leaveError instanceof Error ? leaveError.message : "Could not leave the group.");
      setGroups((current) => [currentGroup, ...remainingGroups].filter(Boolean) as Group[]);
      setActiveGroupId(currentGroup?.id || null);
      setExpenses(currentGroup?.expenses || []);
      setParticipants(buildDefaultParticipants(currentGroupMembers.map((member) => member.name) || []));
    }
  }

  async function handleDeleteGroup() {
    if (!activeGroup.id || !activeGroupId) {
      setGroupMessage("No active group selected.");
      return;
    }

    const currentGroup = groups.find((group) => group.id === activeGroupId) || null;
    setGroups((current) => current.filter((group) => group.id !== activeGroupId));
    setActiveGroupId(null);
    setExpenses([]);
    setParticipants([]);
    setGroupActionToConfirm(null);
    setGroupMessage("Group deleted.");

    try {
      await deleteGroup(activeGroupId, currentUser.uid);
      void refreshActiveGroups(null);
    } catch (deleteError) {
      setGroupMessage(deleteError instanceof Error ? deleteError.message : "Could not delete the group.");
      if (currentGroup) {
        setGroups((current) => [currentGroup, ...current.filter((group) => group.id !== currentGroup.id)]);
        setActiveGroupId(currentGroup.id);
        setExpenses(currentGroup.expenses || []);
        setParticipants(buildDefaultParticipants(currentGroup.members.map((member) => member.name)));
      }
    }
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
              <Text style={styles.sectionTitle}>{activeGroup.id ? activeGroup.name : "No active group"}</Text>
              <Text style={styles.sectionSubtitle}>
                {activeGroup.id ? `Invite code: ${activeGroup.inviteCode}` : "Create or join a group to start tracking expenses."}
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
            {activeGroup.id ? (
              <Pressable
                accessibilityLabel={activeGroup.ownerId === currentUser.uid ? "Delete group" : "Leave group"}
                testID={activeGroup.ownerId === currentUser.uid ? "delete-group-button" : "leave-group-button"}
                style={({ pressed }) => [
                  activeGroup.ownerId === currentUser.uid ? styles.dangerButton : styles.secondaryButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => {
                  setGroupActionToConfirm(activeGroup.ownerId === currentUser.uid ? "delete" : "leave");
                  setGroupMessage(null);
                }}
              >
                <Text
                  style={
                    activeGroup.ownerId === currentUser.uid
                      ? styles.dangerButtonText
                      : styles.secondaryButtonText
                  }
                >
                  {activeGroup.ownerId === currentUser.uid ? "Delete group" : "Leave group"}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {groupActionToConfirm ? (
            <View style={styles.confirmBox}>
              <Text style={styles.confirmTitle}>
                {groupActionToConfirm === "delete"
                  ? `Delete ${activeGroup.name}?`
                  : `Leave ${activeGroup.name}?`}
              </Text>
              <Text style={styles.confirmMessage}>
                {groupActionToConfirm === "delete"
                  ? "This will remove the group for every member and cannot be undone if balances are settled."
                  : "You will be removed from this group and future expenses for it."}
              </Text>
              <View style={styles.confirmActions}>
                <Pressable
                  style={({ pressed }) => [styles.cancelButton, pressed && styles.buttonPressed]}
                  onPress={() => setGroupActionToConfirm(null)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.dangerButton, pressed && styles.buttonPressed]}
                  onPress={() => {
                    if (groupActionToConfirm === "delete") {
                      void handleDeleteGroup();
                    } else {
                      void handleLeaveGroup();
                    }
                  }}
                >
                  <Text style={styles.dangerButtonText}>Confirm</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

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
                    {balance.name === currentUserName ? "You" : balance.name}
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
                {activeMemberNames.map((member) => (
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
                  <Text style={styles.expenseCreatedBy}>
                    Created by {expense.createdByName || expense.createdBy} {expense.createdAt ? `(${new Date(expense.createdAt).toLocaleDateString()})` : ""}
                  </Text>
                  {expense.updatedBy && expense.updatedBy !== expense.createdBy ? (
                    <Text style={styles.expenseUpdatedBy}>
                      Updated by {expense.updatedByName || expense.updatedBy} {expense.updatedAt ? `(${new Date(expense.updatedAt).toLocaleDateString()})` : ""}
                    </Text>
                  ) : null}
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

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Group members</Text>
              <Text style={styles.sectionSubtitle}>Manage group members.</Text>
            </View>
            <Pressable
              accessibilityLabel="Manage members"
              testID="toggle-members-button"
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => {
                setShowMembers(!showMembers);
                setRemoveError(null);
              }}
            >
              <Text style={styles.primaryButtonText}>
                {showMembers ? "Hide members" : "Show members"}
              </Text>
            </Pressable>
          </View>

          {showMembers ? (
            <View style={styles.list}>
              {removeError ? (
                <Text style={styles.errorText} testID="member-remove-error">
                  {removeError}
                </Text>
              ) : null}

              {memberToRemove ? (
                <View style={styles.confirmBox}>
                  <Text style={styles.confirmTitle}>Remove {memberToRemove}?</Text>
                  <Text style={styles.confirmMessage}>
                    This member will be removed from the group. Make sure all balances are settled.
                  </Text>
                  <View style={styles.confirmActions}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.cancelButton,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() => {
                        setMemberToRemove(null);
                        setRemoveError(null);
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.dangerButton,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() => {
                        void handleRemoveMember(memberToRemove);
                      }}
                      testID="confirm-remove-member"
                    >
                      <Text style={styles.dangerButtonText}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                activeGroup.members.map((member) => {
                  const balance = getMemberBalance(member.name);
                  const isCurrentUser = member.userId === currentUser.uid;
                  const canRemove = !isCurrentUser && canRemoveMemberLocal(member.name).canRemove;

                  return (
                    <View key={member.userId} style={styles.memberItem}>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>
                          {isCurrentUser ? `${member.name} (You)` : member.name}
                        </Text>
                        <Text
                          style={[
                            styles.memberBalance,
                            balance > 0.01 && styles.positiveBalance,
                            balance < -0.01 && styles.negativeBalance,
                          ]}
                        >
                          {Math.abs(balance) > 0.01
                            ? `${balance > 0 ? "+" : "-"} EUR ${Math.abs(balance).toFixed(2)}`
                            : "Settled"}
                        </Text>
                      </View>
                      {canRemove ? (
                        <Pressable
                          accessibilityLabel={`Remove ${member.name}`}
                          testID={`remove-member-${member.name}`}
                          style={({ pressed }) => [
                            styles.removeButton,
                            pressed && styles.buttonPressed,
                          ]}
                          onPress={() => setMemberToRemove(member.name)}
                        >
                          <Text style={styles.removeButtonText}>Remove</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>
          ) : null}
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
    minWidth: "45%",
    backgroundColor: "#E9F1F8",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
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
    flexWrap: "wrap",
    justifyContent: "flex-start",
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
  expenseCreatedBy: {
    color: "#7A8A99",
    marginTop: 6,
    fontSize: 12,
    fontStyle: "italic",
  },
  expenseUpdatedBy: {
    color: "#9AA7B7",
    marginTop: 2,
    fontSize: 11,
    fontStyle: "italic",
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
  confirmBox: {
    marginTop: 16,
    backgroundColor: "#FEF5F1",
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#B42318",
  },
  confirmTitle: {
    color: "#152B3C",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },
  confirmMessage: {
    color: "#5F6C7B",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 12,
  },
  dangerButton: {
    minWidth: "45%",
    backgroundColor: "#B42318",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#F7FAFD",
    gap: 10,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: "#152B3C",
    fontSize: 16,
    fontWeight: "700",
  },
  memberBalance: {
    color: "#5F6C7B",
    fontSize: 14,
    marginTop: 4,
    fontWeight: "600",
  },
  removeButton: {
    backgroundColor: "#FEE6E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  removeButtonText: {
    color: "#B42318",
    fontSize: 13,
    fontWeight: "800",
  },
});

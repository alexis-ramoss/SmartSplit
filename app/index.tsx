import { Redirect } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    Modal,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth-context";
import {
    aggregateGlobalBalances,
    calculateDebtBreakdownForMember,
    calculateMemberBalances,
    calculateSettlementSuggestions,
    createExpenseEntry,
    aggregateGlobalBalances,
    EXPENSE_CATEGORIES,
    ExpenseCategory,
    ExpenseEntry,
    formatDate,
    ParticipantInput,
    RecurrenceFrequency,
    RecurrenceRule,
    stopRecurringExpense,
    updateRecurringExpenseTemplate,
} from "../lib/_expense-utils";
import {
    canRemoveMember,
    createGroup,
    deleteGroup,
    leaveGroupFromGroup,
    loadAccessibleGroups,
    processDueRecurringExpensesForGroup,
    removeMemberFromGroup,
    saveExpenseToGroup,
    updateGroupSettings,
    type LoadedGroup
} from "../lib/_group-utils";

type Group = {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  autoConfirmExpenses: boolean;
  members: LoadedGroup["members"];
  expenses: LoadedGroup["expenses"];
  joinRequests?: string[];
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
  autoConfirmExpenses: false,
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

function formatSignedCurrency(amount: number): string {
  const sign = amount > 0 ? "+" : "-";
  return `${sign} EUR ${Math.abs(amount).toFixed(2)}`;
}

function CalendarPicker({
  value,
  onSelect,
  onClose,
  visible,
}: {
  value: string;
  onSelect: (date: string) => void;
  onClose: () => void;
  visible: boolean;
}) {
  const [currentDate, setCurrentDate] = useState(() => {
    try {
      if (!value) return new Date();
      const [day, month, year] = value.split("/").map(Number);
      const d = new Date(year, month - 1, day);
      return isNaN(d.getTime()) ? new Date() : d;
    } catch {
      return new Date();
    }
  });

  useEffect(() => {
    if (visible) {
      try {
        if (value) {
          const [day, month, year] = value.split("/").map(Number);
          const d = new Date(year, month - 1, day);
          if (!isNaN(d.getTime())) {
            setCurrentDate(d);
          }
        }
      } catch {
        // ignore
      }
    }
  }, [visible, value]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const changeMonth = (offset: number) => {
    const nextDate = new Date(year, month + offset, 1);
    setCurrentDate(nextDate);
  };

  const isSelected = (day: number) => {
    if (!value) return false;
    const [d, m, y] = value.split("/").map(Number);
    return day === d && (month + 1) === m && year === y;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.calendarContainer}>
          <View style={styles.calendarHeader}>
            <Pressable onPress={() => changeMonth(-1)} style={styles.calendarNavButton}>
              <Ionicons name="chevron-back" size={24} color="#020427" />
            </Pressable>
            <Text style={styles.calendarTitle}>{monthNames[month]} {year}</Text>
            <Pressable onPress={() => changeMonth(1)} style={styles.calendarNavButton}>
              <Ionicons name="chevron-forward" size={24} color="#020427" />
            </Pressable>
          </View>
          <View style={styles.calendarGrid}>
            {["S", "M", "T", "W", "T", "F", "S"].map((day, idx) => (
              <View key={idx} style={styles.calendarDayHeaderBox}>
                <Text style={styles.calendarDayHeader}>{day}</Text>
              </View>
            ))}
            {days.map((day, idx) => (
              <Pressable
                key={idx}
                testID={day !== null ? `calendar-day-${day}` : undefined}
                style={[
                  styles.calendarDay,
                  day !== null && isSelected(day) && styles.calendarDaySelected
                ]}
                onPress={() => {
                  if (day) {
                    const selectedDate = new Date(year, month, day);
                    onSelect(formatDate(selectedDate));
                  }
                }}
              >
                <Text style={[
                  styles.calendarDayText,
                  day !== null && isSelected(day) && styles.calendarDayTextSelected
                ]}>{day || ""}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.calendarFooter}>
            <Pressable style={styles.calendarCloseButton} onPress={onClose}>
              <Text style={styles.calendarCloseButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
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
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [groupMessage, setGroupMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("General");
  const [date, setDate] = useState(formatDate(new Date()));
  const [payer, setPayer] = useState(() => seededGroups[0]?.members[0]?.name || currentUserName);
  const [participants, setParticipants] = useState<ParticipantInput[]>(() =>
    buildDefaultParticipants(seededGroups[0]?.members.map((member) => member.name) || [])
  );
  const [error, setError] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [showGlobalOverview, setShowGlobalOverview] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [groupActionToConfirm, setGroupActionToConfirm] = useState<"leave" | "delete" | null>(null);

  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>("Monthly");
  const [recurrenceEvery, setRecurrenceEvery] = useState("1");
  const [recurrenceStartDate, setRecurrenceStartDate] = useState(formatDate(new Date()));
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [recurrenceHasEndDate, setRecurrenceHasEndDate] = useState(false);
  const [showMainDatePicker, setShowMainDatePicker] = useState(false);
  const [showRecurrenceStartDatePicker, setShowRecurrenceStartDatePicker] = useState(false);
  const [showRecurrenceEndDatePicker, setShowRecurrenceEndDatePicker] = useState(false);

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

        // process recurring expenses for all accessible groups
        await Promise.all(
          remoteGroups.map((group) => processDueRecurringExpensesForGroup(group.id))
        );

        const refreshedGroups = await loadAccessibleGroups(currentUser.uid);

        if (cancelled) {
          return;
        }

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
  const myNameInActiveGroup = useMemo(
    () => activeGroup.members.find((m) => m.userId === user?.uid)?.name || currentUserName,
    [activeGroup, user, currentUserName]
  );
  const currentUserDebtBreakdown = useMemo(
    () => calculateDebtBreakdownForMember(activeExpenses, myNameInActiveGroup),
    [activeExpenses, myNameInActiveGroup]
  );
  const globalSummary = useMemo(
    () => aggregateGlobalBalances(groups, user?.uid || ""),
    [groups, user?.uid]
  );
  const currentUserBalance =
    visibleMemberBalances.find((balance) => balance.name === myNameInActiveGroup)?.balance || 0;
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
    setCategory("General");
    setDate(formatDate(new Date()));
    setPayer(currentUserName);
    setParticipants(
      activeGroup.members.map((member, index) => ({
        name: member.name,
        selected: index < 2,
        percentage: index < 2 ? "50" : "0",
      }))
    );
    setError(null);
    setEditingExpenseId(null);
    setRecurrenceEnabled(false);
    setRecurrenceFrequency("Monthly");
    setRecurrenceEvery("1");
    setRecurrenceStartDate(formatDate(new Date()));
    setRecurrenceEndDate("");
    setRecurrenceHasEndDate(false);
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

  function getCategoryIcon(label: string): string {
    return EXPENSE_CATEGORIES.find((c) => c.label === label)?.icon || "📦";
  }

  function handleEditExpense(expense: ExpenseEntry) {
    setName(expense.name);
    setAmount(String(expense.amount));
    setCategory(expense.category || "General");
    setDate(expense.date);
    setPayer(expense.payer);
    setParticipants(getParticipantInputsFromExpense(expense));
    setEditingExpenseId(expense.id);
    setError(null);

    if (expense.recurrence) {
      setRecurrenceEnabled(expense.recurrence.active);
      setRecurrenceFrequency(expense.recurrence.frequency);
      setRecurrenceEvery(String(expense.recurrence.every));
      setRecurrenceStartDate(expense.recurrence.startDate);
      setRecurrenceEndDate(expense.recurrence.endDate || "");
      setRecurrenceHasEndDate(!!expense.recurrence.endDate);
    } else {
      setRecurrenceEnabled(false);
      setRecurrenceFrequency("Monthly");
      setRecurrenceEvery("1");
      setRecurrenceStartDate(expense.date);
      setRecurrenceEndDate("");
      setRecurrenceHasEndDate(false);
    }

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

      if (matchingGroup.members.some((m) => m.userId === currentUser.uid)) {
        setActiveGroupId(matchingGroup.id);
        setJoinCode("");
        setShowJoinGroup(false);
        setGroupMessage(`Joined ${matchingGroup.name}.`);
        return;
      }

      setGroups((current) =>
        current.map((g) =>
          g.id === matchingGroup.id
            ? { ...g, joinRequests: [...new Set([...(g.joinRequests || []), currentUserName])] }
            : g
        )
      );

      setJoinCode("");
      setShowJoinGroup(false);
      setGroupMessage(`Requested to join ${matchingGroup.name}. Waiting for approval.`);
      return;
    }

    setGroupMessage("Invalid invite code.");
  }

  function handleAcceptJoinRequest(requester: string) {
    setGroups((current) =>
      current.map((g) =>
        g.id === activeGroup.id
          ? {
              ...g,
              members: [...g.members, { userId: `req-${Date.now()}`, name: requester, email: "", role: "member", joinedAt: new Date().toISOString() }],
              joinRequests: (g.joinRequests || []).filter((r) => r !== requester),
            }
          : g
      )
    );
  }

  function handleRejectJoinRequest(requester: string) {
    setGroups((current) =>
      current.map((g) =>
        g.id === activeGroup.id
          ? {
              ...g,
              joinRequests: (g.joinRequests || []).filter((r) => r !== requester),
            }
          : g
      )
    );
  }

  async function handleUpdateGroupSettings(settings: { autoConfirmExpenses: boolean }) {
    if (!activeGroup.id) return;
    try {
      const updated = await updateGroupSettings(activeGroup.id, settings);
      if (updated) {
        setGroups((current) =>
          current.map((g) => (g.id === updated.id ? { ...g, ...updated } : g))
        );
        setGroupMessage("Settings updated successfully.");
      }
    } catch (err) {
      setGroupMessage("Failed to update settings. Please try again.");
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
      category,
      date,
      payer,
      participants,
      userId: currentUser.uid,
      userName: currentUser.displayName || currentUser.email?.split("@")[0] || "Unknown",
      recurrence: {
        enabled: recurrenceEnabled,
        frequency: recurrenceFrequency,
        every: recurrenceEvery,
        startDate: recurrenceStartDate,
        endDate: recurrenceHasEndDate ? recurrenceEndDate : "",
      },
      confirmed: activeGroup.autoConfirmExpenses,
    });

    if (result.error || !result.expense) {
      setError(result.error);
      return;
    }

    let expenseToSave: ExpenseEntry = {
      ...result.expense,
      groupId: activeGroup.id,
    };

    if (editingExpenseId) {
      const existingExpense = activeExpenses.find((expense) => expense.id === editingExpenseId);
      if (existingExpense) {
        if (existingExpense.recurrence && !recurrenceEnabled) {
          expenseToSave = stopRecurringExpense(existingExpense);
        } else if (existingExpense.recurrence) {
          expenseToSave = updateRecurringExpenseTemplate(existingExpense, expenseToSave);
        }

        expenseToSave.id = editingExpenseId;
        expenseToSave.createdAt = existingExpense.createdAt || expenseToSave.createdAt;
        expenseToSave.createdBy = existingExpense.createdBy || expenseToSave.createdBy;
        expenseToSave.createdByName = existingExpense.createdByName || expenseToSave.createdByName;
        expenseToSave.confirmed = existingExpense.confirmed;
      }
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
        userName: currentUser.displayName || currentUser.email?.split("@")[0] || "Unknown",
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

          <View style={[styles.groupActionsRow, { marginTop: 14 }]}>
            <Pressable
              accessibilityLabel="Sign out"
              style={({ pressed }) => [
                styles.signOutButton,
                { marginTop: 0 },
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

            <Pressable
              accessibilityLabel="Global balances"
              testID="toggle-global-overview"
              style={({ pressed }) => [
                styles.signOutButton,
                { marginTop: 0, backgroundColor: showGlobalOverview ? "#2B6CB0" : "rgba(255,255,255,0.12)" },
                pressed && styles.buttonPressed,
              ]}
              onPress={() => setShowGlobalOverview(!showGlobalOverview)}
            >
              <Text style={styles.signOutButtonText}>
                {showGlobalOverview ? "Hide Global" : "Global Balances"}
              </Text>
            </Pressable>
          </View>

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

        {showGlobalOverview ? (
          <View style={styles.sectionCard} testID="global-overview-card">
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Global Balance Overview</Text>
                <Text style={styles.sectionSubtitle}>Across all your groups.</Text>
              </View>
            </View>

            <View style={[styles.summaryRow, { marginTop: 16 }]}>
              <View style={[styles.summaryItem, { backgroundColor: "#FFF5F5" }]}>
                <Text style={[styles.summaryLabel, { color: "#C53030" }]}>Total Owed</Text>
                <Text style={[styles.summaryValue, { color: "#C53030" }]}>
                  EUR {globalSummary.totalOwed.toFixed(2)}
                </Text>
              </View>
              <View style={[styles.summaryItem, { backgroundColor: "#F0FFF4" }]}>
                <Text style={[styles.summaryLabel, { color: "#2F855A" }]}>Total Receivable</Text>
                <Text style={[styles.summaryValue, { color: "#2F855A" }]}>
                  EUR {globalSummary.totalReceivable.toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={styles.balanceList} testID="global-balance-list">
              {globalSummary.breakdown.length > 0 ? (
                globalSummary.breakdown.map((item) => (
                  <View key={item.name} style={styles.globalBreakdownItem}>
                    <View style={styles.balanceRow}>
                      <Text style={styles.balanceName}>{item.name}</Text>
                      <Text
                        style={[
                          styles.balanceAmount,
                          item.balance > 0.01 && styles.positiveBalance,
                          item.balance < -0.01 && styles.negativeBalance,
                        ]}
                      >
                        {formatSignedCurrency(item.balance)}
                      </Text>
                    </View>
                    <View style={styles.groupBreakdownList}>
                      {item.groups.map((group) => (
                        <View key={group.groupName} style={styles.groupBreakdownRow}>
                          <Text style={styles.groupBreakdownName}>{group.groupName}</Text>
                          <Text
                            style={[
                              styles.groupBreakdownAmount,
                              group.balance > 0.01 && styles.positiveBalance,
                              group.balance < -0.01 && styles.negativeBalance,
                            ]}
                          >
                            {formatSignedCurrency(group.balance)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.infoText}>No outstanding balances.</Text>
              )}
            </View>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>{activeGroup.id ? activeGroup.name : "No active group"}</Text>
              <Text style={styles.sectionSubtitle}>
                {activeGroup.id ? `Invite code: ${activeGroup.inviteCode}` : "Create or join a group to start tracking expenses."}
              </Text>

              <View style={styles.payerRow}>
                {groups.map((group) => (
                  <Pressable
                    key={group.id}
                    testID={`switch-group-${group.id}`}
                    style={[
                      styles.payerChip,
                      activeGroupId === group.id &&
                        styles.payerChipSelected,
                    ]}
                    onPress={() => {
                      setActiveGroupId(group.id);
                    }}
                  >
                    <Text
                      style={[
                        styles.payerChipText,
                        activeGroupId === group.id &&
                          styles.payerChipTextSelected,
                      ]}
                    >
                      {group.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
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
                setShowGroupSettings(false);
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
                setShowGroupSettings(false);
                setGroupMessage(null);
              }}
            >
              <Text style={styles.secondaryButtonText}>Join group</Text>
            </Pressable>
            {activeGroup.id && activeGroup.ownerId === currentUser.uid ? (
              <Pressable
                accessibilityLabel="Group settings"
                testID="open-group-settings-button"
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => {
                  setShowGroupSettings((value) => !value);
                  setShowCreateGroup(false);
                  setShowJoinGroup(false);
                  setGroupMessage(null);
                }}
              >
                <Text style={styles.secondaryButtonText}>Settings</Text>
              </Pressable>
            ) : null}
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

          {showGroupSettings && activeGroup.id && activeGroup.ownerId === currentUser.uid ? (
            <View style={styles.inlineForm}>
              <Text style={styles.formLabel}>Group Settings</Text>
              <View style={[styles.switchRow, { marginBottom: 16 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Automatic Confirmation</Text>
                  <Text style={styles.switchDescription}>
                    New transactions will be automatically confirmed.
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel="Toggle automatic confirmation"
                  testID="toggle-auto-confirm"
                  style={[
                    styles.toggleButton,
                    activeGroup.autoConfirmExpenses && styles.toggleButtonActive,
                  ]}
                  onPress={() => handleUpdateGroupSettings({ autoConfirmExpenses: !activeGroup.autoConfirmExpenses })}
                >
                  <View
                    style={[
                      styles.toggleKnob,
                      activeGroup.autoConfirmExpenses && styles.toggleKnobActive,
                    ]}
                  />
                </Pressable>
              </View>
            </View>
          ) : null}

          {groupMessage ? (
            <Text style={styles.infoText} testID="group-status-message">
              {groupMessage}
            </Text>
          ) : null}
        </View>

        {activeGroup.ownerId === currentUser.uid && activeGroup.joinRequests && activeGroup.joinRequests.length > 0 ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Join requests</Text>
                <Text style={styles.sectionSubtitle}>
                  People waiting to join your group.
                </Text>
              </View>
            </View>
            <View style={{ marginTop: 16, gap: 12 }}>
              {activeGroup.joinRequests.map((requester) => (
                <View key={requester} style={styles.expenseItem}>
                  <Text style={styles.participantName}>{requester}</Text>
                  <View style={[styles.groupActionsRow, { marginTop: 0 }]}>
                    <Pressable
                      style={[styles.primaryButton, { marginVertical: 0 }]}
                      onPress={() => handleAcceptJoinRequest(requester)}
                      testID={`accept-request-${requester}`}
                    >
                      <Text style={styles.primaryButtonText}>Accept</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.cancelButton, { paddingVertical: 12, paddingHorizontal: 16, flex: 0, minWidth: 80 }]}
                      onPress={() => handleRejectJoinRequest(requester)}
                      testID={`reject-request-${requester}`}
                    >
                      <Text style={[styles.cancelButtonText, { fontSize: 14 }]}>Reject</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

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
              <Pressable
                testID="expense-date-input"
                onPress={() => setShowMainDatePicker(true)}
                style={styles.datePickerTrigger}
              >
                <Ionicons name="calendar-outline" size={20} color="#5F6C7B" />
                <Text style={styles.datePickerText}>{date}</Text>
              </Pressable>

              <CalendarPicker
                visible={showMainDatePicker}
                value={date}
                onSelect={(val) => {
                  setDate(val);
                  setShowMainDatePicker(false);
                }}
                onClose={() => setShowMainDatePicker(false)}
              />

              <Text style={styles.formLabel}>Category</Text>
              <View style={styles.payerRow}>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat.label}
                    testID={`category-option-${cat.label}`}
                    style={({ pressed }) => [
                      styles.payerChip,
                      category === cat.label && styles.payerChipSelected,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => {
                      setCategory(cat.label);
                      if (error) {
                        setError(null);
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.payerChipText,
                        category === cat.label && styles.payerChipTextSelected,
                      ]}
                    >
                      {cat.icon} {cat.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

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

              <Text style={styles.formLabel}>Recurring Expense</Text>
              <Pressable
                testID="recurrence-toggle"
                style={styles.checkboxRow}
                onPress={() => setRecurrenceEnabled(!recurrenceEnabled)}
              >
                <View
                  style={[
                    styles.checkbox,
                    recurrenceEnabled && styles.checkboxSelected,
                  ]}
                >
                  {recurrenceEnabled ? <Text style={styles.checkboxTick}>X</Text> : null}
                </View>
                <Text style={styles.participantName}>Make this expense recurring</Text>
              </Pressable>

              {recurrenceEnabled ? (
                <View style={styles.recurrenceSection}>
                  <Text style={styles.formLabel}>Frequency</Text>
                  <View style={styles.payerRow}>
                    {(["Daily", "Weekly", "Monthly"] as RecurrenceFrequency[]).map((freq) => (
                      <Pressable
                        key={freq}
                        testID={`frequency-option-${freq}`}
                        style={[
                          styles.payerChip,
                          recurrenceFrequency === freq && styles.payerChipSelected,
                        ]}
                        onPress={() => setRecurrenceFrequency(freq)}
                      >
                        <Text
                          style={[
                            styles.payerChipText,
                            recurrenceFrequency === freq && styles.payerChipTextSelected,
                          ]}
                        >
                          {freq}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.formLabel}>Every (Interval)</Text>
                  <TextInput
                    accessibilityLabel="Recurrence interval"
                    placeholder="1"
                    keyboardType="numeric"
                    style={styles.input}
                    value={recurrenceEvery}
                    onChangeText={setRecurrenceEvery}
                    testID="recurrence-every-input"
                  />

                  <Text style={styles.formLabel}>Start Date</Text>
                  <Pressable
                    testID="recurrence-start-date-input"
                    onPress={() => setShowRecurrenceStartDatePicker(true)}
                    style={styles.datePickerTrigger}
                  >
                    <Ionicons name="calendar-outline" size={20} color="#5F6C7B" />
                    <Text style={styles.datePickerText}>{recurrenceStartDate}</Text>
                  </Pressable>

                  <CalendarPicker
                    visible={showRecurrenceStartDatePicker}
                    value={recurrenceStartDate}
                    onSelect={(val) => {
                      setRecurrenceStartDate(val);
                      setShowRecurrenceStartDatePicker(false);
                    }}
                    onClose={() => setShowRecurrenceStartDatePicker(false)}
                  />
                  
                  {(() => {
                    const [day] = recurrenceStartDate.split("/").map(Number);

                    return recurrenceFrequency === "Monthly" && day >= 29;
                  })() && (
                    <Text style={styles.helperText}>
                      Shorter months will use the last available day.
                    </Text>
                  )}

                  <View style={styles.checkboxRowContainer}>
                    <Text style={styles.formLabel}>End Date</Text>
                    <Pressable
                      testID="recurrence-end-date-toggle"
                      style={styles.checkboxRowSmall}
                      onPress={() => setRecurrenceHasEndDate(!recurrenceHasEndDate)}
                    >
                      <View
                        style={[
                          styles.checkboxSmall,
                          recurrenceHasEndDate && styles.checkboxSelected,
                        ]}
                      >
                        {recurrenceHasEndDate ? <Text style={styles.checkboxTickSmall}>X</Text> : null}
                      </View>
                      <Text style={styles.checkboxLabelSmall}>Has end date</Text>
                    </Pressable>
                  </View>

                  {recurrenceHasEndDate ? (
                    <>
                      <Pressable
                        testID="recurrence-end-date-input"
                        onPress={() => setShowRecurrenceEndDatePicker(true)}
                        style={styles.datePickerTrigger}
                      >
                        <Ionicons name="calendar-outline" size={20} color="#5F6C7B" />
                        <Text style={styles.datePickerText}>{recurrenceEndDate || "Select end date"}</Text>
                      </Pressable>

                      <CalendarPicker
                        visible={showRecurrenceEndDatePicker}
                        value={recurrenceEndDate}
                        onSelect={(val) => {
                          setRecurrenceEndDate(val);
                          setShowRecurrenceEndDatePicker(false);
                        }}
                        onClose={() => setShowRecurrenceEndDatePicker(false)}
                      />
                    </>
                  ) : (
                    <Text style={styles.helperText}>Repeats indefinitely until stopped manually.</Text>
                  )}
                </View>
              ) : null}

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
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>
                      {getCategoryIcon(expense.category)} {(expense.category || "General").toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.expenseMeta}>Date: {expense.date}</Text>
                  <Text style={styles.expenseMeta}>Paid by {expense.payer}</Text>

                  {expense.recurrence?.active ? (
                    <Text style={styles.expenseMeta}>
                      Repeats {expense.recurrence.frequency.toLowerCase()}
                    </Text>
                  ) : null}

                  {expense.recurringSourceId ? (
                    <Text style={styles.expenseMeta}>Generated recurring expense</Text>
                  ) : null}
                  <Text style={styles.expenseMeta}>
                    Split: {expense.participants.map((p) => `${p.name} ${p.percentage}%`).join(", ")}
                  </Text>
                  <Text style={styles.expenseCreatedBy}>
                    Created by {expense.createdByName || expense.createdBy || "Unknown"} on {expense.createdAt ? new Date(expense.createdAt).toLocaleDateString() : ""}
                  </Text>
                  <Text style={styles.expenseUpdatedBy}>
                    Last updated by {expense.updatedByName || expense.updatedBy || expense.createdByName || expense.createdBy || "Unknown"} on {expense.updatedAt ? new Date(expense.updatedAt).toLocaleDateString() : expense.createdAt ? new Date(expense.createdAt).toLocaleDateString() : ""}
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
  globalBreakdownItem: {
    gap: 4,
  },
  groupBreakdownList: {
    paddingLeft: 24,
    gap: 2,
    marginBottom: 8,
  },
  groupBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  groupBreakdownName: {
    color: "#5F6C7B",
    fontSize: 13,
    fontWeight: "600",
  },
  groupBreakdownAmount: {
    fontSize: 13,
    fontWeight: "700",
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
  recurrenceSection: {
    gap: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E1E8EF",
    paddingTop: 8,
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
  categoryBadge: {
    backgroundColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "flex-start",
    marginTop: 4,
    marginBottom: 4,
  },
  categoryBadgeText: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
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
  },
  expenseUpdatedBy: {
    color: "#7A8A99",
    marginTop: 2,
    fontSize: 12,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  calendarContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  calendarNavButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "#F7F8FA",
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#020427",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  calendarDayHeaderBox: {
    width: "14%",
    alignItems: "center",
    marginBottom: 10,
  },
  calendarDayHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8B95A7",
  },
  calendarDay: {
    width: "14%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    marginBottom: 4,
  },
  calendarDaySelected: {
    backgroundColor: "#020427",
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#152B3C",
  },
  calendarDayTextSelected: {
    color: "#FFFFFF",
  },
  calendarFooter: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#E1E8EF",
    paddingTop: 16,
    alignItems: "center",
  },
  calendarCloseButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  calendarCloseButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#5F6C7B",
  },
  datePickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E1E8EF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  datePickerText: {
    fontSize: 16,
    color: "#152B3C",
    fontWeight: "500",
  },
  checkboxRowContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  checkboxRowSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkboxSmall: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: "#E1E8EF",
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  checkboxTickSmall: {
    fontSize: 12,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  checkboxLabelSmall: {
    fontSize: 14,
    fontWeight: "600",
    color: "#5F6C7B",
  },
  helperText: {
    fontSize: 13,
    color: "#8B95A7",
    fontStyle: "italic",
    marginTop: 4,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#152B3C",
  },
  switchDescription: {
    fontSize: 13,
    color: "#5F6C7B",
    marginTop: 2,
  },
  toggleButton: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#DDE2E8",
    padding: 3,
  },
  toggleButtonActive: {
    backgroundColor: "#020427",
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
  },
  toggleKnobActive: {
    transform: [{ translateX: 22 }],
  },
});

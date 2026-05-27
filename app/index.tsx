import { Redirect } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth-context";
import {
    calculateDebtBreakdownForMember,
    calculateMemberBalances,
    calculateSettlementSuggestions,
    createExpenseEntry,
    EXPENSE_CATEGORIES,
    ExpenseEntry,
    formatDate,
    ParticipantInput,
    RecurrenceFrequency,
    aggregateGlobalBalances,
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
              <Ionicons name="chevron-back" size={24} color="#12626C" />
            </Pressable>
            <Text style={styles.calendarTitle}>{monthNames[month]} {year}</Text>
            <Pressable onPress={() => changeMonth(1)} style={styles.calendarNavButton}>
              <Ionicons name="chevron-forward" size={24} color="#12626C" />
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
        const remoteGroups = await loadAccessibleGroups(user.uid);

        if (cancelled) {
          return;
        }

        // process recurring expenses for all accessible groups
        await Promise.all(
          remoteGroups.map((group) => processDueRecurringExpensesForGroup(group.id))
        );

        const refreshedGroups = await loadAccessibleGroups(user.uid);

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
  }, [activeGroupId, firestoreWritable, user]);

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
  }, [activeGroup, currentUserName]);

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
    if (!firestoreWritable) {
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
      autoConfirmExpenses: false,
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
    } catch {
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
                {
                  marginTop: 0,
                  backgroundColor: showGlobalOverview ? "#137F86" : "#F7FEFF",
                },
                pressed && styles.buttonPressed,
              ]}
              onPress={() => setShowGlobalOverview(!showGlobalOverview)}
            >
              <Text
                style={[
                  styles.signOutButtonText,
                  showGlobalOverview && { color: "#FFFFFF" },
                ]}
              >
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
          <Animated.View 
            entering={FadeIn.duration(400)} 
            exiting={FadeOut.duration(300)}
            layout={Layout.springify()}
            style={styles.sectionCard} 
            testID="global-overview-card"
          >
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Global Balance Overview</Text>
                <Text style={styles.sectionSubtitle}>Across all your groups.</Text>
              </View>
            </View>

            <View style={[styles.summaryRow, { marginTop: 16 }]}>
              <View style={[styles.summaryItem, { backgroundColor: "#F0F9FF" }]}>
                <Text style={[styles.summaryLabel, { color: "#0369A1" }]}>Total Owed</Text>
                <Text style={[styles.summaryValue, { color: "#0369A1" }]}>
                  EUR {globalSummary.totalOwed.toFixed(2)}
                </Text>
              </View>
              <View style={[styles.summaryItem, { backgroundColor: "#F0FDF4" }]}>
                <Text style={[styles.summaryLabel, { color: "#15803D" }]}>Total Receivable</Text>
                <Text style={[styles.summaryValue, { color: "#15803D" }]}>
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
          </Animated.View>
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
            <Animated.View 
              entering={FadeIn} 
              exiting={FadeOut} 
              layout={Layout.springify()} 
              style={styles.confirmBox}
            >
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
            </Animated.View>
          ) : null}

          {showCreateGroup ? (
            <Animated.View 
              entering={FadeIn} 
              exiting={FadeOut} 
              layout={Layout.springify()} 
              style={styles.inlineForm}
            >
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
            </Animated.View>
          ) : null}

          {showJoinGroup ? (
            <Animated.View 
              entering={FadeIn} 
              exiting={FadeOut} 
              layout={Layout.springify()} 
              style={styles.inlineForm}
            >
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
            </Animated.View>
          ) : null}

          {showGroupSettings && activeGroup.id && activeGroup.ownerId === currentUser.uid ? (
            <Animated.View 
              entering={FadeIn} 
              exiting={FadeOut} 
              layout={Layout.springify()} 
              style={styles.inlineForm}
            >
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
            </Animated.View>
          ) : null}

          {groupMessage ? (
            <Text style={styles.infoText} testID="group-status-message">
              {groupMessage}
            </Text>
          ) : null}
        </View>

        {activeGroup.ownerId === currentUser.uid && activeGroup.joinRequests && activeGroup.joinRequests.length > 0 ? (
          <Animated.View 
            entering={FadeIn} 
            exiting={FadeOut} 
            layout={Layout.springify()} 
            style={styles.sectionCard}
          >
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
          </Animated.View>
        ) : null}

        {shouldShowBalanceBreakdown ? (
          <Animated.View 
            entering={FadeIn} 
            exiting={FadeOut} 
            layout={Layout.springify()} 
            style={styles.sectionCard}
          >
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
          </Animated.View>
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
            <Animated.View 
              entering={FadeIn} 
              exiting={FadeOut} 
              layout={Layout.springify()} 
              style={styles.form}
            >
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
                <Ionicons name="calendar-outline" size={20} color="#5B767D" />
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
                    <Ionicons name="calendar-outline" size={20} color="#5B767D" />
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
                        <Ionicons name="calendar-outline" size={20} color="#5B767D" />
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
            </Animated.View>
          ) : null}

          <View style={styles.list} testID="expense-list">
            {activeExpenses.map((expense) => (
              <Animated.View 
                key={expense.id} 
                entering={FadeIn} 
                layout={Layout.springify()} 
                style={styles.expenseItem}
              >
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
              </Animated.View>
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
            <Animated.View 
              entering={FadeIn} 
              exiting={FadeOut} 
              layout={Layout.springify()} 
              style={styles.list}
            >
              {removeError ? (
                <Text style={styles.errorText} testID="member-remove-error">
                  {removeError}
                </Text>
              ) : null}

              {memberToRemove ? (
                <Animated.View 
                  entering={FadeIn} 
                  exiting={FadeOut} 
                  layout={Layout.springify()} 
                  style={styles.confirmBox}
                >
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
                </Animated.View>
              ) : (
                activeGroup.members.map((member) => {
                  const balance = getMemberBalance(member.name);
                  const isCurrentUser = member.userId === currentUser.uid;
                  const canRemove = !isCurrentUser && canRemoveMemberLocal(member.name).canRemove;

                  return (
                    <Animated.View 
                      key={member.userId} 
                      entering={FadeIn} 
                      layout={Layout.springify()} 
                      style={styles.memberItem}
                    >
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
                    </Animated.View>
                  );
                })
              )}
            </Animated.View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F0F9FA",
  },
  container: {
    padding: 20,
    gap: 20,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: "#DDF7F0",
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(184, 232, 234, 0.5)",
    shadowColor: "#0E6E78",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  signOutButton: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#BEE7E9",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    shadowColor: "#0E6E78",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  signOutButtonText: {
    color: "#12626C",
    fontWeight: "800",
    fontSize: 14,
  },
  kicker: {
    color: "#159296",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  title: {
    color: "#103C4A",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 10,
    lineHeight: 34,
  },
  subtitle: {
    color: "#496973",
    fontSize: 15,
    marginTop: 10,
    lineHeight: 22,
    fontWeight: "500",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
  },
  summaryLabel: {
    color: "#5B767D",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryValue: {
    color: "#103C4A",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    shadowColor: "#12626C",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F0F9FA",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 12,
  },
  sectionTitle: {
    color: "#103C4A",
    fontSize: 20,
    fontWeight: "800",
  },
  sectionSubtitle: {
    color: "#5B767D",
    fontSize: 14,
    marginTop: 4,
    fontWeight: "500",
  },
  primaryButton: {
    backgroundColor: "#137F86",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    shadowColor: "#137F86",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  secondaryButton: {
    backgroundColor: "#F0F9FA",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#D1EFF2",
    minWidth: "45%",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#12626C",
    fontWeight: "700",
    fontSize: 13,
  },
  dangerButton: {
    backgroundColor: "#FFF1F1",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#FFE0E0",
    minWidth: "45%",
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButtonText: {
    color: "#C53030",
    fontWeight: "700",
    fontSize: 13,
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  groupActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 20,
  },
  payerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
    marginBottom: 16,
  },
  payerChip: {
    backgroundColor: "#F7FEFF",
    borderWidth: 1,
    borderColor: "#D1EFF2",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  payerChipSelected: {
    backgroundColor: "#137F86",
    borderColor: "#137F86",
  },
  payerChipText: {
    color: "#12626C",
    fontSize: 13,
    fontWeight: "700",
  },
  payerChipTextSelected: {
    color: "#FFFFFF",
  },
  form: {
    marginTop: 20,
    gap: 16,
    backgroundColor: "#F8FAFB",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#EEF2F6",
  },
  formTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#103C4A",
    marginBottom: 4,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#496973",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: "#103C4A",
  },
  datePickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  datePickerText: {
    fontSize: 16,
    color: "#103C4A",
    fontWeight: "500",
  },
  participantsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  participantRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  checkboxSelected: {
    backgroundColor: "#137F86",
    borderColor: "#137F86",
  },
  checkboxTick: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  participantName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#103C4A",
  },
  weightContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  weightInput: {
    backgroundColor: "#F8FAFB",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: 70,
    textAlign: "right",
    fontSize: 15,
    fontWeight: "700",
    color: "#103C4A",
  },
  percentLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
  },
  notSelectedText: {
    fontSize: 13,
    color: "#94A3B8",
    fontStyle: "italic",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#496973",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#137F86",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  saveButton: {
    flex: 2,
    backgroundColor: "#137F86",
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#137F86",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 16,
  },
  list: {
    marginTop: 20,
    gap: 16,
  },
  expenseItem: {
    backgroundColor: "#F8FAFB",
    borderRadius: 24,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#EEF2F6",
  },
  expenseTextArea: {
    flex: 1,
    gap: 4,
  },
  expenseName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#103C4A",
  },
  categoryBadge: {
    backgroundColor: "#DDF7F0",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
    marginBottom: 6,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#12626C",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  expenseMeta: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  expenseCreatedBy: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 8,
  },
  expenseUpdatedBy: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  expenseActions: {
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  expenseAmount: {
    fontSize: 20,
    fontWeight: "900",
    color: "#103C4A",
  },
  editButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  editButtonText: {
    color: "#137F86",
    fontSize: 13,
    fontWeight: "800",
  },
  balanceList: {
    marginTop: 20,
    gap: 12,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#F8FAFB",
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#EEF2F6",
  },
  balanceName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#103C4A",
    flex: 1,
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: "800",
  },
  positiveBalance: {
    color: "#15803D",
  },
  negativeBalance: {
    color: "#C53030",
  },
  settlementBox: {
    marginTop: 24,
    backgroundColor: "#F0F9FA",
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "#D1EFF2",
  },
  settlementTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#12626C",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  settlementText: {
    fontSize: 14,
    color: "#103C4A",
    fontWeight: "600",
    lineHeight: 22,
  },
  errorText: {
    color: "#C53030",
    fontSize: 14,
    fontWeight: "700",
    backgroundColor: "#FFF1F1",
    padding: 16,
    borderRadius: 16,
    marginTop: 8,
  },
  infoText: {
    color: "#64748B",
    fontSize: 15,
    fontWeight: "600",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 12,
    padding: 16,
    backgroundColor: "#F8FAFB",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EEF2F6",
  },
  confirmBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: 24,
    padding: 24,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#991B1B",
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 15,
    color: "#991B1B",
    marginBottom: 20,
    lineHeight: 22,
    opacity: 0.8,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 12,
  },
  memberItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8FAFB",
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EEF2F6",
  },
  memberInfo: {
    flex: 1,
    gap: 4,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#103C4A",
  },
  memberBalance: {
    fontSize: 14,
    fontWeight: "700",
  },
  removeButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#FEE2E2",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  removeButtonText: {
    color: "#C53030",
    fontSize: 13,
    fontWeight: "800",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(16, 60, 74, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  calendarContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    padding: 24,
    width: "100%",
    maxWidth: 360,
    shadowColor: "#103C4A",
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 15 },
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  calendarTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#103C4A",
  },
  calendarNavButton: {
    padding: 10,
    backgroundColor: "#F0F9FA",
    borderRadius: 14,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarDayHeaderBox: {
    width: "14.28%",
    alignItems: "center",
    marginBottom: 12,
  },
  calendarDayHeader: {
    fontSize: 12,
    fontWeight: "900",
    color: "#94A3B8",
    textTransform: "uppercase",
  },
  calendarDay: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 14,
    marginBottom: 4,
  },
  calendarDaySelected: {
    backgroundColor: "#137F86",
  },
  calendarDayText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#103C4A",
  },
  calendarDayTextSelected: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  calendarFooter: {
    marginTop: 24,
    alignItems: "center",
  },
  calendarCloseButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#F1F5F9",
    borderRadius: 16,
  },
  calendarCloseButtonText: {
    color: "#475569",
    fontWeight: "800",
    fontSize: 15,
  },
  inlineForm: {
    marginTop: 20,
    gap: 12,
    padding: 20,
    backgroundColor: "#F8FAFB",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#EEF2F6",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 12,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: "#103C4A",
  },
  switchDescription: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
    lineHeight: 18,
  },
  toggleButton: {
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#E2E8F0",
    padding: 3,
  },
  toggleButtonActive: {
    backgroundColor: "#137F86",
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleKnobActive: {
    transform: [{ translateX: 22 }],
  },
  debtBreakdownBox: {
    backgroundColor: "#F8FAFB",
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#EEF2F6",
  },
  debtBreakdownTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#496973",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  debtBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F6",
  },
  debtBreakdownTextArea: {
    flex: 1,
    gap: 4,
  },
  debtBreakdownName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#103C4A",
  },
  debtBreakdownMeta: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  debtBreakdownAmount: {
    fontSize: 15,
    fontWeight: "900",
  },
  globalBreakdownItem: {
    backgroundColor: "#F8FAFB",
    borderRadius: 22,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EEF2F6",
  },
  groupBreakdownList: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F6",
    gap: 8,
  },
  groupBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  groupBreakdownName: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  groupBreakdownAmount: {
    fontSize: 13,
    fontWeight: "800",
  },
  recurrenceSection: {
    gap: 16,
    padding: 20,
    backgroundColor: "rgba(19, 127, 134, 0.04)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(19, 127, 134, 0.15)",
    marginTop: 8,
  },
  helperText: {
    fontSize: 12,
    color: "#64748B",
    fontStyle: "italic",
    lineHeight: 18,
  },
  checkboxRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  checkboxTickSmall: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
  checkboxLabelSmall: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
});

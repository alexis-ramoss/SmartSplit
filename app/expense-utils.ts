export type ParticipantInput = {
  name: string;
  selected: boolean;
  percentage: string;
};

export type ExpenseInput = {
  name: string;
  amount: string;
  date: string;
  payer: string;
  participants: ParticipantInput[];
};

export type ExpenseSplit = {
  name: string;
  percentage: number;
};

export type ExpenseEntry = {
  id: string;
  groupId?: string;
  name: string;
  amount: number;
  date: string;
  payer: string;
  participants: ExpenseSplit[];
  createdAt: string;
};

export type MemberBalance = {
  name: string;
  balance: number;
};

export type SettlementSuggestion = {
  from: string;
  to: string;
  amount: number;
};

function isValidDate(date: string): boolean {
  const match = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return false;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

function getSelectedParticipants(participants: ParticipantInput[]) {
  return participants
    .filter((participant) => participant.selected)
    .map((participant) => ({
      name: participant.name,
      percentage: Number(participant.percentage),
    }));
}

export function validateExpenseInput(input: ExpenseInput): string | null {
  if (!input.name.trim()) {
    return "Please enter an expense name.";
  }

  const amount = Number(input.amount);
  if (input.amount.trim().length === 0 || Number.isNaN(amount) || amount <= 0) {
    return "Please enter a valid expense amount.";
  }

  if (!isValidDate(input.date.trim())) {
    return "Please enter a valid expense date.";
  }

  if (!input.payer.trim()) {
    return "Please enter who paid for the expense.";
  }

  const selectedParticipants = getSelectedParticipants(input.participants);
  if (selectedParticipants.length === 0) {
    return "Select at least one participant.";
  }

  const hasInvalidWeight = selectedParticipants.some(
    (participant) => Number.isNaN(participant.percentage) || participant.percentage <= 0
  );
  if (hasInvalidWeight) {
    return "Participant percentages must total 100%.";
  }

  const totalPercentage = selectedParticipants.reduce(
    (sum, participant) => sum + participant.percentage,
    0
  );
  if (Math.abs(totalPercentage - 100) > 0.01) {
    return "Participant percentages must total 100%.";
  }

  return null;
}

export function createExpenseEntry(input: ExpenseInput): {
  expense: ExpenseEntry | null;
  error: string | null;
} {
  const error = validateExpenseInput(input);

  if (error) {
    return { expense: null, error };
  }

  const selectedParticipants = getSelectedParticipants(input.participants);

  return {
    expense: {
      id: `${Date.now()}`,
      name: input.name.trim(),
      amount: Number(input.amount),
      date: input.date.trim(),
      payer: input.payer.trim(),
      participants: selectedParticipants,
      createdAt: new Date().toISOString(),
    },
    error: null,
  };
}

export function calculateMemberBalances(
  expenses: ExpenseEntry[],
  members: string[]
): MemberBalance[] {
  const balances = members.reduce<Record<string, number>>((current, member) => {
    current[member] = 0;
    return current;
  }, {});

  expenses.forEach((expense) => {
    balances[expense.payer] = (balances[expense.payer] || 0) + expense.amount;

    expense.participants.forEach((participant) => {
      const share = expense.amount * (participant.percentage / 100);
      balances[participant.name] = (balances[participant.name] || 0) - share;
    });
  });

  return Object.entries(balances).map(([name, balance]) => ({
    name,
    balance: roundCurrency(balance),
  }));
}

export function calculateSettlementSuggestions(
  balances: MemberBalance[]
): SettlementSuggestion[] {
  const debtors = balances
    .filter((balance) => balance.balance < -0.01)
    .map((balance) => ({ name: balance.name, amount: Math.abs(balance.balance) }));
  const creditors = balances
    .filter((balance) => balance.balance > 0.01)
    .map((balance) => ({ name: balance.name, amount: balance.balance }));
  const suggestions: SettlementSuggestion[] = [];

  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.amount, creditor.amount);

    suggestions.push({
      from: debtor.name,
      to: creditor.name,
      amount: roundCurrency(amount),
    });

    debtor.amount = roundCurrency(debtor.amount - amount);
    creditor.amount = roundCurrency(creditor.amount - amount);

    if (debtor.amount <= 0.01) {
      debtorIndex += 1;
    }

    if (creditor.amount <= 0.01) {
      creditorIndex += 1;
    }
  }

  return suggestions;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

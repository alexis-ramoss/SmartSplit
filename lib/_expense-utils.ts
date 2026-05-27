export type ParticipantInput = { name: string; selected: boolean; percentage: string };
export type RecurrenceFrequency = 'Daily' | 'Weekly' | 'Monthly';

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  every: number;
  startDate: string;
  endDate?: string;
  active: boolean;
  nextRunDate: string | null;
  lastGeneratedAt?: string;
  stoppedAt?: string;
};

export type RecurrenceInput = {
  enabled: boolean;
  frequency: RecurrenceFrequency;
  every: string;
  startDate: string;
  endDate?: string;
};

export type ExpenseEntry = {
  id: string;
  groupId: string;
  name: string;
  amount: number;
  date: string;
  payer: string;
  participants: { name: string; percentage: number }[];
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
  recurrence?: RecurrenceRule | null;
  recurringSourceId?: string | null;
};

export function parseDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split('/').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function getNextRunDate(currentRunDate: string, frequency: RecurrenceFrequency, every: number): string {
  const date = parseDate(currentRunDate);
  if (frequency === 'Daily') {
    date.setDate(date.getDate() + every);
  } else if (frequency === 'Weekly') {
    date.setDate(date.getDate() + 7 * every);
  } else if (frequency === 'Monthly') {
    date.setMonth(date.getMonth() + every);
  }
  return formatDate(date);
}

export function generateRecurringExpenseInstance(sourceExpense: ExpenseEntry, runDate: string): ExpenseEntry {
  return {
    ...sourceExpense,
    id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    date: runDate,
    createdAt: new Date().toISOString(),
    recurrence: null,
    recurringSourceId: sourceExpense.id,
  };
}

export function generateDueRecurringExpenses(expenses: ExpenseEntry[], todayStr: string) {
  const generatedExpenses: ExpenseEntry[] = [];
  const updatedTemplates: ExpenseEntry[] = [];
  const today = parseDate(todayStr);

  expenses.forEach((expense) => {
    if (expense.recurrence && expense.recurrence.active && expense.recurrence.nextRunDate) {
      let nextRun = parseDate(expense.recurrence.nextRunDate);
      let currentTemplate = { ...expense, recurrence: { ...expense.recurrence } };
      let templateUpdated = false;

      while (nextRun <= today && currentTemplate.recurrence && currentTemplate.recurrence.active) {
        const instance = generateRecurringExpenseInstance(expense, formatDate(nextRun));
        generatedExpenses.push(instance);

        const nextRunStr = getNextRunDate(
          formatDate(nextRun),
          currentTemplate.recurrence.frequency,
          currentTemplate.recurrence.every
        );
        
        currentTemplate.recurrence.nextRunDate = nextRunStr;
        currentTemplate.recurrence.lastGeneratedAt = new Date().toISOString();

        if (currentTemplate.recurrence.endDate) {
          const endDate = parseDate(currentTemplate.recurrence.endDate);
          if (parseDate(nextRunStr) > endDate) {
            currentTemplate.recurrence.active = false;
            currentTemplate.recurrence.nextRunDate = null;
            currentTemplate.recurrence.stoppedAt = new Date().toISOString();
          }
        }

        nextRun = parseDate(currentTemplate.recurrence.nextRunDate || '');
        templateUpdated = true;
      }

      if (templateUpdated) {
        updatedTemplates.push(currentTemplate);
      }
    }
  });

  return { generatedExpenses, updatedTemplates };
}

export function stopRecurringExpense(expense: ExpenseEntry): ExpenseEntry {
  if (!expense.recurrence) return expense;
  return {
    ...expense,
    recurrence: {
      ...expense.recurrence,
      active: false,
      nextRunDate: null,
      stoppedAt: new Date().toISOString(),
    },
  };
}

export function updateRecurringExpenseTemplate(expense: ExpenseEntry, changes: Partial<ExpenseEntry>): ExpenseEntry {
  return {
    ...expense,
    ...changes,
    id: expense.id, // Ensure ID doesn't change
    recurrence: expense.recurrence ? { ...expense.recurrence, ...(changes.recurrence || {}) } : null,
  };
}

export function validateExpenseInput(input: {
  name: string;
  amount: string;
  date: string;
  payer: string;
  participants: ParticipantInput[];
}) {
  const amt = Number(input.amount);
  if (!input.amount || Number.isNaN(amt) || amt <= 0) return 'Please enter a valid expense amount.';

  const total = input.participants
    .filter((p) => p.selected)
    .reduce((sum, p) => sum + (Number(p.percentage) || 0), 0);

  if (total !== 100) return 'Participant percentages must total 100%.';

  return null;
}

export function createExpenseEntry(input: {
  name: string;
  amount: string;
  date: string;
  payer: string;
  participants: ParticipantInput[];
  userId: string;
  userName: string;
  recurrence?: RecurrenceInput;
}) {
  const error = validateExpenseInput(input);
  if (error) return { error, expense: null };

  const recurrenceRule: RecurrenceRule | null = input.recurrence?.enabled ? {
    frequency: input.recurrence.frequency,
    every: Number(input.recurrence.every) || 1,
    startDate: input.recurrence.startDate,
    endDate: input.recurrence.endDate || undefined,
    active: true,
    nextRunDate: input.recurrence.startDate,
  } : null;

  const expense: ExpenseEntry = {
    id: `exp-${Date.now()}`,
    groupId: 'home',
    name: input.name,
    amount: Number(input.amount),
    date: input.date,
    payer: input.payer,
    participants: input.participants
      .filter((p) => p.selected)
      .map((p) => ({ name: p.name, percentage: Number(p.percentage) || 0 })),
    createdAt: new Date().toISOString(),
    createdBy: input.userId,
    createdByName: input.userName,
    recurrence: recurrenceRule,
    recurringSourceId: null,
  };

  return { error: null, expense };
}

export function calculateMemberBalances(expenses: ExpenseEntry[], members: string[]) {
  const balances = members.map((m) => ({ name: m, balance: 0 }));

  expenses.forEach((e) => {
    const share = e.amount / e.participants.length;
    e.participants.forEach((p) => {
      const entry = balances.find((b) => b.name === p.name);
      if (entry) entry.balance -= share;
    });
    const payerEntry = balances.find((b) => b.name === e.payer);
    if (payerEntry) payerEntry.balance += e.amount;
  });

  return balances;
}

export function calculateSettlementSuggestions(balances: { name: string; balance: number }[]) {
  const debtors = balances.filter((b) => b.balance < -0.01).map((d) => ({ id: d.name, amt: -d.balance }));
  const creditors = balances.filter((b) => b.balance > 0.01).map((c) => ({ id: c.name, amt: c.balance }));
  const suggestions: Array<{ from: string; to: string; amount: number }> = [];

  let i = 0,
    j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const transfer = Math.min(d.amt, c.amt);
    suggestions.push({ from: d.id, to: c.id, amount: transfer });
    d.amt -= transfer;
    c.amt -= transfer;
    if (d.amt <= 0.01) i++;
    if (c.amt <= 0.01) j++;
  }

  return suggestions;
}

export function calculateDebtBreakdownForMember(expenses: ExpenseEntry[], memberId: string) {
  const breakdown: Array<{ id: string; expenseName: string; payer: string; amount: number; direction: 'plus' | 'minus' }> = [];

  expenses.forEach((e) => {
    const participant = e.participants.find((p) => p.name === memberId);
    if (e.payer === memberId) {
      breakdown.push({ id: e.id, expenseName: e.name, payer: e.payer, amount: e.amount * (participant ? participant.percentage / 100 : 1), direction: 'plus' });
    } else if (participant) {
      breakdown.push({ id: e.id, expenseName: e.name, payer: e.payer, amount: e.amount * (participant.percentage / 100), direction: 'minus' });
    }
  });

  return breakdown;
}

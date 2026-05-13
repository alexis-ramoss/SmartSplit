export type ParticipantInput = { name: string; selected: boolean; percentage: string };
export type ExpenseEntry = {
  id: string;
  groupId: string;
  name: string;
  amount: number;
  date: string;
  payer: string;
  participants: { name: string; percentage: number }[];
  createdAt: string;
};

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
}) {
  const error = validateExpenseInput(input);
  if (error) return { error, expense: null };

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

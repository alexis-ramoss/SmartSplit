import { type LoadedGroup } from "./_group-utils";

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
  createdBy: string;
  createdByName: string;
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
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
  userId: string;
  userName: string;
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
    createdBy: input.userId,
    createdByName: input.userName,
  };

  return { error: null, expense };
}

export function calculateMemberBalances(expenses: ExpenseEntry[], members: string[]) {
  const balances = members.map((m) => ({ name: m, balance: 0 }));

  expenses.forEach((e) => {
    e.participants.forEach((p) => {
      const entry = balances.find((b) => b.name === p.name);
      if (entry) {
        entry.balance -= e.amount * (p.percentage / 100);
      }
    });
    const payerEntry = balances.find((b) => b.name === e.payer);
    if (payerEntry) payerEntry.balance += e.amount;
  });

  return balances;
}

export function aggregateGlobalBalances(groups: LoadedGroup[], currentUserId: string) {
  const globalBalances: Record<string, { balance: number; groups: Record<string, number> }> = {};

  groups.forEach((group) => {
    const me = group.members.find((m) => m.userId === currentUserId);
    if (!me) return;

    const myNameInGroup = me.name;
    const groupBalances = calculateMemberBalances(group.expenses, group.members.map((m) => m.name));
    const suggestions = calculateSettlementSuggestions(groupBalances);

    suggestions.forEach((s) => {
      let otherPerson = "";
      let amount = 0;

      if (s.from === myNameInGroup) {
        otherPerson = s.to;
        amount = -s.amount;
      } else if (s.to === myNameInGroup) {
        otherPerson = s.from;
        amount = s.amount;
      }

      if (otherPerson) {
        if (!globalBalances[otherPerson]) {
          globalBalances[otherPerson] = { balance: 0, groups: {} };
        }
        globalBalances[otherPerson].balance += amount;
        globalBalances[otherPerson].groups[group.name] = (globalBalances[otherPerson].groups[group.name] || 0) + amount;
      }
    });
  });

  const breakdown = Object.entries(globalBalances)
    .map(([name, data]) => ({
      name,
      balance: data.balance,
      groups: Object.entries(data.groups)
        .map(([groupName, groupBalance]) => ({ groupName, balance: groupBalance }))
        .filter((g) => Math.abs(g.balance) > 0.01)
    }))
    .filter((b) => Math.abs(b.balance) > 0.01);

  const totalOwed = breakdown.filter((b) => b.balance < 0).reduce((sum, b) => sum - b.balance, 0);
  const totalReceivable = breakdown.filter((b) => b.balance > 0).reduce((sum, b) => sum + b.balance, 0);

  return { totalOwed, totalReceivable, breakdown };
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

import type {
  Account,
  AccountId,
  Budget,
  Category,
  ReportPeriodMode,
  SavingsEntry,
  SavingsGoal,
  Transaction,
} from '../types/finance';
import { MONTH_NAMES_ID, MONTH_SHORT_ID, toSafeRupiah } from '../utils/format';

export interface AccountBalances {
  suami: number;
  istri: number;
  keluarga: number;
  total: number;
}

export interface AccountSummary {
  accountId: AccountId;
  income: number;
  expense: number;
  transferIn: number;
  transferOut: number;
  balance: number;
  transactionCount: number;
}

export interface CombinedSummary {
  totalIncome: number;
  totalExpense: number;
  surplus: number;
  totalTransfers: number;
  suamiContribution: number;
  istriContribution: number;
  totalFamilyContribution: number;
  /** Total funds entering Kas Keluarga (contributions + direct family income) */
  totalFamilyInflow: number;
}

export interface ContributionSummary {
  suamiTotal: number;
  istriTotal: number;
  combinedTotal: number;
  suamiPercent: number;
  istriPercent: number;
  entries: Transaction[];
}

export interface MonthlyContributionRow {
  month: number;
  monthName: string;
  monthShort: string;
  suami: number;
  istri: number;
  total: number;
}

export interface MonthlyChartPoint {
  month: number;
  monthName: string;
  monthShort: string;
  income: number;
  expense: number;
  surplus: number;
  endingBalance: number;
  suamiBalance: number;
  istriBalance: number;
  keluargaBalance: number;
  suamiContribution: number;
  istriContribution: number;
}

export interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface BudgetStatusRow {
  budget: Budget;
  categoryName: string;
  limitAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentage: number;
  status: 'aman' | 'hampir_habis' | 'terlampaui';
}

export interface SavingsGoalProgress {
  goal: SavingsGoal;
  collectedAmount: number;
  remainingAmount: number;
  percentage: number;
  entries: SavingsEntry[];
}

export function getAccountDisplayName(accounts: Account[], accountId?: AccountId): string {
  if (!accountId) return '-';
  return accounts.find((a) => a.id === accountId)?.displayName ?? accountId;
}

export function getCategoryName(categories: Category[], categoryId?: string): string {
  if (!categoryId) return 'Tanpa Kategori';
  return categories.find((c) => c.id === categoryId)?.name ?? 'Kategori Dihapus';
}

/**
 * Deterministically computes exact balances for all 3 accounts from transaction history.
 * - Income adds to accountId
 * - Expense subtracts from accountId
 * - Transfer subtracts from fromAccountId and adds to toAccountId
 * Total family balance = suami + istri + keluarga (invariant under transfers!)
 */
export function calculateAccountBalances(transactions: Transaction[]): AccountBalances {
  let suami = 0;
  let istri = 0;
  let keluarga = 0;

  const applyDelta = (id: AccountId | undefined, delta: number) => {
    if (id === 'suami') suami += delta;
    else if (id === 'istri') istri += delta;
    else if (id === 'keluarga') keluarga += delta;
  };

  for (const tx of transactions) {
    const amt = toSafeRupiah(tx.amount);
    if (amt <= 0) continue;

    if (tx.type === 'income') {
      applyDelta(tx.accountId, amt);
    } else if (tx.type === 'expense') {
      applyDelta(tx.accountId, -amt);
    } else if (tx.type === 'transfer') {
      applyDelta(tx.fromAccountId, -amt);
      applyDelta(tx.toAccountId, amt);
    }
  }

  return {
    suami,
    istri,
    keluarga,
    total: suami + istri + keluarga,
  };
}

export function calculateAccountSummaries(transactions: Transaction[]): Record<AccountId, AccountSummary> {
  const init = (accountId: AccountId): AccountSummary => ({
    accountId,
    income: 0,
    expense: 0,
    transferIn: 0,
    transferOut: 0,
    balance: 0,
    transactionCount: 0,
  });

  const summaries: Record<AccountId, AccountSummary> = {
    suami: init('suami'),
    istri: init('istri'),
    keluarga: init('keluarga'),
  };

  for (const tx of transactions) {
    const amt = toSafeRupiah(tx.amount);
    if (amt <= 0) continue;

    if (tx.type === 'income' && tx.accountId) {
      summaries[tx.accountId].income += amt;
      summaries[tx.accountId].balance += amt;
      summaries[tx.accountId].transactionCount += 1;
    } else if (tx.type === 'expense' && tx.accountId) {
      summaries[tx.accountId].expense += amt;
      summaries[tx.accountId].balance -= amt;
      summaries[tx.accountId].transactionCount += 1;
    } else if (tx.type === 'transfer') {
      if (tx.fromAccountId) {
        summaries[tx.fromAccountId].transferOut += amt;
        summaries[tx.fromAccountId].balance -= amt;
        summaries[tx.fromAccountId].transactionCount += 1;
      }
      if (tx.toAccountId) {
        summaries[tx.toAccountId].transferIn += amt;
        summaries[tx.toAccountId].balance += amt;
        summaries[tx.toAccountId].transactionCount += 1;
      }
    }
  }

  return summaries;
}

/**
 * Computes combined financial summary for a given slice of transactions.
 * CRITICAL RULE: Transfers are NEVER counted as combined income or combined expense!
 */
export function calculateCombinedSummary(transactions: Transaction[]): CombinedSummary {
  let totalIncome = 0;
  let totalExpense = 0;
  let totalTransfers = 0;
  let suamiContribution = 0;
  let istriContribution = 0;
  let directFamilyIncome = 0;

  for (const tx of transactions) {
    const amt = toSafeRupiah(tx.amount);
    if (amt <= 0) continue;

    if (tx.type === 'income') {
      totalIncome += amt;
      if (tx.accountId === 'keluarga') {
        directFamilyIncome += amt;
      }
    } else if (tx.type === 'expense') {
      totalExpense += amt;
    } else if (tx.type === 'transfer') {
      totalTransfers += amt;
      if (tx.toAccountId === 'keluarga' && tx.fromAccountId === 'suami') {
        suamiContribution += amt;
      } else if (tx.toAccountId === 'keluarga' && tx.fromAccountId === 'istri') {
        istriContribution += amt;
      }
    }
  }

  const totalFamilyContribution = suamiContribution + istriContribution;

  return {
    totalIncome,
    totalExpense,
    surplus: totalIncome - totalExpense,
    totalTransfers,
    suamiContribution,
    istriContribution,
    totalFamilyContribution,
    totalFamilyInflow: totalFamilyContribution + directFamilyIncome,
  };
}

export function filterTransactionsByMonth(
  transactions: Transaction[],
  year: number,
  month: number
): Transaction[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return transactions.filter((tx) => tx.date.startsWith(prefix));
}

export function filterTransactionsByYear(transactions: Transaction[], year: number): Transaction[] {
  const prefix = `${year}-`;
  return transactions.filter((tx) => tx.date.startsWith(prefix));
}

export function getPeriodDateRange(
  mode: ReportPeriodMode,
  anchorDate: string,
  customStart?: string,
  customEnd?: string
): { start: string; end: string; label: string } {
  const [yStr, mStr, dStr] = anchorDate.split('-');
  const y = Number(yStr) || new Date().getFullYear();
  const m = Number(mStr) || new Date().getMonth() + 1;
  const d = Number(dStr) || new Date().getDate();

  if (mode === 'daily') {
    return { start: anchorDate, end: anchorDate, label: `Harian (${anchorDate})` };
  }

  if (mode === 'weekly') {
    const dt = new Date(y, m - 1, d);
    const dayOfWeek = dt.getDay(); // 0=Sun
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(dt);
    monday.setDate(dt.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const toISO = (x: Date) =>
      `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    const start = toISO(monday);
    const end = toISO(sunday);
    return { start, end, label: `Mingguan (${start} s.d. ${end})` };
  }

  if (mode === 'monthly') {
    const lastDay = new Date(y, m, 0).getDate();
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start, end, label: `${MONTH_NAMES_ID[m - 1]} ${y}` };
  }

  if (mode === 'yearly') {
    return { start: `${y}-01-01`, end: `${y}-12-31`, label: `Tahun ${y}` };
  }

  const start = customStart || `${y}-${String(m).padStart(2, '0')}-01`;
  const end = customEnd || anchorDate;
  return {
    start: start <= end ? start : end,
    end: start <= end ? end : start,
    label: `Rentang Khusus (${start} s.d. ${end})`,
  };
}

export function filterTransactionsByDateRange(
  transactions: Transaction[],
  start: string,
  end: string
): Transaction[] {
  return transactions.filter((tx) => tx.date >= start && tx.date <= end);
}

/**
 * Calculates husband & wife contributions into Kas Keluarga.
 * Percentages are computed strictly from total contributions in the period (never from total personal income).
 */
export function calculateContributionSummary(transactions: Transaction[]): ContributionSummary {
  const entries = transactions
    .filter(
      (tx) =>
        tx.type === 'transfer' &&
        tx.toAccountId === 'keluarga' &&
        (tx.fromAccountId === 'suami' || tx.fromAccountId === 'istri')
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  let suamiTotal = 0;
  let istriTotal = 0;

  for (const tx of entries) {
    const amt = toSafeRupiah(tx.amount);
    if (tx.fromAccountId === 'suami') suamiTotal += amt;
    if (tx.fromAccountId === 'istri') istriTotal += amt;
  }

  const combinedTotal = suamiTotal + istriTotal;
  const suamiPercent = combinedTotal > 0 ? (suamiTotal / combinedTotal) * 100 : 0;
  const istriPercent = combinedTotal > 0 ? (istriTotal / combinedTotal) * 100 : 0;

  return {
    suamiTotal,
    istriTotal,
    combinedTotal,
    suamiPercent,
    istriPercent,
    entries,
  };
}

export function calculateMonthlyContributions(
  transactions: Transaction[],
  year: number
): MonthlyContributionRow[] {
  const rows: MonthlyContributionRow[] = MONTH_NAMES_ID.map((name, idx) => ({
    month: idx + 1,
    monthName: name,
    monthShort: MONTH_SHORT_ID[idx],
    suami: 0,
    istri: 0,
    total: 0,
  }));

  const yearPrefix = `${year}-`;
  for (const tx of transactions) {
    if (
      tx.type !== 'transfer' ||
      tx.toAccountId !== 'keluarga' ||
      !tx.date.startsWith(yearPrefix)
    ) {
      continue;
    }
    const monthIdx = Number(tx.date.slice(5, 7)) - 1;
    if (monthIdx < 0 || monthIdx > 11) continue;
    const amt = toSafeRupiah(tx.amount);
    if (tx.fromAccountId === 'suami') {
      rows[monthIdx].suami += amt;
      rows[monthIdx].total += amt;
    } else if (tx.fromAccountId === 'istri') {
      rows[monthIdx].istri += amt;
      rows[monthIdx].total += amt;
    }
  }

  return rows;
}

/**
 * Builds 12-month series for a given year:
 * - Income vs Expense per month (excluding transfers)
 * - Cumulative ending balance per month (starting from all transactions strictly before Jan 1 of year)
 * - Monthly contributions (Suami vs Istri)
 */
export function calculateYearlyMonthlySeries(
  allTransactions: Transaction[],
  year: number
): MonthlyChartPoint[] {
  const yearStart = `${year}-01-01`;
  const priorTransactions = allTransactions.filter((tx) => tx.date < yearStart);
  const openingBalances = calculateAccountBalances(priorTransactions);

  let runningSuami = openingBalances.suami;
  let runningIstri = openingBalances.istri;
  let runningKeluarga = openingBalances.keluarga;

  const points: MonthlyChartPoint[] = [];

  for (let m = 1; m <= 12; m++) {
    const monthTxs = filterTransactionsByMonth(allTransactions, year, m);
    const summary = calculateCombinedSummary(monthTxs);
    const monthBalances = calculateAccountBalances(monthTxs);

    runningSuami += monthBalances.suami;
    runningIstri += monthBalances.istri;
    runningKeluarga += monthBalances.keluarga;

    points.push({
      month: m,
      monthName: MONTH_NAMES_ID[m - 1],
      monthShort: MONTH_SHORT_ID[m - 1],
      income: summary.totalIncome,
      expense: summary.totalExpense,
      surplus: summary.surplus,
      endingBalance: runningSuami + runningIstri + runningKeluarga,
      suamiBalance: runningSuami,
      istriBalance: runningIstri,
      keluargaBalance: runningKeluarga,
      suamiContribution: summary.suamiContribution,
      istriContribution: summary.istriContribution,
    });
  }

  return points;
}

export function calculateExpenseByCategory(
  transactions: Transaction[],
  categories: Category[]
): CategoryBreakdownItem[] {
  const map = new Map<string, { amount: number; count: number }>();
  let totalExpense = 0;

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const amt = toSafeRupiah(tx.amount);
    if (amt <= 0) continue;
    totalExpense += amt;
    const key = tx.categoryId || 'uncategorized';
    const prev = map.get(key) ?? { amount: 0, count: 0 };
    map.set(key, { amount: prev.amount + amt, count: prev.count + 1 });
  }

  const items: CategoryBreakdownItem[] = [];
  for (const [categoryId, info] of map.entries()) {
    items.push({
      categoryId,
      categoryName: getCategoryName(categories, categoryId),
      amount: info.amount,
      percentage: totalExpense > 0 ? (info.amount / totalExpense) * 100 : 0,
      count: info.count,
    });
  }

  return items.sort((a, b) => b.amount - a.amount);
}

export function calculateBudgetStatuses(
  budgets: Budget[],
  transactions: Transaction[],
  categories: Category[],
  year: number,
  month: number
): BudgetStatusRow[] {
  const periodBudgets = budgets.filter((b) => b.year === year && b.month === month);
  const monthTxs = filterTransactionsByMonth(transactions, year, month);

  const spentByCategory = new Map<string, number>();
  for (const tx of monthTxs) {
    if (tx.type !== 'expense' || !tx.categoryId) continue;
    const amt = toSafeRupiah(tx.amount);
    spentByCategory.set(tx.categoryId, (spentByCategory.get(tx.categoryId) ?? 0) + amt);
  }

  return periodBudgets
    .map((budget) => {
      const limitAmount = toSafeRupiah(budget.limitAmount);
      const spentAmount = spentByCategory.get(budget.categoryId) ?? 0;
      const remainingAmount = limitAmount - spentAmount;
      const percentage = limitAmount > 0 ? (spentAmount / limitAmount) * 100 : 0;
      let status: BudgetStatusRow['status'] = 'aman';
      if (spentAmount > limitAmount) {
        status = 'terlampaui';
      } else if (percentage >= 80) {
        status = 'hampir_habis';
      }

      return {
        budget,
        categoryName: getCategoryName(categories, budget.categoryId),
        limitAmount,
        spentAmount,
        remainingAmount,
        percentage,
        status,
      };
    })
    .sort((a, b) => b.percentage - a.percentage);
}

export function calculateSavingsProgress(
  goals: SavingsGoal[],
  entries: SavingsEntry[]
): SavingsGoalProgress[] {
  return goals.map((goal) => {
    const goalEntries = entries
      .filter((e) => e.goalId === goal.id)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

    const collectedAmount = goalEntries.reduce((sum, e) => sum + toSafeRupiah(e.amount), 0);
    const targetAmount = toSafeRupiah(goal.targetAmount);
    const remainingAmount = Math.max(0, targetAmount - collectedAmount);
    const percentage = targetAmount > 0 ? Math.min(100, (collectedAmount / targetAmount) * 100) : 0;

    return {
      goal,
      collectedAmount,
      remainingAmount,
      percentage,
      entries: goalEntries,
    };
  });
}

export function getAvailableYears(transactions: Transaction[], budgets: Budget[]): number[] {
  const years = new Set<number>([new Date().getFullYear()]);
  for (const tx of transactions) {
    const y = Number(tx.date.slice(0, 4));
    if (y >= 2000 && y <= 2100) years.add(y);
  }
  for (const b of budgets) {
    if (b.year >= 2000 && b.year <= 2100) years.add(b.year);
  }
  return Array.from(years).sort((a, b) => b - a);
}

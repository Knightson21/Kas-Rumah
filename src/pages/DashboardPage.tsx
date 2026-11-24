import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, Download } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { useFinance } from '../context/FinanceContext';
import {
  calculateAccountBalances,
  calculateCombinedSummary,
  calculateExpenseByCategory,
  calculateYearlyMonthlySeries,
  filterTransactionsByMonth,
  getAccountDisplayName,
  getAvailableYears,
  getCategoryName,
} from '../engine/calculations';
import type { NavSection } from '../types/finance';
import { exportFinanceToExcel } from '../utils/exportExcel';
import {
  formatCompactRupiah,
  formatDateID,
  formatMonthYearID,
  formatPercent,
  formatRupiah,
  formatRupiahSigned,
  getCurrentYearMonth,
  MONTH_NAMES_ID,
} from '../utils/format';

const CATEGORY_COLORS = [
  '#1D3E5E',
  '#B68D40',
  '#1F6E4A',
  '#7C5A3C',
  '#4A6B8A',
  '#9C7A3C',
  '#5A7D6C',
  '#8C857B',
];

interface DashboardPageProps {
  onNavigate: (section: NavSection) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { state, openAddTxModal, pushToast } = useFinance();
  const initial = getCurrentYearMonth();
  const [selectedYear, setSelectedYear] = useState<number>(initial.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(initial.month);

  const availableYears = useMemo(
    () => (state ? getAvailableYears(state.transactions, state.budgets) : [initial.year]),
    [state, initial.year]
  );

  const balances = useMemo(
    () => (state ? calculateAccountBalances(state.transactions) : { suami: 0, istri: 0, keluarga: 0, total: 0 }),
    [state]
  );

  const monthTransactions = useMemo(
    () => (state ? filterTransactionsByMonth(state.transactions, selectedYear, selectedMonth) : []),
    [state, selectedYear, selectedMonth]
  );

  const monthlySummary = useMemo(
    () => calculateCombinedSummary(monthTransactions),
    [monthTransactions]
  );

  const yearlySeries = useMemo(
    () => (state ? calculateYearlyMonthlySeries(state.transactions, selectedYear) : []),
    [state, selectedYear]
  );

  const expenseCategories = useMemo(
    () => (state ? calculateExpenseByCategory(monthTransactions, state.categories) : []),
    [state, monthTransactions]
  );

  const recentMonthTransactions = useMemo(
    () =>
      [...monthTransactions]
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
        .slice(0, 6),
    [monthTransactions]
  );

  if (!state) return null;

  const suamiName = getAccountDisplayName(state.accounts, 'suami');
  const istriName = getAccountDisplayName(state.accounts, 'istri');
  const keluargaName = getAccountDisplayName(state.accounts, 'keluarga');

  const hasAnyTransactions = state.transactions.length > 0;
  const hasYearlyActivity = yearlySeries.some(
    (p) => p.income > 0 || p.expense > 0 || p.suamiContribution > 0 || p.istriContribution > 0
  );

  const handleExportExcel = () => {
    exportFinanceToExcel(state, {
      year: selectedYear,
      month: selectedMonth,
      periodLabel: formatMonthYearID(selectedYear, selectedMonth),
    });
    pushToast('Laporan Excel (.xlsx) berhasil diunduh.');
  };

  return (
    <div className="space-y-8">
      {/* Period Filter & Export Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-[#6B655D]">
            Ringkasan kondisi keuangan periode{' '}
            <span className="font-medium text-[#1C1917]">
              {formatMonthYearID(selectedYear, selectedMonth)}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Filter bulan"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-sm text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
          >
            {MONTH_NAMES_ID.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter tahun"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="font-num rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-sm text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-[#E5E0D5] bg-white px-3.5 py-2 text-sm font-medium text-[#1C1917] transition-colors hover:bg-[#EFECE4]"
          >
            <Download className="h-4 w-4 text-[#1D3E5E]" />
            <span>Ekspor Excel</span>
          </button>
        </div>
      </div>

      {/* Ringkasan Saldo 4 Kolom */}
      <section aria-label="Ringkasan Saldo Akun">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-[#E5E0D5] bg-white p-5">
            <p className="text-xs font-medium text-[#6B655D]">{suamiName}</p>
            <p className="font-num mt-2 text-2xl font-semibold tracking-tight text-[#1C1917]">
              {formatRupiah(balances.suami)}
            </p>
            <p className="mt-2 text-xs text-[#6B655D]">Saldo aktif saat ini</p>
          </div>

          <div className="rounded-lg border border-[#E5E0D5] bg-white p-5">
            <p className="text-xs font-medium text-[#6B655D]">{istriName}</p>
            <p className="font-num mt-2 text-2xl font-semibold tracking-tight text-[#1C1917]">
              {formatRupiah(balances.istri)}
            </p>
            <p className="mt-2 text-xs text-[#6B655D]">Saldo aktif saat ini</p>
          </div>

          <div className="rounded-lg border border-[#E5E0D5] bg-white p-5">
            <p className="text-xs font-medium text-[#6B655D]">{keluargaName}</p>
            <p className="font-num mt-2 text-2xl font-semibold tracking-tight text-[#1C1917]">
              {formatRupiah(balances.keluarga)}
            </p>
            <p className="mt-2 text-xs text-[#6B655D]">Kas bersama rumah tangga</p>
          </div>

          {/* Dominant Focal Anchor: Total Seluruh Akun */}
          <div className="rounded-lg border border-[#1D3E5E] bg-[#1D3E5E] p-5 text-white">
            <p className="text-xs font-medium text-[#EFECE4]/80">Total Saldo Seluruh Akun</p>
            <p className="font-num mt-2 text-2xl font-semibold tracking-tight text-white">
              {formatRupiah(balances.total)}
            </p>
            <p className="mt-2 text-xs text-[#B68D40]">
              Gabungan tiga kas keluarga
            </p>
          </div>
        </div>
      </section>

      {/* Ringkasan Bulanan (Single flat structured grid with hairline dividers) */}
      <section aria-label="Ringkasan Bulanan" className="rounded-lg border border-[#E5E0D5] bg-white">
        <div className="flex items-center justify-between border-b border-[#E5E0D5] px-6 py-4">
          <h2 className="font-display text-base font-semibold text-[#1C1917]">
            Ringkasan {formatMonthYearID(selectedYear, selectedMonth)}
          </h2>
          <span className="text-xs text-[#6B655D]">
            Transfer antar-akun tidak dihitung ganda
          </span>
        </div>

        <div className="grid grid-cols-1 divide-y divide-[#E5E0D5] sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
          <div className="border-b border-[#E5E0D5] p-5 sm:border-r lg:border-b">
            <p className="text-xs text-[#6B655D]">Total Pemasukan</p>
            <p className="font-num mt-1.5 text-xl font-semibold text-[#1F6E4A]">
              {formatRupiah(monthlySummary.totalIncome)}
            </p>
          </div>

          <div className="border-b border-[#E5E0D5] p-5 lg:border-r">
            <p className="text-xs text-[#6B655D]">Total Pengeluaran</p>
            <p className="font-num mt-1.5 text-xl font-semibold text-[#B42318]">
              {formatRupiah(monthlySummary.totalExpense)}
            </p>
          </div>

          <div className="border-b border-[#E5E0D5] p-5 sm:border-r lg:border-r-0">
            <p className="text-xs text-[#6B655D]">
              Sisa Bulanan ({monthlySummary.surplus >= 0 ? 'Surplus' : 'Defisit'})
            </p>
            <p
              className={`font-num mt-1.5 text-xl font-semibold ${
                monthlySummary.surplus >= 0 ? 'text-[#1F6E4A]' : 'text-[#B42318]'
              }`}
            >
              {formatRupiahSigned(monthlySummary.surplus)}
            </p>
          </div>

          <div className="border-b border-[#E5E0D5] p-5 sm:border-b-0 sm:border-r">
            <p className="text-xs text-[#6B655D]">Kontribusi {suamiName} ke {keluargaName}</p>
            <p className="font-num mt-1.5 text-lg font-semibold text-[#1D3E5E]">
              {formatRupiah(monthlySummary.suamiContribution)}
            </p>
          </div>

          <div className="border-b border-[#E5E0D5] p-5 sm:border-b-0 lg:border-r">
            <p className="text-xs text-[#6B655D]">Kontribusi {istriName} ke {keluargaName}</p>
            <p className="font-num mt-1.5 text-lg font-semibold text-[#B68D40]">
              {formatRupiah(monthlySummary.istriContribution)}
            </p>
          </div>

          <div className="p-5">
            <p className="text-xs text-[#6B655D]">Total Dana Masuk ke {keluargaName}</p>
            <p className="font-num mt-1.5 text-lg font-semibold text-[#1C1917]">
              {formatRupiah(monthlySummary.totalFamilyInflow)}
            </p>
          </div>
        </div>
      </section>

      {/* First-Time Empty Guide when database has zero transactions */}
      {!hasAnyTransactions ? (
        <section className="rounded-lg border border-[#E5E0D5] bg-white">
          <EmptyState
            title="Buku kas keluarga masih kosong"
            description="Mulai catat pemasukan pribadi, kontribusi ke kas keluarga, atau pengeluaran harian. Semua saldo dan grafik akan terhitung otomatis di perangkat ini."
            actionLabel="Catat Transaksi Pertama"
            onAction={() => openAddTxModal()}
          />
        </section>
      ) : (
        <>
          {/* 4 Charts Grid (2x2) */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2" aria-label="Visualisasi Keuangan">
            {/* Chart 1: Pemasukan & Pengeluaran per Bulan */}
            <div className="rounded-lg border border-[#E5E0D5] bg-white p-6">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-semibold text-[#1C1917]">
                    Pemasukan & Pengeluaran ({selectedYear})
                  </h2>
                  <p className="text-xs text-[#6B655D]">Perbandingan bulanan tanpa transfer internal</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#6B655D]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-[#1F6E4A]" /> Pemasukan
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-[#B42318]" /> Pengeluaran
                  </span>
                </div>
              </div>

              {hasYearlyActivity ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yearlySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EFECE4" vertical={false} />
                      <XAxis dataKey="monthShort" tick={{ fontSize: 11, fill: '#6B655D' }} axisLine={{ stroke: '#E5E0D5' }} tickLine={false} />
                      <YAxis tickFormatter={formatCompactRupiah} tick={{ fontSize: 11, fill: '#6B655D' }} axisLine={false} tickLine={false} width={72} />
                      <Tooltip
                        formatter={(value) => formatRupiah(Number(value ?? 0))}
                        contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E5E0D5', borderRadius: 6, fontSize: 12 }}
                      />
                      <Bar dataKey="income" name="Pemasukan" fill="#1F6E4A" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="expense" name="Pengeluaran" fill="#B42318" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  compact
                  title={`Belum ada transaksi di tahun ${selectedYear}`}
                  description="Pilih tahun lain atau catat transaksi baru untuk melihat grafik."
                />
              )}
            </div>

            {/* Chart 2: Perkembangan Saldo */}
            <div className="rounded-lg border border-[#E5E0D5] bg-white p-6">
              <div className="mb-4">
                <h2 className="font-display text-base font-semibold text-[#1C1917]">
                  Perkembangan Saldo ({selectedYear})
                </h2>
                <p className="text-xs text-[#6B655D]">Akumulasi total saldo ketiga akun per bulan</p>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={yearlySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="lapisArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1D3E5E" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#1D3E5E" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EFECE4" vertical={false} />
                    <XAxis dataKey="monthShort" tick={{ fontSize: 11, fill: '#6B655D' }} axisLine={{ stroke: '#E5E0D5' }} tickLine={false} />
                    <YAxis tickFormatter={formatCompactRupiah} tick={{ fontSize: 11, fill: '#6B655D' }} axisLine={false} tickLine={false} width={72} />
                    <Tooltip
                      formatter={(value) => formatRupiah(Number(value ?? 0))}
                      contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E5E0D5', borderRadius: 6, fontSize: 12 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="endingBalance"
                      name="Total Saldo"
                      stroke="#1D3E5E"
                      strokeWidth={2}
                      fill="url(#lapisArea)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Pengeluaran Berdasarkan Kategori */}
            <div className="rounded-lg border border-[#E5E0D5] bg-white p-6">
              <div className="mb-4">
                <h2 className="font-display text-base font-semibold text-[#1C1917]">
                  Pengeluaran per Kategori
                </h2>
                <p className="text-xs text-[#6B655D]">
                  Distribusi pengeluaran pada {formatMonthYearID(selectedYear, selectedMonth)}
                </p>
              </div>

              {expenseCategories.length > 0 ? (
                <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expenseCategories}
                          dataKey="amount"
                          nameKey="categoryName"
                          innerRadius={52}
                          outerRadius={84}
                          paddingAngle={2}
                        >
                          {expenseCategories.map((entry, idx) => (
                            <Cell
                              key={entry.categoryId}
                              fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => formatRupiah(Number(value ?? 0))}
                          contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E5E0D5', borderRadius: 6, fontSize: 12 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="max-h-56 space-y-2.5 overflow-y-auto pr-1">
                    {expenseCategories.slice(0, 7).map((item, idx) => (
                      <div key={item.categoryId} className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-xs"
                            style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                          />
                          <span className="truncate text-[#1C1917]">{item.categoryName}</span>
                        </div>
                        <div className="font-num shrink-0 text-right text-[#6B655D]">
                          <span className="font-medium text-[#1C1917]">{formatRupiah(item.amount)}</span>
                          <span className="ml-1.5 text-[11px]">{formatPercent(item.percentage)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState
                  compact
                  title="Belum ada pengeluaran bulan ini"
                  description={`Pengeluaran pada ${formatMonthYearID(selectedYear, selectedMonth)} akan muncul di sini berdasarkan kategori.`}
                />
              )}
            </div>

            {/* Chart 4: Kontribusi Suami & Istri ke Kas Keluarga */}
            <div className="rounded-lg border border-[#E5E0D5] bg-white p-6">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-semibold text-[#1C1917]">
                    Kontribusi ke {keluargaName} ({selectedYear})
                  </h2>
                  <p className="text-xs text-[#6B655D]">Transfer bulanan dari {suamiName} & {istriName}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#6B655D]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-[#1D3E5E]" /> {suamiName}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-[#B68D40]" /> {istriName}
                  </span>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearlySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EFECE4" vertical={false} />
                    <XAxis dataKey="monthShort" tick={{ fontSize: 11, fill: '#6B655D' }} axisLine={{ stroke: '#E5E0D5' }} tickLine={false} />
                    <YAxis tickFormatter={formatCompactRupiah} tick={{ fontSize: 11, fill: '#6B655D' }} axisLine={false} tickLine={false} width={72} />
                    <Tooltip
                      formatter={(value) => formatRupiah(Number(value ?? 0))}
                      contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E5E0D5', borderRadius: 6, fontSize: 12 }}
                    />
                    <Bar dataKey="suamiContribution" name={suamiName} fill="#1D3E5E" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="istriContribution" name={istriName} fill="#B68D40" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* Recent Transactions of Selected Month */}
          <section className="rounded-lg border border-[#E5E0D5] bg-white">
            <div className="flex items-center justify-between border-b border-[#E5E0D5] px-6 py-4">
              <h2 className="font-display text-base font-semibold text-[#1C1917]">
                Transaksi Terbaru ({formatMonthYearID(selectedYear, selectedMonth)})
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('transaksi')}
                className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-[#1D3E5E] hover:underline"
              >
                <span>Lihat semua transaksi</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {recentMonthTransactions.length === 0 ? (
              <EmptyState
                compact
                title={`Belum ada transaksi di ${formatMonthYearID(selectedYear, selectedMonth)}`}
                description="Catat transaksi baru atau pilih bulan lain pada filter di atas."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[#E5E0D5] bg-[#F7F5F0] text-xs font-medium text-[#6B655D]">
                    <tr>
                      <th className="px-6 py-3">Tanggal</th>
                      <th className="px-4 py-3">Keterangan</th>
                      <th className="px-4 py-3">Akun</th>
                      <th className="px-6 py-3 text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E0D5]">
                    {recentMonthTransactions.map((tx) => (
                      <tr key={tx.id} className="transition-colors hover:bg-[#F7F5F0]/60">
                        <td className="font-num whitespace-nowrap px-6 py-3 text-xs text-[#6B655D]">
                          {formatDateID(tx.date)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-[#1C1917]">{tx.description}</div>
                          <div className="text-xs text-[#6B655D]">
                            {tx.type === 'transfer'
                              ? 'Transfer Antar-Akun'
                              : getCategoryName(state.categories, tx.categoryId)}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-[#6B655D]">
                          {tx.type === 'transfer'
                            ? `${getAccountDisplayName(state.accounts, tx.fromAccountId)} → ${getAccountDisplayName(state.accounts, tx.toAccountId)}`
                            : getAccountDisplayName(state.accounts, tx.accountId)}
                        </td>
                        <td
                          className={`font-num whitespace-nowrap px-6 py-3 text-right font-medium ${
                            tx.type === 'income'
                              ? 'text-[#1F6E4A]'
                              : tx.type === 'expense'
                                ? 'text-[#B42318]'
                                : 'text-[#1D3E5E]'
                          }`}
                        >
                          {tx.type === 'income'
                            ? `+${formatRupiah(tx.amount)}`
                            : tx.type === 'expense'
                              ? `-${formatRupiah(tx.amount)}`
                              : formatRupiah(tx.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

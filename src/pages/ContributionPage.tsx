import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowLeftRight } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { useFinance } from '../context/FinanceContext';
import {
  calculateContributionSummary,
  calculateMonthlyContributions,
  filterTransactionsByMonth,
  filterTransactionsByYear,
  getAccountDisplayName,
  getAvailableYears,
} from '../engine/calculations';
import {
  formatCompactRupiah,
  formatDateID,
  formatMonthYearID,
  formatPercent,
  formatRupiah,
  getCurrentYearMonth,
  MONTH_NAMES_ID,
} from '../utils/format';

type ContributionFilterMode = 'monthly' | 'yearly' | 'all';

export const ContributionPage: React.FC = () => {
  const { state, openAddTxModal } = useFinance();
  const current = getCurrentYearMonth();

  const [mode, setMode] = useState<ContributionFilterMode>('yearly');
  const [selectedYear, setSelectedYear] = useState<number>(current.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(current.month);

  const availableYears = useMemo(
    () => (state ? getAvailableYears(state.transactions, state.budgets) : [current.year]),
    [state, current.year]
  );

  const periodTransactions = useMemo(() => {
    if (!state) return [];
    if (mode === 'monthly') {
      return filterTransactionsByMonth(state.transactions, selectedYear, selectedMonth);
    }
    if (mode === 'yearly') {
      return filterTransactionsByYear(state.transactions, selectedYear);
    }
    return state.transactions;
  }, [state, mode, selectedYear, selectedMonth]);

  const contribution = useMemo(
    () => calculateContributionSummary(periodTransactions),
    [periodTransactions]
  );

  const monthlyTable = useMemo(
    () => (state ? calculateMonthlyContributions(state.transactions, selectedYear) : []),
    [state, selectedYear]
  );

  if (!state) return null;

  const suamiName = getAccountDisplayName(state.accounts, 'suami');
  const istriName = getAccountDisplayName(state.accounts, 'istri');
  const keluargaName = getAccountDisplayName(state.accounts, 'keluarga');

  const periodLabel =
    mode === 'monthly'
      ? formatMonthYearID(selectedYear, selectedMonth)
      : mode === 'yearly'
        ? `Tahun ${selectedYear}`
        : 'Seluruh Periode';

  const hasMonthlyChartData = monthlyTable.some((r) => r.total > 0);

  return (
    <div className="space-y-8">
      {/* Period Controls & Quick Contribution CTA */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 rounded-md border border-[#E5E0D5] bg-[#EFECE4] p-1">
            {(
              [
                { id: 'monthly', label: 'Bulanan' },
                { id: 'yearly', label: 'Tahunan' },
                { id: 'all', label: 'Semua' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                className={`whitespace-nowrap rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === tab.id
                    ? 'bg-white text-[#1C1917] shadow-xs'
                    : 'text-[#6B655D] hover:text-[#1C1917]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {mode === 'monthly' && (
            <select
              aria-label="Pilih bulan kontribusi"
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
          )}

          {mode !== 'all' && (
            <select
              aria-label="Pilih tahun kontribusi"
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
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            openAddTxModal({
              type: 'transfer',
              fromAccountId: 'suami',
              toAccountId: 'keluarga',
            })
          }
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-[#1D3E5E] bg-white px-4 py-2 text-sm font-medium text-[#1D3E5E] transition-colors hover:bg-[#EFECE4]"
        >
          <ArrowLeftRight className="h-4 w-4" />
          <span>Catat Kontribusi</span>
        </button>
      </div>

      {/* Contribution Summary Cards (Neutral & Factual) */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-label="Ringkasan Kontribusi">
        <div className="rounded-lg border border-[#E5E0D5] bg-white p-6">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-medium text-[#6B655D]">Kontribusi {suamiName}</p>
            <span className="font-num text-xs font-semibold text-[#1D3E5E]">
              {formatPercent(contribution.suamiPercent)}
            </span>
          </div>
          <p className="font-num mt-2 text-2xl font-semibold text-[#1C1917]">
            {formatRupiah(contribution.suamiTotal)}
          </p>
          <p className="mt-2 text-xs text-[#6B655D]">Periode {periodLabel}</p>
        </div>

        <div className="rounded-lg border border-[#E5E0D5] bg-white p-6">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-medium text-[#6B655D]">Kontribusi {istriName}</p>
            <span className="font-num text-xs font-semibold text-[#B68D40]">
              {formatPercent(contribution.istriPercent)}
            </span>
          </div>
          <p className="font-num mt-2 text-2xl font-semibold text-[#1C1917]">
            {formatRupiah(contribution.istriTotal)}
          </p>
          <p className="mt-2 text-xs text-[#6B655D]">Periode {periodLabel}</p>
        </div>

        <div className="rounded-lg border border-[#E5E0D5] bg-white p-6">
          <p className="text-xs font-medium text-[#6B655D]">Total Kontribusi Gabungan</p>
          <p className="font-num mt-2 text-2xl font-semibold text-[#1D3E5E]">
            {formatRupiah(contribution.combinedTotal)}
          </p>
          <p className="mt-2 text-xs text-[#6B655D]">
            {contribution.entries.length} transfer masuk ke {keluargaName}
          </p>
        </div>
      </section>

      {/* Neutral Proportional Composition Bar */}
      <section className="rounded-lg border border-[#E5E0D5] bg-white p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-[#1C1917]">
            Proporsi Kontribusi Aktual ({periodLabel})
          </h2>
          <p className="text-xs text-[#6B655D]">
            Persentase dihitung dari total kontribusi ke {keluargaName} pada periode ini
          </p>
        </div>

        <div className="mt-4 h-3 w-full overflow-hidden rounded-sm bg-[#EFECE4]">
          {contribution.combinedTotal > 0 && (
            <div className="flex h-full w-full">
              <div
                style={{ width: `${contribution.suamiPercent}%` }}
                className="h-full bg-[#1D3E5E] transition-all"
                title={`${suamiName}: ${formatPercent(contribution.suamiPercent)}`}
              />
              <div
                style={{ width: `${contribution.istriPercent}%` }}
                className="h-full bg-[#B68D40] transition-all"
                title={`${istriName}: ${formatPercent(contribution.istriPercent)}`}
              />
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-4 text-xs text-[#6B655D]">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#1D3E5E]" />
            <span>
              {suamiName}:{' '}
              <strong className="font-num text-[#1C1917]">
                {formatRupiah(contribution.suamiTotal)} ({formatPercent(contribution.suamiPercent)})
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#B68D40]" />
            <span>
              {istriName}:{' '}
              <strong className="font-num text-[#1C1917]">
                {formatRupiah(contribution.istriTotal)} ({formatPercent(contribution.istriPercent)})
              </strong>
            </span>
          </div>
        </div>
      </section>

      {/* Monthly Chart & Monthly Breakdown Table */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-[#E5E0D5] bg-white p-6">
          <h2 className="font-display text-base font-semibold text-[#1C1917]">
            Grafik Kontribusi per Bulan ({selectedYear})
          </h2>
          <p className="mt-0.5 text-xs text-[#6B655D]">
            Perbandingan transfer bulanan ke {keluargaName}
          </p>

          {hasMonthlyChartData ? (
            <div className="mt-4 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTable} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFECE4" vertical={false} />
                  <XAxis dataKey="monthShort" tick={{ fontSize: 11, fill: '#6B655D' }} axisLine={{ stroke: '#E5E0D5' }} tickLine={false} />
                  <YAxis tickFormatter={formatCompactRupiah} tick={{ fontSize: 11, fill: '#6B655D' }} axisLine={false} tickLine={false} width={72} />
                  <Tooltip
                    formatter={(value) => formatRupiah(Number(value ?? 0))}
                    contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E5E0D5', borderRadius: 6, fontSize: 12 }}
                  />
                  <Bar dataKey="suami" name={suamiName} fill="#1D3E5E" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="istri" name={istriName} fill="#B68D40" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              compact
              title={`Belum ada kontribusi di tahun ${selectedYear}`}
              description="Catat transfer dari Kas Suami atau Kas Istri ke Kas Keluarga untuk melihat grafik."
            />
          )}
        </div>

        {/* Monthly Comparison Table */}
        <div className="rounded-lg border border-[#E5E0D5] bg-white">
          <div className="border-b border-[#E5E0D5] px-6 py-4">
            <h2 className="font-display text-base font-semibold text-[#1C1917]">
              Rekap Bulanan ({selectedYear})
            </h2>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 border-b border-[#E5E0D5] bg-[#F7F5F0] text-xs font-medium text-[#6B655D]">
                <tr>
                  <th className="px-6 py-2.5">Bulan</th>
                  <th className="px-3 py-2.5 text-right">{suamiName}</th>
                  <th className="px-3 py-2.5 text-right">{istriName}</th>
                  <th className="px-6 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E0D5]">
                {monthlyTable.map((row) => (
                  <tr key={row.month} className={row.total > 0 ? 'bg-white' : 'text-[#6B655D]/70'}>
                    <td className="px-6 py-2.5 text-xs font-medium text-[#1C1917]">
                      {row.monthName}
                    </td>
                    <td className="font-num px-3 py-2.5 text-right text-xs">
                      {formatRupiah(row.suami)}
                    </td>
                    <td className="font-num px-3 py-2.5 text-right text-xs">
                      {formatRupiah(row.istri)}
                    </td>
                    <td className="font-num px-6 py-2.5 text-right text-xs font-semibold text-[#1C1917]">
                      {formatRupiah(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Contribution Transfer History */}
      <section className="rounded-lg border border-[#E5E0D5] bg-white">
        <div className="border-b border-[#E5E0D5] px-6 py-4">
          <h2 className="font-display text-base font-semibold text-[#1C1917]">
            Riwayat Transfer ke {keluargaName} ({periodLabel})
          </h2>
        </div>

        {contribution.entries.length === 0 ? (
          <EmptyState
            compact
            title="Belum ada riwayat kontribusi pada periode ini"
            description="Gunakan fitur Transfer Antar-Akun dengan tujuan Kas Keluarga agar kontribusi tercatat otomatis."
            actionLabel="Catat Transfer Kontribusi"
            onAction={() =>
              openAddTxModal({
                type: 'transfer',
                fromAccountId: 'suami',
                toAccountId: 'keluarga',
              })
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E5E0D5] bg-[#F7F5F0] text-xs font-medium text-[#6B655D]">
                <tr>
                  <th className="px-6 py-3">Tanggal</th>
                  <th className="px-4 py-3">Dari Akun</th>
                  <th className="px-4 py-3">Keterangan</th>
                  <th className="px-6 py-3 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E0D5]">
                {contribution.entries.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#F7F5F0]/60">
                    <td className="font-num whitespace-nowrap px-6 py-3 text-xs text-[#6B655D]">
                      {formatDateID(tx.date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-[#1C1917]">
                      {getAccountDisplayName(state.accounts, tx.fromAccountId)}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6B655D]">
                      {tx.description}
                      {tx.notes ? ` · ${tx.notes}` : ''}
                    </td>
                    <td className="font-num whitespace-nowrap px-6 py-3 text-right font-medium text-[#1D3E5E]">
                      {formatRupiah(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

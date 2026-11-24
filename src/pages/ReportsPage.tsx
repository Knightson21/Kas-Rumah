import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { useFinance } from '../context/FinanceContext';
import {
  calculateAccountBalances,
  calculateAccountSummaries,
  calculateCombinedSummary,
  calculateContributionSummary,
  calculateExpenseByCategory,
  calculateSavingsProgress,
  calculateYearlyMonthlySeries,
  filterTransactionsByDateRange,
  getAccountDisplayName,
  getPeriodDateRange,
} from '../engine/calculations';
import type { ReportPeriodMode } from '../types/finance';
import { exportFinanceToExcel } from '../utils/exportExcel';
import {
  formatDateID,
  formatPercent,
  formatRupiah,
  formatRupiahSigned,
  getTodayISO,
} from '../utils/format';

export const ReportsPage: React.FC = () => {
  const { state, pushToast } = useFinance();
  const today = getTodayISO();

  const [periodMode, setPeriodMode] = useState<ReportPeriodMode>('monthly');
  const [anchorDate, setAnchorDate] = useState<string>(today);
  const [customStart, setCustomStart] = useState<string>(`${today.slice(0, 7)}-01`);
  const [customEnd, setCustomEnd] = useState<string>(today);

  const range = useMemo(
    () => getPeriodDateRange(periodMode, anchorDate, customStart, customEnd),
    [periodMode, anchorDate, customStart, customEnd]
  );

  const periodTxs = useMemo(
    () => (state ? filterTransactionsByDateRange(state.transactions, range.start, range.end) : []),
    [state, range]
  );

  const combined = useMemo(() => calculateCombinedSummary(periodTxs), [periodTxs]);
  const allTimeBalances = useMemo(
    () =>
      state
        ? calculateAccountBalances(state.transactions)
        : { suami: 0, istri: 0, keluarga: 0, total: 0 },
    [state]
  );
  const periodAccountSummaries = useMemo(() => calculateAccountSummaries(periodTxs), [periodTxs]);
  const expenseByCategory = useMemo(
    () => (state ? calculateExpenseByCategory(periodTxs, state.categories) : []),
    [state, periodTxs]
  );
  const contribution = useMemo(() => calculateContributionSummary(periodTxs), [periodTxs]);
  const transfers = useMemo(
    () =>
      periodTxs
        .filter((tx) => tx.type === 'transfer')
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [periodTxs]
  );
  const savings = useMemo(
    () => (state ? calculateSavingsProgress(state.savingsGoals, state.savingsEntries) : []),
    [state]
  );

  const comparisonYear = Number(anchorDate.slice(0, 4)) || new Date().getFullYear();
  const monthlyComparison = useMemo(
    () => (state ? calculateYearlyMonthlySeries(state.transactions, comparisonYear) : []),
    [state, comparisonYear]
  );

  if (!state) return null;

  const suamiName = getAccountDisplayName(state.accounts, 'suami');
  const istriName = getAccountDisplayName(state.accounts, 'istri');
  const keluargaName = getAccountDisplayName(state.accounts, 'keluarga');

  const handleExportExcel = () => {
    const year = Number(anchorDate.slice(0, 4)) || new Date().getFullYear();
    const month = Number(anchorDate.slice(5, 7)) || new Date().getMonth() + 1;
    exportFinanceToExcel(state, { year, month, periodLabel: range.label });
    pushToast('Laporan Excel (.xlsx) 7 sheet berhasil diunduh.');
  };

  return (
    <div className="space-y-8">
      {/* Period Selector & Excel Export Bar */}
      <section className="rounded-lg border border-[#E5E0D5] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1 rounded-md border border-[#E5E0D5] bg-[#EFECE4] p-1">
            {(
              [
                { id: 'daily', label: 'Harian' },
                { id: 'weekly', label: 'Mingguan' },
                { id: 'monthly', label: 'Bulanan' },
                { id: 'yearly', label: 'Tahunan' },
                { id: 'custom', label: 'Rentang Khusus' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriodMode(item.id)}
                className={`whitespace-nowrap rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  periodMode === item.id
                    ? 'bg-white text-[#1C1917] shadow-xs'
                    : 'text-[#6B655D] hover:text-[#1C1917]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-[#1D3E5E] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#142D46]"
          >
            <Download className="h-4 w-4" />
            <span>Ekspor Excel (.xlsx)</span>
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#E5E0D5] pt-4 text-xs">
          {periodMode === 'custom' ? (
            <>
              <label className="flex items-center gap-2 text-[#6B655D]">
                <span>Dari:</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="font-num rounded-md border border-[#E5E0D5] bg-white px-2.5 py-1.5 text-xs text-[#1C1917]"
                />
              </label>
              <label className="flex items-center gap-2 text-[#6B655D]">
                <span>Sampai:</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="font-num rounded-md border border-[#E5E0D5] bg-white px-2.5 py-1.5 text-xs text-[#1C1917]"
                />
              </label>
            </>
          ) : (
            <label className="flex items-center gap-2 text-[#6B655D]">
              <span>Tanggal acuan:</span>
              <input
                type="date"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
                className="font-num rounded-md border border-[#E5E0D5] bg-white px-2.5 py-1.5 text-xs text-[#1C1917]"
              />
            </label>
          )}
          <span className="text-[#6B655D]">
            Periode aktif: <strong className="text-[#1C1917]">{range.label}</strong> ({formatDateID(range.start)} – {formatDateID(range.end)})
          </span>
        </div>
      </section>

      {/* 1. Ringkasan Pemasukan & Pengeluaran */}
      <section className="rounded-lg border border-[#E5E0D5] bg-white">
        <div className="border-b border-[#E5E0D5] px-6 py-4">
          <h2 className="font-display text-base font-semibold text-[#1C1917]">
            01. Ringkasan Pemasukan dan Pengeluaran
          </h2>
          <p className="text-xs text-[#6B655D]">
            Transfer internal antar-akun tidak dihitung sebagai pemasukan maupun pengeluaran gabungan.
          </p>
        </div>
        <div className="grid grid-cols-1 divide-y divide-[#E5E0D5] sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
          <div className="p-5 sm:border-r sm:border-b lg:border-b-0">
            <p className="text-xs text-[#6B655D]">Pemasukan Gabungan</p>
            <p className="font-num mt-1.5 text-xl font-semibold text-[#1F6E4A]">
              {formatRupiah(combined.totalIncome)}
            </p>
          </div>
          <div className="p-5 sm:border-b lg:border-r lg:border-b-0">
            <p className="text-xs text-[#6B655D]">Pengeluaran Gabungan</p>
            <p className="font-num mt-1.5 text-xl font-semibold text-[#B42318]">
              {formatRupiah(combined.totalExpense)}
            </p>
          </div>
          <div className="p-5 sm:border-r">
            <p className="text-xs text-[#6B655D]">
              Surplus / Defisit ({combined.surplus >= 0 ? 'Surplus' : 'Defisit'})
            </p>
            <p
              className={`font-num mt-1.5 text-xl font-semibold ${
                combined.surplus >= 0 ? 'text-[#1F6E4A]' : 'text-[#B42318]'
              }`}
            >
              {formatRupiahSigned(combined.surplus)}
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs text-[#6B655D]">Total Transfer Internal</p>
            <p className="font-num mt-1.5 text-xl font-semibold text-[#1D3E5E]">
              {formatRupiah(combined.totalTransfers)}
            </p>
          </div>
        </div>
      </section>

      {/* 2. Laporan Saldo Masing-Masing Akun */}
      <section className="rounded-lg border border-[#E5E0D5] bg-white">
        <div className="border-b border-[#E5E0D5] px-6 py-4">
          <h2 className="font-display text-base font-semibold text-[#1C1917]">
            02. Laporan Saldo Masing-Masing Akun
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E5E0D5] bg-[#F7F5F0] text-xs font-medium text-[#6B655D]">
              <tr>
                <th className="px-6 py-3">Akun</th>
                <th className="px-4 py-3 text-right">Pemasukan (Periode)</th>
                <th className="px-4 py-3 text-right">Pengeluaran (Periode)</th>
                <th className="px-4 py-3 text-right">Transfer Masuk</th>
                <th className="px-4 py-3 text-right">Transfer Keluar</th>
                <th className="px-6 py-3 text-right">Saldo Akhir Saat Ini</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E0D5]">
              {state.accounts.map((acc) => {
                const s = periodAccountSummaries[acc.id];
                return (
                  <tr key={acc.id}>
                    <td className="px-6 py-3 font-medium text-[#1C1917]">{acc.displayName}</td>
                    <td className="font-num px-4 py-3 text-right text-xs text-[#1F6E4A]">
                      {formatRupiah(s.income)}
                    </td>
                    <td className="font-num px-4 py-3 text-right text-xs text-[#B42318]">
                      {formatRupiah(s.expense)}
                    </td>
                    <td className="font-num px-4 py-3 text-right text-xs text-[#1D3E5E]">
                      {formatRupiah(s.transferIn)}
                    </td>
                    <td className="font-num px-4 py-3 text-right text-xs text-[#B68D40]">
                      {formatRupiah(s.transferOut)}
                    </td>
                    <td className="font-num px-6 py-3 text-right font-semibold text-[#1C1917]">
                      {formatRupiah(allTimeBalances[acc.id])}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-[#F7F5F0]/70 font-semibold">
                <td className="px-6 py-3 text-[#1C1917]">Total Keseluruhan</td>
                <td className="font-num px-4 py-3 text-right text-xs text-[#1F6E4A]">
                  {formatRupiah(combined.totalIncome)}
                </td>
                <td className="font-num px-4 py-3 text-right text-xs text-[#B42318]">
                  {formatRupiah(combined.totalExpense)}
                </td>
                <td className="font-num px-4 py-3 text-right text-xs text-[#6B655D]">
                  {formatRupiah(combined.totalTransfers)}
                </td>
                <td className="font-num px-4 py-3 text-right text-xs text-[#6B655D]">
                  {formatRupiah(combined.totalTransfers)}
                </td>
                <td className="font-num px-6 py-3 text-right text-[#1D3E5E]">
                  {formatRupiah(allTimeBalances.total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 3 & 4: Pengeluaran per Kategori + Kontribusi Suami & Istri */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-[#E5E0D5] bg-white">
          <div className="border-b border-[#E5E0D5] px-6 py-4">
            <h2 className="font-display text-base font-semibold text-[#1C1917]">
              03. Pengeluaran per Kategori
            </h2>
          </div>
          {expenseByCategory.length === 0 ? (
            <EmptyState
              compact
              title="Belum ada pengeluaran"
              description="Tidak terdapat transaksi pengeluaran pada periode ini."
            />
          ) : (
            <div className="divide-y divide-[#E5E0D5] px-6 py-2">
              {expenseByCategory.map((item) => (
                <div key={item.categoryId} className="py-3">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="font-medium text-[#1C1917]">
                      {item.categoryName}{' '}
                      <span className="font-normal text-[#6B655D]">({item.count}x)</span>
                    </span>
                    <span className="font-num font-semibold text-[#1C1917]">
                      {formatRupiah(item.amount)}{' '}
                      <span className="font-normal text-[#6B655D]">
                        ({formatPercent(item.percentage)})
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-xs bg-[#EFECE4]">
                    <div
                      className="h-full bg-[#1D3E5E]"
                      style={{ width: `${Math.min(100, item.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-[#E5E0D5] bg-white">
          <div className="border-b border-[#E5E0D5] px-6 py-4">
            <h2 className="font-display text-base font-semibold text-[#1C1917]">
              04. Kontribusi ke {keluargaName}
            </h2>
          </div>
          <div className="space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-[#E5E0D5] pb-3 text-sm">
              <span className="text-[#6B655D]">{suamiName}</span>
              <span className="font-num font-semibold text-[#1D3E5E]">
                {formatRupiah(contribution.suamiTotal)} ({formatPercent(contribution.suamiPercent)})
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-[#E5E0D5] pb-3 text-sm">
              <span className="text-[#6B655D]">{istriName}</span>
              <span className="font-num font-semibold text-[#B68D40]">
                {formatRupiah(contribution.istriTotal)} ({formatPercent(contribution.istriPercent)})
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-[#1C1917]">Total Kontribusi Gabungan</span>
              <span className="font-num font-semibold text-[#1C1917]">
                {formatRupiah(contribution.combinedTotal)}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* 5. Riwayat Transfer Antar-Akun */}
      <section className="rounded-lg border border-[#E5E0D5] bg-white">
        <div className="border-b border-[#E5E0D5] px-6 py-4">
          <h2 className="font-display text-base font-semibold text-[#1C1917]">
            05. Riwayat Transfer Antar-Akun
          </h2>
        </div>
        {transfers.length === 0 ? (
          <EmptyState
            compact
            title="Belum ada transfer antar-akun"
            description="Transfer yang dicatat pada periode ini akan tampil lengkap di sini."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E5E0D5] bg-[#F7F5F0] text-xs font-medium text-[#6B655D]">
                <tr>
                  <th className="px-6 py-3">Tanggal</th>
                  <th className="px-4 py-3">Dari Akun</th>
                  <th className="px-4 py-3">Ke Akun</th>
                  <th className="px-4 py-3">Keterangan</th>
                  <th className="px-6 py-3 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E0D5]">
                {transfers.map((tx) => (
                  <tr key={tx.id}>
                    <td className="font-num whitespace-nowrap px-6 py-3 text-xs text-[#6B655D]">
                      {formatDateID(tx.date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-[#1C1917]">
                      {getAccountDisplayName(state.accounts, tx.fromAccountId)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-[#1C1917]">
                      {getAccountDisplayName(state.accounts, tx.toAccountId)}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6B655D]">{tx.description}</td>
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

      {/* 6. Perkembangan Tabungan */}
      <section className="rounded-lg border border-[#E5E0D5] bg-white">
        <div className="border-b border-[#E5E0D5] px-6 py-4">
          <h2 className="font-display text-base font-semibold text-[#1C1917]">
            06. Perkembangan Target Tabungan
          </h2>
        </div>
        {savings.length === 0 ? (
          <EmptyState
            compact
            title="Belum ada target tabungan"
            description="Buat target tabungan pada menu Tabungan untuk memantau perkembangannya di laporan."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E5E0D5] bg-[#F7F5F0] text-xs font-medium text-[#6B655D]">
                <tr>
                  <th className="px-6 py-3">Target Tabungan</th>
                  <th className="px-4 py-3">Akun</th>
                  <th className="px-4 py-3 text-right">Terkumpul</th>
                  <th className="px-4 py-3 text-right">Target</th>
                  <th className="px-6 py-3 text-right">Pencapaian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E0D5]">
                {savings.map((row) => (
                  <tr key={row.goal.id}>
                    <td className="px-6 py-3 font-medium text-[#1C1917]">{row.goal.name}</td>
                    <td className="px-4 py-3 text-xs text-[#6B655D]">
                      {getAccountDisplayName(state.accounts, row.goal.storageAccountId)}
                    </td>
                    <td className="font-num px-4 py-3 text-right text-xs font-medium text-[#1F6E4A]">
                      {formatRupiah(row.collectedAmount)}
                    </td>
                    <td className="font-num px-4 py-3 text-right text-xs text-[#6B655D]">
                      {formatRupiah(row.goal.targetAmount)}
                    </td>
                    <td className="font-num px-6 py-3 text-right text-xs font-semibold text-[#1D3E5E]">
                      {formatPercent(row.percentage)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 7. Perbandingan Kondisi Keuangan Antarbulan */}
      <section className="rounded-lg border border-[#E5E0D5] bg-white">
        <div className="border-b border-[#E5E0D5] px-6 py-4">
          <h2 className="font-display text-base font-semibold text-[#1C1917]">
            07. Perbandingan Kondisi Keuangan Antarbulan ({comparisonYear})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E5E0D5] bg-[#F7F5F0] text-xs font-medium text-[#6B655D]">
              <tr>
                <th className="px-6 py-3">Bulan</th>
                <th className="px-4 py-3 text-right">Pemasukan</th>
                <th className="px-4 py-3 text-right">Pengeluaran</th>
                <th className="px-4 py-3 text-right">Surplus / Defisit</th>
                <th className="px-4 py-3 text-right">Kontribusi Keluarga</th>
                <th className="px-6 py-3 text-right">Saldo Akhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E0D5]">
              {monthlyComparison.map((row) => (
                <tr key={row.month} className="hover:bg-[#F7F5F0]/50">
                  <td className="px-6 py-2.5 text-xs font-medium text-[#1C1917]">{row.monthName}</td>
                  <td className="font-num px-4 py-2.5 text-right text-xs text-[#1F6E4A]">
                    {formatRupiah(row.income)}
                  </td>
                  <td className="font-num px-4 py-2.5 text-right text-xs text-[#B42318]">
                    {formatRupiah(row.expense)}
                  </td>
                  <td
                    className={`font-num px-4 py-2.5 text-right text-xs font-medium ${
                      row.surplus >= 0 ? 'text-[#1F6E4A]' : 'text-[#B42318]'
                    }`}
                  >
                    {formatRupiahSigned(row.surplus)}
                  </td>
                  <td className="font-num px-4 py-2.5 text-right text-xs text-[#1D3E5E]">
                    {formatRupiah(row.suamiContribution + row.istriContribution)}
                  </td>
                  <td className="font-num px-6 py-2.5 text-right text-xs font-semibold text-[#1C1917]">
                    {formatRupiah(row.endingBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

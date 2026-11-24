import * as XLSX from 'xlsx';
import {
  calculateAccountBalances,
  calculateAccountSummaries,
  calculateBudgetStatuses,
  calculateCombinedSummary,
  calculateContributionSummary,
  calculateExpenseByCategory,
  calculateMonthlyContributions,
  calculateSavingsProgress,
  getAccountDisplayName,
  getCategoryName,
} from '../engine/calculations';
import type { FinanceState } from '../types/finance';
import { formatDateID, formatMonthYearID, getTodayISO } from './format';

const RUPIAH_NUM_FMT = '"Rp"#,##0;-"Rp"#,##0;"Rp"0';
const PERCENT_NUM_FMT = '0.0%';

export interface ExcelExportOptions {
  year?: number;
  month?: number;
  periodLabel?: string;
}

function applyColumnFormats(
  ws: XLSX.WorkSheet,
  currencyCols: number[],
  percentCols: number[] = [],
  colWidths: number[] = []
) {
  if (!ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);

  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    for (const c of currencyCols) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (cell && typeof cell.v === 'number') {
        cell.t = 'n';
        cell.z = RUPIAH_NUM_FMT;
      }
    }
    for (const c of percentCols) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (cell && typeof cell.v === 'number') {
        cell.t = 'n';
        cell.z = PERCENT_NUM_FMT;
      }
    }
  }

  if (colWidths.length > 0) {
    ws['!cols'] = colWidths.map((wch) => ({ wch }));
  }
}

/**
 * Pure workbook builder generating the 7 mandatory Excel sheets:
 * 1. Ringkasan
 * 2. Transaksi
 * 3. Kontribusi
 * 4. Transfer
 * 5. Anggaran
 * 6. Tabungan
 * 7. Saldo Akun
 */
export function buildExcelWorkbook(
  state: FinanceState,
  options: ExcelExportOptions = {}
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const nowYear = options.year ?? new Date().getFullYear();
  const nowMonth = options.month ?? new Date().getMonth() + 1;

  const suamiName = getAccountDisplayName(state.accounts, 'suami');
  const istriName = getAccountDisplayName(state.accounts, 'istri');
  const keluargaName = getAccountDisplayName(state.accounts, 'keluarga');

  const balances = calculateAccountBalances(state.transactions);
  const accountSummaries = calculateAccountSummaries(state.transactions);
  const combinedAll = calculateCombinedSummary(state.transactions);
  const contributionAll = calculateContributionSummary(state.transactions);
  const monthlyContributions = calculateMonthlyContributions(state.transactions, nowYear);
  const expenseByCat = calculateExpenseByCategory(state.transactions, state.categories);
  const budgetRows = calculateBudgetStatuses(
    state.budgets,
    state.transactions,
    state.categories,
    nowYear,
    nowMonth
  );
  const savingsRows = calculateSavingsProgress(state.savingsGoals, state.savingsEntries);

  // =========================================================================
  // 1. Sheet: Ringkasan
  // =========================================================================
  const ringkasanRows: (string | number)[][] = [
    ['LAPORAN RINGKASAN KEUANGAN KELUARGA — KAS RUMAH', ''],
    ['Tanggal Ekspor', formatDateID(getTodayISO())],
    ['Periode Acuan', options.periodLabel ?? formatMonthYearID(nowYear, nowMonth)],
    ['', ''],
    ['RINGKASAN SALDO AKUN', 'Nominal (Rp)'],
    [suamiName, balances.suami],
    [istriName, balances.istri],
    [keluargaName, balances.keluarga],
    ['Total Saldo Seluruh Akun', balances.total],
    ['', ''],
    ['RINGKASAN GABUNGAN (TANPA HITUNG GANDA TRANSFER)', 'Nominal (Rp)'],
    ['Total Pemasukan Gabungan', combinedAll.totalIncome],
    ['Total Pengeluaran Gabungan', combinedAll.totalExpense],
    ['Surplus / Defisit Gabungan', combinedAll.surplus],
    ['Total Transfer Antar-Akun (Bukan Pemasukan/Pengeluaran)', combinedAll.totalTransfers],
    [`Total Kontribusi ${suamiName} ke ${keluargaName}`, combinedAll.suamiContribution],
    [`Total Kontribusi ${istriName} ke ${keluargaName}`, combinedAll.istriContribution],
    [`Total Dana Masuk ke ${keluargaName}`, combinedAll.totalFamilyInflow],
    ['', ''],
    ['PENGELUARAN PER KATEGORI (KESELURUHAN)', 'Nominal (Rp)'],
    ...(expenseByCat.length > 0
      ? expenseByCat.map((item) => [item.categoryName, item.amount])
      : [['Belum ada pengeluaran tercatat', 0]]),
  ];
  const wsRingkasan = XLSX.utils.aoa_to_sheet(ringkasanRows);
  applyColumnFormats(wsRingkasan, [1], [], [54, 24]);
  XLSX.utils.book_append_sheet(wb, wsRingkasan, 'Ringkasan');

  // =========================================================================
  // 2. Sheet: Transaksi
  // =========================================================================
  const sortedTxs = [...state.transactions].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
  );
  const txRows: (string | number)[][] = [
    [
      'Tanggal',
      'Jenis Transaksi',
      'Akun / Sumber',
      'Akun Tujuan',
      'Kategori',
      'Nominal (Rp)',
      'Keterangan',
      'Catatan',
    ],
    ...sortedTxs.map((tx) => {
      const jenisLabel =
        tx.type === 'income'
          ? 'Pemasukan'
          : tx.type === 'expense'
            ? 'Pengeluaran'
            : 'Transfer Antar-Akun';
      const akunSumber =
        tx.type === 'transfer'
          ? getAccountDisplayName(state.accounts, tx.fromAccountId)
          : getAccountDisplayName(state.accounts, tx.accountId);
      const akunTujuan =
        tx.type === 'transfer' ? getAccountDisplayName(state.accounts, tx.toAccountId) : '-';
      const kategori =
        tx.type === 'transfer'
          ? 'Transfer Antar-Akun'
          : getCategoryName(state.categories, tx.categoryId);
      return [
        formatDateID(tx.date),
        jenisLabel,
        akunSumber,
        akunTujuan,
        kategori,
        tx.amount,
        tx.description || '-',
        tx.notes || '',
      ];
    }),
  ];
  const wsTransaksi = XLSX.utils.aoa_to_sheet(txRows);
  applyColumnFormats(wsTransaksi, [5], [], [16, 20, 18, 18, 22, 18, 32, 28]);
  XLSX.utils.book_append_sheet(wb, wsTransaksi, 'Transaksi');

  // =========================================================================
  // 3. Sheet: Kontribusi
  // =========================================================================
  const kontribusiRows: (string | number)[][] = [
    ['RINGKASAN KONTRIBUSI KAS KELUARGA', '', '', ''],
    ['Total Kontribusi ' + suamiName, contributionAll.suamiTotal, 'Persentase', contributionAll.suamiPercent / 100],
    ['Total Kontribusi ' + istriName, contributionAll.istriTotal, 'Persentase', contributionAll.istriPercent / 100],
    ['Total Kontribusi Gabungan', contributionAll.combinedTotal, '', ''],
    ['', '', '', ''],
    [`REKAP KONTRIBUSI BULANAN (${nowYear})`, `Kontribusi ${suamiName}`, `Kontribusi ${istriName}`, 'Total'],
    ...monthlyContributions.map((row) => [row.monthName, row.suami, row.istri, row.total]),
    ['', '', '', ''],
    ['RIWAYAT TRANSFER KE KAS KELUARGA', 'Dari Akun', 'Nominal (Rp)', 'Keterangan'],
    ...contributionAll.entries.map((tx) => [
      formatDateID(tx.date),
      getAccountDisplayName(state.accounts, tx.fromAccountId),
      tx.amount,
      tx.description || 'Kontribusi Kas Keluarga',
    ]),
  ];
  const wsKontribusi = XLSX.utils.aoa_to_sheet(kontribusiRows);
  applyColumnFormats(wsKontribusi, [1, 2, 3], [], [34, 22, 22, 24]);
  // Explicitly format the two percentage cells D2 and D3
  if (wsKontribusi['D2']) wsKontribusi['D2'].z = PERCENT_NUM_FMT;
  if (wsKontribusi['D3']) wsKontribusi['D3'].z = PERCENT_NUM_FMT;
  XLSX.utils.book_append_sheet(wb, wsKontribusi, 'Kontribusi');

  // =========================================================================
  // 4. Sheet: Transfer
  // =========================================================================
  const transferTxs = sortedTxs.filter((tx) => tx.type === 'transfer');
  const transferRows: (string | number)[][] = [
    ['Tanggal', 'Akun Sumber', 'Akun Tujuan', 'Nominal (Rp)', 'Keterangan', 'Catatan'],
    ...transferTxs.map((tx) => [
      formatDateID(tx.date),
      getAccountDisplayName(state.accounts, tx.fromAccountId),
      getAccountDisplayName(state.accounts, tx.toAccountId),
      tx.amount,
      tx.description || '-',
      tx.notes || '',
    ]),
  ];
  const wsTransfer = XLSX.utils.aoa_to_sheet(transferRows);
  applyColumnFormats(wsTransfer, [3], [], [16, 20, 20, 18, 32, 28]);
  XLSX.utils.book_append_sheet(wb, wsTransfer, 'Transfer');

  // =========================================================================
  // 5. Sheet: Anggaran
  // =========================================================================
  const anggaranRows: (string | number)[][] = [
    ['Periode', 'Kategori', 'Anggaran (Rp)', 'Realisasi (Rp)', 'Sisa Anggaran (Rp)', 'Pemakaian', 'Status'],
    ...budgetRows.map((row) => [
      formatMonthYearID(row.budget.year, row.budget.month),
      row.categoryName,
      row.limitAmount,
      row.spentAmount,
      row.remainingAmount,
      row.percentage / 100,
      row.status === 'terlampaui'
        ? 'Terlampaui'
        : row.status === 'hampir_habis'
          ? 'Hampir Habis'
          : 'Aman',
    ]),
  ];
  const wsAnggaran = XLSX.utils.aoa_to_sheet(anggaranRows);
  applyColumnFormats(wsAnggaran, [2, 3, 4], [5], [18, 24, 18, 18, 18, 14, 16]);
  XLSX.utils.book_append_sheet(wb, wsAnggaran, 'Anggaran');

  // =========================================================================
  // 6. Sheet: Tabungan
  // =========================================================================
  const tabunganRows: (string | number)[][] = [
    [
      'Nama Target',
      'Akun Penyimpanan',
      'Target Nominal (Rp)',
      'Saldo Terkumpul (Rp)',
      'Sisa Target (Rp)',
      'Pencapaian',
      'Tanggal Target',
      'Jumlah Setoran',
    ],
    ...savingsRows.map((row) => [
      row.goal.name,
      getAccountDisplayName(state.accounts, row.goal.storageAccountId),
      row.goal.targetAmount,
      row.collectedAmount,
      row.remainingAmount,
      row.percentage / 100,
      row.goal.targetDate ? formatDateID(row.goal.targetDate) : '-',
      row.entries.length,
    ]),
  ];
  const wsTabungan = XLSX.utils.aoa_to_sheet(tabunganRows);
  applyColumnFormats(wsTabungan, [2, 3, 4], [5], [26, 20, 20, 20, 18, 14, 16, 16]);
  XLSX.utils.book_append_sheet(wb, wsTabungan, 'Tabungan');

  // =========================================================================
  // 7. Sheet: Saldo Akun
  // =========================================================================
  const saldoRows: (string | number)[][] = [
    [
      'Nama Akun',
      'Total Pemasukan (Rp)',
      'Total Pengeluaran (Rp)',
      'Transfer Masuk (Rp)',
      'Transfer Keluar (Rp)',
      'Saldo Akhir (Rp)',
    ],
    ...state.accounts.map((acc) => {
      const s = accountSummaries[acc.id];
      return [acc.displayName, s.income, s.expense, s.transferIn, s.transferOut, s.balance];
    }),
    [
      'Total Keseluruhan (Tanpa Transfer Internal)',
      combinedAll.totalIncome,
      combinedAll.totalExpense,
      combinedAll.totalTransfers,
      combinedAll.totalTransfers,
      balances.total,
    ],
  ];
  const wsSaldo = XLSX.utils.aoa_to_sheet(saldoRows);
  applyColumnFormats(wsSaldo, [1, 2, 3, 4, 5], [], [36, 22, 22, 20, 20, 20]);
  XLSX.utils.book_append_sheet(wb, wsSaldo, 'Saldo Akun');

  return wb;
}

export function exportFinanceToExcel(state: FinanceState, options: ExcelExportOptions = {}): void {
  const wb = buildExcelWorkbook(state, options);
  const filename = `laporan-kas-rumah-${getTodayISO()}.xlsx`;
  XLSX.writeFile(wb, filename);
}

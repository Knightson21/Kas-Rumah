import React, { useRef, useState } from 'react';
import {
  Check,
  Download,
  FileSpreadsheet,
  HardDriveDownload,
  Pencil,
  Plus,
  RotateCcw,
  Smartphone,
  Trash2,
  Upload,
} from 'lucide-react';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useFinance } from '../context/FinanceContext';
import { usePWAInstall } from '../hooks/usePWA';
import type { Category, CategoryScope, FinanceState } from '../types/finance';
import { validateBackupPayload } from '../utils/backup';
import { exportFinanceToExcel } from '../utils/exportExcel';
import { formatDateTimeID } from '../utils/format';

export const SettingsBackupPage: React.FC = () => {
  const {
    state,
    renameAccount,
    upsertCategory,
    removeCategory,
    exportBackup,
    restoreFromState,
    updateSettings,
    resetAllData,
    pushToast,
  } = useFinance();

  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Account naming state
  const [suamiInput, setSuamiInput] = useState<string>(
    () => state?.accounts.find((a) => a.id === 'suami')?.displayName ?? 'Kas Suami'
  );
  const [istriInput, setIstriInput] = useState<string>(
    () => state?.accounts.find((a) => a.id === 'istri')?.displayName ?? 'Kas Istri'
  );
  const [savingAccounts, setSavingAccounts] = useState(false);

  // Category management state
  const [catTab, setCatTab] = useState<'income' | 'expense_pribadi' | 'expense_keluarga'>('income');
  const [newCatName, setNewCatName] = useState('');
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [pendingDeleteCat, setPendingDeleteCat] = useState<Category | null>(null);

  // Backup & Restore state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<{
    data: FinanceState;
    summaryText: string;
  } | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Reset all data confirmation
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  if (!state) return null;

  const filteredCategories = state.categories.filter((c) => {
    if (catTab === 'income') return c.type === 'income';
    if (catTab === 'expense_pribadi') return c.type === 'expense' && c.scope === 'pribadi';
    return c.type === 'expense' && (c.scope === 'keluarga' || c.scope === 'semua');
  });

  const handleSaveAccountNames = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suamiInput.trim() || !istriInput.trim()) {
      pushToast('Nama tampilan akun tidak boleh kosong.', 'error');
      return;
    }
    setSavingAccounts(true);
    try {
      await renameAccount('suami', suamiInput.trim());
      await renameAccount('istri', istriInput.trim());
    } finally {
      setSavingAccounts(false);
    }
  };

  const handleResetAccountNames = async () => {
    setSuamiInput('Kas Suami');
    setIstriInput('Kas Istri');
    await renameAccount('suami', 'Kas Suami');
    await renameAccount('istri', 'Kas Istri');
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    const type: 'income' | 'expense' = catTab === 'income' ? 'income' : 'expense';
    const scope: CategoryScope =
      catTab === 'income'
        ? 'semua'
        : catTab === 'expense_pribadi'
          ? 'pribadi'
          : 'keluarga';

    await upsertCategory({
      name: trimmed,
      type,
      scope,
      isDefault: false,
    });
    setNewCatName('');
  };

  const handleSaveCategoryEdit = async (cat: Category) => {
    if (!editCatName.trim()) return;
    await upsertCategory(
      {
        name: editCatName.trim(),
        type: cat.type,
        scope: cat.scope,
        isDefault: cat.isDefault,
        isSystemSavings: cat.isSystemSavings,
      },
      cat.id
    );
    setEditingCat(null);
    setEditCatName('');
  };

  const handleConfirmDeleteCat = async () => {
    if (!pendingDeleteCat) return;
    await removeCategory(pendingDeleteCat.id);
    setPendingDeleteCat(null);
  };

  const handleRestoreFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const validation = validateBackupPayload(parsed);

      if (!validation.valid) {
        setRestoreError(validation.error);
        return;
      }

      const s = validation.summary;
      setPendingRestore({
        data: validation.payload.data,
        summaryText: `File backup valid (${formatDateTimeID(s.exportedAt)}). Berisi ${s.transactionsCount} transaksi, ${s.categoriesCount} kategori, ${s.budgetsCount} anggaran, dan ${s.savingsGoalsCount} target tabungan. Melanjutkan proses ini akan menggantikan seluruh data yang tersimpan saat ini.`,
      });
    } catch {
      setRestoreError('File tidak dapat dibaca sebagai JSON yang valid. Data lama Anda tetap aman.');
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestore) return;
    setRestoring(true);
    try {
      await restoreFromState(pendingRestore.data);
      const nextSuami =
        pendingRestore.data.accounts.find((a) => a.id === 'suami')?.displayName ?? 'Kas Suami';
      const nextIstri =
        pendingRestore.data.accounts.find((a) => a.id === 'istri')?.displayName ?? 'Kas Istri';
      setSuamiInput(nextSuami);
      setIstriInput(nextIstri);
      setPendingRestore(null);
    } finally {
      setRestoring(false);
    }
  };

  const handleConfirmResetAll = async () => {
    setResetting(true);
    try {
      await resetAllData();
      setSuamiInput('Kas Suami');
      setIstriInput('Kas Istri');
      setConfirmResetOpen(false);
    } finally {
      setResetting(false);
    }
  };

  const categoryUsageCount = (catId: string) =>
    state.transactions.filter((tx) => tx.categoryId === catId).length;

  return (
    <div className="space-y-8">
      {/* 1. Backup, Restore JSON & Excel Export */}
      <section className="rounded-lg border border-[#E5E0D5] bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E5E0D5] pb-4">
          <div>
            <h2 className="font-display text-base font-semibold text-[#1C1917]">
              Backup, Restore, dan Ekspor Data
            </h2>
            <p className="mt-1 text-xs text-[#6B655D]">
              Semua catatan tersimpan lokal di browser Anda (IndexedDB). Lakukan backup JSON secara
              berkala untuk berjaga-jaga jika browser dibersihkan atau pindah perangkat.
            </p>
          </div>
          <div className="text-right text-xs text-[#6B655D]">
            <div>Backup terakhir</div>
            <div className="font-num mt-0.5 font-medium text-[#1C1917]">
              {formatDateTimeID(state.settings.lastBackupAt)}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Backup JSON */}
          <div className="flex flex-col justify-between rounded-md border border-[#E5E0D5] bg-[#F7F5F0]/50 p-4">
            <div>
              <h3 className="text-sm font-semibold text-[#1C1917]">Backup ke JSON</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#6B655D]">
                Unduh salinan lengkap seluruh akun, transaksi, kategori, anggaran, dan target tabungan.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void exportBackup()}
              className="mt-4 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-[#1D3E5E] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#142D46]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Unduh Backup JSON</span>
            </button>
          </div>

          {/* Restore JSON */}
          <div className="flex flex-col justify-between rounded-md border border-[#E5E0D5] bg-[#F7F5F0]/50 p-4">
            <div>
              <h3 className="text-sm font-semibold text-[#1C1917]">Restore dari JSON</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#6B655D]">
                File divalidasi secara ketat terlebih dahulu sebelum mengganti data yang tersimpan.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleRestoreFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-[#1D3E5E] bg-white px-4 py-2 text-xs font-medium text-[#1D3E5E] transition-colors hover:bg-[#EFECE4]"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Pilih File Backup JSON</span>
            </button>
          </div>

          {/* Export Excel */}
          <div className="flex flex-col justify-between rounded-md border border-[#E5E0D5] bg-[#F7F5F0]/50 p-4">
            <div>
              <h3 className="text-sm font-semibold text-[#1C1917]">Ekspor Excel (.xlsx)</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#6B655D]">
                Menghasilkan 7 sheet rapi: Ringkasan, Transaksi, Kontribusi, Transfer, Anggaran, Tabungan, Saldo Akun.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                exportFinanceToExcel(state);
                pushToast('Laporan Excel (.xlsx) 7 sheet berhasil diunduh.');
              }}
              className="mt-4 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-[#E5E0D5] bg-white px-4 py-2 text-xs font-medium text-[#1C1917] transition-colors hover:bg-[#EFECE4]"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-[#1F6E4A]" />
              <span>Unduh Laporan Excel</span>
            </button>
          </div>
        </div>

        {restoreError && (
          <div className="mt-4 rounded-md border border-[#B42318]/25 bg-[#FCECEB] px-4 py-3 text-xs font-medium text-[#B42318]">
            {restoreError}
          </div>
        )}

        {/* Reminder Interval */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E0D5] pt-4 text-xs">
          <span className="text-[#6B655D]">Pengingat berkala untuk melakukan backup data:</span>
          <select
            aria-label="Interval pengingat backup"
            value={state.settings.backupReminderDays}
            onChange={(e) => void updateSettings({ backupReminderDays: Number(e.target.value) })}
            className="rounded-md border border-[#E5E0D5] bg-white px-3 py-1.5 text-xs text-[#1C1917]"
          >
            <option value={7}>Setiap 7 hari</option>
            <option value={14}>Setiap 14 hari</option>
            <option value={30}>Setiap 30 hari</option>
          </select>
        </div>
      </section>

      {/* 2. Kustomisasi Nama Akun Suami & Istri */}
      <section className="rounded-lg border border-[#E5E0D5] bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E0D5] pb-4">
          <div>
            <h2 className="font-display text-base font-semibold text-[#1C1917]">
              Nama Tampilan Akun Keuangan
            </h2>
            <p className="mt-1 text-xs text-[#6B655D]">
              Ubah label tampilan akun Suami dan Istri sesuai panggilan sehari-hari. Perubahan berlaku di semua halaman dan ekspor Excel.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleResetAccountNames()}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-[#E5E0D5] px-3 py-1.5 text-xs font-medium text-[#6B655D] hover:bg-[#EFECE4] hover:text-[#1C1917]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Kembalikan Default</span>
          </button>
        </div>

        <form onSubmit={handleSaveAccountNames} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="acc-suami-name" className="mb-1.5 block text-xs font-medium text-[#6B655D]">
              Label Akun Suami
            </label>
            <input
              id="acc-suami-name"
              type="text"
              value={suamiInput}
              onChange={(e) => setSuamiInput(e.target.value)}
              placeholder="Kas Suami"
              required
              className="w-full rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-sm text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="acc-istri-name" className="mb-1.5 block text-xs font-medium text-[#6B655D]">
              Label Akun Istri
            </label>
            <input
              id="acc-istri-name"
              type="text"
              value={istriInput}
              onChange={(e) => setIstriInput(e.target.value)}
              placeholder="Kas Istri"
              required
              className="w-full rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-sm text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="acc-kel-name" className="mb-1.5 block text-xs font-medium text-[#6B655D]">
              Label Akun Bersama
            </label>
            <input
              id="acc-kel-name"
              type="text"
              value="Kas Keluarga"
              disabled
              className="w-full rounded-md border border-[#E5E0D5] bg-[#F7F5F0] px-3 py-2 text-sm text-[#6B655D]"
            />
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={savingAccounts}
              className="whitespace-nowrap rounded-md bg-[#1D3E5E] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#142D46] disabled:opacity-60"
            >
              {savingAccounts ? 'Menyimpan...' : 'Simpan Nama Akun'}
            </button>
          </div>
        </form>
      </section>

      {/* 3. Kelola Kategori Transaksi */}
      <section className="rounded-lg border border-[#E5E0D5] bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E0D5] pb-4">
          <div>
            <h2 className="font-display text-base font-semibold text-[#1C1917]">
              Kategori Transaksi
            </h2>
            <p className="mt-1 text-xs text-[#6B655D]">
              Tambah, ubah, atau hapus kategori pemasukan dan pengeluaran sesuai kebiasaan rumah tangga.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-md border border-[#E5E0D5] bg-[#EFECE4] p-1">
            {(
              [
                { id: 'income', label: 'Pemasukan' },
                { id: 'expense_pribadi', label: 'Pengeluaran Pribadi' },
                { id: 'expense_keluarga', label: 'Pengeluaran Keluarga' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setCatTab(tab.id);
                  setEditingCat(null);
                }}
                className={`whitespace-nowrap rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  catTab === tab.id
                    ? 'bg-white text-[#1C1917] shadow-xs'
                    : 'text-[#6B655D] hover:text-[#1C1917]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Add Category Form */}
        <form onSubmit={handleAddCategory} className="mt-4 flex flex-wrap gap-2">
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="Tulis nama kategori baru..."
            className="min-w-[220px] flex-1 rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-sm text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-[#1D3E5E] px-4 py-2 text-xs font-medium text-white hover:bg-[#142D46]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Tambah Kategori</span>
          </button>
        </form>

        {/* Category List */}
        <div className="mt-4 divide-y divide-[#E5E0D5] border-t border-[#E5E0D5]">
          {filteredCategories.map((cat) => {
            const isEditing = editingCat?.id === cat.id;
            const usage = categoryUsageCount(cat.id);

            return (
              <div key={cat.id} className="flex items-center justify-between gap-3 py-3">
                {isEditing ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      type="text"
                      value={editCatName}
                      onChange={(e) => setEditCatName(e.target.value)}
                      className="flex-1 rounded-md border border-[#1D3E5E] bg-white px-2.5 py-1.5 text-sm text-[#1C1917] focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveCategoryEdit(cat)}
                      className="inline-flex items-center gap-1 rounded-md bg-[#1D3E5E] px-3 py-1.5 text-xs font-medium text-white"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Simpan</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCat(null)}
                      className="rounded-md border border-[#E5E0D5] px-2.5 py-1.5 text-xs text-[#6B655D]"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="text-sm font-medium text-[#1C1917]">{cat.name}</span>
                      <span className="ml-2 text-xs text-[#6B655D]">
                        {cat.isSystemSavings
                          ? '· Kategori sistem tabungan'
                          : usage > 0
                            ? `· Dipakai ${usage} transaksi`
                            : ''}
                      </span>
                    </div>

                    {!cat.isSystemSavings && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCat(cat);
                            setEditCatName(cat.name);
                          }}
                          className="rounded p-1.5 text-[#6B655D] hover:bg-[#EFECE4] hover:text-[#1D3E5E]"
                          aria-label={`Ubah kategori ${cat.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteCat(cat)}
                          className="rounded p-1.5 text-[#6B655D] hover:bg-[#FCECEB] hover:text-[#B42318]"
                          aria-label={`Hapus kategori ${cat.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Instalasi Offline (PWA) & Reset Data */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-[#E5E0D5] bg-white p-6">
          <h2 className="font-display text-base font-semibold text-[#1C1917]">
            Akses Offline di Perangkat (PWA)
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[#6B655D]">
            Kas Rumah dapat dipasang langsung di laptop atau ponsel agar mudah dibuka tanpa koneksi
            internet.
          </p>

          <div className="mt-4">
            {isInstalled ? (
              <p className="text-xs font-medium text-[#1F6E4A]">
                Aplikasi sudah terpasang dalam mode mandiri (standalone) di perangkat ini.
              </p>
            ) : isInstallable ? (
              <button
                type="button"
                onClick={() => void install()}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-[#1D3E5E] px-4 py-2 text-xs font-medium text-white hover:bg-[#142D46]"
              >
                <HardDriveDownload className="h-4 w-4" />
                <span>Pasang Aplikasi di Perangkat</span>
              </button>
            ) : isIOS ? (
              <button
                type="button"
                onClick={() => setShowIOSGuide((v) => !v)}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-[#E5E0D5] bg-white px-4 py-2 text-xs font-medium text-[#1C1917] hover:bg-[#EFECE4]"
              >
                <Smartphone className="h-4 w-4" />
                <span>Cara Pasang di iPhone / iPad</span>
              </button>
            ) : (
              <p className="text-xs text-[#6B655D]">
                Gunakan menu browser (Install / Tambahkan ke Layar Utama) jika tersedia. Penyimpanan
                IndexedDB tetap bekerja penuh secara offline.
              </p>
            )}

            {showIOSGuide && (
              <div className="mt-3 rounded-md border border-[#E5E0D5] bg-[#F7F5F0] p-3 text-xs leading-relaxed text-[#6B655D]">
                1. Ketuk tombol <strong>Bagikan (Share)</strong> pada bilah Safari.
                <br />
                2. Gulir ke bawah lalu pilih <strong>Tambahkan ke Layar Utama</strong>.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-[#E5E0D5] bg-white p-6">
          <h2 className="font-display text-base font-semibold text-[#1C1917]">
            Kosongkan Data Lokal
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[#6B655D]">
            Menghapus seluruh transaksi, anggaran, dan target tabungan di perangkat ini. Disarankan
            mengunduh backup JSON terlebih dahulu.
          </p>
          <button
            type="button"
            onClick={() => setConfirmResetOpen(true)}
            className="mt-4 inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-[#B42318]/35 bg-[#FCECEB] px-4 py-2 text-xs font-medium text-[#B42318] transition-colors hover:bg-[#F9D8D5]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Hapus Semua Catatan</span>
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(pendingDeleteCat)}
        title="Hapus Kategori Ini?"
        description={
          pendingDeleteCat
            ? `Kategori "${pendingDeleteCat.name}" akan dihapus. ${
                categoryUsageCount(pendingDeleteCat.id) > 0
                  ? `Kategori ini masih dipakai pada ${categoryUsageCount(pendingDeleteCat.id)} transaksi lama (transaksi tetap ada dan akan bertanda "Kategori Dihapus").`
                  : 'Tidak ada transaksi yang memakai kategori ini.'
              }`
            : ''
        }
        confirmLabel="Ya, Hapus Kategori"
        onConfirm={handleConfirmDeleteCat}
        onCancel={() => setPendingDeleteCat(null)}
      />

      <ConfirmDialog
        open={Boolean(pendingRestore)}
        title="Konfirmasi Restore Data Backup"
        description={pendingRestore?.summaryText ?? ''}
        confirmLabel="Ya, Pulihkan Data"
        tone="primary"
        onConfirm={handleConfirmRestore}
        onCancel={() => setPendingRestore(null)}
        busy={restoring}
      />

      <ConfirmDialog
        open={confirmResetOpen}
        title="Kosongkan Seluruh Catatan?"
        description="Seluruh transaksi, anggaran bulanan, dan target tabungan akan dihapus permanen dari browser ini. Akun default dan kategori bawaan akan dikembalikan."
        confirmLabel="Ya, Kosongkan Semua"
        onConfirm={handleConfirmResetAll}
        onCancel={() => setConfirmResetOpen(false)}
        busy={resetting}
      />
    </div>
  );
};

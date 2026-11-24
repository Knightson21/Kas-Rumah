import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import type { AccountId, TransactionType } from '../types/finance';
import { formatInputThousands, getTodayISO, parseRupiahInput } from '../utils/format';

export const TransactionModal: React.FC = () => {
  const { state, isTxModalOpen, editingTx, txPreset, closeTxModal, upsertTransaction } =
    useFinance();

  const [type, setType] = useState<TransactionType>('expense');
  const [date, setDate] = useState<string>(getTodayISO());
  const [accountId, setAccountId] = useState<AccountId>('keluarga');
  const [fromAccountId, setFromAccountId] = useState<AccountId>('suami');
  const [toAccountId, setToAccountId] = useState<AccountId>('keluarga');
  const [categoryId, setCategoryId] = useState<string>('');
  const [amountDisplay, setAmountDisplay] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isLinkedSavings = Boolean(editingTx?.linkedSavingEntryId);

  useEffect(() => {
    if (!isTxModalOpen || !state) return;

    if (editingTx) {
      setType(editingTx.type);
      setDate(editingTx.date);
      setAccountId(editingTx.accountId ?? 'keluarga');
      setFromAccountId(editingTx.fromAccountId ?? 'suami');
      setToAccountId(editingTx.toAccountId ?? 'keluarga');
      setCategoryId(editingTx.categoryId ?? '');
      setAmountDisplay(formatInputThousands(String(editingTx.amount)));
      setDescription(editingTx.description);
      setNotes(editingTx.notes ?? '');
    } else {
      const nextType = txPreset?.type ?? 'expense';
      setType(nextType);
      setDate(getTodayISO());
      setAccountId(txPreset?.accountId ?? 'keluarga');
      setFromAccountId(txPreset?.fromAccountId ?? 'suami');
      setToAccountId(txPreset?.toAccountId ?? 'keluarga');
      setAmountDisplay('');
      setDescription(txPreset?.description ?? '');
      setNotes('');
      setCategoryId('');
    }
    setError(null);
  }, [isTxModalOpen, editingTx, txPreset, state]);

  // Filter categories dynamically by transaction type and account context
  const availableCategories = useMemo(() => {
    if (!state || type === 'transfer') return [];
    const byType = state.categories.filter((c) => c.type === type);
    if (type === 'income') return byType;

    // For expenses, prioritize matching scope (keluarga vs pribadi), while keeping 'semua' available
    const preferredScope = accountId === 'keluarga' ? 'keluarga' : 'pribadi';
    const primary = byType.filter((c) => c.scope === preferredScope || c.scope === 'semua');
    const secondary = byType.filter((c) => c.scope !== preferredScope && c.scope !== 'semua');
    return [...primary, ...secondary];
  }, [state, type, accountId]);

  useEffect(() => {
    if (!isTxModalOpen || type === 'transfer') return;
    if (availableCategories.length === 0) return;
    const stillExists = availableCategories.some((c) => c.id === categoryId);
    if (!stillExists) {
      setCategoryId(availableCategories[0].id);
    }
  }, [availableCategories, categoryId, isTxModalOpen, type]);

  useEffect(() => {
    if (!isTxModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) closeTxModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isTxModalOpen, saving, closeTxModal]);

  if (!isTxModalOpen || !state) return null;

  const accounts = state.accounts;
  const suamiName = accounts.find((a) => a.id === 'suami')?.displayName ?? 'Kas Suami';
  const istriName = accounts.find((a) => a.id === 'istri')?.displayName ?? 'Kas Istri';
  const keluargaName = accounts.find((a) => a.id === 'keluarga')?.displayName ?? 'Kas Keluarga';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseRupiahInput(amountDisplay);
    if (parsedAmount <= 0) {
      setError('Masukkan nominal lebih dari Rp0 (tidak boleh negatif atau kosong).');
      return;
    }

    if (!date) {
      setError('Tanggal transaksi wajib diisi.');
      return;
    }

    if (type === 'transfer') {
      if (fromAccountId === toAccountId) {
        setError('Akun sumber dan akun tujuan transfer tidak boleh sama.');
        return;
      }
    } else if (!categoryId) {
      setError('Pilih kategori transaksi terlebih dahulu.');
      return;
    }

    const defaultDesc =
      type === 'transfer'
        ? toAccountId === 'keluarga'
          ? `Kontribusi ${accounts.find((a) => a.id === fromAccountId)?.displayName ?? ''} ke ${keluargaName}`
          : `Transfer ${accounts.find((a) => a.id === fromAccountId)?.displayName ?? ''} ke ${accounts.find((a) => a.id === toAccountId)?.displayName ?? ''}`
        : availableCategories.find((c) => c.id === categoryId)?.name ?? 'Transaksi';

    setSaving(true);
    try {
      await upsertTransaction(
        {
          date,
          type,
          accountId: type === 'transfer' ? undefined : accountId,
          fromAccountId: type === 'transfer' ? fromAccountId : undefined,
          toAccountId: type === 'transfer' ? toAccountId : undefined,
          categoryId: type === 'transfer' ? undefined : categoryId,
          amount: parsedAmount,
          description: description.trim() || defaultDesc,
          notes: notes.trim() || undefined,
        },
        editingTx?.id
      );
      closeTxModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan transaksi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1917]/45 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-modal-title"
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-lg border border-[#E5E0D5] bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E0D5] px-6 py-4">
          <h2 id="tx-modal-title" className="font-display text-lg font-semibold text-[#1C1917]">
            {editingTx ? 'Ubah Transaksi' : 'Catat Transaksi Baru'}
          </h2>
          <button
            type="button"
            onClick={closeTxModal}
            disabled={saving}
            className="rounded-md p-1.5 text-[#6B655D] transition-colors hover:bg-[#EFECE4] hover:text-[#1C1917]"
            aria-label="Tutup formulir transaksi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* Segmented Type Selector */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#6B655D]">
              Jenis Transaksi
            </label>
            <div className="grid grid-cols-3 gap-1 rounded-md border border-[#E5E0D5] bg-[#EFECE4] p-1">
              {(
                [
                  { id: 'income', label: 'Pemasukan' },
                  { id: 'expense', label: 'Pengeluaran' },
                  { id: 'transfer', label: 'Transfer Akun' },
                ] as const
              ).map((item) => {
                const active = type === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isLinkedSavings && item.id !== 'expense'}
                    onClick={() => setType(item.id)}
                    className={`whitespace-nowrap rounded px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                      active
                        ? 'bg-white text-[#1C1917] shadow-xs'
                        : 'text-[#6B655D] hover:text-[#1C1917]'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            {isLinkedSavings && (
              <p className="mt-1.5 text-xs text-[#B4690E]">
                Transaksi ini tertaut ke Target Tabungan. Perubahan nominal atau tanggal otomatis
                menyesuaikan saldo target tabungan.
              </p>
            )}
          </div>

          {/* Quick Transfer Shortcuts when type === 'transfer' */}
          {type === 'transfer' && !editingTx && (
            <div className="flex flex-wrap items-center gap-2 border-b border-[#E5E0D5] pb-3">
              <span className="text-xs text-[#6B655D]">Pintasan kontribusi:</span>
              <button
                type="button"
                onClick={() => {
                  setFromAccountId('suami');
                  setToAccountId('keluarga');
                  if (!description) setDescription(`Kontribusi ${suamiName} ke ${keluargaName}`);
                }}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-[#E5E0D5] bg-[#F7F5F0] px-2.5 py-1 text-xs font-medium text-[#1D3E5E] transition-colors hover:border-[#1D3E5E]/40"
              >
                <span>{suamiName}</span>
                <ArrowRight className="h-3 w-3" />
                <span>{keluargaName}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFromAccountId('istri');
                  setToAccountId('keluarga');
                  if (!description) setDescription(`Kontribusi ${istriName} ke ${keluargaName}`);
                }}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-[#E5E0D5] bg-[#F7F5F0] px-2.5 py-1 text-xs font-medium text-[#B68D40] transition-colors hover:border-[#B68D40]/50"
              >
                <span>{istriName}</span>
                <ArrowRight className="h-3 w-3" />
                <span>{keluargaName}</span>
              </button>
            </div>
          )}

          {/* Date & Nominal */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tx-date" className="mb-1.5 block text-xs font-medium text-[#6B655D]">
                Tanggal
              </label>
              <input
                id="tx-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="font-num w-full rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-sm text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="tx-amount" className="mb-1.5 block text-xs font-medium text-[#6B655D]">
                Nominal (Rp)
              </label>
              <div className="relative">
                <span className="font-num pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B655D]">
                  Rp
                </span>
                <input
                  id="tx-amount"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={amountDisplay}
                  onChange={(e) => setAmountDisplay(formatInputThousands(e.target.value))}
                  required
                  className="font-num w-full rounded-md border border-[#E5E0D5] bg-white py-2 pl-9 pr-3 text-right text-sm font-medium text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Account Selector(s) */}
          {type === 'transfer' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="tx-from-account"
                  className="mb-1.5 block text-xs font-medium text-[#6B655D]"
                >
                  Dari Akun (Sumber)
                </label>
                <select
                  id="tx-from-account"
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value as AccountId)}
                  className="w-full rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-sm text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="tx-to-account"
                  className="mb-1.5 block text-xs font-medium text-[#6B655D]"
                >
                  Ke Akun (Tujuan)
                </label>
                <select
                  id="tx-to-account"
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value as AccountId)}
                  className="w-full rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-sm text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.displayName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="tx-account"
                  className="mb-1.5 block text-xs font-medium text-[#6B655D]"
                >
                  Akun Terkait
                </label>
                <select
                  id="tx-account"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value as AccountId)}
                  className="w-full rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-sm text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="tx-category"
                  className="mb-1.5 block text-xs font-medium text-[#6B655D]"
                >
                  Kategori
                </label>
                <select
                  id="tx-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={isLinkedSavings}
                  className="w-full rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-sm text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none disabled:bg-[#F7F5F0]"
                >
                  {availableCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {type === 'transfer' && (
            <p className="rounded-md border border-[#E5E0D5] bg-[#F7F5F0] px-3 py-2 text-xs leading-relaxed text-[#6B655D]">
              Transfer memindahkan dana antar-akun tanpa menambah atau mengurangi total pemasukan
              maupun pengeluaran keluarga gabungan.
            </p>
          )}

          {/* Description */}
          <div>
            <label htmlFor="tx-desc" className="mb-1.5 block text-xs font-medium text-[#6B655D]">
              Keterangan
            </label>
            <input
              id="tx-desc"
              type="text"
              placeholder={
                type === 'transfer'
                  ? `Contoh: Kontribusi bulanan ke ${keluargaName}`
                  : type === 'income'
                    ? 'Contoh: Gaji bulanan'
                    : 'Contoh: Belanja kebutuhan dapur mingguan'
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-sm text-[#1C1917] placeholder:text-[#6B655D]/60 focus:border-[#1D3E5E] focus:outline-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="tx-notes" className="mb-1.5 block text-xs font-medium text-[#6B655D]">
              Catatan Tambahan (Opsional)
            </label>
            <textarea
              id="tx-notes"
              rows={2}
              placeholder="Detail struk, metode pembayaran, atau catatan singkat..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full resize-none rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-sm text-[#1C1917] placeholder:text-[#6B655D]/60 focus:border-[#1D3E5E] focus:outline-none"
            />
          </div>

          {error && (
            <div className="rounded-md border border-[#B42318]/25 bg-[#FCECEB] px-3 py-2 text-xs font-medium text-[#B42318]">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 border-t border-[#E5E0D5] pt-4">
            <button
              type="button"
              onClick={closeTxModal}
              disabled={saving}
              className="whitespace-nowrap rounded-md border border-[#E5E0D5] bg-white px-4 py-2 text-sm font-medium text-[#1C1917] transition-colors hover:bg-[#EFECE4]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="whitespace-nowrap rounded-md bg-[#1D3E5E] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#142D46] disabled:opacity-60"
            >
              {saving ? 'Menyimpan...' : editingTx ? 'Simpan Perubahan' : 'Simpan Transaksi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

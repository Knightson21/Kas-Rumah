import type { Account, AppSettings, Category } from '../types/finance';

export const DEFAULT_ACCOUNTS: Account[] = [
  {
    id: 'suami',
    defaultName: 'Kas Suami',
    displayName: 'Kas Suami',
    description: 'Pemasukan pribadi, pengeluaran pribadi, dan kontribusi suami ke kas keluarga.',
    editableName: true,
  },
  {
    id: 'istri',
    defaultName: 'Kas Istri',
    displayName: 'Kas Istri',
    description: 'Pemasukan pribadi, pengeluaran pribadi, dan kontribusi istri ke kas keluarga.',
    editableName: true,
  },
  {
    id: 'keluarga',
    defaultName: 'Kas Keluarga',
    displayName: 'Kas Keluarga',
    description: 'Dana kontribusi bersama, pemasukan keluarga, dan kebutuhan rumah tangga.',
    editableName: false,
  },
];

export const SAVINGS_EXPENSE_CATEGORY_ID = 'cat_exp_tabungan';

export const DEFAULT_CATEGORIES: Category[] = [
  // Kategori Pemasukan (7)
  { id: 'cat_inc_gaji_suami', name: 'Gaji Suami', type: 'income', scope: 'semua', isDefault: true },
  { id: 'cat_inc_gaji_istri', name: 'Gaji Istri', type: 'income', scope: 'semua', isDefault: true },
  { id: 'cat_inc_bonus', name: 'Bonus', type: 'income', scope: 'semua', isDefault: true },
  { id: 'cat_inc_usaha', name: 'Usaha', type: 'income', scope: 'semua', isDefault: true },
  { id: 'cat_inc_freelance', name: 'Freelance', type: 'income', scope: 'semua', isDefault: true },
  { id: 'cat_inc_hadiah', name: 'Hadiah', type: 'income', scope: 'semua', isDefault: true },
  { id: 'cat_inc_lainnya', name: 'Pemasukan Lainnya', type: 'income', scope: 'semua', isDefault: true },

  // Kategori Pengeluaran Pribadi (8)
  { id: 'cat_exp_prib_makan', name: 'Makan dan Minum', type: 'expense', scope: 'pribadi', isDefault: true },
  { id: 'cat_exp_prib_transport', name: 'Transportasi', type: 'expense', scope: 'pribadi', isDefault: true },
  { id: 'cat_exp_prib_kebutuhan', name: 'Kebutuhan Pribadi', type: 'expense', scope: 'pribadi', isDefault: true },
  { id: 'cat_exp_prib_kesehatan', name: 'Kesehatan', type: 'expense', scope: 'pribadi', isDefault: true },
  { id: 'cat_exp_prib_pendidikan', name: 'Pendidikan', type: 'expense', scope: 'pribadi', isDefault: true },
  { id: 'cat_exp_prib_hiburan', name: 'Hiburan', type: 'expense', scope: 'pribadi', isDefault: true },
  { id: 'cat_exp_prib_sedekah', name: 'Sedekah', type: 'expense', scope: 'pribadi', isDefault: true },
  { id: 'cat_exp_prib_lainnya', name: 'Lainnya (Pribadi)', type: 'expense', scope: 'pribadi', isDefault: true },

  // Kategori Pengeluaran Keluarga (12)
  { id: 'cat_exp_kel_dapur', name: 'Belanja Dapur', type: 'expense', scope: 'keluarga', isDefault: true },
  { id: 'cat_exp_kel_rumah', name: 'Kebutuhan Rumah', type: 'expense', scope: 'keluarga', isDefault: true },
  { id: 'cat_exp_kel_listrik', name: 'Listrik dan Air', type: 'expense', scope: 'keluarga', isDefault: true },
  { id: 'cat_exp_kel_internet', name: 'Internet', type: 'expense', scope: 'keluarga', isDefault: true },
  { id: 'cat_exp_kel_pendidikan', name: 'Pendidikan Anak', type: 'expense', scope: 'keluarga', isDefault: true },
  { id: 'cat_exp_kel_kesehatan', name: 'Kesehatan Keluarga', type: 'expense', scope: 'keluarga', isDefault: true },
  { id: 'cat_exp_kel_transport', name: 'Transportasi Keluarga', type: 'expense', scope: 'keluarga', isDefault: true },
  { id: 'cat_exp_kel_cicilan', name: 'Cicilan', type: 'expense', scope: 'keluarga', isDefault: true },
  { id: 'cat_exp_kel_rekreasi', name: 'Rekreasi', type: 'expense', scope: 'keluarga', isDefault: true },
  { id: 'cat_exp_kel_sedekah', name: 'Sedekah dan Wakaf', type: 'expense', scope: 'keluarga', isDefault: true },
  { id: 'cat_exp_kel_darurat', name: 'Dana Darurat', type: 'expense', scope: 'keluarga', isDefault: true },
  { id: 'cat_exp_kel_lainnya', name: 'Lainnya (Keluarga)', type: 'expense', scope: 'keluarga', isDefault: true },

  // Kategori khusus untuk setoran target tabungan tertaut
  {
    id: SAVINGS_EXPENSE_CATEGORY_ID,
    name: 'Setoran Tabungan',
    type: 'expense',
    scope: 'semua',
    isDefault: true,
    isSystemSavings: true,
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'main',
  lastBackupAt: null,
  backupReminderDays: 14,
  currency: 'IDR',
};

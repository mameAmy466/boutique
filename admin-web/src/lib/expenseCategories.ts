import type { ExpenseCategory } from '../api/types';

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  loyer: 'Loyer',
  electricite: 'Électricité',
  eau: 'Eau',
  internet: 'Internet',
  transport: 'Transport',
  salaires: 'Salaires',
  fournitures: 'Fournitures',
  marketing: 'Marketing',
  taxes: 'Taxes',
  autre: 'Autre',
};

export const EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABEL) as ExpenseCategory[];

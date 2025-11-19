import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PendingTransaction {
  hash: string;
  nonce: number;
  timestamp: number;
  status: 'pending' | 'speeding_up' | 'cancelling' | 'confirmed' | 'failed';
  description?: string;
  gasPrice?: {
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  };
  originalHash?: string; // For speed-up/cancel transactions
}

interface TransactionStore {
  pendingTransactions: PendingTransaction[];
  addTransaction: (transaction: Omit<PendingTransaction, 'timestamp'>) => void;
  removeTransaction: (hash: string) => void;
  updateTransactionStatus: (hash: string, status: PendingTransaction['status']) => void;
  updateTransactionGas: (hash: string, gasPrice: PendingTransaction['gasPrice']) => void;
  clearTransactions: () => void;
  getTransactionByNonce: (nonce: number) => PendingTransaction | undefined;
  getPendingCount: () => number;
}

export const useTransactionStore = create<TransactionStore>()(
  persist(
    (set, get) => ({
      pendingTransactions: [],
      
      addTransaction: (transaction) => {
        const newTransaction: PendingTransaction = {
          ...transaction,
          timestamp: Date.now(),
        };
        
        set((state) => ({
          pendingTransactions: [...state.pendingTransactions, newTransaction],
        }));
      },
      
      removeTransaction: (hash) => {
        set((state) => ({
          pendingTransactions: state.pendingTransactions.filter(tx => tx.hash !== hash),
        }));
      },
      
      updateTransactionStatus: (hash, status) => {
        set((state) => ({
          pendingTransactions: state.pendingTransactions.map(tx =>
            tx.hash === hash ? { ...tx, status } : tx
          ),
        }));
      },
      
      updateTransactionGas: (hash, gasPrice) => {
        set((state) => ({
          pendingTransactions: state.pendingTransactions.map(tx =>
            tx.hash === hash ? { ...tx, gasPrice } : tx
          ),
        }));
      },
      
      clearTransactions: () => {
        set({ pendingTransactions: [] });
      },
      
      getTransactionByNonce: (nonce) => {
        return get().pendingTransactions.find(tx => tx.nonce === nonce && tx.status === 'pending');
      },
      
      getPendingCount: () => {
        return get().pendingTransactions.filter(tx => 
          tx.status === 'pending' || tx.status === 'speeding_up' || tx.status === 'cancelling'
        ).length;
      },
    }),
    {
      name: 'sovry-transactions',
      partialize: (state) => ({ 
        pendingTransactions: state.pendingTransactions.filter(tx => 
          tx.status === 'pending' || tx.status === 'speeding_up' || tx.status === 'cancelling'
        )
      }),
    }
  )
);

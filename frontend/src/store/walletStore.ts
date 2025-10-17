import { create } from 'zustand';
import { useAuthStore } from './authStore';

interface WalletState {
  tokenBalance: number;
  reservedBalance: number;
  currencyCode: string;
  conversionRate: number;
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
}

interface WalletActions {
  fetchBalance: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  fetchTransactions: (limit?: number, offset?: number) => Promise<void>;
  buyTokens: (amount: number, currency?: string) => Promise<void>;
  sendTip: (streamId: string, tokens: number, message?: string) => Promise<void>;
  clearError: () => void;
}

interface Transaction {
  id: string;
  transaction_type: string;
  amount_tokens: number;
  amount_currency?: number;
  fee_tokens?: number;
  balance_after: number;
  reference_id?: string;
  reference_type?: string;
  description: string;
  created_at: string;
}

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const useWalletStore = create<WalletState & WalletActions>((set, get) => ({
  // State
  tokenBalance: 0,
  reservedBalance: 0,
  currencyCode: 'USD',
  conversionRate: 100,
  transactions: [],
  isLoading: false,
  error: null,

  // Actions
  fetchBalance: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const { token } = useAuthStore.getState();
      
      const response = await fetch(`${API_BASE_URL}/api/wallet/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch balance');
      }

      set({
        tokenBalance: data.token_balance,
        reservedBalance: data.reserved_balance,
        currencyCode: data.currency_code,
        conversionRate: data.conversion_rate,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch balance',
        isLoading: false,
      });
    }
  },

  refreshBalance: async () => {
    const { fetchBalance } = get();
    await fetchBalance();
  },

  fetchTransactions: async (limit = 20, offset = 0) => {
    set({ isLoading: true, error: null });
    
    try {
      const { token } = useAuthStore.getState();
      
      const response = await fetch(`${API_BASE_URL}/api/wallet/transactions?limit=${limit}&offset=${offset}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch transactions');
      }

      set({
        transactions: data.transactions,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch transactions',
        isLoading: false,
      });
    }
  },

  buyTokens: async (amount: number, currency = 'USD') => {
    set({ isLoading: true, error: null });
    
    try {
      const { token } = useAuthStore.getState();
      
      const response = await fetch(`${API_BASE_URL}/api/wallet/buy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount_tokens: amount,
          currency_code: currency,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to initiate token purchase');
      }

      // In a real implementation, this would redirect to payment processor
      console.log('Payment session created:', data);
      
      set({ isLoading: false });
      
      // Return the payment session for handling
      return data;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to buy tokens',
        isLoading: false,
      });
      throw error;
    }
  },

  sendTip: async (streamId: string, tokens: number, message?: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const { token } = useAuthStore.getState();
      
      const response = await fetch(`${API_BASE_URL}/api/wallet/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          stream_id: streamId,
          tokens,
          message,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send tip');
      }

      // Update balance
      set(state => ({
        tokenBalance: data.balance_after,
        isLoading: false,
      }));

      // Refresh transactions
      get().fetchTransactions();
      
      return data;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to send tip',
        isLoading: false,
      });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));


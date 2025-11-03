import React, { useState, useEffect } from 'react';
import { useWalletStore } from '../store/walletStore';
import { useAuthStore } from '../store/authStore';
import { 
  Wallet as WalletIcon, 
  TrendingUp, 
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  CreditCard,
  History,
  Filter,
  Search,
  Download
} from 'lucide-react';
import { Link } from 'react-router-dom';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

interface Transaction {
  id: string;
  transaction_type: string;
  amount_tokens: number;
  amount_currency?: number;
  fee_tokens?: number;
  balance_before: number;
  balance_after: number;
  reference_id?: string;
  reference_type?: string;
  description: string;
  created_at: string;
  counterparty_id?: string;
}

const Wallet: React.FC = () => {
  const { tokenBalance, reservedBalance, transactions, isLoading, error, fetchBalance, fetchTransactions, connectSocket, disconnectSocket } = useWalletStore();
  const { token } = useAuthStore();
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const transactionsPerPage = 20;

  useEffect(() => {
    fetchBalance();
    fetchTransactions(transactionsPerPage, 0);
    
    // Connect to socket for real-time updates
    if (token) {
      connectSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, [fetchBalance, fetchTransactions, token, connectSocket, disconnectSocket]);

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'token_purchase': 'Token Purchase',
      'tip_sent': 'Tip Sent',
      'tip_received': 'Tip Received',
      'payout_request': 'Payout Request',
      'payout_completed': 'Payout Completed',
      'refund': 'Refund',
      'fee_deduction': 'Fee Deduction',
      'bonus': 'Bonus',
      'adjustment': 'Adjustment'
    };
    return labels[type] || type;
  };

  const getTransactionIcon = (type: string) => {
    if (type === 'token_purchase' || type === 'tip_received' || type === 'bonus') {
      return <ArrowDownRight className="w-4 h-4 text-green-600" />;
    }
    return <ArrowUpRight className="w-4 h-4 text-red-600" />;
  };

  const getTransactionColor = (type: string) => {
    if (type === 'token_purchase' || type === 'tip_received' || type === 'bonus') {
      return 'text-green-600';
    }
    return 'text-red-600';
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesFilter = selectedFilter === 'all' || transaction.transaction_type === selectedFilter;
    const matchesSearch = searchQuery === '' || 
      transaction.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getTransactionTypeLabel(transaction.transaction_type).toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * transactionsPerPage,
    currentPage * transactionsPerPage
  );

  const transactionTypes = [
    { value: 'all', label: 'All Transactions' },
    { value: 'token_purchase', label: 'Purchases' },
    { value: 'tip_sent', label: 'Tips Sent' },
    { value: 'tip_received', label: 'Tips Received' },
    { value: 'payout_completed', label: 'Payouts' },
    { value: 'refund', label: 'Refunds' }
  ];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount: number) => {
    return Math.abs(amount).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Wallet</h1>
          <p className="text-gray-600">Manage your tokens and view transaction history</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Balance */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-primary-100 rounded-lg">
                  <WalletIcon className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Balance</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {tokenBalance.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Available tokens</p>
                </div>
              </div>
              <button
                onClick={() => fetchBalance()}
                disabled={isLoading}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh balance"
              >
                <RefreshCw className={`w-5 h-5 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Reserved Balance */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Reserved</p>
                <p className="text-2xl font-bold text-gray-900">
                  {reservedBalance.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">In pending transactions</p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <CreditCard className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Quick Actions</p>
              </div>
            </div>
            <Link
              to="/buy-tokens"
              className="w-full bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
            >
              <CreditCard className="w-4 h-4" />
              <span>Buy Tokens</span>
            </Link>
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Header with Filters */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center space-x-2">
                <History className="w-5 h-5 text-gray-600" />
                <h2 className="text-xl font-semibold text-gray-900">Transaction History</h2>
              </div>

              {/* Search and Filter */}
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search transactions..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                {/* Filter */}
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={selectedFilter}
                    onChange={(e) => {
                      setSelectedFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
                  >
                    {transactionTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Transactions List */}
          <div className="divide-y divide-gray-200">
            {isLoading && transactions.length === 0 ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-4 text-gray-500">Loading transactions...</p>
              </div>
            ) : paginatedTransactions.length === 0 ? (
              <div className="p-12 text-center">
                <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No transactions found</p>
                {selectedFilter !== 'all' && (
                  <button
                    onClick={() => setSelectedFilter('all')}
                    className="mt-2 text-primary-600 hover:text-primary-700 text-sm"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            ) : (
              paginatedTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      {/* Icon */}
                      <div className={`p-3 rounded-lg ${
                        transaction.transaction_type === 'token_purchase' || 
                        transaction.transaction_type === 'tip_received' ||
                        transaction.transaction_type === 'bonus'
                          ? 'bg-green-100' 
                          : 'bg-red-100'
                      }`}>
                        {getTransactionIcon(transaction.transaction_type)}
                      </div>

                      {/* Transaction Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="font-medium text-gray-900">
                            {getTransactionTypeLabel(transaction.transaction_type)}
                          </p>
                          {transaction.reference_type && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                              {transaction.reference_type}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {transaction.description}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(transaction.created_at)}
                        </p>
                      </div>

                      {/* Amount */}
                      <div className="text-right">
                        <p className={`text-lg font-semibold ${getTransactionColor(transaction.transaction_type)}`}>
                          {transaction.amount_tokens > 0 ? '+' : '-'}{formatAmount(transaction.amount_tokens)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Balance: {transaction.balance_after.toLocaleString()}
                        </p>
                        {transaction.amount_currency && (
                          <p className="text-xs text-gray-400 mt-1">
                            ≈ ₹{(transaction.amount_currency).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {filteredTransactions.length > transactionsPerPage && (
            <div className="p-6 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {(currentPage - 1) * transactionsPerPage + 1} to{' '}
                {Math.min(currentPage * transactionsPerPage, filteredTransactions.length)} of{' '}
                {filteredTransactions.length} transactions
              </p>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {Math.ceil(filteredTransactions.length / transactionsPerPage)}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredTransactions.length / transactionsPerPage), prev + 1))}
                  disabled={currentPage >= Math.ceil(filteredTransactions.length / transactionsPerPage)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Load More / Refresh */}
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  fetchTransactions(transactionsPerPage, 0);
                  fetchBalance();
                }}
                disabled={isLoading}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                onClick={() => {
                  // Export functionality could be added here
                  alert('Export feature coming soon!');
                }}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Spent</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {transactions
                    .filter(t => t.amount_tokens < 0)
                    .reduce((sum, t) => sum + Math.abs(t.amount_tokens), 0)
                    .toLocaleString()}
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Earned</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {transactions
                    .filter(t => t.transaction_type === 'tip_received')
                    .reduce((sum, t) => sum + t.amount_tokens, 0)
                    .toLocaleString()}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Purchased</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {transactions
                    .filter(t => t.transaction_type === 'token_purchase')
                    .reduce((sum, t) => sum + t.amount_tokens, 0)
                    .toLocaleString()}
                </p>
              </div>
              <CreditCard className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Wallet;

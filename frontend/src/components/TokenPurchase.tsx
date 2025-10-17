import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { useWalletStore } from '../store/walletStore';

interface TokenPackage {
  id: string;
  tokens: number;
  price: number;
  discount: number;
  savings: number;
}

interface PaymentMethods {
  supportedMethods: string[];
  upiApps: string[];
  preferredMethods: string[];
  tokenPricing: Record<string, any>;
}

const TokenPurchase: React.FC = () => {
  const { tokenBalance, refreshBalance } = useWalletStore();
  
  const [packages, setPackages] = useState<TokenPackage[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethods | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<string>('1000');
  const [selectedMethod, setSelectedMethod] = useState<string>('upi');
  const [selectedUpiApp, setSelectedUpiApp] = useState<string>('googlepay');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string>('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [paymentOrder, setPaymentOrder] = useState<any>(null);

  // Load token packages and payment methods
  useEffect(() => {
    loadPaymentData();
  }, []);

  const loadPaymentData = async () => {
    try {
      setLoading(true);
      
      // Load token packages
      const packagesResponse = await fetch('/api/payments/token-packages');
      const packagesData = await packagesResponse.json();
      setPackages(packagesData.packages);

      // Load payment methods
      const methodsResponse = await fetch('/api/payments/methods', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const methodsData = await methodsResponse.json();
      setPaymentMethods(methodsData);
      
    } catch (error) {
      console.error('Failed to load payment data:', error);
      setError('Failed to load payment options');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      if (selectedMethod === 'upi') {
        await handleUPIPayment();
      } else {
        await handleRazorpayPayment();
      }
    } catch (error) {
      console.error('Purchase failed:', error);
      setError(error instanceof Error ? error.message : 'Purchase failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUPIPayment = async () => {
    try {
      const response = await fetch('/api/payments/upi-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          tokenPackage: selectedPackage,
          upiApp: selectedUpiApp
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setPaymentOrder(data.upiLink);
        
        // Generate QR code
        const qrCodeData = await QRCode.toDataURL(data.upiLink.upiLink);
        setQrCode(qrCodeData);
        
        setSuccess('UPI payment link generated! Scan the QR code or use the UPI app.');
      } else {
        throw new Error(data.message || 'Failed to create UPI payment');
      }
    } catch (error) {
      throw error;
    }
  };

  const handleRazorpayPayment = async () => {
    try {
      const response = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          tokenPackage: selectedPackage,
          paymentMethod: selectedMethod
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setPaymentOrder(data.order);
        
        // Initialize Razorpay
        const options = {
          key: process.env.REACT_APP_RAZORPAY_KEY_ID,
          amount: data.order.amount * 100, // Amount in paise
          currency: data.order.currency,
          name: 'LivePanty',
          description: `Purchase ${data.order.tokens} tokens`,
          order_id: data.order.orderId,
          handler: async (response: any) => {
            await verifyPayment(response);
          },
          prefill: {
            name: 'User',
            email: 'user@example.com'
          },
          theme: {
            color: '#ec4899'
          }
        };

        const razorpay = new (window as any).Razorpay(options);
        razorpay.open();
      } else {
        throw new Error(data.message || 'Failed to create payment order');
      }
    } catch (error) {
      throw error;
    }
  };

  const verifyPayment = async (paymentResponse: any) => {
    try {
      const response = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          paymentId: paymentResponse.razorpay_payment_id,
          orderId: paymentResponse.razorpay_order_id,
          signature: paymentResponse.razorpay_signature
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(`Payment successful! ${data.data.tokens} tokens added to your wallet.`);
        setPaymentOrder(null);
        setQrCode('');
        await refreshBalance();
      } else {
        throw new Error(data.message || 'Payment verification failed');
      }
    } catch (error) {
      throw error;
    }
  };

  const selectedPackageData = packages.find(pkg => pkg.id === selectedPackage);

  if (loading && !packages.length) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-pink-500 mx-auto"></div>
          <p className="text-white mt-4">Loading payment options...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">Buy Tokens</h1>
          <p className="text-gray-400">Purchase tokens to tip performers and unlock premium features</p>
          <div className="mt-4">
            <span className="text-sm text-gray-400">Current Balance: </span>
            <span className="text-2xl font-bold text-pink-500">{tokenBalance} tokens</span>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500 bg-opacity-20 border border-green-500 text-green-300 px-4 py-3 rounded-lg mb-6">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Token Packages */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-6">Choose Token Package</h2>
            <div className="grid grid-cols-2 gap-4">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg.id)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedPackage === pkg.id
                      ? 'border-pink-500 bg-pink-500 bg-opacity-10'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl font-bold text-pink-500">{pkg.tokens}</div>
                    <div className="text-sm text-gray-400">tokens</div>
                    <div className="mt-2">
                      <span className="text-lg font-bold">₹{pkg.price}</span>
                      {pkg.discount > 0 && (
                        <span className="text-sm text-green-400 ml-2">
                          ({pkg.discount}% off)
                        </span>
                      )}
                    </div>
                    {pkg.savings > 0 && (
                      <div className="text-xs text-green-400 mt-1">
                        Save ₹{pkg.savings}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Methods */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-6">Payment Method</h2>
            
            {/* Payment Method Selection */}
            <div className="space-y-4 mb-6">
              {paymentMethods?.supportedMethods.map((method) => (
                <label key={method} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={method}
                    checked={selectedMethod === method}
                    onChange={(e) => setSelectedMethod(e.target.value)}
                    className="text-pink-500"
                  />
                  <span className="capitalize">{method}</span>
                </label>
              ))}
            </div>

            {/* UPI App Selection */}
            {selectedMethod === 'upi' && (
              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-2">Choose UPI App</label>
                <div className="grid grid-cols-2 gap-2">
                  {paymentMethods?.upiApps.map((app) => (
                    <button
                      key={app}
                      onClick={() => setSelectedUpiApp(app)}
                      className={`p-2 rounded-lg text-sm transition-all ${
                        selectedUpiApp === app
                          ? 'bg-pink-500 text-white'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      {app.charAt(0).toUpperCase() + app.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Purchase Button */}
            <button
              onClick={handlePurchase}
              disabled={loading || !selectedPackageData}
              className="w-full bg-pink-500 hover:bg-pink-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 rounded-lg font-bold text-lg"
            >
              {loading ? 'Processing...' : `Buy ${selectedPackageData?.tokens} Tokens for ₹${selectedPackageData?.price}`}
            </button>
          </div>
        </div>

        {/* QR Code Display */}
        {qrCode && (
          <div className="mt-8 bg-gray-800 rounded-lg p-6 text-center">
            <h3 className="text-xl font-bold mb-4">Scan QR Code to Pay</h3>
            <div className="flex justify-center">
              <img src={qrCode} alt="UPI QR Code" className="w-64 h-64" />
            </div>
            <p className="text-gray-400 mt-4">
              Open {selectedUpiApp.charAt(0).toUpperCase() + selectedUpiApp.slice(1)} and scan this QR code
            </p>
            <button
              onClick={() => {
                setQrCode('');
                setPaymentOrder(null);
              }}
              className="mt-4 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Payment Instructions */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">Payment Instructions</h3>
          <div className="space-y-2 text-sm text-gray-400">
            <p>• Tokens are added to your wallet immediately after successful payment</p>
            <p>• You can use tokens to tip performers during live streams</p>
            <p>• Tokens never expire and can be used anytime</p>
            <p>• All payments are processed securely through Razorpay</p>
            <p>• For UPI payments, make sure you have the selected UPI app installed</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenPurchase;

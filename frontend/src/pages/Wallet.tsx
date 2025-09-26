import React from 'react';

const Wallet: React.FC = () => {
  return (
    <div className="p-6">
      <div className="card">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Wallet
        </h1>
        <p className="text-gray-600">
          This is where the wallet interface will be implemented.
          Features will include:
        </p>
        <ul className="list-disc list-inside mt-4 space-y-2 text-gray-600">
          <li>Token balance display</li>
          <li>Buy tokens interface</li>
          <li>Transaction history</li>
          <li>Tip history</li>
          <li>Payment methods</li>
        </ul>
      </div>
    </div>
  );
};

export default Wallet;

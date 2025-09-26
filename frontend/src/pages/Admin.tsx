import React from 'react';

const Admin: React.FC = () => {
  return (
    <div className="p-6">
      <div className="card">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Admin Dashboard
        </h1>
        <p className="text-gray-600">
          This is where the admin interface will be implemented.
          Features will include:
        </p>
        <ul className="list-disc list-inside mt-4 space-y-2 text-gray-600">
          <li>User management</li>
          <li>Content moderation</li>
          <li>Platform analytics</li>
          <li>KYC verification</li>
          <li>System settings</li>
        </ul>
      </div>
    </div>
  );
};

export default Admin;

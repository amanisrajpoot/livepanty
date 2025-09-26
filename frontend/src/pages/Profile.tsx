import React from 'react';

const Profile: React.FC = () => {
  return (
    <div className="p-6">
      <div className="card">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          User Profile
        </h1>
        <p className="text-gray-600">
          This is where the user profile interface will be implemented.
          Features will include:
        </p>
        <ul className="list-disc list-inside mt-4 space-y-2 text-gray-600">
          <li>Profile information editing</li>
          <li>Avatar upload</li>
          <li>Bio and preferences</li>
          <li>Stream history</li>
          <li>Account settings</li>
        </ul>
      </div>
    </div>
  );
};

export default Profile;

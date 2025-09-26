import React from 'react';

const CreateStream: React.FC = () => {
  return (
    <div className="p-6">
      <div className="card">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Create New Stream
        </h1>
        <p className="text-gray-600">
          This is where the stream creation interface will be implemented.
          Features will include:
        </p>
        <ul className="list-disc list-inside mt-4 space-y-2 text-gray-600">
          <li>Stream title and description</li>
          <li>Category selection</li>
          <li>Privacy settings</li>
          <li>Tip and chat options</li>
          <li>Stream preview</li>
        </ul>
      </div>
    </div>
  );
};

export default CreateStream;

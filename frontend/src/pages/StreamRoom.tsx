import React from 'react';
import { useParams } from 'react-router-dom';

const StreamRoom: React.FC = () => {
  const { streamId } = useParams<{ streamId: string }>();

  return (
    <div className="p-6">
      <div className="card">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Stream Room: {streamId}
        </h1>
        <p className="text-gray-600">
          This is where the live streaming interface will be implemented.
          Features will include:
        </p>
        <ul className="list-disc list-inside mt-4 space-y-2 text-gray-600">
          <li>WebRTC video streaming</li>
          <li>Real-time chat</li>
          <li>Tip sending interface</li>
          <li>Viewer list</li>
          <li>Stream controls (for performers)</li>
        </ul>
      </div>
    </div>
  );
};

export default StreamRoom;

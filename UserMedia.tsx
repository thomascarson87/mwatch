import React, { useEffect, useRef } from 'react';
import { User } from './types';
import { MicOff, VideoOff } from 'lucide-react';

interface UserMediaProps {
  user: User;
  stream?: MediaStream;
  className?: string;
}

export const UserMedia: React.FC<UserMediaProps> = ({ user, stream, className = "" }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`relative bg-stadium-800 rounded-full overflow-hidden border-2 border-stadium-700/50 shadow-lg group ${className}`}>
      {/* Video Stream or Placeholder */}
      {(!user.isVideoOff && stream) ? (
        <video
          ref={videoRef}
          autoPlay
          muted={user.isLocal} // Always mute local to prevent echo
          playsInline
          className="w-full h-full object-cover transform scale-x-[-1]" // Mirror effect
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-stadium-700">
          <div className="text-lg sm:text-2xl font-bold text-gray-300">
            {user.name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* Hover Name Tag - Shows on hover for floating bubbles */}
      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
          <span className="text-[10px] text-white font-bold truncate px-2">{user.name}</span>
      </div>
      
      {/* Persistent Icons */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-1 gap-1">
        {user.isMuted && <div className="bg-red-500/80 p-0.5 rounded-full"><MicOff size={10} className="text-white" /></div>}
        {user.isVideoOff && <div className="bg-red-500/80 p-0.5 rounded-full"><VideoOff size={10} className="text-white" /></div>}
      </div>
      
      {/* Audio Indicator (Ring effect) */}
      {!user.isMuted && !user.isLocal && (
        <div className="absolute inset-0 border-2 border-green-500/50 rounded-full animate-pulse pointer-events-none"></div>
      )}
    </div>
  );
};
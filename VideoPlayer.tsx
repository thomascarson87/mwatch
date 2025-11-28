import React, { useMemo } from 'react';
import { StreamConfig } from './types';

interface VideoPlayerProps {
  streamConfig: StreamConfig;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ streamConfig }) => {
  
  const embedUrl = useMemo(() => {
    let { url } = streamConfig;
    if (!url) return '';

    // Extract src from raw iframe string if provided
    if (url.trim().startsWith('<iframe') || url.trim().includes('<iframe')) {
        const srcMatch = url.match(/src\s*=\s*["']([^"']+)["']/i);
        if (srcMatch && srcMatch[1]) {
            url = srcMatch[1];
        }
    }

    // Simple YouTube parser
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=))([\w\-]{10,12})\b/);
    
    if (ytMatch && ytMatch[1]) {
      return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&mute=1&controls=1`;
    }
    
    return url;
  }, [streamConfig]);

  if (!streamConfig.url) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black/40 text-stadium-700">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-50">
          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
          <line x1="7" y1="2" x2="7" y2="22"></line>
          <line x1="17" y1="2" x2="17" y2="22"></line>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <line x1="2" y1="7" x2="7" y2="7"></line>
          <line x1="2" y1="17" x2="7" y2="17"></line>
          <line x1="17" y1="17" x2="22" y2="17"></line>
          <line x1="17" y1="7" x2="22" y2="7"></line>
        </svg>
        <p className="text-xl font-medium opacity-50">Enter a stream URL or Embed Code to start</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-black relative overflow-hidden">
      <iframe
        src={embedUrl}
        className="w-full h-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        title="Sports Stream"
      />
    </div>
  );
};

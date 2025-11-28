import React, { useEffect, useRef, useState } from 'react';
import { User } from './types';
import { MicOff, Loader2 } from 'lucide-react';

interface UserMediaProps {
  user: User;
  stream?: MediaStream;
  isTiny: boolean;
  onClick?: () => void;
  className?: string;
}

export const UserMedia: React.FC<UserMediaProps> = ({ user, stream, isTiny, onClick, className = "" }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0); // 0 to 100
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  // 1. Handle Video Stream Attachment & Playback
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !stream) {
        setIsPlaying(false);
        return;
    }

    videoEl.srcObject = stream;

    const attemptPlay = async () => {
        try {
            await videoEl.play();
            setIsPlaying(true);
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.warn("Video autoplay failed:", err);
            }
        }
    };

    attemptPlay();

    const onPause = () => {
        if (!user.isVideoOff && videoEl.paused) attemptPlay();
    };
    
    videoEl.addEventListener('pause', onPause);
    return () => {
        videoEl.removeEventListener('pause', onPause);
    };
  }, [stream, user.isVideoOff]);


  // 2. Handle Audio Visualization
  useEffect(() => {
    if (!stream || user.isMuted) {
        setVolume(0);
        return;
    }

    let audioContext: AudioContext | undefined;
    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContext = new AudioContextClass();
    } catch (e) {
        return;
    }

    if (!audioContext || audioContext.state === 'closed') return;

    let source: MediaStreamAudioSourceNode;
    try {
        source = audioContext.createMediaStreamSource(stream);
    } catch (e) {
        audioContext.close();
        return;
    }

    const analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 64; 
    source.connect(analyzer);
    analyzerRef.current = analyzer;

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateVolume = () => {
        if (analyzerRef.current) {
            analyzer.getByteFrequencyData(dataArray);
            
            let sum = 0;
            for(let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const avg = sum / bufferLength;
            
            setVolume(prev => {
                const target = avg;
                return target > prev ? target : prev * 0.85; // Faster decay for snappier response
            });
        }
        animationRef.current = requestAnimationFrame(updateVolume);
    };

    updateVolume();

    return () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        if (audioContext && audioContext.state !== 'closed') {
             audioContext.close().catch(() => {});
        }
    };
  }, [stream, user.isMuted]);

  // Dynamic Scale Logic
  const dynamicScale = isTiny ? 1 : 1 + Math.min(volume / 100, 0.4); 
  
  // Green border opacity based on volume
  const borderOpacity = Math.min(volume / 30, 1);

  // Base size classes based on mode
  const sizeClasses = isTiny 
    ? "w-8 h-8" 
    : "w-12 h-12 sm:w-14 sm:h-14";

  return (
    <div 
      onClick={onClick}
      className={`relative rounded-full transition-all duration-200 ease-out bg-black group cursor-pointer ${sizeClasses} ${className}`}
      style={{
        transform: `scale(${dynamicScale})`,
        zIndex: volume > 10 && !isTiny ? 50 : 10,
      }}
      title={isTiny ? "Click to expand" : "Click to minimize"}
    >
      {/* Speaking Glow Ring (Green) */}
      <div 
        className="absolute inset-[-4px] rounded-full border-2 border-stadium-success transition-opacity duration-100 pointer-events-none"
        style={{ opacity: isTiny ? 0 : borderOpacity }}
      />

      {/* Video Container */}
      <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-stadium-700 bg-stadium-800 shadow-md">
        {(!user.isVideoOff && stream) ? (
            <>
                <video
                    ref={videoRef}
                    muted={user.isLocal} 
                    playsInline
                    className={`w-full h-full object-cover transform ${user.isLocal ? 'scale-x-[-1]' : ''}`}
                    style={{ opacity: isPlaying ? 1 : 0, transition: 'opacity 0.5s' }}
                />
                {!isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-stadium-800">
                         <Loader2 className="animate-spin text-stadium-accent" size={isTiny ? 10 : 16} />
                    </div>
                )}
            </>
        ) : (
            <div className="w-full h-full flex items-center justify-center bg-stadium-700 text-white">
                <div className={`${isTiny ? 'text-[10px]' : 'text-sm'} font-bold`}>
                    {user.name.charAt(0).toUpperCase()}
                </div>
            </div>
        )}

        {/* Mute Icon Overlay */}
        {user.isMuted && (
            <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-0.5 z-20 bg-black/40">
                <MicOff size={isTiny ? 8 : 10} className="text-white" />
            </div>
        )}
      </div>

      {/* Hover Name Tag */}
      <div 
        className={`absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-sm transition-opacity whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100`}
      >
          <span className="text-[10px] text-white font-medium">{user.name}</span>
      </div>
    </div>
  );
};

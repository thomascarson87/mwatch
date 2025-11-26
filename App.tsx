import React, { useState, useEffect, useCallback, useRef } from 'react';
import { VideoPlayer } from './VideoPlayer';
import { ChatSidebar } from './ChatSidebar';
import { UserMedia } from './UserMedia';
import { Message, User, StreamConfig, RoomState } from './types';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Share2, Code, MessageSquare, X, Trophy, Play, Loader2 } from 'lucide-react';
import { generateHypeCommentary } from './geminiService';
// @ts-ignore - Trystero is imported via importmap
import { joinRoom, selfId } from 'trystero';

const App: React.FC = () => {
  const [roomState, setRoomState] = useState<RoomState>(RoomState.LOBBY);
  // Default user is just "Me"
  const [users, setUsers] = useState<User[]>([
    { id: 'local', name: 'Fan_1', isLocal: true, isMuted: false, isVideoOff: false }
  ]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamConfig, setStreamConfig] = useState<StreamConfig>({ url: '', type: 'direct' });
  const [streamInput, setStreamInput] = useState('https://embednow.top/embed/cricket/2025/in-za/2nd-test');
  const [localStream, setLocalStream] = useState<MediaStream | undefined>(undefined);
  
  // P2P State
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [room, setRoom] = useState<any>(null);

  const [showInvite, setShowInvite] = useState(false);
  const [userName, setUserName] = useState('Fan_1');
  
  // UI States
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notification, setNotification] = useState<{sender: string, text: string} | null>(null);

  // Initialize camera access
  const initMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error("Error accessing media devices.", err);
      return undefined;
    }
  }, []);

  // Check for stream in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedStream = params.get('stream');
    if (sharedStream) {
      setStreamInput(sharedStream);
    }
  }, []);

  // --- P2P ROOM LOGIC ---
  useEffect(() => {
    if (roomState === RoomState.ACTIVE && localStream) {
      // 1. Generate a consistent Room ID from the Stream URL
      // We strip special chars to make it URL safe-ish for the room ID
      const sanitizedId = btoa(streamInput).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
      const roomId = `mwatch-v1-${sanitizedId}`;
      
      console.log(`Joining Room: ${roomId} as ${selfId}`);

      // 2. Connect to Trystero Room
      const r = joinRoom({ appId: 'mwatch-live-app' }, roomId);
      
      // 3. Define Actions
      const [sendUserUpdate, getUserUpdate] = r.makeAction('userUpdate');
      const [sendChat, getChat] = r.makeAction('chat');

      // 4. Handle Incoming User Data
      getUserUpdate((data: Partial<User>, peerId: string) => {
        setUsers(prev => {
           const existing = prev.find(u => u.peerId === peerId);
           if (existing) {
             return prev.map(u => u.peerId === peerId ? { ...u, ...data } : u);
           } else {
             // New user found via data channel (before stream maybe)
             return [...prev, { 
                id: peerId, 
                peerId: peerId,
                name: data.name || 'Fan', 
                isLocal: false, 
                isMuted: data.isMuted || false, 
                isVideoOff: data.isVideoOff || false 
             }];
           }
        });
      });

      // 5. Handle Incoming Chat
      getChat((data: any, peerId: string) => {
         const sender = users.find(u => u.peerId === peerId)?.name || 'Unknown';
         const msg: Message = {
            id: Date.now().toString() + peerId,
            sender: data.sender || sender,
            text: data.text,
            timestamp: new Date(),
            isAi: false
         };
         addMessage(msg);
      });

      // 6. Handle P2P Streams
      r.onPeerJoin((peerId: string) => {
         console.log('Peer joined:', peerId);
         // Broadcast my info to the new peer
         sendUserUpdate({ 
             name: userName, 
             isMuted: users[0].isMuted, 
             isVideoOff: users[0].isVideoOff 
         }, peerId);
         
         addSystemMessage(`A fan joined the room!`);
      });

      r.onPeerLeave((peerId: string) => {
         console.log('Peer left:', peerId);
         setUsers(prev => prev.filter(u => u.peerId !== peerId));
         setRemoteStreams(prev => {
             const next = { ...prev };
             delete next[peerId];
             return next;
         });
         addSystemMessage(`A fan left the room.`);
      });

      r.onPeerStream((stream: MediaStream, peerId: string) => {
         console.log('Received stream from:', peerId);
         setRemoteStreams(prev => ({ ...prev, [peerId]: stream }));
         
         // Ensure user exists in list
         setUsers(prev => {
             if (prev.find(u => u.peerId === peerId)) return prev;
             return [...prev, { 
                 id: peerId, 
                 peerId: peerId,
                 name: 'Connecting...', 
                 isLocal: false, 
                 isMuted: false, 
                 isVideoOff: false 
             }];
         });
      });

      // 7. Add my stream
      r.addStream(localStream);

      // Store room ref
      setRoom({ r, sendUserUpdate, sendChat });
      
      // Cleanup
      return () => {
        r.leave();
      };
    }
  }, [roomState, localStream]);

  // Handle local state changes (Mute/Video) and broadcast
  useEffect(() => {
     if (room && users[0]) {
         // Broadcast my current state to everyone
         room.sendUserUpdate({
             name: userName,
             isMuted: users[0].isMuted,
             isVideoOff: users[0].isVideoOff
         });
     }
  }, [users[0].isMuted, users[0].isVideoOff, userName, room]);


  const addMessage = (msg: Message) => {
    setMessages(prev => [...prev, msg]);
    
    // Notification logic
    if (msg.sender !== userName) {
       if (!isChatOpen) {
          setUnreadCount(prev => prev + 1);
          setNotification({ sender: msg.sender, text: msg.text });
          setTimeout(() => setNotification(null), 4000);
       }
    }
  };

  const addSystemMessage = (text: string) => {
    addMessage({
      id: Date.now().toString(),
      sender: 'System',
      text,
      timestamp: new Date(),
      isAi: false
    });
  };

  const handleSendMessage = (text: string, isAiQuery = false) => {
    // 1. Add locally
    const newMessage: Message = {
      id: Date.now().toString(),
      sender: isAiQuery ? 'mwatch AI' : userName,
      text: text,
      timestamp: new Date(),
      isAi: isAiQuery
    };
    
    addMessage(newMessage);

    // 2. Broadcast if not AI query
    if (!isAiQuery && room) {
        room.sendChat({ text, sender: userName });
    }

    // 3. AI Logic
    if (isAiQuery) {
       // Only I see my AI interaction
    }
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
      setUsers(prev => prev.map(u => u.isLocal ? { ...u, isMuted: !u.isMuted } : u));
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
      setUsers(prev => prev.map(u => u.isLocal ? { ...u, isVideoOff: !u.isVideoOff } : u));
    }
  };
  
  const handleJoin = async () => {
      // Init media first
      await initMedia();
      setUsers(prev => prev.map(u => u.isLocal ? { ...u, name: userName } : u));
      setStreamConfig({ url: streamInput, type: 'youtube' });
      setRoomState(RoomState.ACTIVE);

      // Update URL so invite link works correctly for this specific stream
      const url = new URL(window.location.href);
      url.searchParams.set('stream', streamInput);
      window.history.pushState({}, '', url);

      // Initial Hype
      setTimeout(async () => {
         const hype = await generateHypeCommentary("Live Sports Match");
         addMessage({
            id: Date.now().toString(),
            sender: "mwatch AI",
            text: hype,
            timestamp: new Date(),
            isAi: true
         });
      }, 1500);
  };

  const handleInvite = async () => {
    const shareData = {
        title: 'Join my mwatch Party',
        text: `Come watch the match with me on mwatch!`,
        url: window.location.href
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (err) {
            console.log('Error sharing:', err);
        }
    } else {
        navigator.clipboard.writeText(window.location.href);
        setShowInvite(true);
        setTimeout(() => setShowInvite(false), 2000);
    }
  };

  // --- RENDER ---

  if (roomState === RoomState.LOBBY) {
    return (
      <div className="min-h-screen bg-stadium-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-stadium-accent rounded-full blur-[150px]"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600 rounded-full blur-[150px]"></div>
        </div>

        <div className="z-10 max-w-lg w-full bg-stadium-800/80 backdrop-blur-xl border border-stadium-700 p-8 rounded-3xl shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="bg-stadium-accent/20 p-4 rounded-full border border-stadium-accent/50">
                <Trophy size={48} className="text-stadium-accent" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-center mb-2 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">mwatch</h1>
          <p className="text-center text-gray-400 mb-8">Watch sports together, wherever you are.</p>

          <div className="space-y-4">
             <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Your Name</label>
                <input 
                    type="text" 
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full bg-stadium-900 border border-stadium-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-stadium-accent focus:outline-none"
                />
             </div>

             <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Stream Link or Embed Code</label>
                <div className="relative">
                    <Code className="absolute left-3 top-3.5 text-gray-500" size={16} />
                    <input 
                        type="text" 
                        value={streamInput}
                        onChange={(e) => setStreamInput(e.target.value)}
                        placeholder="Paste URL or <iframe src='...'></iframe>"
                        className="w-full bg-stadium-900 border border-stadium-700 rounded-lg pl-10 pr-3 py-3 text-white focus:ring-2 focus:ring-stadium-accent focus:outline-none"
                    />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                   Tip: Paste the embed code here, then click Join. The Invite button will then share this specific match.
                </p>
             </div>

             <button 
                onClick={handleJoin}
                className="w-full bg-stadium-accent hover:bg-blue-600 text-white font-bold py-4 rounded-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 mt-6"
             >
                <Play size={20} fill="currentColor" />
                Join Room
             </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative font-sans">
      
      {/* BACKGROUND LAYER: Video Player */}
      <div className="absolute inset-0 z-0">
          <VideoPlayer streamConfig={streamConfig} />
      </div>

      {/* GRADIENT OVERLAY TOP: For Header Visibility */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-black/90 via-black/40 to-transparent pointer-events-none z-10" />
      
      {/* LAYER 2: Floating Header */}
      <div className="absolute top-0 left-0 w-full z-20 flex items-start justify-between p-6 pointer-events-none">
           <div className="flex flex-col gap-2 pointer-events-auto">
               <div className="flex items-center gap-2">
                    <Trophy className="text-stadium-accent drop-shadow-lg" size={24} />
                    <span className="font-bold text-lg text-white drop-shadow-md hidden sm:block">mwatch</span>
                    <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded animate-pulse ml-2 shadow-lg">LIVE</span>
               </div>
               
               {/* Minimal Input to change stream */}
               <div className="group relative w-64 transition-all opacity-50 hover:opacity-100">
                   <input 
                      type="text" 
                      value={streamInput}
                      onChange={(e) => {
                          setStreamInput(e.target.value);
                          setStreamConfig({ ...streamConfig, url: e.target.value });
                          
                          // Update URL if user changes stream mid-game
                          const url = new URL(window.location.href);
                          url.searchParams.set('stream', e.target.value);
                          window.history.pushState({}, '', url);
                      }}
                      className="w-full bg-black/40 border border-white/10 rounded-full px-4 py-1.5 text-xs text-white backdrop-blur-sm focus:bg-black/80 transition-all outline-none"
                      placeholder="Paste new link..."
                   />
               </div>
           </div>

           <div className="pointer-events-auto">
               <button 
                  onClick={handleInvite}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md text-sm px-4 py-2 rounded-full transition-all border border-white/10 text-white shadow-lg"
               >
                  <Share2 size={16} />
                  <span className="hidden sm:inline">{showInvite ? 'Copied!' : 'Invite'}</span>
               </button>
           </div>
      </div>

      {/* LAYER 3: Ambient User Bubbles (Bottom Center) */}
      <div className="absolute bottom-24 left-0 right-0 z-20 flex justify-center items-end gap-4 px-4 pointer-events-none">
          {users.map((user, index) => (
              <div 
                key={user.id} 
                className="pointer-events-auto transition-all duration-500 hover:scale-110 hover:-translate-y-2 animate-in fade-in zoom-in slide-in-from-bottom-4 duration-500"
                style={{
                    zIndex: 20 + index
                }}
              >
                  <UserMedia 
                      user={user} 
                      stream={user.isLocal ? localStream : (user.peerId ? remoteStreams[user.peerId] : undefined)}
                      className="w-20 h-20 sm:w-28 sm:h-28 shadow-2xl border-2 border-white/20"
                  />
                  {/* Connection indicator for remote users without streams yet */}
                  {!user.isLocal && !remoteStreams[user.peerId!] && (
                      <div className="absolute inset-0 flex items-center justify-center">
                          <Loader2 className="animate-spin text-stadium-accent" size={24} />
                      </div>
                  )}
              </div>
          ))}
      </div>

      {/* LAYER 4: Floating Controls (Bottom Center) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 bg-black/50 backdrop-blur-lg px-6 py-3 rounded-full border border-white/10 shadow-2xl">
           <button 
              onClick={toggleMute}
              className={`p-3 rounded-full transition-all ${users[0].isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
           >
              {users[0].isMuted ? <MicOff size={20} /> : <Mic size={20} />}
           </button>
           
           <button 
              onClick={() => {
                  if (room && room.r) room.r.leave();
                  window.location.reload(); // Simple reload to leave cleanly
              }}
              className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white px-6 flex items-center gap-2"
           >
              <PhoneOff size={20} />
              <span className="text-sm font-bold hidden sm:inline">Leave</span>
           </button>

           <button 
              onClick={toggleVideo}
              className={`p-3 rounded-full transition-all ${users[0].isVideoOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
           >
              {users[0].isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
           </button>
      </div>

      {/* LAYER 5: Chat & Notifications (Bottom Right) */}
      <div className="absolute bottom-6 right-6 z-40 flex flex-col items-end gap-3 pointer-events-none">
          
          {/* Notification Toast */}
          {notification && !isChatOpen && (
              <div className="bg-stadium-900/90 backdrop-blur-md text-white p-3 rounded-xl border border-stadium-700 shadow-xl max-w-xs animate-slide-up pointer-events-auto flex items-start gap-3 mb-2">
                  <div className="bg-stadium-accent w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                      {notification.sender[0]}
                  </div>
                  <div className="min-w-0">
                      <p className="text-xs font-bold text-stadium-accent">{notification.sender}</p>
                      <p className="text-sm truncate">{notification.text}</p>
                  </div>
              </div>
          )}

          {/* Chat Floating Button */}
          <button
            onClick={() => {
                setIsChatOpen(!isChatOpen);
                setUnreadCount(0);
            }}
            className="w-14 h-14 bg-stadium-accent hover:bg-blue-600 rounded-full shadow-lg shadow-blue-900/50 flex items-center justify-center text-white transition-transform hover:scale-105 pointer-events-auto relative group"
          >
             {isChatOpen ? <X size={24} /> : <MessageSquare size={24} />}
             
             {/* Unread Badge */}
             {!isChatOpen && unreadCount > 0 && (
                 <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-black animate-bounce">
                     {unreadCount}
                 </div>
             )}
             
             {/* Tooltip */}
             <div className="absolute right-full mr-3 bg-black/80 px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap backdrop-blur-sm">
                 {isChatOpen ? 'Close Chat' : 'Party Chat & Stats'}
             </div>
          </button>
      </div>

      {/* LAYER 6: Popup Chat Window */}
      {isChatOpen && (
          <div className="absolute bottom-24 right-6 w-80 sm:w-96 h-[65vh] max-h-[600px] bg-stadium-900/90 backdrop-blur-xl border border-stadium-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-30 origin-bottom-right animate-in fade-in zoom-in-95 duration-200">
             <ChatSidebar 
                messages={messages} 
                onSendMessage={handleSendMessage}
                currentUser={users[0]}
                streamTitle="Live Match"
                onClose={() => setIsChatOpen(false)}
             />
          </div>
      )}

    </div>
  );
};

export default App;
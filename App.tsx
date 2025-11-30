import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { VideoPlayer } from './VideoPlayer';
import { ChatSidebar } from './ChatSidebar';
import { UserMedia } from './UserMedia';
import { Message, User, StreamConfig, RoomState, Channel } from './types';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Share2, MessageSquare, X, Trophy, Play, Tv, ChevronUp, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { joinRoom, selfId } from 'trystero';

const App: React.FC = () => {
  const [roomState, setRoomState] = useState<RoomState>(RoomState.LOBBY);
  const [users, setUsers] = useState<User[]>([
    { id: 'local', name: 'Fan_1', isLocal: true, isMuted: false, isVideoOff: false }
  ]);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Default stream for initial load
  const DEFAULT_STREAM = `<iframe id="player" marginheight="0" marginwidth="0" src="https://embednow.top/embed/epl/2025-11-30/cry-mun" scrolling="no" allowfullscreen="yes" allow="encrypted-media; picture-in-picture;" width="100%" height="100%" frameborder="0" style="position:absolute;"></iframe>`;
  
  // Multi-Channel State
  const [channels, setChannels] = useState<Channel[]>([
    { id: 'default', name: 'Channel 1', url: DEFAULT_STREAM }
  ]);
  const [activeChannelId, setActiveChannelId] = useState<string>('default');
  const [newChannelInput, setNewChannelInput] = useState('');

  // Derived Stream Config for Player
  const activeChannel = useMemo(() => 
    channels.find(c => c.id === activeChannelId) || channels[0], 
  [channels, activeChannelId]);

  const streamConfig: StreamConfig = { url: activeChannel.url, type: 'direct' };

  const [localStream, setLocalStream] = useState<MediaStream | undefined>(undefined);
  
  // P2P State
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  
  // Room refs and state
  const roomRef = useRef<any>(null);
  const [roomReady, setRoomReady] = useState(false);

  const [showInvite, setShowInvite] = useState(false);
  const [userName, setUserName] = useState('Fan_1');
  
  // UI States
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isStreamMenuOpen, setIsStreamMenuOpen] = useState(false);
  
  // Avatar View Modes
  const [areAvatarsHidden, setAreAvatarsHidden] = useState(false);
  const [areAvatarsTiny, setAreAvatarsTiny] = useState(false);

  const [unreadCount, setUnreadCount] = useState(0);
  const [notification, setNotification] = useState<{sender: string, text: string} | null>(null);

  // Initialize camera access with HIGH QUALITY constraints
  const initMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
            width: { ideal: 640 }, 
            height: { ideal: 480 },
            frameRate: { ideal: 30 }
        }, 
        audio: { 
            echoCancellation: true, 
            noiseSuppression: true,
            autoGainControl: true
        } 
      });
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error("Error accessing media devices.", err);
      return undefined;
    }
  }, []);

  // --- P2P ROOM LOGIC ---
  useEffect(() => {
    if (roomState === RoomState.ACTIVE) {
      if (roomRef.current) return;

      const roomId = 'mwatch-global-party-v1';
      console.log(`Joining Global Room: ${roomId} as ${selfId}`);

      // PRODUCTION CONFIG: Using public STUN servers to ensure connectivity across NATs/Firewalls
      const r = joinRoom({ 
          appId: 'mwatch-live-app',
          rtcConfig: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
      }, roomId);
      
      const [sendUserUpdate, getUserUpdate] = r.makeAction('userUpdate');
      const [sendChat, getChat] = r.makeAction('chat');
      const [sendChannelState, getChannelState] = r.makeAction('channelState');

      // 1. Handle User Updates
      getUserUpdate((data: Partial<User>, peerId: string) => {
        setUsers(prev => {
           const existing = prev.find(u => u.peerId === peerId);
           if (existing) {
             return prev.map(u => u.peerId === peerId ? { ...u, ...data } : u);
           } else {
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

      // 2. Handle Chat
      getChat((data: any, peerId: string) => {
         const sender = users.find(u => u.peerId === peerId)?.name || 'Unknown';
         const msg: Message = {
            id: Date.now().toString() + peerId,
            sender: data.sender || sender,
            text: data.text,
            timestamp: new Date()
         };
         addMessage(msg);
      });

      // 3. Handle Channel Sync
      getChannelState((data: { channels: Channel[], activeId: string }, peerId: string) => {
         setChannels(data.channels);
         setActiveChannelId(prev => {
             if (prev !== data.activeId) {
                 const newChan = data.channels.find(c => c.id === data.activeId);
                 addSystemMessage(`Channel switched to ${newChan?.name || 'Channel'}`);
                 return data.activeId;
             }
             return prev;
         });
      });

      // 4. Peer Events
      r.onPeerJoin((peerId: string) => {
         if (localStream) {
             r.addStream(localStream, peerId);
         }
         // Send my info
         sendUserUpdate({ 
             name: userName, 
             isMuted: users[0].isMuted, 
             isVideoOff: users[0].isVideoOff 
         }, peerId);
         
         // Sync current channel state
         sendChannelState({ channels, activeId: activeChannelId }, peerId);
         
         addSystemMessage(`A fan joined the squad!`);
      });

      r.onPeerLeave((peerId: string) => {
         setUsers(prev => prev.filter(u => u.peerId !== peerId));
         setRemoteStreams(prev => {
             const next = { ...prev };
             delete next[peerId];
             return next;
         });
      });

      r.onPeerStream((stream: MediaStream, peerId: string) => {
         setRemoteStreams(prev => ({ ...prev, [peerId]: stream }));
         setUsers(prev => {
             const exists = prev.find(u => u.peerId === peerId);
             if (exists) return prev;
             
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

      roomRef.current = { r, sendUserUpdate, sendChat, sendChannelState };
      setRoomReady(true);
      
      return () => {
        r.leave();
        roomRef.current = null;
        setRoomReady(false);
      };
    }
  }, [roomState]); 

  // Add local stream to room once connected
  useEffect(() => {
    if (roomReady && roomRef.current && localStream) {
        roomRef.current.r.addStream(localStream);
    }
  }, [roomReady, localStream]);

  // Handle local state changes for user info
  useEffect(() => {
     if (roomRef.current && users[0]) {
         roomRef.current.sendUserUpdate({
             name: userName,
             isMuted: users[0].isMuted,
             isVideoOff: users[0].isVideoOff
         });
     }
  }, [users[0].isMuted, users[0].isVideoOff, userName, roomReady]);

  // Sync channels when state updates locally
  const broadcastChannelState = (newChannels: Channel[], newActiveId: string) => {
      if (roomRef.current) {
          roomRef.current.sendChannelState({ channels: newChannels, activeId: newActiveId });
      }
  };

  const addMessage = (msg: Message) => {
    setMessages(prev => [...prev, msg]);
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
      timestamp: new Date()
    });
  };

  const handleSendMessage = (text: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      sender: userName,
      text: text,
      timestamp: new Date()
    };
    addMessage(newMessage);

    if (roomRef.current) {
        roomRef.current.sendChat({ text, sender: userName });
    }
  };

  // --- CHANNEL MANAGEMENT ---

  const handleSwitchChannel = (channelId: string) => {
      setActiveChannelId(channelId);
      broadcastChannelState(channels, channelId);
      setIsStreamMenuOpen(false); // Close menu on select
  };

  const handleAddChannel = () => {
      if (!newChannelInput.trim()) return;

      const newId = Date.now().toString();
      const newChannel: Channel = {
          id: newId,
          name: `Channel ${channels.length + 1}`,
          url: newChannelInput
      };
      
      const updatedChannels = [...channels, newChannel];
      setChannels(updatedChannels);
      setNewChannelInput('');
      
      broadcastChannelState(updatedChannels, activeChannelId);
  };

  const handleDeleteChannel = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (channels.length <= 1) return; // Don't delete last channel
      
      const updatedChannels = channels.filter(c => c.id !== id);
      setChannels(updatedChannels);
      
      let nextActiveId = activeChannelId;
      if (activeChannelId === id) {
          nextActiveId = updatedChannels[0].id;
          setActiveChannelId(nextActiveId);
      }

      broadcastChannelState(updatedChannels, nextActiveId);
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
    }
    setUsers(prev => prev.map(u => u.isLocal ? { ...u, isMuted: !u.isMuted } : u));
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
    }
    setUsers(prev => prev.map(u => u.isLocal ? { ...u, isVideoOff: !u.isVideoOff } : u));
  };
  
  const handleJoin = async () => {
      await initMedia();
      setUsers(prev => prev.map(u => u.isLocal ? { ...u, name: userName } : u));
      setRoomState(RoomState.ACTIVE);
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
        try {
            await navigator.clipboard.writeText(window.location.href);
            setShowInvite(true);
            setTimeout(() => setShowInvite(false), 2000);
        } catch (err) {
            const input = document.createElement('input');
            input.value = window.location.href;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setShowInvite(true);
            setTimeout(() => setShowInvite(false), 2000);
        }
    }
  };

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
          <p className="text-center text-gray-400 mb-8">Global Watch Party - Join the Crowd</p>

          <div className="space-y-4">
             <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Your Name</label>
                <input 
                    type="text" 
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full bg-stadium-900 border border-stadium-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-stadium-accent focus:outline-none"
                    placeholder="Enter your nickname"
                />
             </div>
             
             <button 
                onClick={handleJoin}
                className="w-full bg-stadium-accent hover:bg-blue-600 text-white font-bold py-4 rounded-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 mt-6"
             >
                <Play size={20} fill="currentColor" />
                Join Party
             </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative font-sans">
      
      {/* BACKGROUND: Video Player */}
      <div className="absolute inset-0 z-0">
          <VideoPlayer streamConfig={streamConfig} />
      </div>

      {/* TOP GRADIENT */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none z-10" />

      {/* --- CORNER 1: TOP LEFT (Brand & Channel Indicator) --- */}
      <div className="absolute top-4 left-4 z-50 flex flex-col items-start gap-1 select-none pointer-events-auto">
          <div className="flex items-center gap-2">
            <Trophy className="text-stadium-accent drop-shadow-lg" size={24} />
            <span className="font-bold text-lg text-white drop-shadow-md hidden sm:block">mwatch</span>
            <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded animate-pulse shadow-lg">LIVE</span>
          </div>
          <div className="bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-gray-300 border border-white/10">
              {activeChannel.name}
          </div>
      </div>

      {/* --- TOP CENTER: AVATAR STRIP --- */}
      <div className={`absolute top-4 left-0 w-full flex justify-center z-40 transition-all duration-300 pointer-events-none ${areAvatarsHidden ? '-translate-y-32 opacity-0' : 'translate-y-0 opacity-100'}`}>
          <div className={`flex items-center transition-all duration-300 pointer-events-auto ${areAvatarsTiny ? 'bg-black/40 p-1.5 gap-2' : 'p-2 gap-4'} rounded-full backdrop-blur-sm`}>
            {users.map((user) => {
                const stream = user.isLocal ? localStream : (user.peerId ? remoteStreams[user.peerId] : undefined);
                return (
                  <UserMedia 
                      key={user.id}
                      user={user} 
                      stream={stream}
                      isTiny={areAvatarsTiny}
                      onClick={() => setAreAvatarsTiny(!areAvatarsTiny)}
                      className="shadow-lg border border-white/20"
                  />
                );
            })}
          </div>
      </div>

      {/* --- CORNER 2: TOP RIGHT (Invite & Avatar Toggle) --- */}
      <div className="absolute top-4 right-4 z-50 flex gap-2 pointer-events-none">
         <button 
             onClick={() => setAreAvatarsHidden(!areAvatarsHidden)}
             className="bg-black/40 hover:bg-black/60 backdrop-blur-md text-white p-2 rounded-full border border-white/10 shadow-lg transition-colors pointer-events-auto"
             title={areAvatarsHidden ? "Show Squad" : "Hide Squad"}
         >
             {areAvatarsHidden ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
         </button>

         <button 
            onClick={handleInvite}
            className="flex items-center gap-2 bg-stadium-accent hover:bg-blue-600 text-white px-3 py-2 rounded-full shadow-lg transition-all text-sm font-medium pointer-events-auto"
         >
            <Share2 size={16} />
            <span className="hidden sm:inline">{showInvite ? 'Copied!' : 'Invite'}</span>
         </button>
      </div>

      {/* --- CORNER 3: BOTTOM LEFT (Channel Settings) --- */}
      <div className="absolute bottom-6 left-6 z-50 pointer-events-auto">
          <div className="relative">
             {isStreamMenuOpen && (
                 <div className="absolute bottom-full left-0 mb-3 w-80 bg-stadium-900/95 backdrop-blur-xl border border-stadium-700 rounded-xl p-4 shadow-2xl flex flex-col gap-3 origin-bottom-left animate-in fade-in zoom-in-95 duration-200">
                     <div className="flex justify-between items-center pb-2 border-b border-white/10">
                        <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Channels</label>
                        <button onClick={() => setIsStreamMenuOpen(false)} className="text-gray-400 hover:text-white"><X size={14} /></button>
                     </div>
                     
                     <div className="flex flex-col gap-2 max-h-48 overflow-y-auto no-scrollbar">
                         {channels.map((channel) => (
                             <div 
                                key={channel.id} 
                                className={`group flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${activeChannelId === channel.id ? 'bg-stadium-accent/20 border-stadium-accent text-white' : 'bg-black/40 border-transparent hover:bg-white/5 text-gray-300'}`}
                                onClick={() => handleSwitchChannel(channel.id)}
                             >
                                 <div className="flex flex-col min-w-0">
                                     <span className="text-xs font-bold truncate">{channel.name}</span>
                                     <span className="text-[10px] text-gray-500 truncate max-w-[180px]">{channel.url}</span>
                                 </div>
                                 <div className="flex items-center gap-2">
                                     {activeChannelId === channel.id && <div className="w-2 h-2 rounded-full bg-stadium-success animate-pulse"></div>}
                                     {channels.length > 1 && (
                                         <button 
                                            onClick={(e) => handleDeleteChannel(e, channel.id)}
                                            className="p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Remove Channel"
                                         >
                                             <Trash2 size={12} />
                                         </button>
                                     )}
                                 </div>
                             </div>
                         ))}
                     </div>

                     <div className="pt-2 border-t border-white/10 flex gap-2">
                        <input 
                            value={newChannelInput}
                            onChange={(e) => setNewChannelInput(e.target.value)}
                            className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-stadium-accent"
                            placeholder="Add stream URL..."
                        />
                        <button 
                            onClick={handleAddChannel}
                            disabled={!newChannelInput.trim()}
                            className="bg-stadium-accent hover:bg-blue-600 disabled:opacity-50 text-white p-2 rounded-lg transition-colors"
                        >
                            <Plus size={16} />
                        </button>
                     </div>
                 </div>
             )}
             
             <button 
               onClick={() => setIsStreamMenuOpen(!isStreamMenuOpen)}
               className={`bg-black/50 hover:bg-black/70 backdrop-blur-md border border-white/10 text-white p-3 rounded-full shadow-xl transition-all ${isStreamMenuOpen ? 'ring-2 ring-stadium-accent' : ''}`}
               title="Channels"
             >
                 <Tv size={20} />
             </button>
          </div>
      </div>

      {/* --- CORNER 4: BOTTOM RIGHT (Controls Dock) --- */}
      <div className="absolute bottom-6 right-6 z-50 flex flex-col items-end gap-3 pointer-events-none">
          
          <div className="flex flex-col items-end gap-2 w-full">
            {notification && !isChatOpen && (
                <div className="bg-stadium-900/90 backdrop-blur-md text-white p-3 rounded-xl border border-stadium-700 shadow-xl max-w-xs animate-slide-up pointer-events-auto flex items-start gap-3">
                    <div className="bg-stadium-accent w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">
                        {notification.sender[0]}
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold text-stadium-accent">{notification.sender}</p>
                        <p className="text-xs truncate">{notification.text}</p>
                    </div>
                </div>
            )}
          </div>

          <div className="flex items-center gap-2 pointer-events-auto bg-black/60 backdrop-blur-lg p-2 rounded-2xl border border-white/10 shadow-2xl">
              
              <button 
                  onClick={toggleMute}
                  className={`p-3 rounded-xl transition-all ${users[0].isMuted ? 'bg-red-500/90 text-white hover:bg-red-600' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  title="Toggle Microphone"
              >
                  {users[0].isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              <button 
                  onClick={toggleVideo}
                  className={`p-3 rounded-xl transition-all ${users[0].isVideoOff ? 'bg-red-500/90 text-white hover:bg-red-600' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  title="Toggle Camera"
              >
                  {users[0].isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
              </button>

              <div className="w-px h-8 bg-white/20 mx-1"></div>

              <button
                onClick={() => {
                    setIsChatOpen(!isChatOpen);
                    setUnreadCount(0);
                }}
                className={`p-3 rounded-xl transition-all relative ${isChatOpen ? 'bg-stadium-accent text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                title="Toggle Chat"
              >
                 <MessageSquare size={20} />
                 {!isChatOpen && unreadCount > 0 && (
                     <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-black animate-bounce">
                         {unreadCount}
                     </div>
                 )}
              </button>

               <button 
                  onClick={() => {
                      if (roomRef.current && roomRef.current.r) roomRef.current.r.leave();
                      window.location.reload(); 
                  }}
                  className="p-3 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors ml-1"
                  title="Leave Party"
               >
                  <PhoneOff size={20} />
               </button>
          </div>
      </div>

      {isChatOpen && (
          <div className="absolute bottom-24 right-6 w-80 h-[60vh] max-h-[500px] bg-stadium-900/90 backdrop-blur-xl border border-stadium-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-40 origin-bottom-right animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
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

import React, { useState, useEffect, useRef } from 'react';
import { Message, User } from './types';
import { Send, Users, Layout, X, Link as LinkIcon, RefreshCcw } from 'lucide-react';

interface ChatSidebarProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  currentUser: User;
  streamTitle: string;
  onClose?: () => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({ messages, onSendMessage, currentUser, streamTitle, onClose }) => {
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'widgets'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Widget State
  const [widgetInput, setWidgetInput] = useState('');
  const [activeWidgetUrl, setActiveWidgetUrl] = useState('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (activeTab === 'chat') {
      scrollToBottom();
    }
  }, [messages, activeTab]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText;
    setInputText('');

    if (activeTab === 'widgets') setActiveTab('chat');
    onSendMessage(text);
  };

  const handleLoadWidget = () => {
    if (!widgetInput.trim()) return;
    
    let url = widgetInput;
    if (url.includes('<iframe')) {
        const srcMatch = url.match(/src\s*=\s*["']([^"']+)["']/i);
        if (srcMatch && srcMatch[1]) {
            url = srcMatch[1];
        }
    }
    setActiveWidgetUrl(url);
  };

  return (
    <div className="flex flex-col h-full bg-stadium-900/50 w-full relative">
      {/* Tabs Header */}
      <div className="flex items-center justify-between border-b border-stadium-700 bg-stadium-900/80 shrink-0 pr-2">
        <div className="flex flex-1">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-3 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-colors relative ${
              activeTab === 'chat' ? 'text-stadium-accent' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users size={16} />
            Chat
            {activeTab === 'chat' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-stadium-accent" />}
          </button>
          
          <button
            onClick={() => setActiveTab('widgets')}
            className={`flex-1 py-3 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-colors relative ${
              activeTab === 'widgets' ? 'text-green-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Layout size={16} />
            Widgets
            {activeTab === 'widgets' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-green-400" />}
          </button>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors ml-1"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative flex flex-col bg-stadium-900/60 backdrop-blur-sm">
        
        {activeTab === 'widgets' ? (
           <div className="flex-1 overflow-y-auto no-scrollbar bg-stadium-900/80 flex flex-col">
              {activeWidgetUrl ? (
                <div className="flex flex-col h-full">
                    <div className="p-2 bg-stadium-800 flex justify-between items-center border-b border-stadium-700">
                        <span className="text-xs text-gray-400">Live Widget</span>
                        <button 
                           onClick={() => setActiveWidgetUrl('')}
                           className="text-xs flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors"
                        >
                           <RefreshCcw size={12} /> Change
                        </button>
                    </div>
                    <iframe 
                        src={activeWidgetUrl}
                        className="w-full flex-1 border-0"
                        scrolling="yes"
                        title="Stats Widget"
                    ></iframe>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
                     <div className="bg-stadium-800 p-4 rounded-full">
                         <Layout size={32} className="text-gray-500" />
                     </div>
                     <div>
                         <h3 className="text-gray-200 font-bold mb-1">Add Widget</h3>
                         <p className="text-gray-500 text-xs">Paste an embed code or URL (e.g., Live Score).</p>
                     </div>
                     <div className="w-full max-w-xs space-y-2">
                        <div className="relative">
                            <LinkIcon className="absolute left-3 top-3 text-gray-500" size={14} />
                            <input 
                                type="text" 
                                value={widgetInput}
                                onChange={(e) => setWidgetInput(e.target.value)}
                                placeholder="Paste embed code..."
                                className="w-full bg-stadium-800 border border-stadium-700 rounded-lg pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-stadium-accent"
                            />
                        </div>
                        <button 
                           onClick={handleLoadWidget}
                           disabled={!widgetInput}
                           className="w-full bg-stadium-accent hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold py-2.5 rounded-lg transition-colors"
                        >
                           Load Widget
                        </button>
                     </div>
                </div>
              )}
           </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.sender === currentUser.name ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-baseline gap-2 mb-1`}>
                   <span className="text-[10px] font-bold text-gray-300">
                    {msg.sender}
                   </span>
                   <span className="text-[10px] text-gray-500">{msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                      msg.sender === currentUser.name
                        ? 'bg-stadium-accent/90 backdrop-blur-md text-white rounded-tr-none'
                        : 'bg-stadium-700/80 backdrop-blur-md text-gray-100 rounded-tl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area - Only show for chat tab */}
      {activeTab === 'chat' && (
        <form onSubmit={handleSend} className="p-3 bg-stadium-900/90 border-t border-stadium-700 shrink-0 backdrop-blur-md">
            <div className="relative">
            <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Message..."
                className="w-full bg-stadium-800/50 text-white rounded-full pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stadium-accent transition-all placeholder-gray-500 border border-stadium-700/50"
            />
            <button
                type="submit"
                disabled={!inputText.trim()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 bg-stadium-accent hover:bg-blue-600 rounded-full text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Send size={14} />
            </button>
            </div>
        </form>
      )}
    </div>
  );
};

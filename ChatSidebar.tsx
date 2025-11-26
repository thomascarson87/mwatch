import React, { useState, useEffect, useRef } from 'react';
import { Message, User } from './types';
import { Send, Bot, Users, Sparkles, BarChart3, X } from 'lucide-react';
import { generateAssistantResponse } from './geminiService';

interface ChatSidebarProps {
  messages: Message[];
  onSendMessage: (text: string, isAiQuery?: boolean) => void;
  currentUser: User;
  streamTitle: string;
  onClose?: () => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({ messages, onSendMessage, currentUser, streamTitle, onClose }) => {
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'ai' | 'stats'>('chat');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (activeTab !== 'stats') {
      scrollToBottom();
    }
  }, [messages, activeTab]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText;
    setInputText('');

    if (activeTab === 'chat' || activeTab === 'stats') {
      // If sending from stats tab, switch back to chat to see it
      if (activeTab === 'stats') setActiveTab('chat');
      onSendMessage(text);
    } else {
      // AI Mode
      onSendMessage(text); // Show user query
      setIsAiThinking(true);
      const response = await generateAssistantResponse(text, streamTitle || "Live Sports Match");
      onSendMessage(response, true);
      setIsAiThinking(false);
    }
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
            onClick={() => setActiveTab('ai')}
            className={`flex-1 py-3 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-colors relative ${
              activeTab === 'ai' ? 'text-purple-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Bot size={16} />
            AI Coach
            {activeTab === 'ai' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-400" />}
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-3 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-colors relative ${
              activeTab === 'stats' ? 'text-green-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            <BarChart3 size={16} />
            Stats
            {activeTab === 'stats' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-green-400" />}
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
        
        {activeTab === 'stats' ? (
           <div className="flex-1 overflow-y-auto no-scrollbar bg-stadium-900/80">
              <iframe 
                id="sofa-lineups-embed-14566580" 
                src="https://widgets.sofascore.com/es-ES/embed/lineups?id=14566580&widgetTheme=dark"
                className="w-full border-0 min-h-[786px]"
                scrolling="no"
                title="SofaScore Lineups"
              ></iframe>
              <div className="p-4 text-center text-[10px] text-gray-500 font-sans border-t border-stadium-700/50">
                  <a href="https://www.sofascore.com/es/football/match/barcelona-chelsea/Nrgb#id:14566580" target="_blank" rel="noreferrer" className="hover:text-stadium-accent underline transition-colors">
                       Ver resultados en SofaScore
                  </a>
              </div>
           </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            {activeTab === 'ai' && messages.filter(m => m.isAi).length === 0 && (
              <div className="text-center text-gray-500 mt-10">
                <Sparkles className="mx-auto mb-2 text-purple-400" size={32} />
                <p className="text-sm">Ask me about rules, stats, or player info!</p>
              </div>
            )}

            {(activeTab === 'chat' ? messages.filter(m => !m.isAi) : messages.filter(m => m.isAi || (m.sender === currentUser.name && messages.indexOf(m) > 0 && messages[messages.indexOf(m)+1]?.isAi) || m.sender === 'mwatch AI' || (m.isAi === undefined && m.text.includes('?')) )).map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.sender === currentUser.name ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-baseline gap-2 mb-1`}>
                   <span className={`text-[10px] font-bold ${msg.isAi ? 'text-purple-400' : 'text-gray-300'}`}>
                    {msg.sender}
                   </span>
                   <span className="text-[10px] text-gray-500">{msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    msg.isAi 
                      ? 'bg-purple-900/80 border border-purple-500/30 text-purple-100'
                      : msg.sender === currentUser.name
                        ? 'bg-stadium-accent/90 backdrop-blur-md text-white rounded-tr-none'
                        : 'bg-stadium-700/80 backdrop-blur-md text-gray-100 rounded-tl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isAiThinking && activeTab === 'ai' && (
              <div className="flex items-start">
                 <div className="bg-purple-900/20 border border-purple-500/20 text-purple-200 rounded-2xl px-4 py-2 text-sm flex gap-2 items-center">
                   <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></span>
                   <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-100"></span>
                   <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-200"></span>
                 </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="p-3 bg-stadium-900/90 border-t border-stadium-700 shrink-0 backdrop-blur-md">
        <div className="relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={activeTab === 'ai' ? "Ask AI Coach..." : "Message..."}
            className="w-full bg-stadium-800/50 text-white rounded-full pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stadium-accent transition-all placeholder-gray-500 border border-stadium-700/50"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isAiThinking}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 bg-stadium-accent hover:bg-blue-600 rounded-full text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {activeTab === 'ai' ? <Sparkles size={14} /> : <Send size={14} />}
          </button>
        </div>
      </form>
    </div>
  );
};
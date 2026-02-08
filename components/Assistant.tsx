import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { sendMessageToGemini } from '../services/geminiService';

const Assistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'System Online. I am the MaxBit Concierge. Accessing inventory and logistics protocols... How may I assist you?', timestamp: Date.now() }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isOpen, isThinking]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    
    const userText = inputValue;
    setInputValue(''); // Clear input immediately

    const userMsg: ChatMessage = { role: 'user', text: userText, timestamp: Date.now() };
    
    // Optimistic UI update
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    try {
      // Prepare history for API (exclude the message we just added effectively, or include it? 
      // The service expects history + new message. We pass previous messages as history.)
      const historyForApi = messages.map(m => ({ role: m.role, text: m.text }));
      
      const responseText = await sendMessageToGemini(historyForApi, userText);
      
      setMessages(prev => [...prev, { role: 'model', text: responseText, timestamp: Date.now() }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', text: "Error: Connection lost.", timestamp: Date.now() }]);
    } finally { 
      setIsThinking(false); 
    }
  };

  return (
    <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-[90] flex flex-col items-end font-sans">
      {isOpen && (
        <div className="bg-slate-950 rounded-2xl shadow-2xl w-[90vw] sm:w-[400px] h-[500px] md:h-[600px] mb-4 md:mb-6 flex flex-col overflow-hidden border border-slate-800 animate-fade-in-up ring-1 ring-cyan-500/30">
          <div className="maxbit-gradient p-5 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-slate-900 rounded-full animate-pulse"></div>
                <div>
                    <span className="font-black italic text-slate-900 tracking-tighter block leading-none">MAXBIT CONCIERGE</span>
                    <span className="text-[9px] font-bold text-slate-800 tracking-widest uppercase opacity-75">AI Operational</span>
                </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-900 hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#0b0f1a]" ref={scrollRef}>
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 text-xs md:text-sm leading-relaxed rounded-2xl ${
                    msg.role === 'user' 
                    ? 'bg-cyan-500 text-slate-950 font-bold rounded-tr-none shadow-[0_0_15px_rgba(34,211,238,0.2)]' 
                    : 'bg-slate-900 text-slate-300 border border-slate-800 rounded-tl-none'
                  }`}>
                  <p className="whitespace-pre-line">{msg.text}</p>
                  <span className={`text-[8px] font-mono mt-2 block opacity-50 ${msg.role === 'user' ? 'text-slate-900' : 'text-slate-500'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
              </div>
            ))}
            {isThinking && (
                <div className="flex justify-start">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none p-4 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                </div>
            )}
          </div>

          <div className="p-4 bg-slate-950 border-t border-slate-800">
            <div className="flex gap-2">
              <input 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask about orders, specs, or support..." 
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs md:text-sm text-white outline-none focus:border-cyan-500 transition-colors placeholder-slate-600"
              />
              <button 
                onClick={handleSend} 
                disabled={!inputValue.trim() || isThinking}
                className="bg-cyan-500 text-slate-900 p-3 rounded-xl hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(34,211,238,0.3)]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <button onClick={() => setIsOpen(!isOpen)} className="maxbit-gradient text-slate-900 w-12 h-12 md:w-16 md:h-16 flex items-center justify-center rounded-xl md:rounded-2xl shadow-[0_0_30px_rgba(34,211,238,0.3)] hover:scale-110 transition-all duration-300 group border-2 border-white/10 z-50">
        {isOpen ? (
             <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
        ) : (
            <div className="relative">
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-900 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                </span>
                <svg className="w-6 h-6 md:w-8 md:h-8 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
            </div>
        )}
      </button>
    </div>
  );
};

export default Assistant;
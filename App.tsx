import React, { useState, useRef, useEffect } from 'react';
import { Search, Send, Filter, X, Calendar, User, FileText, ChevronDown, Settings, Sparkles, Bot, Clock, TrendingUp, Database, Mic, MicOff, Copy, ThumbsUp, ThumbsDown, Share2, Download, Bookmark, MessageSquare, Brain, Zap, Shield, Globe, BarChart3, Eye, EyeOff, Moon, Sun, Palette, Volume2, VolumeX, AlertCircle, MapPin, Building, Star, Info } from 'lucide-react';
import { flaskService, FlaskServiceError } from './services/flaskService';

// Type definitions (Source and Message are imported from flaskService)

interface Author {
  name: string;
  count: number;
}

interface Document {
  id: string;
  name: string;
  author: string;
  date: string;
  type: string;
  size?: string;
  category: string;
  status?: string;
  downloads?: number;
  content?: string;
}

interface DateRange {
  start: string;
  end: string;
}

interface QuickPrompt {
  text: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface Model {
  id: string;
  name: string;
  description: string;
}

// Extend window for speech recognition
declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

// Helper function to generate Azure Storage URL
const generateAzureStorageUrl = (filePath: string): string => {
  const accountName = import.meta.env.VITE_AZURE_STORAGE_ACCOUNT_NAME;
  const containerName = import.meta.env.VITE_AZURE_STORAGE_CONTAINER_NAME;
  
  if (!accountName || !containerName) {
    console.warn('Azure Storage configuration not found');
    return '#';
  }

  // Extract blob name from full Azure Storage path
  let blobName = filePath;
  
  // If it's a full URL like: https://account.blob.core.windows.net/container/path/file.pdf
  if (filePath.includes('blob.core.windows.net')) {
    const urlParts = filePath.split('/');
    const containerIndex = urlParts.findIndex(part => part === containerName);
    if (containerIndex !== -1 && containerIndex < urlParts.length - 1) {
      // Get everything after the container name and decode any existing encoding
      blobName = urlParts.slice(containerIndex + 1).map(part => decodeURIComponent(part)).join('/');
    }
  }
  
  // If it starts with container name, remove it
  if (blobName.startsWith(`${containerName}/`)) {
    blobName = blobName.substring(containerName.length + 1);
  }
  
  // Remove leading slash if present
  blobName = blobName.startsWith('/') ? blobName.substring(1) : blobName;
  
  // Properly encode the blob name (handles spaces and special characters)
  const encodedBlobName = blobName.split('/').map(part => encodeURIComponent(part)).join('/');
  
  const finalUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${encodedBlobName}`;
  
  console.log('🔗 Generating URL:', {
    originalPath: filePath,
    extractedBlobName: blobName,
    encodedBlobName: encodedBlobName,
    finalUrl: finalUrl
  });
  
  return finalUrl;
};

// Helper function to normalize relevance scores
const normalizeRelevance = (score: number): number => {
  // Azure Search scores can be much higher than 1.0
  // Normalize to 0-1 range using a logarithmic scale for better distribution
  if (score <= 0) return 0;
  if (score >= 10) return 1; // Cap very high scores
  
  // Use a sigmoid-like function to normalize scores between 0-10 to 0-1
  return Math.min(1, score / 10);
};

// Helper function to open file in new tab
const openFile = (source: any) => {
  console.log('📁 Opening file:', {
    sourceName: source.name,
    sourceId: source.id,
    sourceType: source.type
  });
  
  const url = generateAzureStorageUrl(source.id);
  if (url !== '#') {
    console.log('✅ Opening URL:', url);
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    console.warn('❌ Cannot open file: Azure Storage configuration missing');
    alert('Azure Storage is not configured. Please check your environment variables.');
  }
};

// Enhanced Formatted Response Component
const FormattedResponse: React.FC<{ content: string; darkMode: boolean }> = ({ content, darkMode }) => {
  // Parse the content into structured sections
  const parseContent = (text: string) => {
    const lines = text.split('\n');
    const sections: Array<{
      type: 'header' | 'bullet' | 'text';
      content: string;
      level?: number;
      icon?: React.ComponentType<{ className?: string }>;
    }> = [];

    let currentSection: any = null;

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('###')) {
        // Main section header
        const headerText = trimmedLine.replace(/^#{1,6}\s*/, '').replace(/:\s*$/, '');
        let icon = Info;
        
        // Assign icons based on content
        const lowerContent = headerText.toLowerCase();
        if (lowerContent.includes('location') || lowerContent.includes('dubai') || lowerContent.includes('vegas') || lowerContent.includes('london')) {
          icon = MapPin;
        } else if (lowerContent.includes('accommodation') || lowerContent.includes('hotel')) {
          icon = Building;
        } else if (lowerContent.includes('key') || lowerContent.includes('summary') || lowerContent.includes('overview')) {
          icon = Star;
        } else if (lowerContent.includes('risk') || lowerContent.includes('security') || lowerContent.includes('compliance')) {
          icon = Shield;
        } else if (lowerContent.includes('trend') || lowerContent.includes('market') || lowerContent.includes('analysis')) {
          icon = TrendingUp;
        } else if (lowerContent.includes('data') || lowerContent.includes('report') || lowerContent.includes('document')) {
          icon = FileText;
        } else if (lowerContent.includes('user') || lowerContent.includes('author') || lowerContent.includes('customer')) {
          icon = User;
        } else if (lowerContent.includes('calendar') || lowerContent.includes('date') || lowerContent.includes('time')) {
          icon = Calendar;
        }
        
        sections.push({
          type: 'header',
          content: headerText,
          level: 3,
          icon
        });
      } else if (trimmedLine.startsWith('##')) {
        // Sub-section header
        const headerText = trimmedLine.replace(/^#{1,6}\s*/, '').replace(/:\s*$/, '');
        sections.push({
          type: 'header',
          content: headerText,
          level: 2,
          icon: Info
        });
      } else if (trimmedLine.startsWith('- **') || trimmedLine.startsWith('- ')) {
        // Bullet point
        let bulletContent = trimmedLine.replace(/^-\s*/, '');
        
        // Handle formatting
        if (bulletContent.includes('**')) {
          bulletContent = bulletContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        }
        if (bulletContent.includes('*') && !bulletContent.includes('**')) {
          bulletContent = bulletContent.replace(/\*(.*?)\*/g, '<em>$1</em>');
        }
        
        sections.push({
          type: 'bullet',
          content: bulletContent
        });
      } else if (/^\d+\.\s/.test(trimmedLine)) {
        // Numbered list
        let numberContent = trimmedLine.replace(/^\d+\.\s*/, '');
        
        // Handle formatting
        if (numberContent.includes('**')) {
          numberContent = numberContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        }
        if (numberContent.includes('*') && !numberContent.includes('**')) {
          numberContent = numberContent.replace(/\*(.*?)\*/g, '<em>$1</em>');
        }
        
        sections.push({
          type: 'bullet', // Treat numbered lists similar to bullets for now
          content: numberContent
        });
      } else if (trimmedLine) {
        // Regular text
        let textContent = trimmedLine;
        
        // Handle formatting
        if (textContent.includes('**')) {
          textContent = textContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        }
        if (textContent.includes('*') && !textContent.includes('**')) {
          textContent = textContent.replace(/\*(.*?)\*/g, '<em>$1</em>');
        }
        
        sections.push({
          type: 'text',
          content: textContent
        });
      }
    });

    return sections;
  };

  const sections = parseContent(content);

  return (
    <div className="space-y-4">
      {sections.map((section, index) => {
        if (section.type === 'header') {
          const Icon = section.icon || Info;
          return (
            <div key={index} className={`relative ${section.level === 3 ? 'mb-6' : 'mb-4'}`}>
              {section.level === 3 ? (
                <div className={`relative p-4 rounded-xl border-l-4 ${
                  darkMode 
                    ? 'bg-gradient-to-r from-blue-900/30 to-blue-800/20 border-blue-400 bg-gray-800/50' 
                    : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-500 bg-white/80'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      darkMode 
                        ? 'bg-blue-600/80 text-white' 
                        : 'bg-blue-600 text-white'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className={`text-xl font-bold ${
                      darkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {section.content}
                    </h3>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={`w-4 h-4 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                  <h4 className={`text-lg font-semibold ${
                    darkMode ? 'text-gray-200' : 'text-gray-800'
                  }`}>
                    {section.content}
                  </h4>
                </div>
              )}
            </div>
          );
        } else if (section.type === 'bullet') {
          return (
            <div key={index} className={`ml-6 mb-3`}>
              <div className="flex items-start gap-3 group">
                <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 transition-colors ${
                  darkMode ? 'bg-blue-400 group-hover:bg-blue-300' : 'bg-blue-600 group-hover:bg-blue-700'
                }`}></div>
                <div 
                  className={`text-sm leading-relaxed flex-1 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}
                  dangerouslySetInnerHTML={{ __html: section.content }}
                  style={{
                    lineHeight: '1.6'
                  }}
                />
              </div>
            </div>
          );
        } else {
          return (
            <div 
              key={index} 
              className={`text-sm leading-relaxed ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}
              dangerouslySetInnerHTML={{ __html: section.content }}
            />
          );
        }
      })}
    </div>
  );
};

const RAGChatbot = () => {
  const [messages, setMessages] = useState<any[]>([
    {
      id: 1,
      type: 'bot',
      content: 'Hello! I\'m your AI-powered assistant. How can I help you today?',
      timestamp: new Date(),
    }
  ]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (messageText: string = inputMessage) => {
    if (!messageText.trim()) return;
    const userMessage = {
      id: messages.length + 1,
      type: 'user',
      content: messageText,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);
    try {
      const agentResult = await flaskService.sendAgentMessage(messageText);
      const botResponse = {
        id: messages.length + 2,
        type: 'bot',
        content: agentResult.response,
        tool_calls_made: agentResult.tool_calls_made,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botResponse]);
      if (audioEnabled && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(agentResult.response);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        window.speechSynthesis.speak(utterance);
      }
    } catch (err: any) {
      setError(err.message || 'Unknown error');
      const errorResponse = {
        id: messages.length + 2,
        type: 'bot',
        content: err.message || 'Unknown error',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={`flex flex-col h-screen transition-colors duration-300 ${darkMode ? 'bg-gray-900 text-white' : 'bg-gradient-to-br from-slate-50 to-blue-50'}`}>
      {/* Header/Navbar with branding and controls */}
      <div className={`relative border-b shadow-md z-10 ${darkMode ? 'bg-[#10131a] border-gray-800' : 'bg-white border-gray-300'}`}>
        {/* Barclays blue accent bar */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-b-xl shadow-lg" />
        <div className="relative px-10 py-5 flex items-center justify-between min-h-[88px]">
          {/* Brand Section */}
          <div className="flex items-center gap-7">
            <div className="relative group">
              <div className="absolute -inset-2 bg-blue-100 dark:bg-blue-900 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-300"></div>
              <div className="relative w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-xl border border-blue-100 dark:border-blue-800 group-hover:scale-105 transition-transform">
                <img 
                  src="/Barclays Logo.png" 
                  alt="Barclays Logo" 
                  className="w-12 h-12 object-contain"
                  style={{ borderRadius: '16px' }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      parent.classList.remove('bg-white');
                      parent.classList.add('bg-blue-700');
                      parent.innerHTML = '<svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex flex-col">
              <h1 className={`text-3xl font-extrabold tracking-wide font-sans ${darkMode ? 'text-white' : 'text-gray-900'}`}>Barclays Agent</h1>
              <span className={`text-base mt-1 tracking-wide ${darkMode ? 'text-blue-400' : 'text-blue-700'}`}>MCP Integrated</span>
            </div>
          </div>
          {/* Controls Section + Help + Avatar */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`relative p-2.5 rounded-lg transition-all duration-200 group border border-transparent
                ${darkMode ? 'text-blue-400 hover:text-white hover:bg-gray-800/70 hover:border-blue-700' : 'text-gray-600 hover:text-blue-700 hover:bg-blue-50 hover:border-blue-300'}`}
              title="Toggle Dark Mode"
            >
              <div className="relative">
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </div>
            </button>
            {/* User avatar */}
            <div className={`w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center ml-2 shadow border ${darkMode ? 'border-blue-800' : 'border-blue-300'} text-white font-bold text-lg select-none`}>
              AJ
            </div>
          </div>
        </div>
      </div>
      {/* Error Banner */}
      {error && (
        <div className={`mx-6 mt-4 p-4 rounded-lg border-l-4 ${darkMode ? 'bg-red-900/20 border-red-600 text-red-100' : 'bg-red-50 border-red-500 text-red-800'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-semibold">Service Error</span>
              <span className="text-sm mt-1">{error}</span>
            </div>
            <button onClick={() => setError(null)} className={`p-1 rounded ${darkMode ? 'hover:bg-red-800/30' : 'hover:bg-red-100'}`}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {messages.map(message => (
          <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-3xl w-full ${message.type === 'user' ? 'ml-16' : 'mr-16'}`}>
              <div
                className={`relative rounded-2xl p-5 transition-all border shadow-md
                  ${message.type === 'user'
                    ? (darkMode
                        ? 'bg-blue-950 text-blue-100 border-blue-800 hover:bg-blue-900/80'
                        : 'bg-blue-50 text-blue-900 border-blue-300 hover:bg-blue-100')
                    : (darkMode
                        ? 'bg-gray-900/90 text-gray-100 border-gray-700 hover:bg-gray-800/70'
                        : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-50')
                  }
                  hover:scale-[1.01] hover:shadow-lg
                `}
              >
                {/* Avatar/Icon */}
                <div className="absolute -top-5 left-0 flex items-center">
                  {message.type === 'bot' ? (
                    <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow border border-blue-200 dark:border-blue-700 -ml-4">
                      <img
                        src="/Barclays Logo.png"
                        alt="Bot"
                        className="w-6 h-6 object-contain"
                        style={{ borderRadius: '50%' }}
                      />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center shadow border border-blue-300 -ml-4">
                      <User className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>
                {/* Message Content */}
                <div className={`leading-relaxed min-h-[32px] ${message.type === 'user' ? (darkMode ? 'text-blue-100' : 'text-blue-900') : (darkMode ? 'text-gray-100' : 'text-gray-900')} pl-12`}>
                  {message.content}
                  {message.type === 'bot' && typeof message.tool_calls_made !== 'undefined' && (
                    <div className="mt-2 text-xs text-blue-600">Tool Calls Made: {message.tool_calls_made}</div>
                  )}
                </div>
                {/* Timestamp bottom-right */}
                <div className="absolute bottom-3 right-5 text-xs text-gray-500 select-none">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-4xl w-full mr-12">
              <div className={`rounded-2xl p-6 shadow-sm transition-all ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>Processing...</span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      {/* Input Area */}
      <div className="w-full max-w-2xl mx-auto mt-2 mb-6">
        <div className="border-t border-gray-300 dark:border-gray-800 mb-4" />
        <div className={`flex items-end ${darkMode ? 'bg-gray-900' : 'bg-gray-50'} border border-gray-300 dark:border-gray-700 rounded-2xl shadow-md px-4 py-2 transition-all focus-within:ring-2 focus-within:ring-blue-500`}>
          <textarea
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message and press Enter…"
            className={`flex-1 bg-transparent border-none outline-none resize-none text-sm py-2 px-0 min-h-[44px] max-h-[120px] transition-all ${darkMode ? 'text-gray-100 placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`}
            rows={1}
            style={{ minHeight: '44px', maxHeight: '120px', overflow: 'hidden' }}
            onInput={e => {
              e.currentTarget.style.height = 'auto';
              e.currentTarget.style.height = Math.min(Math.max(e.currentTarget.scrollHeight, 44), 120) + 'px';
            }}
            disabled={isLoading}
            aria-label="Chat message input"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isLoading}
            className={`ml-3 p-2 rounded-lg transition-colors duration-200 flex items-center justify-center
              ${!inputMessage.trim() || isLoading
                ? (darkMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed')
                : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'}
            `}
            title="Send Message"
          >
            {isLoading
              ? <div className="animate-spin h-5 w-5 border-b-2 border-white rounded-full"></div>
              : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RAGChatbot;

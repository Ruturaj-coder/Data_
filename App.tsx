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
      <div className={`relative border-b transition-all duration-300 ${darkMode ? 'bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-gray-700/50' : 'bg-gradient-to-r from-blue-50 via-white to-blue-50 border-gray-200/80'}`}>
        {/* Subtle pattern overlay */}
        <div className={`absolute inset-0 opacity-30 ${darkMode ? 'bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/20' : 'bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5'}`}></div>
        <div className="relative px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Brand Section */}
            <div className="flex items-center gap-5">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-300"></div>
                <div className="relative w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-xl">
                  <img 
                    src="/Barclays Logo.png" 
                    alt="Barclays Logo" 
                    className="w-10 h-10 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.classList.remove('bg-white');
                        parent.classList.add('bg-gradient-to-br', 'from-blue-600', 'via-blue-700', 'to-indigo-800');
                        parent.innerHTML = '<svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
                      }
                    }}
                  />
                </div>
              </div>
              <div>
                <h1 className={`text-2xl font-bold tracking-tight bg-gradient-to-r ${darkMode ? 'from-white to-gray-200 bg-clip-text text-transparent' : 'from-gray-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent'}`}>
                  Barclays RAG Assistant
                </h1>
              </div>
            </div>
            {/* Controls Section */}
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 p-2 rounded-xl backdrop-blur-sm shadow-lg ${darkMode ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}> 
                <button
                  onClick={() => {
                    if (audioEnabled && 'speechSynthesis' in window) {
                      window.speechSynthesis.cancel();
                    }
                    setAudioEnabled(!audioEnabled);
                  }}
                  className={`relative p-2.5 rounded-lg transition-all duration-300 group ${audioEnabled ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' : darkMode ? 'text-gray-400 hover:text-white hover:bg-gradient-to-r hover:from-gray-700 hover:to-gray-600' : 'text-gray-600 hover:text-blue-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:shadow-md'}`}
                  title="Toggle Text-to-Speech"
                >
                  {audioEnabled && (
                    <div className="absolute inset-0 bg-blue-400/20 rounded-lg animate-pulse"></div>
                  )}
                  <div className="relative">
                    {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </div>
                </button>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className={`relative p-2.5 rounded-lg transition-all duration-300 group ${darkMode ? 'text-gray-400 hover:text-white hover:bg-gradient-to-r hover:from-gray-700 hover:to-gray-600' : 'text-gray-600 hover:text-blue-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:shadow-md'}`}
                  title="Toggle Dark Mode"
                >
                  <div className="relative">
                    {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </div>
                </button>
              </div>
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
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map(message => (
          <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-3xl w-full ${message.type === 'user' ? 'ml-16' : 'mr-16'}`}>
              <div className={`${message.type === 'user' ? (darkMode ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white ml-auto shadow-lg' : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white ml-auto') : (darkMode ? 'bg-gray-800/95 border border-gray-700/60 text-white shadow-xl' : 'bg-white/90 backdrop-blur-sm border border-gray-200/60 shadow-lg')} rounded-xl p-4 transition-all hover:shadow-xl`}>
                <div className={`leading-relaxed ${message.type === 'user' ? 'text-white' : darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                  {message.content}
                  {message.type === 'bot' && typeof message.tool_calls_made !== 'undefined' && (
                    <div className="mt-2 text-xs text-blue-600">Tool Calls Made: {message.tool_calls_made}</div>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs mt-2 text-gray-400">
                  <span>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
      <div className={`relative mx-auto w-1/2 rounded-lg shadow-xl transition-all duration-300 mb-4 ${darkMode ? 'backdrop-blur-md bg-gray-800/90 border border-gray-600/50 hover:bg-gray-800/95 hover:shadow-2xl' : 'backdrop-blur-md bg-white/70 border border-white/20 hover:bg-white/80 hover:shadow-2xl'}`}>
        <div className="px-6 py-4">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything... (Shift+Enter for new line)"
                  className={`w-full px-4 py-3 pr-20 border rounded-lg focus:outline-none transition-all text-sm resize-none ${darkMode ? 'bg-gray-700/90 border-gray-500/50 text-white placeholder-gray-400 focus:ring-1 focus:ring-blue-400 focus:border-blue-400 focus:bg-gray-700' : 'bg-white/90 border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:bg-white'}`}
                  rows={1}
                  style={{ minHeight: '44px', maxHeight: '120px', overflow: 'hidden' }}
                  onInput={(e) => {
                    e.currentTarget.style.height = 'auto';
                    e.currentTarget.style.height = Math.min(Math.max(e.currentTarget.scrollHeight, 44), 120) + 'px';
                  }}
                  disabled={isLoading}
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || isLoading}
                  className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 rounded transition-colors ${!inputMessage.trim() || isLoading ? (darkMode ? 'text-gray-500 cursor-not-allowed' : 'text-gray-400 cursor-not-allowed') : (darkMode ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-900/30' : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50')}`}
                  title="Send Message"
                >
                  {isLoading ? (<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>) : (<Send className="w-4 h-4" />)}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RAGChatbot;

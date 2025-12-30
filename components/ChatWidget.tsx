import React, { useState, useEffect, useRef, useContext } from 'react';
import { X, Send, Sparkles, User } from 'lucide-react';
import { GoogleGenAI, Chat } from "@google/genai";
import { DataContext } from '../contexts/DataContext';

// Simple markdown parser
const parseMarkdown = (text: string) => {
    // Bold: **text** or __text__
    text = text.replace(/\*\*(.*?)\*\*|__(.*?)__/g, '<strong>$1$2</strong>');
    // Italics: *text* or _text_
    text = text.replace(/\*(.*?)\*|_(.*?)_/g, '<em>$1$2</em>');
    // Unordered list: * item or - item
    text = text.replace(/^\s*[\*-]\s*(.*)/gm, '<ul><li>$1</li></ul>');
    text = text.replace(/<\/ul>\s*<ul>/g, ''); // Join consecutive lists
    // Replace newlines with <br>
    text = text.replace(/\n/g, '<br />');
    return text;
};


interface ChatWidgetProps {
    isOpen: boolean;
    onClose: () => void;
}

interface Message {
    role: 'user' | 'model';
    text: string;
}

const ChatWidget: React.FC<ChatWidgetProps> = ({ isOpen, onClose }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chat, setChat] = useState<Chat | null>(null);
    const { dealers, models } = useContext(DataContext);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && !chat) {
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY as string });

                const modelDataSummary = models.map(m => `${m.brand} ${m.model_name} (Type: ${m.body_type}, Range: ${m.range_wltp}km)`).join(', ');
                const dealerDataSummary = dealers.map(d => `${d.name} in ${d.city} (Brands: ${d.brands.join('/')})`).join(', ');

                const systemInstruction = `You are a helpful and friendly AI assistant for "Makina Elektrike", an online directory for electric vehicles in Albania.
                Your goal is to help users find the perfect electric vehicle and dealership.
                You have access to the following data from the website:
                - AVAILABLE MODELS: ${modelDataSummary}
                - AVAILABLE DEALERSHIPS: ${dealerDataSummary}
                Use this information to answer user questions about available cars, their specifications, and where to find them.
                If a user asks a general question about EVs, answer it to the best of your ability.
                Keep your answers concise and easy to read. Use markdown for formatting like lists or bold text.
                Always communicate in the language of the user's question.`;

                const newChat = ai.chats.create({
                    model: 'gemini-2.5-flash',
                    config: { systemInstruction }
                });

                setChat(newChat);
                setMessages([{ role: 'model', text: 'Hello! How can I help you find the perfect electric car today?' }]);
            } catch (error) {
                console.error("Failed to initialize Gemini AI:", error);
                setMessages([{ role: 'model', text: 'Sorry, the AI assistant is currently unavailable.' }]);
            }
        }
    }, [isOpen, chat, dealers, models]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSend = async () => {
        if (input.trim() === '' || isLoading || !chat) return;

        const userMessage: Message = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await chat.sendMessage({ message: userMessage.text });
            const modelResponse: Message = { role: 'model', text: response.text };
            setMessages(prev => [...prev, modelResponse]);
        } catch (error) {
            console.error('Error sending message to Gemini:', error);
            const errorMessage: Message = { role: 'model', text: "I'm having trouble connecting right now. Please try again later." };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className={`fixed bottom-8 right-8 z-[60] w-[380px] h-[600px] transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5 pointer-events-none'}`}>
            <div className="bg-navy-blue/80 backdrop-blur-2xl border border-gray-cyan/30 rounded-2xl shadow-2xl w-full h-full flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-white/10 flex-shrink-0">
                    <div className="flex items-center space-x-2">
                        <Sparkles className="text-gray-cyan" size={24} />
                        <h2 className="text-lg font-bold text-white">EV Assistant</h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full text-white hover:bg-white/10 transition-colors" aria-label="Close chat">
                        <X size={20} />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-gray-cyan flex items-center justify-center flex-shrink-0"><Sparkles size={16} className="text-white" /></div>}
                            <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${msg.role === 'user'
                                    ? 'bg-vivid-red text-white rounded-br-none'
                                    : 'bg-gray-700/50 text-gray-200 rounded-bl-none'
                                }`}>
                                <div dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.text) }} />
                            </div>
                            {msg.role === 'user' && <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0"><User size={16} className="text-white" /></div>}
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex items-start gap-3 justify-start">
                            <div className="w-8 h-8 rounded-full bg-gray-cyan flex items-center justify-center flex-shrink-0"><Sparkles size={16} className="text-white" /></div>
                            <div className="max-w-[80%] rounded-2xl px-4 py-2 text-sm bg-gray-700/50 text-gray-200 rounded-bl-none">
                                <div className="flex items-center space-x-1">
                                    <span className="h-2 w-2 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                    <span className="h-2 w-2 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                    <span className="h-2 w-2 bg-gray-300 rounded-full animate-bounce"></span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-white/10 flex-shrink-0">
                    <div className="relative flex items-center">
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Ask me anything about EVs..."
                            className="w-full bg-white/10 border-gray-600 rounded-full shadow-sm focus:ring-gray-cyan focus:border-gray-cyan text-white py-2.5 pl-4 pr-12"
                            disabled={isLoading}
                        />
                        <button onClick={handleSend} disabled={isLoading} className="absolute right-1 top-1/2 -translate-y-1/2 p-2 bg-gray-cyan rounded-full text-white disabled:bg-gray-500 hover:bg-opacity-90 transition-colors">
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatWidget;

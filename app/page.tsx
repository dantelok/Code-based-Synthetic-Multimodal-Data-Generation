"use client";
import Prompt from "./components/prompt";
import UserMessage from "./components/UserMessage";
import AiMessage from "./components/AiMessage";
import { useState, useRef, useEffect } from "react";

interface Message {
  type: 'user' | 'ai';
  prompt?: string;
  fileType?: 'csv' | 'image';
  fileData?: File;
  apiKey?: string;
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good day";
  return "Good evening";
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = (prompt: string, file: File | null, apiKey: string) => {
    const newMessage: Message = {
      type: 'user',
      prompt,
      fileType: file?.type.includes('csv') ? 'csv' : 'image',
      fileData: file || undefined,
      apiKey
    };

    setMessages(prev => [...prev, newMessage]);

    // Add AI response message
    const aiMessage: Message = {
      type: 'ai',
      prompt,
      fileType: file?.type.includes('csv') ? 'csv' : 'image',
      fileData: file || undefined,
      apiKey
    };

    setMessages(prev => [...prev, aiMessage]);
  };

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="min-h-screen bg-[#141415] text-white flex flex-col">
      <div className="flex-1 overflow-hidden">
        <div
          className="h-full max-h-[calc(100vh-120px)] overflow-y-auto px-2 sm:px-4 py-4 sm:py-8 container mx-auto space-y-4 mb-4"
          style={{ scrollbarGutter: 'stable' }}
        >
          {messages.length === 0 ? (
            <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-200 tracking-wide text-center px-4">
                {getGreeting()}, Reuben
              </h1>
            </div>
          ) : (
            messages.map((message, index) => (
              message.type === 'user' ? (
                <UserMessage 
                  key={index}
                  prompt={message.prompt}
                  fileType={message.fileType}
                  fileName={message.fileData?.name}
                />
              ) : (
                <AiMessage
                  key={index}
                  fileType={message.fileType}
                  fileData={message.fileData}
                  prompt={message.prompt}
                  apiKey={message.apiKey}
                />
              )
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <div className="fixed inset-x-0 sm:inset-x-4 bottom-0 sm:bottom-4 bg-[#1C1C1E] z-50 rounded-t-lg sm:rounded-lg px-3 py-2 m-0 sm:m-5 safe-area-inset-bottom">
        <Prompt onSend={handleSendMessage} />
      </div>
    </div>
  );
}

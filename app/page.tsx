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
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = (prompt: string, file: File | null) => {
    const newMessage: Message = {
      type: 'user',
      prompt,
      fileType: file?.type.includes('csv') ? 'csv' : 'image',
      fileData: file || undefined
    };

    setMessages(prev => [...prev, newMessage]);

    // Add AI response message
    const aiMessage: Message = {
      type: 'ai',
      prompt,
      fileType: file?.type.includes('csv') ? 'csv' : 'image',
      fileData: file || undefined
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
          className="h-full max-h-[calc(100vh-120px)] overflow-y-auto px-4 py-8 container mx-auto space-y-4 mb-4"
          style={{ scrollbarGutter: 'stable' }}
        >
          {messages.map((message, index) => (
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
              />
            )
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <div className="fixed inset-x-4 bottom-4 bg-[#1C1C1E] z-50 rounded-lg px-3 py-2 m-5 safe‑area-inset-bottom">
  <Prompt onSend={handleSendMessage} />
</div>

    </div>
  );
}

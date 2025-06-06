import React, { useState, useRef } from 'react'
import { MdSend } from "react-icons/md";
import { IoCloudUpload } from "react-icons/io5";
import { IoEye, IoEyeOff } from "react-icons/io5";

interface PromptProps {
  onSend: (prompt: string, file: File | null, apiKey: string) => void;
}

const Prompt: React.FC<PromptProps> = ({ onSend }) => {
    const [inputValue, setInputValue] = useState<string>('');
    const [file, setFile] = useState<File | null>(null);
    const [apiKey, setApiKey] = useState<string>('');
    const [showApiKey, setShowApiKey] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(e.target.value);
    };

    const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setApiKey(e.target.value);
    };

    const toggleApiKeyVisibility = () => {
      setShowApiKey(!showApiKey);
    };

    const handleFileUpload = () => {
      fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        setFile(selectedFile);
      }
    };

    const handleSend = async () => {
      if (inputValue.trim() || file) {
        if (!apiKey) {
          onSend('Please enter your Cohere API key.', null, '');
          return;
        }

        if (file) {
          const isCSV = file.type === 'text/csv' || file.name.endsWith('.csv');
          const isImage = file.type.startsWith('image/');
          
          if (isCSV) {
            onSend(inputValue, file, apiKey);
          } else if (isImage) {
            // Handle image file
            onSend(inputValue, file, apiKey);
          } else {
            onSend('Please upload a CSV or image file.', null, '');
          }
        } else {
          // If no file, just send the prompt
          onSend(inputValue, null, apiKey);
        }
        
        // Reset after sending
        setInputValue('');
        setFile(null);
      }
    };

  return (
    <div className="w-full">
      <div className="relative">
        <input
          type={showApiKey ? "text" : "password"}
          value={apiKey}
          onChange={handleApiKeyChange}
          placeholder="Enter your Cohere API key"
          className="w-full p-3 mb-2 text-white bg-transparent border border-gray-600 rounded-lg focus:outline-none focus:border-[#2a6d89] text-sm sm:text-base pr-10"
        />
        <button
          type="button"
          onClick={toggleApiKeyVisibility}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
          aria-label={showApiKey ? "Hide API key" : "Show API key"}
        >
          {showApiKey ? (
            <IoEyeOff className="w-5 h-5" />
          ) : (
            <IoEye className="w-5 h-5" />
          )}
        </button>
      </div>
      <textarea
        value={inputValue}
        onChange={handleChange}
        placeholder="Enter your AI prompt here, and upload your CSV or image file to begin."
        className="chat-input w-full h-16 p-3 sm:p-4 text-white bg-transparent border-none resize-none focus:outline-none text-sm sm:text-base"
      />
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv,image/*"
        className="hidden"
      />
      {file && (
        <div className="flex items-center bg-[#232325] rounded-xl p-2 sm:p-3 mb-2 relative w-fit min-w-[200px] sm:min-w-[260px] shadow-md">
          <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-pink-500 rounded-lg mr-2 sm:mr-3">
            <svg xmlns='http://www.w3.org/2000/svg' className='w-5 h-5 sm:w-6 sm:h-6 text-white' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 17v-2a2 2 0 012-2h2a2 2 0 012 2v2m-6 0a2 2 0 002 2h2a2 2 0 002-2m-6 0V7a2 2 0 012-2h6a2 2 0 012 2v10m-6 0h6' /></svg>
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <a href="#" className="text-white font-medium truncate max-w-[120px] sm:max-w-[140px] hover:underline text-sm sm:text-base">{file.name}</a>
            <span className="text-xs text-gray-300">Document</span>
          </div>
          <button
            className="absolute top-1 sm:top-2 right-1 sm:right-2 text-gray-400 hover:text-white text-lg"
            onClick={() => setFile(null)}
            aria-label="Remove file"
            type="button"
          >
            ×
          </button>
        </div>
      )}
      <div className="button-group flex gap-2 m-2 justify-between">
        <button 
          onClick={handleFileUpload}
          className="add-button bg-[#1A262B] hover:bg-[#8476d4] transition-all duration-150 text-white rounded-full p-2 flex items-center justify-center group"
          aria-label="Upload file"
        >
          <IoCloudUpload className='text-[#2a6d89] text-xl sm:text-2xl group-hover:text-white transition-colors duration-150'/>
        </button>
        <button 
          onClick={handleSend}
          className="send-button bg-[#2a6d89] hover:bg-[#1A262B] transition-all duration-150 text-white rounded-full p-2 flex items-center justify-center group"
          aria-label="Send message"
        >
          <MdSend className='text-white text-xl sm:text-2xl group-hover:text-[#8476d4] transition-colors duration-150'/>
        </button>
      </div>
    </div>
  )
}

export default Prompt
import React, { useState, useRef } from 'react'
import { MdSend } from "react-icons/md";
import { IoCloudUpload } from "react-icons/io5";

interface PromptProps {
  onSend: (prompt: string, file: File | null) => void;
}

const Prompt: React.FC<PromptProps> = ({ onSend }) => {
    const [inputValue, setInputValue] = useState<string>('');
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(e.target.value);
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
        if (file) {
          const isCSV = file.type === 'text/csv' || file.name.endsWith('.csv');
          const isImage = file.type.startsWith('image/');
          
          if (isCSV) {
            onSend(inputValue, file);
          } else if (isImage) {
            // Handle image file
            onSend(inputValue, file);
          } else {
            onSend('Please upload a CSV or image file.', null);
          }
        } else {
          // If no file, just send the prompt
          onSend(inputValue, null);
        }
        
        // Reset after sending
        setInputValue('');
        setFile(null);
      }
    };

  return (
    <div>
      <textarea
        value={inputValue}
        onChange={handleChange}
        placeholder="Enter your AI prompt here, and upload your CSV or image file to begin."
        className="chat-input w-full h-16 p-4 text-white bg-transparent border-none resize-none focus:outline-none"
      />
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv,image/*"
        className="hidden"
      />
      {file && (
        <div className="flex items-center bg-[#232325] rounded-xl p-3 mb-2 relative w-fit min-w-[260px] shadow-md">
          <div className="flex items-center justify-center w-10 h-10 bg-pink-500 rounded-lg mr-3">
            <svg xmlns='http://www.w3.org/2000/svg' className='w-6 h-6 text-white' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 17v-2a2 2 0 012-2h2a2 2 0 012 2v2m-6 0a2 2 0 002 2h2a2 2 0 002-2m-6 0V7a2 2 0 012-2h6a2 2 0 012 2v10m-6 0h6' /></svg>
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <a href="#" className="text-white font-medium truncate max-w-[140px] hover:underline">{file.name}</a>
            <span className="text-xs text-gray-300">Document</span>
          </div>
          <button
            className="absolute top-2 right-2 text-gray-400 hover:text-white text-lg"
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
        >
          <IoCloudUpload className='text-[#2a6d89] text-2xl group-hover:text-white transition-colors duration-150'/>
        </button>
        <button 
          onClick={handleSend}
          className="send-button bg-[#2a6d89] hover:bg-[#1A262B] transition-all duration-150 text-white rounded-full p-2 flex items-center justify-center group"
        >
          <MdSend className='text-white text-2xl group-hover:text-[#8476d4] transition-colors duration-150'/>
        </button>
      </div>
    </div>
  )
}

export default Prompt
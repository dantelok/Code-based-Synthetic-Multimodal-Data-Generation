import React, { useState, useRef } from 'react'
import { MdFileUpload, MdSend } from "react-icons/md";

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
        <div className="file-info text-sm text-gray-300 px-4">
          File selected: {file.name}
        </div>
      )}
      <div className="button-group flex gap-2 m-2 justify-between">
        <button 
          onClick={handleFileUpload}
          className="add-button bg-[#1A262B] hover:bg-[#1A262B]/80 text-white rounded-full p-2"
        >
          <MdFileUpload className='text-[#2F7491] text-2xl'/>
        </button>
        <button 
          onClick={handleSend}
          className="send-button bg-[#2F7491] hover:bg-[#2F7491]/80 text-white rounded-full p-2"
        >
          <MdSend className='text-white text-2xl'/>
        </button>
      </div>
    </div>
  )
}

export default Prompt
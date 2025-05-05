import React, { useState } from 'react'
import { MdFileUpload, MdSend } from "react-icons/md";
const Prompt = () => {
    const [inputValue, setInputValue] = useState<string>('');

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(e.target.value);
    };
  return (
    <div>
    <textarea
      value={inputValue}
      onChange={handleChange}
      placeholder="Enter your AI prompt here, and upload your CSV or image file to begin."
      className="chat-input w-full h-16 p-4 text-white bg-transparent border-none resize-none focus:outline-none"
    />
    <div className="button-group flex gap-2 m-2 justify-between">
      <button className="add-button bg-[#1A262B] hover:bg-[#1A262B]/80 text-white rounded-full p-2">
        <MdFileUpload className='text-[#2F7491] text-2xl'/>
      </button>
      <button className="send-button bg-[#2F7491] hover:bg-[#2F7491]/80 text-white rounded-full p-2">
        <MdSend className='text-[#2F7491] text-2xl'/>
      </button>
    </div>
    </div>
  )
}

export default Prompt
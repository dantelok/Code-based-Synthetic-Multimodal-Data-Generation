import React, { useState } from 'react'
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
      placeholder="How can I help you today?"
      className="chat-input w-full h-16 px-4 py-2 text-white bg-transparent border-none resize-none focus:outline-none"
    />
    <div className="button-group flex gap-4">
      <button className="add-button bg-gray-700 hover:bg-gray-600 text-white rounded-full p-2">
        <span className="material-symbols-outlined text-xl">add</span>
      </button>
      </div>
    </div>
  )
}

export default Prompt
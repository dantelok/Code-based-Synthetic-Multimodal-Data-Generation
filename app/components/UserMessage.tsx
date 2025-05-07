import React from 'react'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { FaFileCsv } from "react-icons/fa";

interface UserMessageProps {
  prompt?: string;
  fileType?: 'csv' | 'image';
  fileName?: string;
}

const UserMessage: React.FC<UserMessageProps> = ({ prompt, fileType, fileName }) => {
  return (
    <div className="px-2 sm:px-4">
      <div className='flex gap-2 sm:gap-4'>
        <div className="shrink-0">
          <Avatar className="w-10 h-10 sm:w-14 sm:h-14">
            <AvatarImage src="/reuben.jpg" alt='User' className="w-full h-full" />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
        </div>
        <div className="flex-1 min-w-0">
          {prompt && <p className="text-white break-words">{String(prompt)}</p>}
          {fileType && fileName && (
            <div className='mt-2 bg-purple-600/20 text-purple-300 px-3 sm:px-4 py-2 rounded-md flex items-center gap-2 overflow-hidden'>
              <FaFileCsv className="shrink-0" /> 
              <span className="font-medium truncate">{String(fileName)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UserMessage
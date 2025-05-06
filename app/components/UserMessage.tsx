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
    <div>
      <div className='flex gap-2'>
        <div>
          <Avatar className="w-14 h-14">
            <AvatarImage src="/reuben.jpg" alt='User' className=" w-full h-full" />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
        </div>
        <div className="flex-1">
          {prompt && <p className="text-white">{String(prompt)}</p>}
          {fileType && fileName && (
            <div className='mt-2 bg-purple-600/20 text-purple-300 px-4 py-2 rounded-md flex items-center gap-2'>
              <FaFileCsv /> <span className="font-medium">{String(fileName)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UserMessage
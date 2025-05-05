import React from 'react'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"

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
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" alt='User' />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
        </div>
        <div className="flex-1">
          {prompt && <p className="text-white">{String(prompt)}</p>}
          {fileType && fileName && (
            <div className='mt-2 bg-purple-600/20 text-purple-300 px-4 py-2 rounded-md'>
              <p>Uploaded file: <span className="font-medium">{String(fileName)}</span></p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UserMessage
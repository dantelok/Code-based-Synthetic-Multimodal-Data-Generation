import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/** Cohere assistant avatar shown beside every AI message. */
export default function AiAvatar() {
  return (
    <Avatar className="w-14 h-14 shrink-0">
      <AvatarImage
        src="/cohere.jpg"
        alt="AI Assistant"
        className="w-full h-full"
        width={56}
        height={56}
      />
      <AvatarFallback>AI</AvatarFallback>
    </Avatar>
  );
}

"use client";
import Prompt from "./components/prompt";
import { useState } from "react";
export default function Home() {
  return (
    <>
    <div className="">
      {/*this is the part where we will display the message */}
    </div>
    <div className="fixed bottom-0 left-0 right-0 bg-[#1C1C1E] z-50 m-5 rounded-lg">
  <div className="">
      <Prompt/>
    </div>
    </div>
    </>
  );
}

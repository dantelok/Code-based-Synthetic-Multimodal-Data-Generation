"use client";
import Prompt from "./components/prompt";
import { useState } from "react";
export default function Home() {
  return (
    <>
    <div className="">
      {/*this is the part where we will display the message */}
    </div>
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 z-50 m-5">
  <div className="max-w-3xl mx-auto">
      <Prompt/>
    </div>
    </div>
    </>
  );
}

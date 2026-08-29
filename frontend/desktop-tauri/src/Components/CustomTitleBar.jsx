import React from "react";
import { AiOutlineClose, AiOutlineMinus, AiOutlineExpand } from "react-icons/ai";
import { native } from "../native";

export default function CustomTitleBar() {
  const handleMinimize = () => native.minimize();
  const handleMaximize = () => native.maximize();
  const handleClose = () => native.close();

  return (
    <div className="absolute flex justify-between items-center bg-[#020617] text-white h-6 w-screen pl-4 select-none">
      {/* Draggable Area */}
      <div className="text-gray-400 flex-1 drag" data-tauri-drag-region>Employee Tracker</div>
      
      {/* Buttons */}
      <div className="flex">
        <button className="hover:bg-gray-700 p-2 non-draggable" onClick={handleMinimize}>
          <AiOutlineMinus size={12} />
        </button>
        <button className="hover:bg-gray-700 p-2 non-draggable" onClick={handleMaximize}>
          <AiOutlineExpand size={12} />
        </button>
        <button className="hover:bg-red-600 p-2 non-draggable" onClick={handleClose}>
          <AiOutlineClose size={12} />
        </button>
      </div>
    </div>
  );
}

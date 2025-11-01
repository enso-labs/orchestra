"use client";
import React, { useState, useEffect } from "react";
import { FaClipboardList } from "react-icons/fa"; // Importing the icon

const WaitlistButton = () => {
  const [visible, setVisible] = useState(true);

  const handleClick = () => {
    const contactSection = document.querySelector("#contact");
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: "smooth" });
    }
    setVisible(false);
  };

  const handleScroll = () => {
    if (window.scrollY === 0) {
      setVisible(true);
    }
  };

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    visible && (
      <div className="fixed bottom-3 right-4 z-50 md:bottom-4 md:right-5">
        <button
          onClick={handleClick}
          className="animate-pulse-grow-shrink flex items-center rounded-lg border-2 border-white bg-black px-4 py-2 text-white"
          style={{ borderRadius: "5px" }}
        >
          <FaClipboardList className="mr-1" />
          Join Waitlist
        </button>
      </div>
    )
  );
};

export default WaitlistButton;

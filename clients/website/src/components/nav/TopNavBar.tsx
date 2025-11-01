"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MdClose, MdMenu } from "react-icons/md";
import Image from "next/image";

const TopNavbar = () => {
  const [showSolidBackground, setShowSolidBackground] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");

  useEffect(() => {
    const handleScroll = () => {
      const currentScroll = window.pageYOffset;
      setShowSolidBackground(currentScroll > 50);
      
      // Detect which section is currently in view
      const sections = ["contact"];
      sections.forEach(section => {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 100 && rect.bottom >= 100) {
            setActiveSection(section);
          }
        }
      });
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleDrawer = () => {
    setIsDrawerOpen(!isDrawerOpen);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
  };

  // Define menu items in one place for consistency
  const menuItems = [
    { href: "/", label: "Home" },
    // { href: "/#about", label: "About" },
    // { href: "/blog", label: "Blog" }
  ];

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
        className={`fixed left-0 top-0 z-50 w-full transition-all duration-300 ease-in-out ${
          showSolidBackground 
            ? "bg-black/90 backdrop-blur-lg shadow-lg shadow-black/20 py-2" 
            : "bg-transparent py-4"
        }`}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <motion.div 
              className="flex items-center" 
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <a href="/" className="flex items-center ml-2">
                {/* <Image
                  src="/images/logo-bg.png"
                  alt="Enso Logo"
                  width={36}
                  height={36}
                  className="mr-2"
                /> */}
                <span className="text-xl font-cormorant font-medium tracking-wide text-white hover:text-gray-300 transition-colors duration-200">
                  enso
                </span>
              </a>
            </motion.div>
            
            {/* Mobile menu button */}
            {/* <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleDrawer} 
              className="flex items-center justify-center rounded-full bg-gray-800/70 p-2 text-white hover:bg-gray-700/70 transition-colors duration-200 sm:hidden"
              aria-label="Open menu"
            >
              <MdMenu className="h-6 w-6" />
            </motion.button> */}
            
            {/* Desktop menu */}
            {/* <div className="hidden sm:flex items-center space-x-1">
              
              <motion.a
                href="/#contact"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="ml-2 rounded-full bg-white text-black px-5 py-2 text-sm font-montserrat tracking-wide font-medium shadow-lg shadow-white/10 hover:bg-gray-200 transition-all duration-200"
              >
                Join Beta
              </motion.a>
            </div> */}
          </div>
        </div>
      </motion.nav>
      
    </>
  );
};

export default TopNavbar;

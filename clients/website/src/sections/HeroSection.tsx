"use client";
import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { apiClient } from "@/utils/client";

const HeroSection = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const response = await apiClient.contactFormSubmit({ 
        Email: email,
        // Name: "Newsletter Subscriber", 
        Message: "Beta invite request" 
      });
      
      setIsSubmitting(false);
      setIsSubmitted(true);
      setEmail("");
      
      // Reset success message after delay
      setTimeout(() => {
        setIsSubmitted(false);
      }, 3000);
    } catch (error) {
      console.error("Error submitting form:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center bg-black text-white"
    >
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="w-80 h-80 relative"
      >
        <Image 
          src="/images/logo-bg.png" 
          alt="Enso Logo" 
          fill
          priority
          className="object-contain"
        />
      </motion.div>

      {/* Headline */}
      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="mb-6 text-5xl md:text-6xl font-cormorant font-light tracking-wide text-center"
      >
        
        
        Be Present<br />
        <span className="text-gold-500">with Enso</span>
        
      </motion.h1>

      {/* Description */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.5 }}
        className="mb-12 max-w-md text-xl font-montserrat font-light tracking-wide text-center text-gray-300"
      >
        Composable Agents Built on LangGraph Powered by MCP & A2A
      </motion.p>

      {/* Email Form */}
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.7 }}
        onSubmit={handleSubmit}
        className="w-full max-w-md px-4"
      >
        <div className="relative">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email for beta invite"
            required
            className="w-full px-6 py-3 rounded-full bg-gray-900 border border-gray-700 text-white text-sm font-montserrat tracking-wide focus:outline-none focus:ring-2 focus:ring-gray-400 transition-all"
          />
          <button
            type="submit"
            disabled={isSubmitting || isSubmitted}
            className={`absolute right-2 top-1/2 -translate-y-1/2 px-5 py-1.5 rounded-full bg-white text-black text-sm font-montserrat tracking-wide font-medium hover:bg-gray-200 transition-all ${
              isSubmitting ? "opacity-70" : ""
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing
              </span>
            ) : (
              "Join Beta"
            )}
          </button>
        </div>
        
        {/* Success Message */}
        {isSubmitted && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 text-center text-sm font-montserrat text-green-400"
          >
            Thank you! We&apos;ll send your invite soon.
          </motion.p>
        )}
      </motion.form>

      {/* Links */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.9 }}
        className="flex justify-center space-x-6 mt-8 text-sm font-montserrat text-gray-400"
      >
        <a href="https://demo.enso.sh" className="hover:text-purple-400 transition-colors">Demo</a>
        <a href="/blogs" className="hover:text-purple-400 transition-colors">Blog</a>
        <a href="/socials" className="hover:text-purple-400 transition-colors">Social</a>
        {/* <a href="https://discord.gg/QRfjg4YNzU" className="hover:text-purple-400 transition-colors">Community</a> */}
        {/* <a href="mailto:ryan.adaptivebiz@gmail.com" className="hover:text-purple-400 transition-colors">Contact</a> */}
        <a href="https://github.com/enso-labs" className="hover:text-purple-400 transition-colors">Github</a>
        <a href="https://demo.enso.sh/docs/" className="hover:text-purple-400 transition-colors">Docs</a>
      </motion.div>
    </div>
  );
};

export default HeroSection;

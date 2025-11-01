"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import { apiClient } from "@/utils/client";

const initState = {
  buttonText: "Join Waitlist",
  payload: {
    Name: "",
    Email: "",
    Phone: "",
    Message: "",
  },
};

export default function ContactSection() {
  // State for the contact form
  const [buttonText, setButtonText] = useState(initState.buttonText);
  const [payload, setPayload] = useState(initState.payload);
  const [loading, setLoading] = useState(false);

  const successful = buttonText !== initState.buttonText;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Call the API to submit the contact form
    const res = await apiClient.contactFormSubmit(payload);
    // Reset the form
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setButtonText(data.message);
      alert(data.message);
    } else {
      console.error(data.message);
      alert(data.message);
    }
  };

  return (
    <section id="contact" className="py-24 bg-gray-900 relative overflow-hidden">
      {/* Background gradient element - similar to Roadmap section */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-blue-900/20 pointer-events-none"></div>
      
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-4">
            Make Every <span className="text-indigo-500">Moment</span> Count
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Register your email to get early access and be part of our journey.
          </p>
        </motion.div>

        <div className="flex justify-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
            className="w-full max-w-2xl"
          >
            <div className="bg-gray-800/50 p-8 rounded-lg border border-gray-700 shadow-lg shadow-indigo-500/10">
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </span>
                  <input
                    required
                    className="w-full appearance-none rounded-lg border border-gray-600 bg-gray-700/70 px-4 py-4 pl-12 text-lg text-gray-200 shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all duration-200"
                    id="name"
                    type="text"
                    placeholder="Enter Name..."
                    onChange={(e) =>
                      setPayload((prev) => ({ ...prev, Name: e.target.value }))
                    }
                    disabled={loading || successful}
                    value={payload.Name}
                  />
                </div>
                
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <input
                    required
                    className="w-full appearance-none rounded-lg border border-gray-600 bg-gray-700/70 px-4 py-4 pl-12 text-lg text-gray-200 shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all duration-200"
                    id="email"
                    type="email"
                    placeholder="Enter Email..."
                    onChange={(e) =>
                      setPayload((prev) => ({ ...prev, Email: e.target.value }))
                    }
                    disabled={loading || successful}
                    value={payload.Email}
                  />
                </div>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={loading || successful}
                  className={`w-full rounded-lg px-6 py-4 text-xl font-bold text-white shadow-lg transition-all duration-300 ${
                    !successful 
                      ? 'bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 shadow-indigo-500/30' 
                      : 'bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 shadow-green-500/30'
                  } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                  type="submit"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="mr-2 inline-block h-5 w-5 animate-spin rounded-full border-4 border-solid border-white border-t-transparent"></div>
                      <span>Sending...</span>
                    </div>
                  ) : (
                    buttonText
                  )}
                </motion.button>
                
                {successful && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 text-center text-green-400"
                  >
                    <svg className="w-6 h-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    Thank you for joining! We&apos;ll be in touch soon.
                  </motion.div>
                )}
              </form>
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              viewport={{ once: true }}
              className="mt-8 text-center text-gray-400"
            >
              <p>
                By joining, you&apos;ll be the first to know about our latest updates and features.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

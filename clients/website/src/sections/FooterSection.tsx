"use client";
import { useState } from "react";
import { apiClient } from "@/utils/client";

const FooterSection = () => {
	const [email, setEmail] = useState('');
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Call the API to submit the subscribe form
      await apiClient.subscribeToNewsletter({email});
      // Reset the form
      setEmail('');
      setLoading(false);
    } catch (error) {
      console.error(error);
      alert(error);
      setLoading(false);
    }
  };

  return (
    <footer className="bg-black pb-16 pt-10 md:py-12 text-gray-300">
      <div className="container mx-auto px-6 md:flex md:items-center md:justify-between">
        <div className="mb-6 md:mb-0">
          <h2 className="mb-2 text-center text-xl font-bold md:text-left">
            Subscribe to Our Newsletter
          </h2>
          <form
            onSubmit={handleSubmit}
            className="flex flex-col justify-center sm:flex-row md:justify-start"
          >
            <input
              type="email"
              className="focus:shadow-outline mr-2 w-full rounded border border-gray-700 bg-gray-800 px-4 py-2 leading-tight text-white focus:outline-none sm:w-auto"
              placeholder="Enter your email"
              onChange={(e) => setEmail(e.target.value)}
              value={email}
            />
            <button
              type="submit"
              className="focus:shadow-outline mt-2 rounded bg-indigo-500 px-4 py-2 text-white transition-colors duration-150 hover:bg-indigo-700 focus:outline-none sm:mt-0"
            >
              {loading ? (
                <>
                  <div className="flex items-center justify-center">
                    <div className="mr-2 inline-block h-5 w-5 animate-spin rounded-full border-4 border-solid border-white border-t-transparent"></div>
                    <span>Subscribing...</span>
                  </div>
                </>
              ) : (
                "Subscribe"
              )}
            </button>
          </form>
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;

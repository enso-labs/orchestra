"use client";

import { useState } from "react";
import { FaGithub, FaLinkedin } from "react-icons/fa";

const AboutSection = () => {

  return (
    <div id="about" className="bg-black py-10">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div className="relative flex justify-center">
            <div
              className="absolute rounded-lg bg-indigo-700 opacity-40"
              style={{
                width: "79%",
                height: "70%",
                bottom: "0%",
                right: "10.5%",
                opacity: 0.6,
                zIndex: 0,
                borderRadius: "10px 10px 10px 10px",
              }}
            ></div>
            <img
              src="/images/ryan_egg.png"
              alt="Founder"
              className="relative z-10 rounded-[0px_0px_10px_10px]"
              style={{
                filter: "drop-shadow(0px 2px 5px black)",
                zIndex: 1,
              }}
            />
            <div className="absolute bottom-[-30px] z-20 rounded bg-white p-2 shadow-md md:bottom-4 md:right-4">
              <div className="flex items-center">
                <p className="md:text-md text-sm font-bold text-black">
                  Ryan Eggleston
                </p>
                <a
                  href="https://www.linkedin.com/in/ryan-eggleston"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-blue-700"
                >
                  <FaLinkedin size={20} />
                </a>
                <a
                  href="https://github.com/ryaneggz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-black"
                >
                  <FaGithub size={20} />
                </a>
              </div>
              <p className="text-xs text-gray-700 md:text-sm">
                Founder & Core Developer
              </p>
            </div>
          </div>
          <div className="mt-10 md:mt-20">
            <h2 className="mb-8 text-4xl font-bold text-white md:text-6xl">
              Join the{" "}
              <a
                href="/#contact"
                className="text-indigo-500 hover:text-indigo-700"
              >
                Waitlist...
              </a>
            </h2>
            <p className="mb-3 text-justify text-base text-gray-200">
              Hi, I&apos;m Ryan! I&apos;m a software engineer that is passionate
              about automating my life to maximize time with my family.
              I enjoy working on problems that can do the same for others.
              Over the last few years I spent nearly every waking moment
              obsessing on how AI components should be composed together to
              better understand potential use cases. I&apos;m taking that obsession and
              turning it into a platform that can help other regain ownership of their time.
            </p>
            <p className="text-justify text-base text-gray-200">
              Currently I am developing the SaaS application. Join the waitlist
              and be one of my first customers and stay up-to-date on new
              features! I thrive on your feedback, hearing what I can do to
              improve your experience motivates me, which is why I have implemented the feature
              request form below in order to get community feedback on what
              they&apos;d like to see prioritized.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutSection;

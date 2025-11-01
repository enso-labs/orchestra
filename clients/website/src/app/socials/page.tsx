"use client";

import Link from "next/link";
import { FaArrowLeft, FaGithub } from "react-icons/fa";
import { FaXTwitter, FaInstagram, FaLinkedin, FaYoutube, FaDiscord, FaGlobe } from "react-icons/fa6";
import { SiTiktok, SiThreads } from "react-icons/si";
import { FiExternalLink } from "react-icons/fi";

const SocialPage = () => {
  const socials = [
    {
      name: "Discord",
      handle: "Enso Labs",
      icon: <FaDiscord className="text-xl" />,
      url: "https://discord.gg/QRfjg4YNzU",
    },
    {
      name: "YouTube",
      handle: "@enso-labs",
      icon: <FaYoutube className="text-xl" />,
      url: "https://www.youtube.com/@enso-labs",
    },
    {
      name: "Instagram",
      handle: "@enso.labs",
      icon: <FaInstagram className="text-xl" />,
      url: "https://instagram.com/enso.labs",
    },
    {
      name: "LinkedIn",
      handle: "Enso Labs",
      icon: <FaLinkedin className="text-xl" />,
      url: "https://www.linkedin.com/company/enso-sh",
    },
    {
      name: "X",
      handle: "@JohnEggz",
      icon: <FaXTwitter className="text-xl" />,
      url: "https://x.com/JohnEggz",
    },
    {
      name: "Github",
      handle: "Enso Labs",
      icon: <FaGithub className="text-xl" />,
      url: "https://github.com/enso-labs",
    },
    {
      name: "Website",
      handle: "Enso Labs",
      icon: <FaGlobe className="text-xl" />,
      url: "https://enso.sh",
    },

    // {
    //   name: "TikTok",
    //   handle: "@10x.app",
    //   icon: <SiTiktok className="text-xl" />,
    //   url: "https://tiktok.com/@10x.app",
    // },
  
    // {
    //   name: "Threads",
    //   handle: "@10x_app",
    //   icon: <SiThreads className="text-xl" />,
    //   url: "https://threads.net/@10x_app",
    // },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center p-6">
      <div className="w-full max-w-lg">
        <Link href="/" className="flex items-center text-gray-400 hover:text-white mb-8">
          <FaArrowLeft className="mr-2" />
          Back
        </Link>

        <div className="space-y-4">
          {socials.map((social, index) => (
            <a 
              key={index}
              href={social.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 rounded-lg bg-gray-900 hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center">
                <div className="text-white mr-4">
                  {social.icon}
                </div>
                <div>
                  <div className="flex items-center">
                    {social.name} <FiExternalLink className="ml-2 text-gray-500" />
                  </div>
                  <div className="text-gray-400 text-sm">{social.handle}</div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SocialPage; 
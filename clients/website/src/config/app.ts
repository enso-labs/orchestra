import {
  FaGithub,
  FaGitlab,
  FaMeetup,
  FaLinkedin,
  FaInstagram,
  FaYoutube,
  FaTwitch,
} from "react-icons/fa";

export const NODE_ENV = process.env.NEXT_PUBLIC_NODE_ENV || "production";
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "";
export const MEDIUM_RSS_URL = "https://medium.com/feed/@ryaneggz";


// Social Config
export const socialIcons = [
  {
    Icon: FaYoutube,
    tooltip: "@promptengineers",
    key: "youtube",
    link: "https://www.youtube.com/@promptengineersai",
  },
  {
    Icon: FaTwitch,
    tooltip: "ryaneggz",
    key: "twitch",
    link: "https://www.twitch.tv/ryaneggz",
  },
  {
    Icon: FaInstagram,
    tooltip: "@enso.labs",
    key: "instagram",
    link: "https://www.instagram.com/enso.labs/",
  },
  {
    Icon: FaGithub,
    tooltip: "enso-labs",
    key: "github",
    link: "https://github.com/enso-labs",
  },
  // {
  //   Icon: FaGitlab,
  //   tooltip: "kre8mymedia",
  //   key: "gitlab",
  //   link: "https://gitlab.com/kre8mymedia",
  // },
  {
    Icon: FaMeetup,
    tooltip: "Plano Prompt Engineers",
    key: "meetup",
    link: "https://www.meetup.com/Plano-Prompt-Engineers/",
  },
  {
    Icon: FaLinkedin,
    tooltip: "Prompt Engineers AI",
    key: "linkedin",
    link: "https://www.linkedin.com/company/promptengineers-ai",
  },
  
  // {
  //   Icon: FaMedium,
  //   tooltip: "@promptengineers",
  //   key: "youtube",
  //   link: "https://www.youtube.com/channel/promptengineers",
  // },
];

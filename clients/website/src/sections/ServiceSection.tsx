"use client";

import {
  FaCode,
  FaBullhorn,
  FaChartLine,
  FaCog,
  FaRobot,
  FaCloud,
  FaPencilRuler,
  FaChess,
} from "react-icons/fa"; // Import icons from React Icons

const services = [
  {
    id: 1,
    icon: FaRobot,
    title: "AI Development",
    description:
      "Cutting-edge AI solutions to automate and enhance your business processes.",
  },
  {
    id: 2,
    icon: FaCode,
    title: "Software Development",
    description:
      "Custom software development services including responsive website design, and more.",
  },
  {
    id: 3,
    icon: FaCog,
    title: "Dev-Ops & Automation",
    description:
      "Automate your business processes and streamline your operations with our DevOps services.",
  },
  {
    id: 4,
    icon: FaPencilRuler,
    title: "UI/UX Design",
    description:
      "Crafting intuitive user interfaces and experiences for websites, mobile apps, and software applications.",
  },
  {
    id: 5,
    icon: FaBullhorn,
    title: "Digital Marketing",
    description:
      "Comprehensive digital marketing solutions including SEO, PPC, and social media.",
  },
  {
    id: 6,
    icon: FaChartLine,
    title: "SEO & Analytics",
    description:
      "Improve your visibility online with our expert SEO services and analytics.",
  },
  {
    id: 7,
    icon: FaCloud,
    title: "Hosting & Maintenance",
    description:
      "Reliable hosting services coupled with ongoing maintenance, technical support, for digital assets.",
  },
  {
    id: 8,
    icon: FaChess,
    title: "IT Consulting & Strategy",
    description:
      "Expert technology guidance to align IT with business goals, including digital transformation and tech assessments.",
  },
];

const ServiceSection = () => {
  return (
    <div id="services" className="bg-black py-20">
      <div className="container mx-auto px-6">
        <h2 className="mb-8 text-center text-4xl font-bold text-white">
          My Promise...
        </h2>
        <p className="mb-10 text-center text-base text-gray-300 md:mx-60">
          To listen to your feedback and bring you the features you want most. I
          will be implementing a suggestion form so that you can tell me what
          you&apos;d like to see an the community will vote on the features they
          want to see implemented.
        </p>
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => (
            <div
              key={service.id}
              className="rounded-lg bg-gray-800 p-6 transition duration-300 ease-in-out"
            >
              <service.icon className="mx-auto mb-4 h-12 w-12 text-indigo-500" />
              <h3 className="mb-3 text-center text-lg font-semibold text-gray-100">
                {service.title}
              </h3>
              <p className="text-center text-gray-400">{service.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ServiceSection;

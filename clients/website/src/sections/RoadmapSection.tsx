'use client';
import React, { useState } from 'react';
import { motion } from 'framer-motion';

// Icons for features - you can use appropriate icons from your UI library
const icons = {
  A: "🚀", // Launch icon
  B: "⚙️", // Settings icon
  C: "📊", // Analytics icon
  D: "🔒", // Security icon
};

// Status indicators for features
type Status = 'completed' | 'in-progress' | 'planned';

const roadmapData = [
  { 
    date: 'Q1 2025', 
    title: 'Chat Presets', 
    description: 'System prompts, models, tools are able to be saved and used in chat sessions.', 
    status: 'completed' as Status,
    icon: icons.A,
    details: 'System prompts, models, tools are able to be saved and used in chat sessions.' 
    + ' Users can also create their own presets. This allows for a more personalized chat experience.'
  },
  { 
    date: 'Q2 2025', 
    title: 'Shareable Agents', 
    description: 'Users can market their agents to others. Settings are customizable, and private. Best settings win.', 
    status: 'in-progress' as Status,
    icon: icons.B,
    details: 'There will be a system for users to review agents, a way to see how many people have used an agent, and a way to see how many people have rated an agent.' 
  },
  { 
    date: 'Q3 2025', 
    title:  'Agent Insights, and Reviews', 
    description: 'Creators can see basic usage insights, and users can review agents.', 
    status: 'planned' as Status,
    icon: icons.C,
    details: 'Backend dashboard for creators to see basic usage insights, and a system for users to review agents.' 
  },
  { 
    date: 'Q1 2026', 
    title: 'Coming Soon...', 
    description: 'When we know what we are building, we will let you know.', 
    status: 'planned' as Status,
    icon: icons.D,
    details: 'More details to come!' 
  },
];

// Get status color
const getStatusColor = (status: Status) => {
  switch(status) {
    case 'completed': return 'bg-green-500';
    case 'in-progress': return 'bg-blue-500';
    case 'planned': return 'bg-purple-500';
    default: return 'bg-gray-500';
  }
};

// Get status label
const getStatusLabel = (status: Status) => {
  switch(status) {
    case 'completed': return 'Completed';
    case 'in-progress': return 'In Progress';
    case 'planned': return 'Planned';
    default: return '';
  }
};

export default function RoadmapSection() {
  // State to track which item is expanded
  const [expandedItem, setExpandedItem] = useState<number | null>(null);

  const toggleExpand = (idx: number) => {
    setExpandedItem(expandedItem === idx ? null : idx);
  };

  return (
    <section id="roadmap" className="py-24 bg-gray-900 relative overflow-hidden">
      {/* Background gradient element */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 to-purple-900/20 pointer-events-none"></div>
      
      <div className="container mx-auto px-4">
        <motion.h2 
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-4xl font-bold text-center mb-16 text-white"
        >
          Roadmap
        </motion.h2>
        
        <div className="max-w-4xl mx-auto">
          <div className="relative border-l-2 border-blue-500/50 pl-8 ml-4 md:ml-0">
            {roadmapData.map((item, idx) => (
              <motion.div 
                key={idx} 
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                viewport={{ once: true }}
                className="mb-16 relative"
              >
                {/* Timeline dot with status color */}
                <div 
                  className={`absolute w-5 h-5 ${getStatusColor(item.status)} rounded-full -left-[44px] mt-1.5 
                    shadow-lg shadow-${item.status === 'completed' ? 'green' : item.status === 'in-progress' ? 'blue' : 'purple'}-500/50
                    flex items-center justify-center transition-transform duration-300 hover:scale-125`}
                >
                  {/* Show checkmark for completed items */}
                  {item.status === 'completed' && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  )}
                </div>
                
                {/* Diagonal connector line */}
                <div className="absolute h-8 w-8 border-t-2 border-blue-500/30 -left-[30px] top-2 border-dotted"></div>
                
                {/* Content card */}
                <div 
                  className="bg-gray-800/50 p-6 rounded-lg border border-gray-700 hover:border-blue-500/50 
                    transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-blue-500/10"
                  onClick={() => toggleExpand(idx)}
                >
                  {/* Status badge */}
                  <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium mb-2 ${getStatusColor(item.status)} bg-opacity-20 text-white`}>
                    {getStatusLabel(item.status)}
                  </div>
                  
                  {/* Date */}
                  <time className="mb-1 text-sm font-normal text-gray-400 block">
                    {item.date}
                  </time>
                  
                  {/* Title with icon */}
                  <h3 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
                    <span className="text-2xl">{item.icon}</span>
                    {item.title}
                  </h3>
                  
                  {/* Description */}
                  <p className="text-base font-normal text-gray-300 mb-2">
                    {item.description}
                  </p>
                  
                  {/* Expanded details */}
                  {expandedItem === idx && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-4 pt-4 border-t border-gray-700 text-gray-300"
                    >
                      {item.details}
                    </motion.div>
                  )}
                  
                  {/* Expand/collapse indicator */}
                  <div className="text-blue-400 text-sm mt-2 flex items-center">
                    {expandedItem === idx ? 'Show less' : 'Learn more'}
                    <svg 
                      className={`w-4 h-4 ml-1 transform transition-transform ${expandedItem === idx ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
} 
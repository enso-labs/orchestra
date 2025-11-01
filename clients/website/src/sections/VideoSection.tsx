"use client";

import { useRef, useEffect } from "react";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";

const videos = [
  {
    id: 1,
    src: "https://www.youtube.com/embed/Z2iivy1IXtk?si=gH_xakaAyKNBZDuv&autoplay=1&mute=1&start=3300",
    title: "How to Configure Cursor Dev Environment",
    views: "1.5M views",
  },
  {
    id: 2,
    src: "https://www.youtube.com/embed/m8PKx6CIHSU?si=d4yAcjRiC2N0ZNLK&autoplay=1&mute=1&start=600",
    title: "Playing Destiny 2 with Friends", 
    views: "175K views",
  },
  {
    id: 3,
    src: "https://www.youtube.com/embed/7rX8DBRPgIU?si=KFhBZQDbB8L6U47A&autoplay=1&mute=1&start=30",
    title: "Play World of Warcraft with Me!",
    views: "3.8M views",
  },
//   {
//     id: 4,
//     src: "https://www.youtube.com/embed/E2AX09cHSTk?si=kp_9Sb1fqyMX3PFX",
//     title: "Kithe Reh Gaya | Ring Ceremony Reel",
//     views: "82K views",
//   },
//   {
//     id: 5,
//     src: "https://www.youtube.com/embed/I44ZQaTsgAc?si=ONGl9IygHDtQcqlD",
//     title: "WHEN TOEI ANIMATORS WENT CRAZY",
//     views: "3.5M views",
//   },
//   {
//     id: 6,
//     src: "https://www.youtube.com/embed/I44ZQaTsgAc?si=ONGl9IygHDtQcqlD",
//     title: "How Kalpana Chawla and team died!",
//     views: "8M views",
//   },
];

const VideoCarousel = () => {
  const carouselRef = useRef<HTMLDivElement>(null);

  const scroll = (scrollOffset: number) => {
    if (carouselRef.current) {
      carouselRef.current.scrollLeft += scrollOffset;
    }
  };

  return (
    <div className="bg-black py-4">
      <div className="w-full">
        <div className="relative flex items-center">
          {/* <button
            onClick={() => scroll(-300)}
            className="absolute left-0 z-10 rounded-full bg-gray-800 p-2"
          >
            <FaArrowLeft className="text-white" />
          </button> */}
          <div
            ref={carouselRef}
            className="scrollbar-hide flex overflow-x-scroll gap-3"
          >
            {videos.map((video) => (
              <div
                key={video.id}
                className="relative flex h-[225px] min-w-[400px] flex-col items-center justify-center bg-gray-800 transition duration-300 ease-in-out"
              >
                <iframe
                  src={video.src}
                  title={video.title}
                  className="absolute left-0 top-0 h-full w-full object-cover"
                  allowFullScreen
                />
              </div>
            ))}
          </div>
          {/* <button
            onClick={() => scroll(300)}
            className="absolute right-0 z-10 rounded-full bg-gray-800 p-2"
          >
            <FaArrowRight className="text-white" />
          </button> */}
        </div>
      </div>
    </div>
  );
};

export default VideoCarousel;

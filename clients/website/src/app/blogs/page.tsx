"use server";

import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import TopNavbar from "@/components/nav/TopNavBar";
import Loading from "@/components/loaders/Loading";
import { extractImagesToJson, rssParser } from "@/utils/rss";
import { MEDIUM_RSS_URL } from "@/config/app";
import { formatDate } from "@/utils/format";


const AuthorInfo = ({ 
  name, 
  published, 
  img = "https://avatars.githubusercontent.com/u/40816745?s=400&u=f2d7532a21510a6d122dfb725453daf88d614947&v=4" 
}: { name: string, published: Date, img?: string }) => (
  <div className="flex items-center rounded-b-lg pt-3">
    <Image
      src={img}
      alt={name}
      width={50}
      height={50}
      className="rounded-full"
    />
    <div className="ml-3">
      <div className="text-sm font-semibold text-white">{name}</div>
      <div className="text-xs text-gray-400">{formatDate(published.getTime())}</div>
    </div>
  </div>
);

// Define getServerSideProps to fetch blog data
async function Blogs() {
  const parsed = await rssParser(MEDIUM_RSS_URL);
  const blogs = parsed.items;
  // if (true) return null;
  return (
    <>
      {blogs.map((blog: any) => {
        const images = extractImagesToJson(blog['content:encoded']);
        return (
          <div
            key={blog.guid}
            style={{ boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
            className="cursor-pointer rounded-lg bg-slate-900 shadow transition duration-300 ease-in-out hover:shadow-lg"
          >
            <img
              // layout="fill"
              // unoptimized={true}
              src={images[0].src}
              // loader={() => blog.images[0]}
              alt={blog.title}
              width={300}
              height={200}
              className="h-48 w-full rounded-t-lg object-cover"
            />
            <div className="flex-grow p-4 text-black">
              <div className="no-scrollbar flex flex-nowrap overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {blog.categories.map((category: string, index: number) => (
                  <div
                    key={index}
                    className="m-1 flex items-center justify-center rounded-full border border-green-700 bg-green-900 px-2 py-1 font-medium text-white"
                  >
                    <div
                      className="max-w-full flex-initial whitespace-nowrap text-xs font-normal leading-none"
                      title={category}
                    >
                      {category}
                    </div>
                  </div>
                ))}
              </div>

              {/* Move padding inside this div */}
              <Link href={blog.link} passHref>
                <h3 className="my-1 text-lg font-semibold text-white">
                  {blog.title}
                </h3>
              </Link>
              <p className="h-[55px] text-xs text-gray-400">
                {blog['content:encodedSnippet'] ? blog['content:encodedSnippet'].substring(0, 200) : ''}...
              </p>
              <AuthorInfo name={blog.creator} published={new Date(blog.isoDate)} />
            </div>
          </div>
        )
      })}
    </>
  );
}

// Define the BlogIndex component that accepts blogs as a prop
const BlogIndex = async () => {
  return (
    <main>
      <TopNavbar />
      <div
        className="min-h-screen bg-black bg-cover bg-center bg-no-repeat py-20"
        // style={{ backgroundImage: `url('${HERO_GIF}')` }}
      >
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
            <Suspense fallback={<Loading />}>
              <Blogs />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
};

export default BlogIndex;

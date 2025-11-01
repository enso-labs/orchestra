import { Suspense } from "react";
import DOMPurify from "isomorphic-dompurify";
import Loading from "@/components/loaders/Loading";
import TopNavbar from "@/components/nav/TopNavBar";
import { MEDIUM_RSS_URL } from "@/config/app";
import { HERO_GIF } from "@/config/static";
import { rssToJson } from "@/utils/rss";
import { findByProperty } from "@/utils/filter";
import Link from "next/link";

type Props = {
  params: { slug: string };
};

// Define getServerSideProps to fetch blog data
async function Blog({ slug }: { slug: string }) {
  const blogs = await rssToJson(MEDIUM_RSS_URL);
  const blog = findByProperty(blogs, "slug", slug);
  console.log(blog)

  return (
    <div className="cursor-pointer rounded-lg bg-gray-100 p-4 shadow transition duration-300 ease-in-out hover:shadow-lg">
      <Link href={blog.id}>
        <h1 className="px-0 mb-3 text-center text-3xl font-bold text-gray-800">
          {blog.title}
        </h1>
      </Link>
      <div
        className="blog-content text-black"
        dangerouslySetInnerHTML={{
          __html: blog.content ? DOMPurify.sanitize(blog.content) : "",
        }}
      ></div>
    </div>
  );
}

const BlogContent = ({ params: { slug } }: Props) => {
  return (
    <>
      <header>
        <TopNavbar />
      </header>
      <main>
        <div
          className="flex min-h-screen items-center justify-center bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url('${HERO_GIF}')` }}
        >
          <Suspense fallback={<Loading />}>
            <div className="mx-auto my-20 w-full max-w-5xl px-3">
              <Blog slug={slug} />
            </div>
          </Suspense>
        </div>
      </main>
    </>
  );
};

export async function generateMetadata({ params }: Props) {
  // read route params
  const slug = params.slug;

  // fetch data
  const blogs = await rssToJson(MEDIUM_RSS_URL);
  const blog = findByProperty(blogs, "slug", slug);

  return {
    title: blog.title,
    description: blog.excerpt,
    openGraph: {
      title: blog.title,
      description: blog.excerpt,
      url: `/blogs/${slug}`,
      images: [
        {
          url: blog.images[0],
          // width: 1200,
          // height: 630,
          alt: blog.title,
        },
      ],
    },
  };
}

export default BlogContent;

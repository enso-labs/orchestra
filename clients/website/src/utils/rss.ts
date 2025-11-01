import { parse } from "rss-to-json";
import Parser from 'rss-parser';
import * as htmlparser2 from "htmlparser2";


export async function rssParser(url: string) {
    const parser = new Parser();
    const feed = await parser.parseURL(url);
    return feed;
}

export async function rssToJson(
  url: string,
  excerptLength: number = 350,
): Promise<any> {
    try {
        const data = await parse(url);

        if (data && data.items) {
            data.items.forEach((item: any) => {
                const content = item.content;

                // Regular expression to find all <img> tags and extract the src attribute
                const imgRegex = /<img[^>]+src="([^">]+)"/g;
                let match;
                const imageUrls = [];

                // Extract all image URLs
                while ((match = imgRegex.exec(content)) !== null) {
                    imageUrls.push(match[1]);
                }

                // Add the 'images' property to the item object
                item.images = imageUrls;

                // Regular expression to find the first <p> tag and extract its content
                const pRegex = /<p>(.*?)<\/p>/;
                const pMatch = pRegex.exec(content);

                if (pMatch && pMatch[1]) {
                    // Create an excerpt of the first 200 characters of the first paragraph
                    item.excerpt = pMatch[1].substr(0, excerptLength);
                } else {
                    // If no paragraph is found, set the excerpt to an empty string
                    item.excerpt = "";
                }

                // Remove HTML tags from the excerpt
                item.excerpt = item.excerpt.replace(/<[^>]*>?/gm, "");

                // Create a slug from the title
                item.slug = item.title
                .toLowerCase()
                .replace(/[\s]+/g, "-") // Replace spaces with -
                .replace(/[^\w\-]+/g, "") // Remove all non-word chars
                .replace(/\-\-+/g, "-") // Replace multiple - with single -
                .replace(/^-+/, "") // Trim - from start of text
                .replace(/-+$/, ""); // Trim - from end of text
            });

            return data.items.length > 0 ? data.items : [];
        }
    } catch (error) {
        console.error("Error fetching or processing data:", error);
    }
}

export function extractImagesToJson(htmlString: string) {
  const images: any[] = [];
  const parser = new htmlparser2.Parser({
    onopentag(name, attribs) {
      if (name === "img") {
        images.push({
          src: attribs.src || null,
          alt: attribs.alt || null,
          title: attribs.title || null
        });
      }
    }
  }, { decodeEntities: true });

  parser.write(htmlString);
  parser.end();

  return images;
}
export type Blog = {
  id: number;
  title: {
    rendered: string;
  };
  content: {
    rendered: string;
  };
  excerpt: {
    rendered: string;
  };
  summary: string;
  slug: string;
};

export type Contact = {
  Name?: string;
  Email: string;
  Phone?: string;
  Message?: string;
};

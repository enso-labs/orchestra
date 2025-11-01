import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import { FaChevronDown as ChevronDownIcon } from "react-icons/fa";

const faqItems = [
  {
    question: "What is Prompt Engineers AI?",
    answer: `<p>The goal of Prompt Engineers AI is to provide busy professionals 
            the most useful AI assistant platform to help them automate their workflows,
            but also free up their time. When it comes to our work life we spend a large portion
            of that time dedicated to sifting through and processing information across a variety
            of sources and tools. We strive to consolidate your online interactions into a single
            platform that can be accessed from anywhere.</p>`,
  },
  {
    question: "What features will be supported?",
    answer: `<p>The platform is built on state-of-the-art open-source libraries. 
            I believe providing familiar interfaces and intuitive tools enable
            users get up and running quickly. The advanced Retrieval Augmented Generation (RAG) 
            system allows users to quickly combine different sources into single conversation without
            cross contaminating the source information. We also support agent oriented chat for task
            execution against a variety of tools. Agents can also be equipped with knowledge bases to
            provide more contextual information to the agent during.</p>`,
  },
  {
    question: "Do you support API access?",
    answer: `<p>Prompt Engineers AI is an API-first platform with JSON and streaming responses through a single Chat endpoint.
            We strive to provide builders with a variety of LLM providers, tools, and resources when it comes to 
            building not only Chat enabled solutions but cron based scheduled procedures.</p>`,
  },
  {
    question: "What LLM providers are supported?",
    answer: `<p>The platform will support a variety of models from OpenAI, Anthropic, Ollama, and Groq with plans to support more from
            Google and Hugging Face. Most of the LLMs are currently supported by our 
            <a class="underline text-indigo-400" target="_blank" href="https://promptengineersai.netlify.app">open-source LLM Server</a>. 
            The models range from Chat, Text-To-Speech, Multi-Modal, Embedding, and more to come!</p>`,
  },
  {
    question: "Who are the Plano Prompt Engineers?",
    answer: `<p>Plano Prompt Engineers is a in-person meetup in Plano, TX &#40where I am located&#41 that meets once a month
            to discuss AI related topics, share ideas, and network with like-minded individuals. We welcome all new members
            regardless of technical background or experience. If you are interested, check us out at <a class="underline text-indigo-400" target="_blank" href="https://www.meetup.com/plano-prompt-engineers/">Meetup Group</a></p>`,
  },
];

const FaqList = () => {
  return (
    <div className="mt-12" id="faq">
      <h3 className="mb-8 text-center text-5xl font-bold text-white">FAQs</h3>
      <div className="mx-auto w-full max-w-4xl divide-y divide-white/5 rounded-xl bg-white/10">
        {faqItems.map((item, index) => (
          <Disclosure as="div" className="p-6" key={index}>
            <DisclosureButton className="group flex w-full items-center justify-between">
              <span className="text-base font-medium text-white group-hover:text-white/90">
                {item.question}
              </span>
              <ChevronDownIcon className="size-5 fill-white/60 group-open:rotate-180 group-hover:fill-white/50" />
            </DisclosureButton>
            <DisclosurePanel
              className="mt-2 text-sm/5 text-white/60"
              dangerouslySetInnerHTML={{ __html: item.answer }}
            />
          </Disclosure>
        ))}
      </div>
    </div>
  );
};

export default FaqList;

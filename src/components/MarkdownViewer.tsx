import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { cn } from "@/lib/utils";

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  // Simple hashtag parser to turn #tag into a span
  const processHashtags = (text: string) => {
    // We will let react-markdown handle most things, but we can't easily parse hashtags
    // into links without a custom remark plugin. For now, we'll just style them later or
    // we can use a custom renderer for text.
    return text;
  };

  return (
    <div
      className={cn("markdown-body max-w-none text-[15px] leading-relaxed break-words", className)}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: ({ node, ...props }) => {
            // Check if it's a hashtag (we could implement hashtag linking if we pre-processed)
            return (
              <a
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
                {...props}
              />
            );
          },
          code: ({ node, className, children, ...props }) => {
            return (
              <code
                className={cn(
                  "bg-muted px-1.5 py-0.5 rounded-md font-mono text-[0.9em]",
                  className,
                )}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ node, ...props }) => (
            <pre
              className="bg-[#0d1117] p-4 rounded-xl overflow-x-auto border border-border/50 my-4 shadow-sm"
              dir="ltr"
              {...props}
            />
          ),
          p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
          ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2" {...props} />,
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="border-l-4 border-primary/50 pl-4 italic text-muted-foreground my-2"
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

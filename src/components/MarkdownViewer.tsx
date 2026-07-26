import React from "react";
import { Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import DOMPurify from "dompurify";
import "highlight.js/styles/github-dark.css";
import { cn } from "@/lib/utils";

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

function sanitizeContent(content: string): string {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "u", "s", "code", "pre", "blockquote",
      "ul", "ol", "li", "a", "h1", "h2", "h3", "h4", "h5", "h6",
      "table", "thead", "tbody", "tr", "th", "td", "hr", "img",
      "span", "div", "del", "sup", "sub",
    ],
    ALLOWED_ATTR: [
      "href", "target", "rel", "className", "class", "id", "src", "alt",
      "width", "height", "title", "dir",
    ],
    ALLOW_DATA_ATTR: false,
  });
}

function isSafeUrl(href: string): boolean {
  if (!href) return false;
  const trimmed = href.trim().toLowerCase();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/");
}

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  const transformedContent = content.replace(/\[@([^\]]+)\]\(([^)]+)\)/g, '[@$1](/profile/$2)');
  const sanitizedContent = sanitizeContent(transformedContent);

  return (
    <div
      className={cn("markdown-body max-w-none text-[15px] leading-relaxed break-words", className)}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeRaw]}
        components={{
          a: ({ node, ...props }) => {
            const href = props.href || "";
            if (href.startsWith("/profile/")) {
              const profileId = href.replace("/profile/", "");
              return (
                <Link
                  to="/profile/$id"
                  params={{ id: profileId }}
                  className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-semibold hover:underline inline-flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {props.children}
                </Link>
              );
            }
            if (!isSafeUrl(href)) {
              return <span className="text-muted-foreground">{props.children}</span>;
            }
            return (
              <a
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
                href={href}
              >
                {props.children}
              </a>
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
          img: ({ node, ...props }) => (
            <img
              {...props}
              alt={props.alt || ""}
              loading="lazy"
              className="max-w-full h-auto rounded-md"
            />
          ),
        }}
      >
        {sanitizedContent}
      </ReactMarkdown>
    </div>
  );
}

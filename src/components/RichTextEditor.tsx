import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bold, Italic, Code, Link as LinkIcon, List, Quote, Heading } from "lucide-react";
import { cn } from "@/lib/utils";

export function RichTextEditor({
  content,
  onChange,
  placeholder,
}: {
  content: string;
  onChange: (md: string) => void;
  placeholder: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary hover:underline cursor-pointer",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Markdown,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.storage.markdown.getMarkdown());
    },
    editorProps: {
      attributes: {
        class: "tiptap-editor focus:outline-none min-h-[100px] p-3 text-[15px] leading-relaxed",
      },
    },
  });

  // Keep content in sync if cleared from outside
  useEffect(() => {
    if (editor && content === "" && editor.getText() !== "") {
      editor.commands.setContent("");
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className="w-full border border-input rounded-md bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary overflow-hidden flex flex-col shadow-sm">
      <div className="flex flex-wrap items-center gap-1 border-b border-input bg-muted/40 px-2 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 text-muted-foreground hover:text-foreground",
            editor.isActive("bold") && "bg-muted text-foreground",
          )}
          onClick={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleBold().run();
          }}
          title="عريض (Bold)"
        >
          <Bold className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 text-muted-foreground hover:text-foreground",
            editor.isActive("italic") && "bg-muted text-foreground",
          )}
          onClick={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleItalic().run();
          }}
          title="مائل (Italic)"
        >
          <Italic className="w-4 h-4" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 text-muted-foreground hover:text-foreground",
            editor.isActive("link") && "bg-muted text-foreground",
          )}
          onClick={(e) => {
            e.preventDefault();
            const previousUrl = editor.getAttributes("link").href;
            const url = window.prompt("URL", previousUrl);
            if (url === null) return;
            if (url === "") {
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
              return;
            }
            editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }}
          title="رابط (Link)"
        >
          <LinkIcon className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 text-muted-foreground hover:text-foreground",
            editor.isActive("blockquote") && "bg-muted text-foreground",
          )}
          onClick={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleBlockquote().run();
          }}
          title="اقتباس (Quote)"
        >
          <Quote className="w-4 h-4" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 text-muted-foreground hover:text-foreground",
            editor.isActive("codeBlock") && "bg-muted text-foreground",
          )}
          onClick={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleCodeBlock().run();
          }}
          title="كود (Code Snippet)"
        >
          <Code className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 text-muted-foreground hover:text-foreground",
            editor.isActive("bulletList") && "bg-muted text-foreground",
          )}
          onClick={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleBulletList().run();
          }}
          title="قائمة نقطية (Bulleted List)"
        >
          <List className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 text-muted-foreground hover:text-foreground",
            editor.isActive("heading", { level: 3 }) && "bg-muted text-foreground",
          )}
          onClick={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleHeading({ level: 3 }).run();
          }}
          title="عنوان (Heading)"
        >
          <Heading className="w-4 h-4" />
        </Button>
      </div>
      <EditorContent editor={editor} className="bg-transparent" />
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .tiptap-editor p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: right;
          color: hsl(var(--muted-foreground) / 0.6);
          pointer-events: none;
          height: 0;
        }
        .tiptap-editor p {
          margin-bottom: 0.5rem;
        }
        .tiptap-editor p:last-child {
          margin-bottom: 0;
        }
        .tiptap-editor ul {
          list-style-type: disc;
          list-style-position: inside;
          margin-bottom: 0.5rem;
        }
        .tiptap-editor ol {
          list-style-type: decimal;
          list-style-position: inside;
          margin-bottom: 0.5rem;
        }
        .tiptap-editor blockquote {
          border-right: 4px solid hsl(var(--primary) / 0.5); /* RTL right border instead of left */
          padding-right: 1rem;
          font-style: italic;
          color: hsl(var(--muted-foreground));
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .tiptap-editor code {
          background-color: hsl(var(--muted));
          padding: 0.125rem 0.375rem;
          border-radius: 0.375rem;
          font-family: var(--font-mono);
          font-size: 0.9em;
        }
        .tiptap-editor pre {
          background-color: #0d1117;
          color: #c9d1d9;
          padding: 1rem;
          border-radius: 0.75rem;
          overflow-x: auto;
          direction: ltr;
          margin-top: 1rem;
          margin-bottom: 1rem;
        }
        .tiptap-editor pre code {
          background-color: transparent;
          padding: 0;
          color: inherit;
        }
      `,
        }}
      />
    </div>
  );
}

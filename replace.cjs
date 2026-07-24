const fs = require("fs");
let code = fs.readFileSync("src/components/CreatePost.tsx", "utf8");

// Add setIsOpen(false) in onSuccess
code = code.replace(
  /onSuccess: \(\) => {/g,
  `onSuccess: () => {
      setIsOpen(false);`,
);

// Replace the return statement
const returnIndex = code.indexOf("  return (\n    <Card");
const newReturn = `  return (
    <Card className="border border-muted/50 shadow-sm overflow-hidden mb-4">
      <CardContent className="p-4 flex gap-3 items-center">
        <UserAvatar
          avatarUrl={profile?.avatar_url}
          fullName={profile?.full_name ?? "؟"}
          className="w-10 h-10 shrink-0 border shadow-sm"
        />
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <button className="flex-1 text-right text-[15px] text-muted-foreground bg-muted/40 hover:bg-muted/60 transition-colors border border-input rounded-full px-4 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/20">
              بم تفكر يا {profile?.full_name?.split(' ')[0] ?? 'زميلي'}؟
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden border-muted/50">
            {/* Top Tabs Header */}
            <div className="flex border-b border-muted/40 bg-muted/10 pt-10 sm:pt-0">
              <button
                type="button"
                onClick={() => setIsQuestion(false)}
                className={cn(
                  "flex-1 py-3 text-center text-xs font-semibold transition-all relative border-b-2 outline-none",
                  !isQuestion
                    ? "border-primary text-primary bg-background/50"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/5",
                )}
              >
                📝 منشور عام
              </button>
              <button
                type="button"
                onClick={() => setIsQuestion(true)}
                className={cn(
                  "flex-1 py-3 text-center text-xs font-semibold transition-all relative border-b-2 outline-none",
                  isQuestion
                    ? "border-primary text-primary bg-background/50"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/5",
                )}
              >
                ❓ سؤال تعليمي
              </button>
            </div>
            
            <div className="p-4 sm:p-5">
              <div className="flex gap-4">
                <div className="hidden sm:block">
                  <UserAvatar
                    avatarUrl={profile?.avatar_url}
                    fullName={profile?.full_name ?? "؟"}
                    className="w-10 h-10 shrink-0 border shadow-sm"
                  />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="min-h-[85px] w-full border border-input rounded-md bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary overflow-hidden flex flex-col shadow-sm">
                    <MarkdownToolbar onInsert={handleInsertMarkdown} className="border-b border-input rounded-none bg-muted/40 px-2 py-1.5" />
                    <Textarea
                      ref={textareaRef}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder={
                        isQuestion
                          ? "اكتب سؤالك التعليمي هنا بالتفصيل، يمكنك استخدام الماركدون لتنسيق الكود..."
                          : "شارك نصيحة، موضوع مفيد، أو منشور عام، يمكنك التنسيق عبر الماركدون..."
                      }
                      rows={4}
                      maxLength={4000}
                      className="resize-none w-full border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-3 text-[15px] placeholder:text-muted-foreground/60 leading-relaxed bg-transparent"
                    />
                  </div>
                  {imagePaths.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {imagePaths.map((p) => (
                        <div
                          key={p}
                          className="relative group overflow-hidden rounded-lg border shadow-sm"
                        >
                          <StorageImage
                            bucket="post-images"
                            path={p}
                            className="w-full h-32 object-cover transition-transform group-hover:scale-105"
                          />
                          <button
                            onClick={() => setImagePaths((prev) => prev.filter((x) => x !== p))}
                            className="absolute top-1.5 right-1.5 bg-black/75 text-white rounded-full p-1.5 hover:bg-red-600 transition shadow-md"
                            title="إزالة الصورة"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {hits.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 rounded-lg p-2.5 border border-destructive/10 animate-pulse">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      يحتوي المنشور على كلمات غير لائقة: {hits.join("، ")}
                    </div>
                  )}

                  <div className="flex justify-between items-center gap-2 pt-3 border-t border-muted/40">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleFiles(e.target.files)}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading || imagePaths.length >= 4}
                        className="rounded-full text-muted-foreground hover:text-primary hover:bg-primary/5 transition gap-1.5 h-8 text-xs"
                      >
                        {uploading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ImagePlus className="w-3.5 h-3.5" />
                        )}
                        إرفاق صور
                      </Button>
                      {content.length > 0 && (
                        <span className="text-[10px] text-muted-foreground bg-muted/65 px-2.5 py-1 rounded-full font-mono">
                          {content.length}/4000
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => mut.mutate()}
                      disabled={
                        (!content.trim() && imagePaths.length === 0) || mut.isPending || hits.length > 0
                      }
                      className="rounded-full px-6 gap-1.5 text-xs font-semibold shadow-sm transition"
                    >
                      {mut.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      نشر
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
`;
code = code.substring(0, returnIndex) + newReturn;

fs.writeFileSync("src/components/CreatePost.tsx", code);
console.log("done");

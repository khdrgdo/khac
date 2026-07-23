const fs = require("fs");
let content = fs.readFileSync("src/routes/_authenticated/admin.tsx", "utf8");

const oldList = `        <Card className="border-border/40 shadow-none overflow-hidden bg-card">
          <div className="divide-y divide-border/40">
            {filtered.map((u) => {`;

const newList = `        <Card className="border-border/40 shadow-none overflow-hidden bg-card">
          {filtered.length > 0 && (
            <div className="hidden sm:flex items-center justify-between p-4 bg-muted/30 border-b border-border/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="flex-1">المستخدم</div>
              <div className="w-[300px] flex justify-end gap-12 pr-8">
                <span>الحالة والتخصص</span>
                <span>النقاط</span>
                <span className="w-8"></span>
              </div>
            </div>
          )}
          <div className="divide-y divide-border/40">
            {filtered.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">لا توجد نتائج للبحث</div>
            )}
            {filtered.map((u) => {`;

content = content.replace(oldList, newList);
fs.writeFileSync("src/routes/_authenticated/admin.tsx", content);
console.log("Success");

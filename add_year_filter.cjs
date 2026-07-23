const fs = require("fs");

let content = fs.readFileSync("src/routes/_authenticated/admin.tsx", "utf8");

// Add yearFilter state
const targetState = `  const [userFilter, setUserFilter] = useState("all"); // 'all', 'students', 'teachers', 'admins', 'banned'`;
const replacementState = `  const [userFilter, setUserFilter] = useState("all"); // 'all', 'students', 'teachers', 'admins', 'banned'\n  const [yearFilter, setYearFilter] = useState("all");`;
content = content.replace(targetState, replacementState);

// Add yearFilter logic
const targetFilter = `  const searched = (data ?? []).filter((u) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return u.full_name?.toLowerCase().includes(q) || u.university_number?.toLowerCase().includes(q);
  });

  const filtered = searched.filter((u) => {
    if (userFilter === "all") return true;
    if (userFilter === "students")
      return !u.roles.includes("teacher") && !u.roles.includes("admin");
    if (userFilter === "teachers") return u.roles.includes("teacher");
    if (userFilter === "admins") return u.roles.includes("admin");
    if (userFilter === "banned")
      return u.banned || (u.suspended_until && new Date(u.suspended_until) > new Date());
    return true;
  });`;

const replacementFilter = `  const searched = (data ?? []).filter((u) => {
    let match = true;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      match = (u.full_name?.toLowerCase().includes(q) || u.university_number?.toLowerCase().includes(q)) as boolean;
    }
    if (match && yearFilter !== "all" && String(u.year) !== yearFilter) {
      match = false;
    }
    return match;
  });

  const filtered = searched.filter((u) => {
    if (userFilter === "all") return true;
    if (userFilter === "students")
      return !u.roles.includes("teacher") && !u.roles.includes("admin");
    if (userFilter === "teachers") return u.roles.includes("teacher");
    if (userFilter === "admins") return u.roles.includes("admin");
    if (userFilter === "banned")
      return u.banned || (u.suspended_until && new Date(u.suspended_until) > new Date());
    return true;
  });`;

content = content.replace(targetFilter, replacementFilter);

// Add Year Dropdown to UI
const targetUI = `        <div className="relative w-full sm:w-[300px] shrink-0">
          <Input
            placeholder="بحث بالاسم أو الرقم الجامعي..."
            className="pr-10 bg-muted/30 border-none shadow-sm rounded-full h-10 focus-visible:ring-1 focus-visible:ring-indigo-500 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search className="w-4 h-4 text-muted-foreground absolute right-4 top-1/2 -translate-y-1/2" />
        </div>`;

const replacementUI = `        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-[100px] bg-muted/30 border-none shadow-sm rounded-full h-10 text-sm">
              <SelectValue placeholder="السنة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل السنوات</SelectItem>
              <SelectItem value="1">السنة 1</SelectItem>
              <SelectItem value="2">السنة 2</SelectItem>
              <SelectItem value="3">السنة 3</SelectItem>
              <SelectItem value="4">السنة 4</SelectItem>
              <SelectItem value="5">السنة 5</SelectItem>
              <SelectItem value="6">السنة 6</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-[250px]">
            <Input
              placeholder="بحث بالاسم أو الرقم الجامعي..."
              className="pr-10 bg-muted/30 border-none shadow-sm rounded-full h-10 focus-visible:ring-1 focus-visible:ring-indigo-500 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search className="w-4 h-4 text-muted-foreground absolute right-4 top-1/2 -translate-y-1/2" />
          </div>
        </div>`;

content = content.replace(targetUI, replacementUI);

fs.writeFileSync("src/routes/_authenticated/admin.tsx", content);

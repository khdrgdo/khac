const fs = require("fs");

let content = fs.readFileSync("src/routes/_authenticated/admin.tsx", "utf8");

const targetUsersTableStart = `  const [actionReason, setActionReason] = useState("");
  const [actionDays, setActionDays] = useState("3");`;

const replacementUsersTableStart = `  const [actionReason, setActionReason] = useState("");
  const [actionDays, setActionDays] = useState("3");
  const [userFilter, setUserFilter] = useState("all"); // 'all', 'students', 'teachers', 'admins', 'banned'`;

content = content.replace(targetUsersTableStart, replacementUsersTableStart);

const targetUsersFilter = `  const filtered = (data ?? []).filter((u) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return u.full_name?.toLowerCase().includes(q) || u.university_number?.toLowerCase().includes(q);
  });`;

const replacementUsersFilter = `  const searched = (data ?? []).filter((u) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return u.full_name?.toLowerCase().includes(q) || u.university_number?.toLowerCase().includes(q);
  });

  const filtered = searched.filter((u) => {
    if (userFilter === "all") return true;
    if (userFilter === "students") return !u.roles.includes("teacher") && !u.roles.includes("admin");
    if (userFilter === "teachers") return u.roles.includes("teacher");
    if (userFilter === "admins") return u.roles.includes("admin");
    if (userFilter === "banned") return u.banned || (u.suspended_until && new Date(u.suspended_until) > new Date());
    return true;
  });

  const counts = {
    all: searched.length,
    students: searched.filter(u => !u.roles.includes("teacher") && !u.roles.includes("admin")).length,
    teachers: searched.filter(u => u.roles.includes("teacher")).length,
    admins: searched.filter(u => u.roles.includes("admin")).length,
    banned: searched.filter(u => u.banned || (u.suspended_until && new Date(u.suspended_until) > new Date())).length,
  };`;

content = content.replace(targetUsersFilter, replacementUsersFilter);

const targetSearchHeader = `      <div className="flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <Input
            placeholder="Search items, categories, or more..."
            className="pr-10 bg-muted/30 border-none shadow-none rounded-full h-10 focus-visible:ring-1 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search className="w-4 h-4 text-muted-foreground absolute right-4 top-1/2 -translate-y-1/2" />
        </div>
      </div>`;

const replacementSearchHeader = `      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
          <Button
            variant={userFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setUserFilter("all")}
            className={userFilter === "all" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-card text-muted-foreground"}
          >
            الكل <Badge variant="secondary" className="mr-2 bg-black/10 text-current">{counts.all}</Badge>
          </Button>
          <Button
            variant={userFilter === "students" ? "default" : "outline"}
            size="sm"
            onClick={() => setUserFilter("students")}
            className={userFilter === "students" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-card text-muted-foreground"}
          >
            الطلاب <Badge variant="secondary" className="mr-2 bg-black/10 text-current">{counts.students}</Badge>
          </Button>
          <Button
            variant={userFilter === "teachers" ? "default" : "outline"}
            size="sm"
            onClick={() => setUserFilter("teachers")}
            className={userFilter === "teachers" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-card text-muted-foreground"}
          >
            الأساتذة <Badge variant="secondary" className="mr-2 bg-black/10 text-current">{counts.teachers}</Badge>
          </Button>
          <Button
            variant={userFilter === "admins" ? "default" : "outline"}
            size="sm"
            onClick={() => setUserFilter("admins")}
            className={userFilter === "admins" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-card text-muted-foreground"}
          >
            المشرفون <Badge variant="secondary" className="mr-2 bg-black/10 text-current">{counts.admins}</Badge>
          </Button>
          <Button
            variant={userFilter === "banned" ? "default" : "outline"}
            size="sm"
            onClick={() => setUserFilter("banned")}
            className={userFilter === "banned" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-card text-muted-foreground"}
          >
            محظور/موقوف <Badge variant="secondary" className="mr-2 bg-black/10 text-current">{counts.banned}</Badge>
          </Button>
        </div>

        <div className="relative w-full sm:w-[300px] shrink-0">
          <Input
            placeholder="بحث بالاسم أو الرقم الجامعي..."
            className="pr-10 bg-muted/30 border-none shadow-sm rounded-full h-10 focus-visible:ring-1 focus-visible:ring-indigo-500 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search className="w-4 h-4 text-muted-foreground absolute right-4 top-1/2 -translate-y-1/2" />
        </div>
      </div>`;

content = content.replace(targetSearchHeader, replacementSearchHeader);

fs.writeFileSync("src/routes/_authenticated/admin.tsx", content);

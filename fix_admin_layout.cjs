const fs = require("fs");
let content = fs.readFileSync("src/routes/_authenticated/admin.tsx", "utf8");

const startIdx = content.indexOf("function AdminPage() {");
const endIdx = content.indexOf("function ReportsTab() {");

const newCode = `function AdminPage() {
  const { isAdmin, isMainAdmin, isSubAdmin, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/feed", replace: true });
  }, [loading, isAdmin, navigate]);

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
      </div>
    );
  if (!isAdmin) return null;

  const permissions = getSubAdminPermissions(profile);

  const showReports = !isSubAdmin || permissions.can_reports;
  const showLog = !isSubAdmin; // Only Main Admin / non-sub-admins see activity logs
  const showTeacher = !isSubAdmin || permissions.can_teachers;
  const showWords = !isSubAdmin || permissions.can_words;
  const showSubAdmins = isMainAdmin; // Only Main Admin can manage sub-admins

  const defaultTab = showReports ? "reports" : "users";

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 pt-6">
      {/* Header Section */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">لوحة الإدارة</h1>
        <p className="text-muted-foreground text-sm">
          {isSubAdmin
            ? "إدارة الصلاحيات المخصصة للمشرف المساعد"
            : "نظرة عامة وإدارة شاملة للنظام الأكاديمي"}
        </p>
      </div>

      <StatsCards />

      {/* Main Layout: Horizontal Tabs */}
      <Tabs
        defaultValue={defaultTab}
        className="flex flex-col gap-6 w-full items-start"
      >
        <div className="w-full border-b border-border/40">
          <TabsList className="flex flex-row h-auto w-full justify-start bg-transparent p-0 gap-6 overflow-x-auto shrink-0 pb-px">
            {showReports && (
              <TabsTrigger
                value="reports"
                className="relative rounded-none border-b-2 border-transparent bg-transparent px-2 py-3 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none transition-colors"
              >
                <Flag className="w-4 h-4 ml-2" /> البلاغات
              </TabsTrigger>
            )}
            <TabsTrigger
              value="users"
              className="relative rounded-none border-b-2 border-transparent bg-transparent px-2 py-3 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none transition-colors"
            >
              <Users className="w-4 h-4 ml-2" /> المستخدمون
            </TabsTrigger>
            {showLog && (
              <TabsTrigger
                value="log"
                className="relative rounded-none border-b-2 border-transparent bg-transparent px-2 py-3 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none transition-colors"
              >
                <ScrollText className="w-4 h-4 ml-2" /> سجل النشاط
              </TabsTrigger>
            )}
            {showTeacher && (
              <TabsTrigger
                value="teacher"
                className="relative rounded-none border-b-2 border-transparent bg-transparent px-2 py-3 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none transition-colors"
              >
                <UserPlus className="w-4 h-4 ml-2" /> إضافة أستاذ
              </TabsTrigger>
            )}
            {showWords && (
              <TabsTrigger
                value="words"
                className="relative rounded-none border-b-2 border-transparent bg-transparent px-2 py-3 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none transition-colors"
              >
                <Shield className="w-4 h-4 ml-2" /> الكلمات المحظورة
              </TabsTrigger>
            )}
            {showSubAdmins && (
              <TabsTrigger
                value="subadmins"
                className="relative rounded-none border-b-2 border-transparent bg-transparent px-2 py-3 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none transition-colors"
              >
                <Shield className="w-4 h-4 ml-2" /> حسابات المشرف المساعد
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <div className="flex-1 w-full min-w-0">
          {showReports && (
            <TabsContent
              value="reports"
              className="mt-0 focus-visible:outline-none focus-visible:ring-0"
            >
              <ReportsTab />
            </TabsContent>
          )}
          <TabsContent
            value="users"
            className="mt-0 focus-visible:outline-none focus-visible:ring-0"
          >
            <UsersTable />
          </TabsContent>
          {showLog && (
            <TabsContent
              value="log"
              className="mt-0 focus-visible:outline-none focus-visible:ring-0"
            >
              <ActivityLogTab />
            </TabsContent>
          )}
          {showTeacher && (
            <TabsContent
              value="teacher"
              className="mt-0 focus-visible:outline-none focus-visible:ring-0"
            >
              <AddTeacherCard />
            </TabsContent>
          )}
          {showWords && (
            <TabsContent
              value="words"
              className="mt-0 focus-visible:outline-none focus-visible:ring-0"
            >
              <BannedWordsTab />
            </TabsContent>
          )}
          {showSubAdmins && (
            <TabsContent
              value="subadmins"
              className="mt-0 focus-visible:outline-none focus-visible:ring-0"
            >
              <SubAdminsTab />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}

function StatsCards() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [{ count: users }, { count: posts }, { count: reports }, { count: msgs }] =
        await Promise.all([
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase.from("posts").select("*", { count: "exact", head: true }),
          supabase
            .from("post_reports")
            .select("*", { count: "exact", head: true })
            .eq("status", "pending"),
          supabase.from("messages").select("*", { count: "exact", head: true }),
        ]);
      return { users: users ?? 0, posts: posts ?? 0, reports: reports ?? 0, msgs: msgs ?? 0 };
    },
  });

  const items = [
    {
      icon: Users,
      label: "إجمالي المستخدمين",
      value: data?.users ?? 0,
      color: "text-blue-600",
      bg: "bg-blue-500/10",
    },
    {
      icon: FileText,
      label: "المنشورات",
      value: data?.posts ?? 0,
      color: "text-indigo-600",
      bg: "bg-indigo-500/10",
    },
    {
      icon: Flag,
      label: "بلاغات قيد المراجعة",
      value: data?.reports ?? 0,
      color: "text-rose-600",
      bg: "bg-rose-500/10",
    },
    {
      icon: MessageSquare,
      label: "الرسائل المتبادلة",
      value: data?.msgs ?? 0,
      color: "text-emerald-600",
      bg: "bg-emerald-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((it) => (
        <Card key={it.label} className="shadow-none border-border/40 bg-card">
          <CardContent className="p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-sm font-medium text-muted-foreground">{it.label}</span>
              <div className={\`w-8 h-8 rounded-md flex items-center justify-center \${it.bg} \${it.color}\`}>
                <it.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight text-foreground">{it.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

`;

content = content.slice(0, startIdx) + newCode + content.slice(endIdx);
fs.writeFileSync("src/routes/_authenticated/admin.tsx", content);

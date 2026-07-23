const fs = require("fs");

let content = fs.readFileSync("src/routes/_authenticated/admin.tsx", "utf8");

// 1. Add imports
const importTarget = 'import { Checkbox } from "@/components/ui/checkbox";';
const rechartsImport = `import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from "recharts";\nimport { Calendar, Download } from "lucide-react";\n`;
if (!content.includes('from "recharts"')) {
  content = content.replace(importTarget, importTarget + "\n" + rechartsImport);
}

// 2. Extract components
function replaceComponent(content, compName, newCode, nextCompName) {
  const startIdx = content.indexOf(`function ${compName}() {`);
  if (startIdx === -1) return content;

  let endIdx;
  if (nextCompName) {
    endIdx = content.indexOf(`function ${nextCompName}() {`);
  } else {
    // Fallback for end of file or if not found
    endIdx = content.indexOf("// ============", startIdx);
  }

  if (endIdx === -1 || startIdx >= endIdx) return content;

  return content.slice(0, startIdx) + newCode + "\n\n" + content.slice(endIdx);
}

// AdminPage
const newAdminPage = `function AdminPage() {
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
  const showLog = !isSubAdmin;
  const showTeacher = !isSubAdmin || permissions.can_teachers;
  const showWords = !isSubAdmin || permissions.can_words;
  const showSubAdmins = isMainAdmin;

  const defaultTab = showReports ? "reports" : "users";

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-12 pt-6">
      
      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 p-8 text-white shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-sm font-medium text-white backdrop-blur-sm mb-2">
              <Sparkles className="mr-2 h-4 w-4" />
              ميزات الإدارة المتقدمة
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isSubAdmin ? "لوحة المشرف المساعد" : "لوحة الإدارة الشاملة"}
            </h1>
            <p className="text-white/80 max-w-xl">
              {isSubAdmin
                ? "تتيح لك هذه اللوحة إدارة الصلاحيات المخصصة لك ومتابعة نشاط النظام ضمن النطاق المسموح."
                : "راقب الإحصائيات في الوقت الفعلي، وتتبع المبيعات والتقارير، وأدِر المستخدمين بكفاءة عالية للحصول على رؤى غير محدودة."}
            </p>
          </div>
          <Button variant="secondary" className="whitespace-nowrap bg-white text-indigo-600 hover:bg-white/90">
            ترقية للنظام الاحترافي
          </Button>
        </div>
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-white/10 blur-3xl"></div>
        <div className="absolute left-0 bottom-0 -ml-16 -mb-16 h-48 w-48 rounded-full bg-white/10 blur-2xl"></div>
      </div>

      {/* Overview Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold tracking-tight">نظرة عامة</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="bg-card text-xs text-muted-foreground h-8 border-border/40">
            <Calendar className="w-3.5 h-3.5 ml-2" />
            آخر 30 يوماً
          </Button>
          <Button variant="outline" size="sm" className="bg-card text-xs text-muted-foreground h-8 border-border/40">
            <Download className="w-3.5 h-3.5 ml-2" />
            تصدير
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards />

      {/* Charts */}
      <DashboardCharts />

      {/* Main Layout: Horizontal Tabs (styled like table filters) */}
      <div className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">إدارة النظام</h2>
          <div className="flex items-center gap-2">
             <Button variant="outline" size="sm" className="bg-card text-xs text-muted-foreground h-8 border-border/40">
              <Calendar className="w-3.5 h-3.5 ml-2" />
              آخر 30 يوماً
            </Button>
            <Button variant="outline" size="sm" className="bg-card text-xs text-muted-foreground h-8 border-border/40">
              <Download className="w-3.5 h-3.5 ml-2" />
              تصدير
            </Button>
          </div>
        </div>

        <Tabs
          defaultValue={defaultTab}
          className="flex flex-col gap-4 w-full items-start"
        >
          <div className="w-full border-b border-border/40">
            <TabsList className="flex flex-row h-auto w-full justify-start bg-transparent p-0 gap-8 overflow-x-auto shrink-0 pb-px">
              {showReports && (
                <TabsTrigger
                  value="reports"
                  className="relative rounded-none border-b-2 border-transparent bg-transparent px-1 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none transition-colors"
                >
                  البلاغات
                </TabsTrigger>
              )}
              <TabsTrigger
                value="users"
                className="relative rounded-none border-b-2 border-transparent bg-transparent px-1 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none transition-colors"
              >
                المستخدمون
              </TabsTrigger>
              {showLog && (
                <TabsTrigger
                  value="log"
                  className="relative rounded-none border-b-2 border-transparent bg-transparent px-1 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none transition-colors"
                >
                  سجل النشاط
                </TabsTrigger>
              )}
              {showTeacher && (
                <TabsTrigger
                  value="teacher"
                  className="relative rounded-none border-b-2 border-transparent bg-transparent px-1 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none transition-colors"
                >
                  الأساتذة
                </TabsTrigger>
              )}
              {showWords && (
                <TabsTrigger
                  value="words"
                  className="relative rounded-none border-b-2 border-transparent bg-transparent px-1 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none transition-colors"
                >
                  الكلمات المحظورة
                </TabsTrigger>
              )}
              {showSubAdmins && (
                <TabsTrigger
                  value="subadmins"
                  className="relative rounded-none border-b-2 border-transparent bg-transparent px-1 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none transition-colors"
                >
                  حسابات المساعدين
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <div className="flex-1 w-full min-w-0">
            {showReports && (
              <TabsContent value="reports" className="mt-0 focus-visible:outline-none">
                <ReportsTab />
              </TabsContent>
            )}
            <TabsContent value="users" className="mt-0 focus-visible:outline-none">
              <UsersTable />
            </TabsContent>
            {showLog && (
              <TabsContent value="log" className="mt-0 focus-visible:outline-none">
                <ActivityLogTab />
              </TabsContent>
            )}
            {showTeacher && (
              <TabsContent value="teacher" className="mt-0 focus-visible:outline-none">
                <AddTeacherCard />
              </TabsContent>
            )}
            {showWords && (
              <TabsContent value="words" className="mt-0 focus-visible:outline-none">
                <BannedWordsTab />
              </TabsContent>
            )}
            {showSubAdmins && (
              <TabsContent value="subadmins" className="mt-0 focus-visible:outline-none">
                <SubAdminsTab />
              </TabsContent>
            )}
          </div>
        </Tabs>
      </div>
    </div>
  );
}`;

const newStatsCards = `function DashboardCharts() {
  const barData = [
    { name: "01", value: 40 },
    { name: "02", value: 70 },
    { name: "03", value: 45 },
    { name: "04", value: 90 },
    { name: "05", value: 65 },
    { name: "06", value: 85 },
    { name: "07", value: 110 },
  ];

  const areaData = [
    { name: "1", value: 2000 },
    { name: "2", value: 4000 },
    { name: "3", value: 3000 },
    { name: "4", value: 8000 },
    { name: "5", value: 5000 },
    { name: "6", value: 12000 },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <Card className="border border-border/40 shadow-sm rounded-xl bg-card overflow-hidden">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">إجمالي النشاط</p>
              <h3 className="text-2xl font-bold tracking-tight mt-1">1,525</h3>
              <p className="text-xs text-emerald-500 mt-1 font-medium">+20.3% منذ الشهر الماضي</p>
            </div>
            <Button variant="outline" size="sm" className="h-8 text-xs bg-muted/30">
              <Calendar className="w-3.5 h-3.5 ml-1.5" /> آخر 30 يوماً
            </Button>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/40 shadow-sm rounded-xl bg-card overflow-hidden">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">التفاعل الكلي</p>
              <h3 className="text-2xl font-bold tracking-tight mt-1">20,462.89</h3>
              <p className="text-xs text-emerald-500 mt-1 font-medium">+20.1% منذ الشهر الماضي</p>
            </div>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
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
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      trend: "+41% منذ الشهر الماضي"
    },
    {
      icon: FileText,
      label: "إجمالي المنشورات",
      value: data?.posts ?? 0,
      color: "text-blue-600",
      bg: "bg-blue-50",
      trend: "+41% منذ الشهر الماضي"
    },
    {
      icon: Flag,
      label: "البلاغات المعلقة",
      value: data?.reports ?? 0,
      color: "text-cyan-600",
      bg: "bg-cyan-50",
      trend: "-50% منذ الشهر الماضي",
      trendDown: true
    },
    {
      icon: MessageSquare,
      label: "إجمالي الرسائل",
      value: data?.msgs ?? 0,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      trend: "+41% منذ الشهر الماضي"
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((it) => (
        <Card key={it.label} className="border border-border/40 shadow-sm rounded-xl bg-card hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-5 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className={\`w-8 h-8 rounded-lg flex items-center justify-center \${it.bg} \${it.color}\`}>
                <it.icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">{it.label}</span>
            </div>
            <div className="text-3xl font-bold tracking-tight text-foreground">{it.value.toLocaleString()}</div>
            <div className={\`text-xs mt-2 font-medium \${it.trendDown ? 'text-rose-500' : 'text-emerald-500'}\`}>
              {it.trend}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}`;

content = replaceComponent(content, "AdminPage", newAdminPage, "StatsCards");
content = replaceComponent(content, "StatsCards", newStatsCards, "ReportsTab");

// 3. Fix UsersTable
const oldUsersTableHeaders = `        <Card className="border-border/40 shadow-none overflow-hidden bg-card">
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
          <div className="divide-y divide-border/40">`;

const newUsersTableHeaders = `        <Card className="border border-border/40 shadow-sm rounded-xl overflow-hidden bg-card">
          {filtered.length > 0 && (
            <div className="hidden sm:grid grid-cols-12 items-center p-4 bg-transparent border-b border-border/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="col-span-5">اسم المستخدم (Client Name)</div>
              <div className="col-span-3">تاريخ الانضمام (Date)</div>
              <div className="col-span-2">التخصص (Category)</div>
              <div className="col-span-2 text-left pr-4">الحالة (Status)</div>
            </div>
          )}
          <div className="divide-y divide-border/40">`;

const oldUsersTableRow = `                <div
                  key={u.id}
                  className="group p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      user={{
                        id: u.id,
                        full_name: u.full_name,
                        avatar_url: u.avatar_url,
                      }}
                      className="w-10 h-10 border border-border/50 shadow-sm"
                    />
                    <div className="flex flex-col text-right">
                      <span className="font-semibold text-sm line-clamp-1">{u.full_name}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {u.university_number}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 sm:w-[300px] justify-end">
                    {/* Status & Roles */}
                    <div className="flex flex-col items-end gap-1">
                      {status}
                      <div className="flex items-center gap-1 mt-1 flex-wrap justify-end">
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-muted/50 text-muted-foreground"
                        >
                          {u.roles?.includes("teacher") ? "أستاذ" : "طالب"}
                        </Badge>
                      </div>
                    </div>

                    {/* Points */}
                    <div className="flex flex-col items-end gap-0.5 min-w-[3rem]">
                      <span className="font-bold text-sm">{u.points || 0}</span>
                      <span className="text-[10px] text-muted-foreground">نقطة</span>
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => setDetailsFor(u)}>
                          <Eye className="w-4 h-4 ml-2" />
                          التفاصيل الكاملة
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setYearDialogFor(u)}
                          disabled={!isMainAdmin && !permissions.can_courses}
                        >
                          <Edit3 className="w-4 h-4 ml-2" />
                          تعديل السنة الدراسية
                        </DropdownMenuItem>

                        {!u.roles?.includes("teacher") &&
                          (isMainAdmin || permissions.can_teachers) && (
                            <DropdownMenuItem onClick={() => setTeacherRole.mutate(u.id)}>
                              <UserPlus className="w-4 h-4 ml-2" />
                              ترقية كأستاذ
                            </DropdownMenuItem>
                          )}

                        <DropdownMenuSeparator />

                        {(isMainAdmin || permissions.can_warn) && (
                          <DropdownMenuItem
                            className="text-amber-600 focus:text-amber-700"
                            onClick={() => setActionFor({ user: u, type: "warn" })}
                          >
                            <AlertTriangle className="w-4 h-4 ml-2" />
                            إرسال إنذار ({u.warning_count || 0}/3)
                          </DropdownMenuItem>
                        )}

                        {(isMainAdmin || permissions.can_suspend) && (
                          <>
                            <DropdownMenuItem
                              className="text-orange-600 focus:text-orange-700"
                              onClick={() => setActionFor({ user: u, type: "suspend" })}
                            >
                              <Ban className="w-4 h-4 ml-2" />
                              تعليق مؤقت
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setActionFor({ user: u, type: "ban" })}
                            >
                              <ShieldAlert className="w-4 h-4 ml-2" />
                              حظر نهائي
                            </DropdownMenuItem>
                          </>
                        )}

                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setActionFor({ user: u, type: "delete" })}
                          disabled={isSubAdmin}
                        >
                          <Trash2 className="w-4 h-4 ml-2" />
                          حذف الحساب
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>`;

const newUsersTableRow = `                <div
                  key={u.id}
                  className="group grid grid-cols-1 sm:grid-cols-12 items-center gap-4 p-4 bg-card hover:bg-muted/20 transition-colors"
                >
                  <div className="col-span-5 flex items-center gap-3">
                    <UserAvatar
                      user={{
                        id: u.id,
                        full_name: u.full_name,
                        avatar_url: u.avatar_url,
                      }}
                      className="w-9 h-9 shadow-sm"
                    />
                    <div className="flex flex-col text-right">
                      <span className="font-semibold text-sm line-clamp-1">{u.full_name}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {u.university_number}
                      </span>
                    </div>
                  </div>
                  
                  <div className="col-span-3 text-xs text-muted-foreground hidden sm:block">
                    {new Date(u.created_at || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </div>

                  <div className="col-span-2 hidden sm:flex items-center">
                     <span className="text-sm font-medium text-muted-foreground capitalize">
                        {u.roles?.includes("teacher") ? "أستاذ" : "طالب"}
                     </span>
                  </div>

                  <div className="col-span-2 flex items-center justify-between pl-2">
                    <div className="flex items-center justify-center">
                       {u.banned ? (
                         <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-50 text-rose-600 text-xs font-medium">
                           <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                           محظور
                         </div>
                       ) : u.suspended_until && new Date(u.suspended_until) > new Date() ? (
                         <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 text-amber-600 text-xs font-medium">
                           <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                           موقوف
                         </div>
                       ) : (
                         <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 text-emerald-600 text-xs font-medium">
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                           نشط
                         </div>
                       )}
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border-border/40">
                        <DropdownMenuItem onClick={() => setDetailsFor(u)} className="text-xs py-2">
                          <Eye className="w-3.5 h-3.5 ml-2" />
                          التفاصيل الكاملة
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setYearDialogFor(u)}
                          disabled={!isMainAdmin && !permissions.can_courses}
                          className="text-xs py-2"
                        >
                          <Edit3 className="w-3.5 h-3.5 ml-2" />
                          تعديل السنة الدراسية
                        </DropdownMenuItem>

                        {!u.roles?.includes("teacher") &&
                          (isMainAdmin || permissions.can_teachers) && (
                            <DropdownMenuItem onClick={() => setTeacherRole.mutate(u.id)} className="text-xs py-2">
                              <UserPlus className="w-3.5 h-3.5 ml-2" />
                              ترقية كأستاذ
                            </DropdownMenuItem>
                          )}

                        <DropdownMenuSeparator />

                        {(isMainAdmin || permissions.can_warn) && (
                          <DropdownMenuItem
                            className="text-amber-600 focus:text-amber-700 text-xs py-2"
                            onClick={() => setActionFor({ user: u, type: "warn" })}
                          >
                            <AlertTriangle className="w-3.5 h-3.5 ml-2" />
                            إرسال إنذار ({u.warning_count || 0}/3)
                          </DropdownMenuItem>
                        )}

                        {(isMainAdmin || permissions.can_suspend) && (
                          <>
                            <DropdownMenuItem
                              className="text-orange-600 focus:text-orange-700 text-xs py-2"
                              onClick={() => setActionFor({ user: u, type: "suspend" })}
                            >
                              <Ban className="w-3.5 h-3.5 ml-2" />
                              تعليق مؤقت
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive text-xs py-2"
                              onClick={() => setActionFor({ user: u, type: "ban" })}
                            >
                              <ShieldAlert className="w-3.5 h-3.5 ml-2" />
                              حظر نهائي
                            </DropdownMenuItem>
                          </>
                        )}

                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive text-xs py-2"
                          onClick={() => setActionFor({ user: u, type: "delete" })}
                          disabled={isSubAdmin}
                        >
                          <Trash2 className="w-3.5 h-3.5 ml-2" />
                          حذف الحساب
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>`;

content = content.replace(oldUsersTableHeaders, newUsersTableHeaders);
content = content.replace(oldUsersTableRow, newUsersTableRow);

// Fix users table search input to look like the image (cleaner)
const oldSearchInput = `        <div className="relative w-full max-w-sm">
          <Input
            placeholder="بحث بالاسم أو الرقم الجامعي..."
            className="pr-10 bg-card border-border/40 shadow-none focus-visible:ring-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Users className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
        </div>`;

const newSearchInput = `        <div className="relative w-full max-w-md">
          <Input
            placeholder="Search items, categories, or more..."
            className="pr-10 bg-muted/30 border-none shadow-none rounded-full h-10 focus-visible:ring-1 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search className="w-4 h-4 text-muted-foreground absolute right-4 top-1/2 -translate-y-1/2" />
        </div>`;

if (content.includes(oldSearchInput)) {
  content = content.replace(oldSearchInput, newSearchInput);
}

// Ensure Search is imported
if (!content.includes("Search,")) {
  content = content.replace("Users,", "Users, Search,");
}

fs.writeFileSync("src/routes/_authenticated/admin.tsx", content);
console.log("Replaced Admin components with SaaS Dashboard UX");

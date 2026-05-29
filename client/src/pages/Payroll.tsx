import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Users, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  Calendar, 
  DollarSign, 
  AlertCircle, 
  CheckCircle,
  FileText,
  CreditCard,
  History,
  Trash2,
  Edit2,
  TrendingUp,
  UserCheck,
  Percent
} from "lucide-react";
import { useToast } from "../components/Toast.tsx";

interface Employee {
  id: number;
  name: string;
  phone: string;
  email: string;
  position: string;
  baseSalary: number;
  hireDate: string;
  status: string;
  notes: string;
  createdAt: string;
}

interface PayrollRecord {
  id: number;
  employeeId: number;
  payrollMonth: string;
  baseSalary: number;
  bonuses: number;
  deductions: number;
  netSalary: number;
  paidAmount: number;
  paymentStatus: "unpaid" | "partial" | "paid";
  notes: string;
  employee: Employee;
}

interface SalaryPayment {
  id: number;
  amount: number;
  paymentDate: string;
  paymentType: string;
  notes: string;
}

export default function Payroll() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"employees" | "payroll">("payroll");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Date selection for payroll
  const currentDateStr = new Date().toISOString().substring(0, 7); // "YYYY-MM"
  const [selectedMonth, setSelectedMonth] = useState(currentDateStr);

  // Modals state
  const [isAddEmpModalOpen, setIsAddEmpModalOpen] = useState(false);
  const [isEditEmpModalOpen, setIsEditEmpModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Selected records for modals
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedPayroll, setSelectedPayroll] = useState<PayrollRecord | null>(null);

  // Form states
  const [empForm, setEmpForm] = useState({
    name: "",
    phone: "",
    email: "",
    position: "Kassir",
    baseSalary: "",
    hireDate: new Date().toISOString().substring(0, 10), // "YYYY-MM-DD"
    status: "active",
    notes: ""
  });

  const [adjustForm, setAdjustForm] = useState({
    bonuses: "",
    deductions: "",
    notes: ""
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentType: "Nəğd",
    notes: ""
  });

  // ----------------------------------------------------
  // QUERIES
  // ----------------------------------------------------

  // Fetch employees
  const { data: employees = [], isLoading: isEmpLoading } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  // Fetch monthly payroll sheets
  const { data: payrollSheets = [], isLoading: isPayrollLoading } = useQuery<PayrollRecord[]>({
    queryKey: ["/api/payroll", { month: selectedMonth }],
    queryFn: async () => {
      const res = await fetch(`/api/payroll?month=${selectedMonth}`);
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  // Fetch payment disbursements logs
  const { data: activeSalaryPayments = [] } = useQuery<SalaryPayment[]>({
    queryKey: [`/api/payroll/${selectedPayroll?.id}/payments`],
    enabled: !!selectedPayroll,
  });

  // ----------------------------------------------------
  // MUTATIONS
  // ----------------------------------------------------

  // Create employee
  const createEmpMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsAddEmpModalOpen(false);
      setEmpForm({
        name: "",
        phone: "",
        email: "",
        position: "Kassir",
        baseSalary: "",
        hireDate: new Date().toISOString().substring(0, 10),
        status: "active",
        notes: ""
      });
      toast({
        title: "Əməkdaş Əlavə Edildi 👤",
        description: "Yeni əməkdaş uğurla sistemə qeyd edildi.",
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Xəta Baş Verdi",
        description: "Əməkdaş qeydə alınarkən xəta baş verdi.",
        variant: "destructive",
      });
    }
  });

  // Update employee
  const updateEmpMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/employees/${selectedEmployee?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll", { month: selectedMonth }] });
      setIsEditEmpModalOpen(false);
      setSelectedEmployee(null);
      toast({
        title: "Məlumatlar Yeniləndi ✏️",
        description: "Əməkdaşın məlumatları uğurla yeniləndi.",
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Xəta Baş Verdi",
        description: "Məlumatlar yenilənərkən texniki problem yarandı.",
        variant: "destructive",
      });
    }
  });

  // Delete employee
  const deleteEmpMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/employees/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll", { month: selectedMonth }] });
      toast({
        title: "Əməkdaş Silindi 🗑️",
        description: "Əməkdaş və onun bütün kartı sistemdən çıxarıldı.",
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Xəta Baş Verdi",
        description: "Əməkdaş silinərkən xəta baş verdi.",
        variant: "destructive",
      });
    }
  });

  // Calculate monthly payroll
  const calculatePayrollMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/payroll/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMonth }),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll", { month: selectedMonth }] });
      toast({
        title: "Maaşlar Hesablandı 📅",
        description: `${selectedMonth} ayı üçün ${data.calculated} əməkdaşın əməkhaqqı cədvəli uğurla çıxarıldı.`,
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Xəta Baş Verdi",
        description: "Maaş cədvəli hesablanarkən xəta yarandı.",
        variant: "destructive",
      });
    }
  });

  // Adjust payroll bonuses & deductions
  const adjustPayrollMutation = useMutation({
    mutationFn: async (payload: { bonuses: number; deductions: number; notes: string }) => {
      const res = await fetch(`/api/payroll/${selectedPayroll?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll", { month: selectedMonth }] });
      setIsAdjustModalOpen(false);
      setSelectedPayroll(null);
      toast({
        title: "Maaş Tənzimləndi 💰",
        description: "Bonus və cərimələr uğurla maaş kartına əlavə edildi.",
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Xəta Baş Verdi",
        description: "Maaş tənzimlənərkən xəta baş verdi.",
        variant: "destructive",
      });
    }
  });

  // Log salary payment
  const logPaymentMutation = useMutation({
    mutationFn: async (payload: { amount: number; paymentType: string; notes: string }) => {
      const res = await fetch(`/api/payroll/${selectedPayroll?.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll", { month: selectedMonth }] });
      if (selectedPayroll) {
        queryClient.invalidateQueries({ queryKey: [`/api/payroll/${selectedPayroll.id}/payments`] });
      }
      setIsPayModalOpen(false);
      setPaymentForm({ amount: "", paymentType: "Nəğd", notes: "" });
      toast({
        title: "Ödəniş Qeydə Alındı 💵",
        description: "Əməkdaşa ödənilən maaş kassa balansından çıxıldı.",
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Xəta Baş Verdi",
        description: "Ödəniş qeydə alınarkən texniki problem yarandı.",
        variant: "destructive",
      });
    }
  });

  // ----------------------------------------------------
  // SUBMISSIONS & HANDLERS
  // ----------------------------------------------------

  const handleAddEmpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empForm.name.trim() || !empForm.baseSalary) return;
    createEmpMutation.mutate({
      ...empForm,
      baseSalary: parseFloat(empForm.baseSalary)
    });
  };

  const handleEditEmpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empForm.name.trim() || !empForm.baseSalary) return;
    updateEmpMutation.mutate({
      ...empForm,
      baseSalary: parseFloat(empForm.baseSalary)
    });
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const bonuses = parseFloat(adjustForm.bonuses || "0");
    const deductions = parseFloat(adjustForm.deductions || "0");
    adjustPayrollMutation.mutate({
      bonuses,
      deductions,
      notes: adjustForm.notes
    });
  };

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(paymentForm.amount);
    if (isNaN(amount) || amount <= 0) {
      return toast({
        title: "Yanlış Məbləğ",
        description: "Zəhmət olmasa düzgün ödəniş məbləği daxil edin.",
        variant: "destructive",
      });
    }
    logPaymentMutation.mutate({
      amount,
      paymentType: paymentForm.paymentType,
      notes: paymentForm.notes
    });
  };

  // ----------------------------------------------------
  // FILTERING & AGGREGATE CALCULATIONS
  // ----------------------------------------------------

  // Filter lists based on search and tab
  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.position.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPayroll = payrollSheets.filter(sheet =>
    sheet.employee?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sheet.employee?.position.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Compute stats for current payroll month
  const totalEmployees = employees.filter(e => e.status === "active").length;
  const monthlyTotalLiability = payrollSheets.reduce((acc, sheet) => acc + sheet.netSalary, 0);
  const monthlyTotalDisbursed = payrollSheets.reduce((acc, sheet) => acc + sheet.paidAmount, 0);
  const monthlyOutstandingDebts = monthlyTotalLiability - monthlyTotalDisbursed;

  const paymentBadges: Record<string, string> = {
    paid: "bg-green-50 text-green-700 border-green-100",
    partial: "bg-amber-50 text-amber-700 border-amber-100",
    unpaid: "bg-red-50 text-red-700 border-red-100",
  };

  const paymentBadgeLabels: Record<string, string> = {
    paid: "Ödənilib ✅",
    partial: "Qismən ⏳",
    unpaid: "Ödənilməyib ❌",
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 select-none animate-in fade-in-0">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1 bg-primary/10 border border-primary/20 text-primary text-[9px] font-black uppercase px-2.5 py-1 rounded-md tracking-wider">
            <Users className="w-3 h-3" />
            <span>Kadrlar & Əmək Uçotu</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight mt-1">👥 HR və Əməkhaqqı (Payroll)</h1>
          <p className="text-xs text-gray-400 font-semibold mt-1">Əməkdaşların reyestrini aparın, aylıq maaşları hesablayın və ödənişləri kassaya çıxın.</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab Switcher */}
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => { setActiveTab("payroll"); setSearchTerm(""); }}
              className={`px-4 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                activeTab === "payroll" ? "bg-white text-gray-950 shadow-sm" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Maaş Hesabatı
            </button>
            <button
              onClick={() => { setActiveTab("employees"); setSearchTerm(""); }}
              className={`px-4 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                activeTab === "employees" ? "bg-white text-gray-950 shadow-sm" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Əməkdaşlar
            </button>
          </div>

          {activeTab === "employees" ? (
            <button
              onClick={() => setIsAddEmpModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/95 text-white font-black rounded-xl shadow-md shadow-primary/20 text-xs tracking-wider uppercase cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yeni Əməkdaş 👤</span>
            </button>
          ) : (
            <button
              onClick={() => calculatePayrollMutation.mutate()}
              disabled={calculatePayrollMutation.isPending}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-md shadow-emerald-500/20 text-xs tracking-wider uppercase cursor-pointer disabled:opacity-50"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Ayın Hesabını Çıxart 📅</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="size-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-5.5 h-5.5" />
          </div>
          <div className="text-left">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Aktiv Əməkdaşlar</span>
            <span className="text-lg font-black text-gray-900 block mt-0.5">{totalEmployees} nəfər</span>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="size-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <TrendingUp className="w-5.5 h-5.5" />
          </div>
          <div className="text-left">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Ümumi Maaş Öhdəliyi</span>
            <span className="text-lg font-black text-gray-900 block mt-0.5">{monthlyTotalLiability.toFixed(2)} ₼</span>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="size-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-5.5 h-5.5" />
          </div>
          <div className="text-left">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Ödənilən Maaşlar</span>
            <span className="text-lg font-black text-emerald-600 block mt-0.5">{monthlyTotalDisbursed.toFixed(2)} ₼</span>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm flex items-center gap-4 relative overflow-hidden">
          <div className="size-11 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
            <AlertCircle className="w-5.5 h-5.5" />
          </div>
          <div className="text-left">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Qalıq Ödənilməli</span>
            <span className="text-lg font-black text-red-600 block mt-0.5">{monthlyOutstandingDebts.toFixed(2)} ₼</span>
          </div>
          {monthlyOutstandingDebts > 0 && (
            <span className="absolute top-3 right-3 size-2 rounded-full bg-red-500 animate-pulse"></span>
          )}
        </div>
      </div>

      {/* Main Workspace */}
      <div className="bg-white border border-gray-100 rounded-3xl shadow-sm p-6 space-y-4">
        
        {/* Workspace Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Search bar */}
          <div className="relative max-w-sm w-full">
            <Search className="w-4.5 h-4.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={activeTab === "employees" ? "Əməkdaş adı və ya vəzifə..." : "Əməkdaş üzrə axtarış..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-primary transition-all text-gray-700"
            />
          </div>

          {/* Month selector for payroll */}
          {activeTab === "payroll" && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Hesablanma Ayı:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3.5 py-2 border border-gray-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-primary bg-gray-50 font-mono text-gray-700 cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Dynamic Tables */}
        {activeTab === "employees" ? (
          /* EMPLOYEES DIRECTORY TABLE */
          isEmpLoading ? (
            <div className="py-12 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Əməkdaşlar yüklənir...</div>
          ) : filteredEmployees.length === 0 ? (
            <div className="py-12 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Heç bir əməkdaş tapılmadı.</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-50">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-wider border-b border-gray-100">
                    <th className="py-3.5 px-4">Ad, Soyad</th>
                    <th className="py-3.5 px-4">Vəzifə</th>
                    <th className="py-3.5 px-4 text-right">Aylıq Əsas Maaş</th>
                    <th className="py-3.5 px-4 text-center">Əlaqə</th>
                    <th className="py-3.5 px-4 text-center">Qəbul Tarixi</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-center">Əməliyyat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs font-bold text-gray-600">
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="block font-black text-gray-900 leading-tight">{emp.name}</span>
                            {emp.notes && <span className="block text-[9px] font-medium text-gray-400 mt-0.5 truncate max-w-[150px]">{emp.notes}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 border rounded-lg bg-gray-100 text-gray-600 text-[10px] font-bold">
                          {emp.position}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right text-gray-900 font-mono">
                        {emp.baseSalary.toFixed(2)} ₼
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 text-gray-500 font-medium text-center">
                          {emp.phone && <div className="flex items-center justify-center gap-1"><Phone className="w-3 h-3 text-gray-400" /> <span>{emp.phone}</span></div>}
                          {emp.email && <div className="flex items-center justify-center gap-1"><Mail className="w-3 h-3 text-gray-400" /> <span>{emp.email}</span></div>}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center text-gray-500 font-mono">
                        {new Date(emp.hireDate).toLocaleDateString("az-AZ")}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-0.5 border rounded-full text-[9px] font-black ${
                          emp.status === "active" ? "bg-green-50 text-green-700 border-green-100" : "bg-red-50 text-red-700 border-red-100"
                        }`}>
                          {emp.status === "active" ? "Aktiv" : "Deaktiv"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedEmployee(emp);
                              setEmpForm({
                                name: emp.name,
                                phone: emp.phone || "",
                                email: emp.email || "",
                                position: emp.position,
                                baseSalary: emp.baseSalary.toString(),
                                hireDate: emp.hireDate,
                                status: emp.status,
                                notes: emp.notes || ""
                              });
                              setIsEditEmpModalOpen(true);
                            }}
                            className="p-1.5 hover:bg-gray-100 text-gray-600 rounded-lg transition-all cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`${emp.name} əməkdaşını və onun bütün kartlarını birdəfəlik silmək istədiyinizdən əminsiniz?`)) {
                                deleteEmpMutation.mutate(emp.id);
                              }
                            }}
                            className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* MONTHLY PAYROLL TABLE */
          isPayrollLoading ? (
            <div className="py-12 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Maaş hesabatı yüklənir...</div>
          ) : filteredPayroll.length === 0 ? (
            <div className="py-12 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">
              {selectedMonth} ayı üçün heç bir maaş hesabatı yoxdur. Zəhmət olmasa "Ayın Hesabını Çıxart" düyməsinə klikləyərək maaşları hesablayın.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-50">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-wider border-b border-gray-100">
                    <th className="py-3.5 px-4">Əməkdaş</th>
                    <th className="py-3.5 px-4 text-right">Əsas Maaş</th>
                    <th className="py-3.5 px-4 text-right text-emerald-600">Bonus (+)</th>
                    <th className="py-3.5 px-4 text-right text-red-600">Tutulma (-)</th>
                    <th className="py-3.5 px-4 text-right font-black text-gray-900">Nett Ödənilməli</th>
                    <th className="py-3.5 px-4 text-right text-indigo-600">Ödənilmiş</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-center">Əməliyyatlar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs font-bold text-gray-600">
                  {filteredPayroll.map((sheet) => {
                    const balance = sheet.netSalary - sheet.paidAmount;
                    return (
                      <tr key={sheet.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div>
                            <span className="block font-black text-gray-900 leading-tight">{sheet.employee?.name}</span>
                            <span className="block text-[9px] font-bold text-gray-400 mt-0.5 uppercase tracking-wide">
                              {sheet.employee?.position}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-gray-500">
                          {sheet.baseSalary.toFixed(2)} ₼
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-emerald-600">
                          {sheet.bonuses > 0 ? `+${sheet.bonuses.toFixed(2)} ₼` : "0.00 ₼"}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-red-600">
                          {sheet.deductions > 0 ? `-${sheet.deductions.toFixed(2)} ₼` : "0.00 ₼"}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-gray-900">
                          {sheet.netSalary.toFixed(2)} ₼
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-indigo-600">
                          {sheet.paidAmount.toFixed(2)} ₼
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-0.5 border rounded-full text-[9px] font-black ${paymentBadges[sheet.paymentStatus]}`}>
                            {paymentBadgeLabels[sheet.paymentStatus]}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {/* Adjust button */}
                            <button
                              onClick={() => {
                                setSelectedPayroll(sheet);
                                setAdjustForm({
                                  bonuses: sheet.bonuses.toString(),
                                  deductions: sheet.deductions.toString(),
                                  notes: sheet.notes || ""
                                });
                                setIsAdjustModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 font-black rounded-lg text-[9px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 border border-gray-100"
                            >
                              <Percent className="w-2.5 h-2.5 text-gray-400" />
                              <span>Tənzimlə</span>
                            </button>

                            {/* Pay button */}
                            {sheet.paymentStatus !== "paid" && (
                              <button
                                onClick={() => {
                                  setSelectedPayroll(sheet);
                                  setPaymentForm({
                                    amount: balance.toFixed(2),
                                    paymentType: "Nəğd",
                                    notes: ""
                                  });
                                  setIsPayModalOpen(true);
                                }}
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black rounded-lg text-[9px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 border border-emerald-100/50"
                              >
                                <span>Ödə 💸</span>
                              </button>
                            )}

                            {/* History button */}
                            <button
                              onClick={() => {
                                setSelectedPayroll(sheet);
                                setIsHistoryModalOpen(true);
                              }}
                              className="p-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-100 text-gray-400 hover:text-gray-600 rounded-lg transition-all cursor-pointer"
                              title="Ödəniş Tarixçəsi"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* MODAL 1: ADD EMPLOYEE */}
      {isAddEmpModalOpen && (
        <div className="liquid-glass-overlay">
          <div className="liquid-glass-card max-w-md p-6">
            <h3 className="text-base font-black text-gray-900 tracking-tight flex items-center gap-2 border-b border-gray-100 pb-3">
              <Users className="w-5 h-5 text-primary" />
              <span>Yeni Əməkdaş Reyestri</span>
            </h3>

            <form onSubmit={handleAddEmpSubmit} className="space-y-4 pt-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Ad, Soyad *</label>
                <input
                  type="text"
                  required
                  value={empForm.name}
                  onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                  placeholder="Məsələn: Əli Məmmədov"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Vəzifə *</label>
                  <select
                    value={empForm.position}
                    onChange={(e) => setEmpForm({ ...empForm, position: e.target.value })}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="Kassir">Kassir 🛒</option>
                    <option value="Anbardar">Anbardar 📦</option>
                    <option value="Menecer">Menecer 💼</option>
                    <option value="Satıcı">Satıcı 👥</option>
                    <option value="Kuryer">Kuryer 🛵</option>
                    <option value="Digər">Digər 👤</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Aylıq Maaş (₼) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={empForm.baseSalary}
                    onChange={(e) => setEmpForm({ ...empForm, baseSalary: e.target.value })}
                    placeholder="Məsələn: 750.00"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Telefon</label>
                  <input
                    type="text"
                    value={empForm.phone}
                    onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                    placeholder="+994 50 123 45 67"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">İşə Başlama Tarixi *</label>
                  <input
                    type="date"
                    required
                    value={empForm.hireDate}
                    onChange={(e) => setEmpForm({ ...empForm, hireDate: e.target.value })}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">E-poçt</label>
                <input
                  type="email"
                  value={empForm.email}
                  onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })}
                  placeholder="name@bisaas.az"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Qeydlər</label>
                <textarea
                  rows={2}
                  value={empForm.notes}
                  onChange={(e) => setEmpForm({ ...empForm, notes: e.target.value })}
                  placeholder="İş şərtləri, müqavilə qeydləri..."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddEmpModalOpen(false)}
                  className="flex-1 py-3 border border-gray-200 hover:bg-gray-50 text-gray-500 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer text-center"
                >
                  Geri
                </button>
                <button
                  type="submit"
                  disabled={createEmpMutation.isPending}
                  className="flex-1 py-3 bg-primary hover:bg-primary/95 text-white font-black rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer text-center"
                >
                  {createEmpMutation.isPending ? "Yaradılır..." : "Yarat 👍"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT EMPLOYEE */}
      {isEditEmpModalOpen && selectedEmployee && (
        <div className="liquid-glass-overlay">
          <div className="liquid-glass-card max-w-md p-6">
            <h3 className="text-base font-black text-gray-900 tracking-tight flex items-center gap-2 border-b border-gray-100 pb-3">
              <Edit2 className="w-4 h-4 text-primary" />
              <span>Əməkdaş Məlumatlarını Redaktə Et</span>
            </h3>

            <form onSubmit={handleEditEmpSubmit} className="space-y-4 pt-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Ad, Soyad *</label>
                <input
                  type="text"
                  required
                  value={empForm.name}
                  onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                  placeholder="Əli Məmmədov"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Vəzifə *</label>
                  <select
                    value={empForm.position}
                    onChange={(e) => setEmpForm({ ...empForm, position: e.target.value })}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="Kassir">Kassir 🛒</option>
                    <option value="Anbardar">Anbardar 📦</option>
                    <option value="Menecer">Menecer 💼</option>
                    <option value="Satıcı">Satıcı 👥</option>
                    <option value="Kuryer">Kuryer 🛵</option>
                    <option value="Digər">Digər 👤</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Aylıq Maaş (₼) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={empForm.baseSalary}
                    onChange={(e) => setEmpForm({ ...empForm, baseSalary: e.target.value })}
                    placeholder="750.00"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">İşə Başlama Tarixi *</label>
                  <input
                    type="date"
                    required
                    value={empForm.hireDate}
                    onChange={(e) => setEmpForm({ ...empForm, hireDate: e.target.value })}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Kadrın Statusu *</label>
                  <select
                    value={empForm.status}
                    onChange={(e) => setEmpForm({ ...empForm, status: e.target.value })}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="active">Aktiv / İşləyir</option>
                    <option value="inactive">Deaktiv / Ayrılıb</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Telefon</label>
                  <input
                    type="text"
                    value={empForm.phone}
                    onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                    placeholder="+994 50 123 45 67"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">E-poçt</label>
                  <input
                    type="email"
                    value={empForm.email}
                    onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })}
                    placeholder="email@bisaas.az"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Qeydlər</label>
                <textarea
                  rows={2}
                  value={empForm.notes}
                  onChange={(e) => setEmpForm({ ...empForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsEditEmpModalOpen(false)}
                  className="flex-1 py-3 border border-gray-200 hover:bg-gray-50 text-gray-500 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer text-center"
                >
                  Geri
                </button>
                <button
                  type="submit"
                  disabled={updateEmpMutation.isPending}
                  className="flex-1 py-3 bg-primary hover:bg-primary/95 text-white font-black rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer text-center"
                >
                  {updateEmpMutation.isPending ? "Yadda saxlanır..." : "Dəyişiklikləri Saxla"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADJUST BONUSES & DEDUCTIONS */}
      {isAdjustModalOpen && selectedPayroll && (
        <div className="liquid-glass-overlay">
          <div className="liquid-glass-card max-w-sm p-6">
            <h3 className="text-base font-black text-gray-900 tracking-tight flex items-center gap-2 border-b border-gray-100 pb-3">
              <Percent className="w-5 h-5 text-indigo-600" />
              <span>Maaş Tənzimlənməsi (Bonus/Cərimə)</span>
            </h3>

            <div className="p-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-left text-xs font-bold space-y-1.5 mt-4">
              <div className="flex justify-between text-gray-400">
                <span>Əməkdaş:</span>
                <span className="text-gray-900 font-black">{selectedPayroll.employee?.name}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Əsas Aylıq Maaş:</span>
                <span className="text-gray-900 font-black font-mono">{selectedPayroll.baseSalary.toFixed(2)} ₼</span>
              </div>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-emerald-600 uppercase tracking-wider block">Bonus / Mükafat (₼)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustForm.bonuses}
                    onChange={(e) => setAdjustForm({ ...adjustForm, bonuses: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary font-mono text-emerald-700"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-red-600 uppercase tracking-wider block">Tutulma / Cərimə (₼)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustForm.deductions}
                    onChange={(e) => setAdjustForm({ ...adjustForm, deductions: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary font-mono text-red-700"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Tənzimləmə Səbəbi / Şərh</label>
                <input
                  type="text"
                  value={adjustForm.notes}
                  onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                  placeholder="Məsələn: Satış bonusu və ya Gecikmə cəriməsi"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="flex-1 py-3 border border-gray-200 hover:bg-gray-50 text-gray-500 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer text-center"
                >
                  İmtina
                </button>
                <button
                  type="submit"
                  disabled={adjustPayrollMutation.isPending}
                  className="flex-1 py-3 bg-primary hover:bg-primary/95 text-white font-black rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer text-center"
                >
                  {adjustPayrollMutation.isPending ? "Yadda saxlanır..." : "Hesabla 👍"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: DISBURSE MAAS PAYMENT */}
      {isPayModalOpen && selectedPayroll && (
        <div className="liquid-glass-overlay">
          <div className="liquid-glass-card max-w-sm p-6">
            <h3 className="text-base font-black text-gray-900 tracking-tight flex items-center gap-2 border-b border-gray-100 pb-3">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <span>Əməkhaqqı Ödənişi</span>
            </h3>

            <div className="p-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-left text-xs font-bold space-y-1.5 mt-4">
              <div className="flex justify-between text-gray-400">
                <span>Əməkdaş:</span>
                <span className="text-gray-900 font-black">{selectedPayroll.employee?.name}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Nett Ödənilməli:</span>
                <span className="text-gray-900 font-black font-mono">{selectedPayroll.netSalary.toFixed(2)} ₼</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Mövcud Ödənilən:</span>
                <span className="text-gray-900 font-black font-mono text-indigo-600">{selectedPayroll.paidAmount.toFixed(2)} ₼</span>
              </div>
              <div className="flex justify-between border-t border-gray-200/50 pt-1.5 text-gray-400">
                <span>Qalıq Maaş Borcu:</span>
                <span className="text-red-600 font-black font-mono">{(selectedPayroll.netSalary - selectedPayroll.paidAmount).toFixed(2)} ₼</span>
              </div>
            </div>

            <form onSubmit={handlePaySubmit} className="space-y-4 pt-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Ödənilən Maaş Məbləği (₼) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  max={(selectedPayroll.netSalary - selectedPayroll.paidAmount).toFixed(2)}
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  placeholder="Məbləğ yazın"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary font-mono text-gray-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Kassa Ödəniş Üsulu</label>
                <select
                  value={paymentForm.paymentType}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentType: e.target.value })}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary"
                >
                  <option value="Nəğd">Nəğd Pul 💵</option>
                  <option value="Kart">Bank Kartı / Köçürmə 💳</option>
                  <option value="Kart2Kart">Kartdan-Karta 📲</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Ödəniş Qeydi</label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  placeholder="Məsələn: Əməkhaqqı kartı ödənişi"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="flex-1 py-3 border border-gray-200 hover:bg-gray-50 text-gray-500 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer text-center"
                >
                  İmtina
                </button>
                <button
                  type="submit"
                  disabled={logPaymentMutation.isPending}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer text-center"
                >
                  {logPaymentMutation.isPending ? "Ödənilir..." : "Ödənişi Qeyd Et 💸"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: SALARY PAYMENT HISTORY LEDGER */}
      {isHistoryModalOpen && selectedPayroll && (
        <div className="liquid-glass-overlay">
          <div className="liquid-glass-card max-w-md p-6">
            <h3 className="text-base font-black text-gray-900 tracking-tight flex items-center gap-2 border-b border-gray-100 pb-3">
              <History className="w-5 h-5 text-gray-700" />
              <span>{selectedPayroll.employee?.name} - Maaş Ödənişləri</span>
            </h3>

            <div className="max-h-[300px] overflow-y-auto space-y-2 mt-4 pr-1">
              {activeSalaryPayments.length === 0 ? (
                <div className="py-8 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Hələ heç bir ödəniş çıxılmayıb.</div>
              ) : (
                activeSalaryPayments.map((p) => (
                  <div key={p.id} className="p-3 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-between text-xs font-bold">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-gray-800 font-black">
                        <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                        <span>Kassa Növü: {p.paymentType}</span>
                      </div>
                      {p.notes && <span className="block text-[10px] text-gray-400 font-medium">Qeyd: {p.notes}</span>}
                      <span className="block text-[8.5px] text-gray-400 font-mono">
                        Tarix: {new Date(p.paymentDate).toLocaleString("az-AZ")}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-emerald-600 font-black font-mono">-{p.amount.toFixed(2)} ₼</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-gray-100 mt-4">
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="w-full py-3 bg-gray-950 hover:bg-gray-800 text-white font-black rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer text-center"
              >
                Bağla
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

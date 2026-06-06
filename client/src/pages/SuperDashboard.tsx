import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert,
  Plus,
  Users,
  TrendingUp,
  LayoutDashboard,
  CheckCircle,
  XCircle,
  Building,
  RotateCw,
  Lock,
  Layers,
  Calendar,
  Eye,
  EyeOff,
  Trash2,
  Activity,
  Settings as SettingsIcon,
  Database,
  Download
} from "lucide-react";
import { useToast } from "../components/Toast.tsx";

export default function SuperDashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Dialog & state values
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newAdminUser, setNewAdminUser] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  const [selectedTenantForUsers, setSelectedTenantForUsers] = useState<any | null>(null);
  const [tenantUsers, setTenantUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const [selectedTenantForDelete, setSelectedTenantForDelete] = useState<any | null>(null);
  const [superAdminPasswordConfirm, setSuperAdminPasswordConfirm] = useState("");
  const [showSuperAdminPassword, setShowSuperAdminPassword] = useState(false);

  // Super Admin profile updates state
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [superUsername, setSuperUsername] = useState(() => {
    try {
      const userStr = localStorage.getItem("qazanpos_user");
      return userStr ? JSON.parse(userStr).username : "superadmin";
    } catch (e) {
      return "superadmin";
    }
  });
  const [superPassword, setSuperPassword] = useState("");
  const [showSuperPassword, setShowSuperPassword] = useState(false);

  // Super Admin 2FA Setup State & Logic
  const [showSuper2FASetupModal, setShowSuper2FASetupModal] = useState(false);
  const [super2FASecret, setSuper2FASecret] = useState("");
  const [super2FAQRCode, setSuper2FAQRCode] = useState("");
  const [super2FACodeInput, setSuper2FACodeInput] = useState("");

  const { data: superUsers, refetch: refetchSuperUsers } = useQuery<any[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("İstifadəçiləri gətirmək mümkün olmadı");
      return res.json();
    },
  });

  const activeSuperUserFromDb = superUsers?.find((u) => u.username === superUsername);
  const isSuper2FAActive = activeSuperUserFromDb?.twoFactorEnabled === 1;

  const handleStartSuper2FASetup = async () => {
    try {
      const res = await fetch("/api/auth/2fa-setup", { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSuper2FASecret(data.secret);
      
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.otpauthURI)}`;
      setSuper2FAQRCode(qrUrl);
      setShowSuper2FASetupModal(true);
    } catch (e) {
      toast({
        title: "Xəta!",
        description: "2FA qurulumuna başlamaq mümkün olmadı.",
        variant: "destructive",
      });
    }
  };

  const handleActivateSuper2FA = async () => {
    if (!super2FACodeInput.trim() || super2FACodeInput.length !== 6) {
      toast({
        title: "Xəta!",
        description: "6 rəqəmli OTP kodu daxil edin.",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch("/api/auth/2fa-activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: super2FASecret, token: super2FACodeInput }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "OTP kod yanlışdır");
      }

      toast({
        title: "Təhlükəsizlik aktivdir!",
        description: "Super Admin 2FA müdafiəsi uğurla aktiv edildi.",
        variant: "success",
      });

      setShowSuper2FASetupModal(false);
      setSuper2FACodeInput("");
      refetchSuperUsers();
    } catch (err: any) {
      toast({
        title: "Aktivləşdirmə alınmadı!",
        description: err.message || "Daxil etdiyiniz OTP kod yanlışdır.",
        variant: "destructive",
      });
    }
  };

  const handleDisableSuper2FA = async () => {
    if (!window.confirm("Super Admin 2FA müdafiəsini söndürmək istədiyinizə əminsiniz?")) {
      return;
    }

    try {
      const res = await fetch("/api/auth/2fa-disable", { method: "POST" });
      if (!res.ok) throw new Error();
      
      localStorage.removeItem("qazanpos_2fa_trust_token");

      toast({
        title: "2FA söndürüldü",
        description: "Super Admin üçün iki-mərhələli təhlükəsizlik söndürüldü.",
        variant: "success",
      });
      
      refetchSuperUsers();
    } catch (e) {
      toast({
        title: "Xəta!",
        description: "2FA deaktiv edilərkən xəta baş verdi.",
        variant: "destructive",
      });
    }
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/super/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Profil yenilənə bilmədi!");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Uğurlu Yenilənmə!",
        description: "Super Admin giriş məlumatları uğurla yeniləndi. Çıxış edib yeni hesab ilə daxil olun.",
        variant: "success"
      });
      setIsProfileOpen(false);
      setSuperPassword("");
      setShowSuperPassword(false);
      
      // Auto-logout after 2 seconds to force fresh login with new username/password
      setTimeout(() => {
        localStorage.removeItem("qazanpos_user");
        sessionStorage.clear();
        window.location.reload();
      }, 2000);
    },
    onError: (err: any) => {
      toast({
        title: "Xəta!",
        description: err.message || "Yeniləmə zamanı xəta baş verdi.",
        variant: "destructive"
      });
    }
  });

  const handleViewUsers = async (tenant: any) => {
    setSelectedTenantForUsers(tenant);
    setIsLoadingUsers(true);
    try {
      const res = await fetch(`/api/super/tenants/${tenant.id}/users`);
      if (!res.ok) throw new Error("İstifadəçiləri gətirmək mümkün olmadı");
      const data = await res.json();
      setTenantUsers(data);
    } catch (err: any) {
      toast({
        title: "Xəta!",
        description: err.message || "İstifadəçilər yüklənərkən xəta baş verdi.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Fetch tenants
  const { data: tenantsList, isLoading, refetch, isRefetching } = useQuery<any[]>({
    queryKey: ["/api/super/tenants"],
    queryFn: async () => {
      const res = await fetch("/api/super/tenants");
      if (!res.ok) throw new Error("Biznesləri gətirmək mümkün olmadı");
      return res.json();
    },
  });

  // Create Tenant mutation
  const createTenantMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/super/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Biznes yaradıla bilmədi");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super/tenants"] });
      setIsCreateOpen(false);
      setNewName("");
      setNewSlug("");
      setNewAdminUser("");
      setNewAdminPassword("");
      toast({
        title: "Biznes Yaradıldı",
        description: "Yeni biznes və idarəçi hesabı uğurla aktivləşdirildi.",
        variant: "success",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Xəta!",
        description: err.message || "Biznes yaradılarkən xəta baş verdi.",
        variant: "destructive",
      });
    },
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/super/tenants/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Biznes statusu dəyişdirilə bilmədi");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super/tenants"] });
      toast({
        title: "Biznes Statusu Yeniləndi",
        description: "Əməliyyat uğurla tamamlandı.",
        variant: "success",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Xəta!",
        description: err.message || "Biznes statusu yenilənərkən xəta baş verdi.",
        variant: "destructive",
      });
    },
  });

  // Toggle release tier mutation
  const updateTierMutation = useMutation({
    mutationFn: async ({ id, releaseTier }: { id: number; releaseTier: string }) => {
      const res = await fetch(`/api/super/tenants/${id}/tier`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ releaseTier }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Biznes yenilənmə dərəcəsi dəyişdirilə bilmədi");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super/tenants"] });
      toast({
        title: "Biznes Yenilənmə Dərəcəsi Dəyişdirildi",
        description: "Sistem yenilənmə axını uğurla tətbiq edildi.",
        variant: "success",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Xəta!",
        description: err.message || "Biznes dərəcəsi dəyişdirilərkən xəta baş verdi.",
        variant: "destructive",
      });
    },
  });

  // Delete Tenant mutation
  const deleteTenantMutation = useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) => {
      const res = await fetch(`/api/super/tenants/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Biznes silinə bilmədi");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/super/tenants"] });
      setSelectedTenantForDelete(null);
      setSuperAdminPasswordConfirm("");
      setShowSuperAdminPassword(false);
      toast({
        title: "Biznes Silindi",
        description: data.message || "Biznes və ona aid bütün məlumatlar uğurla təmizləndi.",
        variant: "success",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Xəta!",
        description: err.message || "Biznes silinərkən xəta baş verdi.",
        variant: "destructive",
      });
    },
  });

  // Update billing tier mutation
  const updateBillingTierMutation = useMutation({
    mutationFn: async ({ id, billingTier }: { id: number; billingTier: string }) => {
      const res = await fetch(`/api/super/tenants/${id}/billing-tier`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingTier }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Biznes tarifi dəyişdirilə bilmədi");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super/tenants"] });
      toast({
        title: "Tarif Planı Yeniləndi",
        description: "Biznesin abunəlik limitləri uğurla tətbiq edildi.",
        variant: "success",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Xəta!",
        description: err.message || "Biznes tarifi yenilənərkən xəta baş verdi.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="py-24 text-center text-xs text-gray-400 font-semibold animate-pulse space-y-4">
        <RotateCw className="w-8 h-8 text-primary mx-auto animate-spin" />
        <p>SaaS Control Plane yüklənir, lütfən gözləyin...</p>
      </div>
    );
  }

  // Calculate high-level platform stats
  const totalTenants = tenantsList?.length || 0;
  const activeTenants = tenantsList ? tenantsList.filter((t) => t.status === "active").length : 0;
  const totalSalesCount = tenantsList ? tenantsList.reduce((acc, t) => acc + (t.saleCount || 0), 0) : 0;
  const canaryTenants = tenantsList ? tenantsList.filter((t) => t.releaseTier === "canary").length : 0;

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <Building className="w-6 h-6 text-primary" /> BirSaaS Control Plane
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Çox-biznesli platforma idarəçiliyi, subdomenlərin idarə olunması və tədricən yenilənmə axınları
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              toast({
                title: "Ehtiyat Nüsxə Hazırlanır...",
                description: "Bütün platformanın ehtiyat nüsxəsi yüklənir.",
                variant: "success",
              });
              const userStr = localStorage.getItem("qazanpos_user");
              const user = userStr ? JSON.parse(userStr) : null;
              const role = user?.role || "Admin";
              const username = user?.username || "superadmin";
              window.location.href = `/api/super/backup/export?role=${encodeURIComponent(role)}&username=${encodeURIComponent(username)}`;
            }}
            className="px-4 py-2.5 bg-gray-900 text-white hover:bg-gray-800 cursor-pointer shadow-xs transition-all text-xs flex items-center justify-center gap-2 rounded-xl font-bold border border-gray-900"
          >
            <Database className="w-4 h-4 text-primary shrink-0" /> Tam DB Backup Yüklə (JSON)
          </button>

          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            className="px-4 py-2.5 bg-white text-gray-700 border border-gray-200 hover:text-primary hover:border-primary/50 cursor-pointer shadow-xs transition-all text-xs flex items-center justify-center gap-2 rounded-xl font-bold"
          >
            <SettingsIcon className="w-4 h-4 text-gray-400 shrink-0" /> Profil Ayarları
          </button>
          
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 cursor-pointer shadow-md shadow-primary/10 transition-all text-xs flex items-center justify-center gap-2 animate-pulse-subtle"
          >
            <Plus className="w-4 h-4" /> Yeni Biznes Yarat (Provision)
          </button>
        </div>
      </div>

      {/* Analytics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Tenants */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs glass-card flex items-center justify-between">
          <div>
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider block">Toplam Tenant (Biznes)</span>
            <span className="text-2xl font-black text-gray-900 mt-1 block">{totalTenants}</span>
          </div>
          <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Building className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Active Tenants */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs glass-card flex items-center justify-between">
          <div>
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider block">Aktiv Bizneslər</span>
            <span className="text-2xl font-black text-emerald-600 mt-1 block">{activeTenants}</span>
          </div>
          <div className="size-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Platform Sales */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs glass-card flex items-center justify-between">
          <div>
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider block">Platforma Satışları</span>
            <span className="text-2xl font-black text-gray-900 mt-1 block">{totalSalesCount} ədəd</span>
          </div>
          <div className="size-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Canary Pipeline */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs glass-card flex items-center justify-between">
          <div>
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider block">Canary Tədarükçüləri</span>
            <span className="text-2xl font-black text-purple-600 mt-1 block">{canaryTenants} biznes</span>
          </div>
          <div className="size-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Tenant Management Directory Table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-xs glass-card">
        <div className="flex items-center justify-between p-5 border-b border-gray-100/50">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-primary" />
            <h3 className="font-extrabold text-gray-900 text-sm">Qeydiyyatdan Keçmiş Bizneslər Jurnalı</h3>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-2 bg-white text-gray-500 rounded-lg border border-gray-200 hover:text-primary hover:border-primary/50 cursor-pointer shadow-xs transition-all flex items-center justify-center disabled:opacity-50"
            title="Yenilə"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[850px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="p-4 pl-6 w-16 text-center">ID</th>
                <th className="p-4">Biznes Adı</th>
                <th className="p-4">Biznes Kodu (Subdomain)</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4">Yayımlanma Dərəcəsi</th>
                <th className="p-4">Tarif Planı</th>
                <th className="p-4 text-center">Kassa Sayı</th>
                <th className="p-4 text-center">Satış Həcmi</th>
                <th className="p-4 text-right pr-6 w-56">Əməliyyatlar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-semibold text-xs text-gray-700">
              {tenantsList?.map((tenant) => {
                const isSuper = tenant.id === 2; // Tenant 2 is the Super Admin control plane
                return (
                  <tr key={tenant.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="p-4 text-center text-gray-400 font-mono pl-6">{tenant.id}</td>
                    <td className="p-4 font-extrabold text-gray-900">{tenant.name}</td>
                    <td className="p-4">
                      <span className="font-mono text-primary bg-primary/5 px-2 py-1 rounded-md text-[11px] font-bold">
                        {tenant.slug}.birsaas.com
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {tenant.status === "active" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 border border-green-100 rounded-full font-bold text-[10px]">
                          AKTİV
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 border border-red-100 rounded-full font-bold text-[10px]">
                          DAYANDIRILIB
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={tenant.releaseTier}
                          onChange={(e) => updateTierMutation.mutate({ id: tenant.id, releaseTier: e.target.value })}
                          disabled={isSuper}
                          className="px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-white text-[10px] font-extrabold cursor-pointer"
                        >
                          <option value="stable">Stable (Sabit)</option>
                          <option value="beta">Beta (Sınaqçılar)</option>
                          <option value="canary">Canary (Testlər)</option>
                        </select>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={tenant.billingTier || "free"}
                          onChange={(e) => updateBillingTierMutation.mutate({ id: tenant.id, billingTier: e.target.value })}
                          disabled={isSuper}
                          className="px-2.5 py-1.5 border border-amber-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 bg-amber-50/20 text-[10px] font-extrabold cursor-pointer text-amber-800"
                        >
                          <option value="free">Sınaq (Free)</option>
                          <option value="mini">Mini Plan</option>
                          <option value="pro">Pro Plan</option>
                          <option value="enterprise">Enterprise</option>
                        </select>
                      </div>
                    </td>
                    <td className="p-4 text-center font-bold text-gray-900">{tenant.userCount}</td>
                    <td className="p-4 text-center font-bold text-gray-900">{tenant.saleCount} satış</td>
                    <td className="p-4 text-right pr-6">
                      {!isSuper ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleViewUsers(tenant)}
                            className="px-2.5 py-1.5 bg-white text-gray-700 rounded-lg border border-gray-200 hover:text-primary hover:border-primary/50 cursor-pointer shadow-xs transition-all flex items-center justify-center gap-1 font-bold text-[10px]"
                          >
                            <Lock className="w-3.5 h-3.5 text-amber-500" /> Girişlər
                          </button>
                          {tenant.status === "active" ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`'${tenant.name}' biznesinin fəaliyyətini dayandırmağa əminsiniz?`)) {
                                  toggleStatusMutation.mutate({ id: tenant.id, status: "suspended" });
                                }
                              }}
                              className="px-2.5 py-1.5 bg-white text-red-500 rounded-lg border border-red-100 hover:bg-red-50 cursor-pointer shadow-xs transition-all flex items-center justify-center gap-1 font-bold text-[10px]"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Blok Et
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => toggleStatusMutation.mutate({ id: tenant.id, status: "active" })}
                              className="px-2.5 py-1.5 bg-white text-emerald-600 rounded-lg border border-emerald-100 hover:bg-emerald-50 cursor-pointer shadow-xs transition-all flex items-center justify-center gap-1 font-bold text-[10px]"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> Aktivləşdir
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedTenantForDelete(tenant)}
                            className="px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg border border-red-100 hover:bg-red-100 cursor-pointer shadow-xs transition-all flex items-center justify-center gap-1 font-bold text-[10px]"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Sil
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400 font-extrabold uppercase italic block tracking-wider pr-4">Super Platform</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision Tenant Modal Window Overlay */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-100 flex items-center justify-center p-4 animate-in fade-in-0">
          <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-2xl max-w-md w-full relative space-y-6">
            <div>
              <h3 className="font-extrabold text-gray-900 text-lg tracking-tight flex items-center gap-2">
                <Building className="w-5 h-5 text-primary" /> Yeni SaaS Biznesi Provision Et
              </h3>
              <p className="text-[10px] text-gray-400 mt-1 font-semibold leading-relaxed uppercase tracking-wider">
                Yeni tenant profilini aktivləşdir və admin hesabını seeder et
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newName.trim() || !newSlug.trim() || !newAdminUser.trim() || !newAdminPassword.trim()) {
                  toast({
                    title: "Xəta!",
                    description: "Bütün məlumatlar doldurulmalıdır.",
                    variant: "destructive",
                  });
                  return;
                }
                createTenantMutation.mutate({
                  name: newName.trim(),
                  slug: newSlug.trim().toLowerCase(),
                  adminUsername: newAdminUser.trim().toLowerCase(),
                  adminPassword: newAdminPassword.trim(),
                });
              }}
              className="space-y-4 text-xs font-semibold"
            >
              {/* Shop Name */}
              <div className="space-y-1">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Mağaza (Biznes) Adı *</label>
                <input
                  type="text"
                  placeholder="Məs. Grand Store"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 text-gray-900 font-extrabold"
                  required
                />
              </div>

              {/* Subdomain slug */}
              <div className="space-y-1">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Biznes Kodu (subdomain slug) *</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Məs. grandstore"
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 font-mono text-gray-900 font-bold"
                    required
                  />
                  <span className="absolute right-3.5 top-3.5 text-[10px] text-gray-400 font-bold font-mono lowercase">
                    .birsaas.com
                  </span>
                </div>
              </div>

              <div className="border-t border-dashed border-gray-100 pt-4 space-y-3">
                <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider block">Biznes Sahibi (Admin) Məlumatları</span>
                
                {/* Admin Username */}
                <div className="space-y-1">
                  <label className="text-gray-400 uppercase tracking-wider block text-[10px]">İstifadəçi adı *</label>
                  <input
                    type="text"
                    placeholder="Məs. admin"
                    value={newAdminUser}
                    onChange={(e) => setNewAdminUser(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 text-gray-900 font-bold"
                    required
                  />
                </div>

                {/* Admin Password */}
                <div className="space-y-1">
                  <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Şifrə *</label>
                  <div className="relative">
                    <input
                      type={showAdminPassword ? "text" : "password"}
                      placeholder="Şifrə"
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 font-mono text-gray-900 font-bold"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="absolute right-3.5 top-3.5 text-gray-400 hover:text-primary transition-colors flex items-center justify-center"
                    >
                      {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex gap-2.5 justify-end text-xs font-bold pt-4 border-t border-gray-100/50 mt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2.5 border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 cursor-pointer transition-all"
                >
                  Ləğv Et
                </button>
                <button
                  type="submit"
                  disabled={createTenantMutation.isPending}
                  className="px-6 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 cursor-pointer shadow-md shadow-primary/10 transition-all flex items-center justify-center gap-1.5"
                >
                  {createTenantMutation.isPending ? "Yaradılır..." : "Biznesi Provision Et"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Tenant Users Modal */}
      {selectedTenantForUsers && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-100 flex items-center justify-center p-4 animate-in fade-in-0">
          <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-2xl max-w-lg w-full relative space-y-6">
            <div>
              <h3 className="font-extrabold text-gray-900 text-lg tracking-tight flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-500" /> '{selectedTenantForUsers.name}' Giriş Məlumatları
              </h3>
              <p className="text-[10px] text-gray-400 mt-1 font-semibold leading-relaxed uppercase tracking-wider">
                Sistemə daxil olmaq üçün istifadəçi adları və şifrələri
              </p>
            </div>

            {isLoadingUsers ? (
              <div className="py-8 text-center text-xs text-gray-400 font-semibold space-y-2">
                <RotateCw className="w-6 h-6 text-primary mx-auto animate-spin" />
                <p>İstifadəçilər yüklənir...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tenantUsers.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">Bu biznes üçün istifadəçi tapılmadı.</p>
                ) : (
                  <div className="overflow-hidden border border-gray-100 rounded-2xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 text-gray-400 font-bold border-b border-gray-100">
                          <th className="p-3 pl-4">İstifadəçi adı</th>
                          <th className="p-3">Şifrə</th>
                          <th className="p-3 pr-4 text-center">Rol</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-semibold text-gray-700">
                        {tenantUsers.map((user) => (
                          <tr key={user.id} className="hover:bg-gray-50/50">
                            <td className="p-3 pl-4 font-mono font-bold text-gray-900">{user.username}</td>
                            <td className="p-3 font-mono font-bold text-amber-600 select-all bg-amber-50/30 px-2 rounded-md">
                              {user.password}
                            </td>
                            <td className="p-3 pr-4 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                user.role === "Admin" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                              }`}>
                                {user.role}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2.5 justify-end text-xs font-bold pt-4 border-t border-gray-100/50">
              <button
                type="button"
                onClick={() => {
                  setSelectedTenantForUsers(null);
                  setTenantUsers([]);
                }}
                className="px-6 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 cursor-pointer transition-all"
              >
                Bağla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Tenant Modal */}
      {selectedTenantForDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-100 flex items-center justify-center p-4 animate-in fade-in-0">
          <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-2xl max-w-md w-full relative space-y-6">
            <div>
              <h3 className="font-extrabold text-red-600 text-lg tracking-tight flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" /> '{selectedTenantForDelete.name}' Biznesini Sil
              </h3>
              <p className="text-[10px] text-gray-400 mt-1 font-semibold leading-relaxed uppercase tracking-wider">
                BU ƏMƏLİYYAT DAİMİDİR VƏ GERİ QAYTARILA BİLMƏZ!
              </p>
            </div>

            <div className="space-y-4 text-xs font-semibold">
              <div className="bg-red-50 text-red-700 p-4 rounded-2xl border border-red-100 space-y-2">
                <p className="font-bold">Diqqət! Bu əməliyyat nəticəsində:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Mağazanın bütün satış jurnalları və gəlir-xərc məlumatları silinəcək.</li>
                  <li>Bütün məhsul kataloqu və anbardakı qalıqlar silinəcək.</li>
                  <li>Mağazaya aid bütün kassir və admin istifadəçi hesabları tamamilə ləğv ediləcək.</li>
                </ul>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!superAdminPasswordConfirm.trim()) {
                    toast({
                      title: "Xəta!",
                      description: "Təsdiq üçün Super Admin şifrənizi daxil edin.",
                      variant: "destructive",
                    });
                    return;
                  }
                  deleteTenantMutation.mutate({
                    id: selectedTenantForDelete.id,
                    password: superAdminPasswordConfirm.trim(),
                  });
                }}
                className="space-y-3"
              >
                <div className="space-y-1">
                  <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Super Admin Şifrəsi *</label>
                  <div className="relative">
                    <input
                      type={showSuperAdminPassword ? "text" : "password"}
                      placeholder="Super Admin Şifrənizi daxil edin"
                      value={superAdminPasswordConfirm}
                      onChange={(e) => setSuperAdminPasswordConfirm(e.target.value)}
                      className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500 bg-gray-50/50 font-mono text-gray-900 font-bold"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowSuperAdminPassword(!showSuperAdminPassword)}
                      className="absolute right-3.5 top-3.5 text-gray-400 hover:text-red-500 transition-colors flex items-center justify-center"
                    >
                      {showSuperAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2.5 justify-end text-xs font-bold pt-4 border-t border-gray-100/50 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTenantForDelete(null);
                      setSuperAdminPasswordConfirm("");
                      setShowSuperAdminPassword(false);
                    }}
                    className="px-4 py-2.5 border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 cursor-pointer transition-all"
                  >
                    Ləğv Et
                  </button>
                  <button
                    type="submit"
                    disabled={deleteTenantMutation.isPending}
                    className="px-6 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 cursor-pointer shadow-md shadow-red-500/10 transition-all flex items-center justify-center gap-1.5"
                  >
                    {deleteTenantMutation.isPending ? "Silinir..." : "Biznesi Həmişəlik Sil"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 5. Profile Settings Modal */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-0">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-2xl max-w-sm w-full relative">
            <div className="flex items-center gap-3 text-primary mb-4 border-b border-gray-100 pb-3 text-left">
              <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <SettingsIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-gray-900 text-sm leading-tight">Profil Ayarları</h3>
                <span className="text-[10px] text-gray-400 font-bold mt-0.5 block">Platforma Admin giriş məlumatları</span>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!superUsername.trim()) {
                  toast({ title: "Xəta!", description: "İstifadəçi adı boş ola bilməz!", variant: "destructive" });
                  return;
                }
                if (!superPassword.trim()) {
                  toast({ title: "Xəta!", description: "Yeni şifrə daxil edilməlidir!", variant: "destructive" });
                  return;
                }
                if (superPassword.trim().length < 4) {
                  toast({ title: "Xəta!", description: "Şifrə ən azı 4 simvoldan ibarət olmalıdır!", variant: "destructive" });
                  return;
                }
                updateProfileMutation.mutate({
                  username: superUsername.trim(),
                  password: superPassword.trim()
                });
              }}
              className="space-y-4 text-xs font-semibold"
            >
              <div className="space-y-1 text-left">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">İstifadəçi Adı *</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={superUsername}
                    onChange={(e) => setSuperUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 text-gray-900 font-bold"
                    placeholder="Məs. superadmin"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1 text-left">
                <label className="text-gray-400 uppercase tracking-wider block text-[10px]">Yeni Şifrə *</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
                  <input
                    type={showSuperPassword ? "text" : "password"}
                    value={superPassword}
                    onChange={(e) => setSuperPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 font-mono text-gray-900 font-bold"
                    placeholder="Yeni şifrənizi daxil edin"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowSuperPassword(!showSuperPassword)}
                    className="absolute right-3.5 top-3.5 text-gray-400 hover:text-primary transition-colors flex items-center justify-center cursor-pointer"
                  >
                    {showSuperPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 2FA Security section inside SuperAdmin profile modal */}
              <div className="border-t border-gray-100/70 pt-4 mt-2 text-left space-y-3">
                <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider block font-bold">İki-Mərhələli Təhlükəsizlik (2FA)</span>
                
                {isSuper2FAActive ? (
                  <div className="flex items-center justify-between gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wide font-extrabold">Qorunur (Aktivdir)</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleDisableSuper2FA}
                      className="px-2.5 py-1.5 bg-white text-red-500 border border-red-100 rounded-lg font-bold text-[9px] hover:bg-red-50 cursor-pointer transition-all"
                    >
                      Söndür
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wide font-extrabold">Qorunmur (Deaktivdir)</span>
                    <button
                      type="button"
                      onClick={handleStartSuper2FASetup}
                      className="px-2.5 py-1.5 bg-primary text-white rounded-lg font-black text-[9px] hover:bg-primary/95 cursor-pointer shadow-xs transition-all uppercase tracking-wide"
                    >
                      Aktiv Et ⚡
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2.5 justify-end text-xs font-bold pt-4 border-t border-gray-100/50 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    setSuperPassword("");
                    setShowSuperPassword(false);
                  }}
                  className="px-4 py-2.5 border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 cursor-pointer transition-all"
                >
                  Ləğv Et
                </button>
                <button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="px-6 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 cursor-pointer shadow-md shadow-primary/10 transition-all flex items-center justify-center gap-1.5"
                >
                  {updateProfileMutation.isPending ? "Yenilənir..." : "Yenilə ⚡"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Super Admin 2FA Setup Modal Overlay */}
      {showSuper2FASetupModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-100 flex items-center justify-center p-4 animate-in fade-in-0">
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-2xl max-w-sm w-full relative space-y-5 animate-in zoom-in-95 duration-200 text-center">
            
            <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
              <Lock className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-extrabold text-gray-900 text-sm">
                Super Admin 2FA Qurulum Kılavuzu
              </h3>
              <p className="text-[10px] text-gray-500 font-semibold">
                Mobil telefonunuzda Google Authenticator ilə bu QR kodu skan edin.
              </p>
            </div>

            {/* QR Code Container */}
            {super2FAQRCode && (
              <div className="bg-gray-50 p-4 rounded-2xl inline-block border border-gray-100 mx-auto shadow-inner">
                <img
                  src={super2FAQRCode}
                  alt="2FA QR Code"
                  className="size-40 mx-auto"
                />
              </div>
            )}

            {/* Secret key text copy alternative */}
            <div className="space-y-1 text-xs">
              <span className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider block font-bold">QR Skan etmək olmursa, gizli açar:</span>
              <code className="bg-gray-100 text-primary px-3 py-1.5 rounded-lg font-mono font-bold tracking-widest text-[11px] select-all block">
                {super2FASecret}
              </code>
            </div>

            {/* Verification code input */}
            <div className="space-y-1.5 text-xs text-left font-semibold">
              <label className="text-gray-400 uppercase tracking-wider block text-[9px] text-center font-bold">Tətbiqdəki 6 Rəqəmli OTP Kodu daxil edin</label>
              <input
                type="text"
                maxLength={6}
                placeholder="000000"
                value={super2FACodeInput}
                onChange={(e) => setSuper2FACodeInput(e.target.value.replace(/[^0-9]/g, ""))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 text-center font-mono font-black text-lg tracking-widest text-gray-900 animate-pulse"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 text-xs font-bold pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowSuper2FASetupModal(false);
                  setSuper2FACodeInput("");
                }}
                className="flex-1 py-3 border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 cursor-pointer transition-all font-bold"
              >
                İmtina Et
              </button>
              <button
                type="button"
                onClick={handleActivateSuper2FA}
                className="flex-1 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 cursor-pointer shadow-md shadow-primary/10 transition-all font-black uppercase tracking-wider"
              >
                Aktivləşdir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

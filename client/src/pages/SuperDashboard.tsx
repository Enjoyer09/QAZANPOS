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
  Activity
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
  const activeTenants = tenantsList?.filter((t) => t.status === "active").length || 0;
  const totalSalesCount = tenantsList?.reduce((acc, t) => acc + (t.saleCount || 0), 0) || 0;
  const canaryTenants = tenantsList?.filter((t) => t.releaseTier === "canary").length || 0;

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <Building className="w-6 h-6 text-primary" /> Qazan SaaS Control Plane
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Çox-biznesli platforma idarəçiliyi, subdomenlərin idarə olunması və tədricən yenilənmə axınları
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 cursor-pointer shadow-md shadow-primary/10 transition-all text-xs flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Yeni Biznes Yarat (Provision)
        </button>
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
                    <td className="p-4 text-center font-bold text-gray-900">{tenant.userCount}</td>
                    <td className="p-4 text-center font-bold text-gray-900">{tenant.saleCount} satış</td>
                    <td className="p-4 text-right pr-6">
                      {!isSuper ? (
                        <div className="flex justify-end gap-2">
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
                  <input
                    type="password"
                    placeholder="Şifrə"
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-gray-50/50 font-mono text-gray-900 font-bold"
                    required
                  />
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
    </div>
  );
}

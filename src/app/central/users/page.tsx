"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, ShieldCheck, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RoleBadge, UserStatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/api-client";
import { DEMO_CAMPUSES, DEMO_USERS } from "@/lib/demo-data";
import type {
  AuthUserDTO,
  CampusDTO,
  UserRole,
  UserStatus,
} from "@/types/contracts";

export default function CentralUsersPage() {
  const [users, setUsers] = useState<AuthUserDTO[]>([]);
  const [campuses, setCampuses] = useState<CampusDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<{
    fullName: string;
    email: string;
    institutionalId: string;
    role: UserRole;
    campusId: string;
  }>({
    fullName: "",
    email: "",
    institutionalId: "",
    role: "INSTRUCTOR",
    campusId: "",
  });

  const loadData = useCallback(async () => {
    try {
      const [uRes, cRes] = await Promise.all([
        apiClient.users.list({ pageSize: 100 }),
        apiClient.campuses.list({ pageSize: 50 }),
      ]);
      setUsers(uRes.data);
      setCampuses(cRes.data);
    } catch {
      setUsers(DEMO_USERS);
      setCampuses(DEMO_CAMPUSES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const hasCentralManager = useMemo(
    () => users.some((u) => u.role === "CENTRAL_LAB_MANAGER"),
    [users]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.institutionalId.toLowerCase().includes(q) ||
        (u.campus?.code.toLowerCase().includes(q) ?? false)
      );
    });
  }, [users, search, roleFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.role !== "CENTRAL_LAB_MANAGER" && !form.campusId) {
      toast.error("Campus assignment is mandatory for Lab Manager, Instructor, and Student roles.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiClient.users.create({
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        institutionalId: form.institutionalId.trim().toUpperCase(),
        role: form.role,
        campusId: form.role === "CENTRAL_LAB_MANAGER" ? null : form.campusId,
      });
      setUsers((prev) => [res.data, ...prev]);
      toast.success(`User ${res.data.fullName} created`);
      setCreateOpen(false);
      setForm({
        fullName: "",
        email: "",
        institutionalId: "",
        role: "INSTRUCTOR",
        campusId: "",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (u: AuthUserDTO) => {
    const nextStatus: UserStatus = u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await apiClient.users.update(u.id, { status: nextStatus });
      setUsers((prev) =>
        prev.map((row) => (row.id === u.id ? { ...row, status: nextStatus } : row))
      );
      toast.success(`${u.fullName} marked ${nextStatus.toLowerCase()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Role Governance"
        description="Manage Lab Managers, Instructors, and Students across all 40 campuses. Single Central Lab Manager constraint enforced at database level."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Create User
          </Button>
        }
      />

      <div className="rounded-2xl border border-[#288568]/25 bg-[#EAF6F1]/70 px-4 py-3 text-xs text-[#288568] flex items-center gap-2.5">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        <span>
          <strong>Governance Policy:</strong> Exactly one{" "}
          <strong>Central Lab Manager</strong> exists globally (no campus scope). Every
          Lab Manager, Instructor, and Student MUST belong to a single campus.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#E6E5E0] bg-white p-3.5 shadow-card">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#72736E]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, institutional ID, or campus..."
            className="pl-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Roles</SelectItem>
            <SelectItem value="CENTRAL_LAB_MANAGER">Central Lab Manager</SelectItem>
            <SelectItem value="LAB_MANAGER">Lab Manager</SelectItem>
            <SelectItem value="INSTRUCTOR">Instructor</SelectItem>
            <SelectItem value="STUDENT">Student</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm sheet-table">
            <thead>
              <tr className="text-left">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Institutional ID</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Campus Scope</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Active</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#72736E]">
                    Loading users...
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-[#FAF9F6]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#222321]">{u.fullName}</p>
                      <p className="text-xs text-[#72736E]">{u.email}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#72736E]">
                      {u.institutionalId}
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {u.campus ? (
                        <span>
                          <strong className="font-mono text-[#F26943] mr-1">
                            {u.campus.code}
                          </strong>
                          {u.campus.name}
                        </span>
                      ) : (
                        <span className="font-medium text-[#222321]">
                          Global (40 Campuses)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <UserStatusBadge status={u.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Switch
                        checked={u.status === "ACTIVE"}
                        disabled={u.role === "CENTRAL_LAB_MANAGER"}
                        onCheckedChange={() => handleToggleStatus(u)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create User Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-[#F26943]" />
              Provision Platform User
            </DialogTitle>
            <DialogDescription>
              Assign role and campus isolation scope. Single Central Lab Manager policy applies.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="user-name">Full Name</Label>
              <Input
                id="user-name"
                placeholder="Dr. Kavita Rao"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="user-email">Email</Label>
                <Input
                  id="user-email"
                  type="email"
                  placeholder="kavita.rao@campuslab.edu"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-inst-id">Institutional ID</Label>
                <Input
                  id="user-inst-id"
                  placeholder="INS-0402"
                  value={form.institutionalId}
                  onChange={(e) =>
                    setForm({ ...form, institutionalId: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm({ ...form, role: v as UserRole })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {!hasCentralManager && (
                      <SelectItem value="CENTRAL_LAB_MANAGER">
                        Central Lab Manager (Unique)
                      </SelectItem>
                    )}
                    <SelectItem value="LAB_MANAGER">Lab Manager</SelectItem>
                    <SelectItem value="INSTRUCTOR">Instructor</SelectItem>
                    <SelectItem value="STUDENT">Student</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Assigned Campus</Label>
                <Select
                  value={form.campusId}
                  disabled={form.role === "CENTRAL_LAB_MANAGER"}
                  onValueChange={(v) => setForm({ ...form, campusId: v })}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        form.role === "CENTRAL_LAB_MANAGER"
                          ? "Global (None)"
                          : "Select campus"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {campuses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} · {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

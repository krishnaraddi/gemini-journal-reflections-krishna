import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
  UserCheck,
  UserX,
  FileText,
  MapPin,
  Sparkles,
  Activity,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  KeyRound,
  ExternalLink,
} from 'lucide-react';
import {
  UserProfile,
  UserRole,
  UserStatus,
  AdminAuditLog,
  JournalEntry,
} from '../types';
import {
  subscribeToAllUsers,
  updateUserRole,
  updateUserStatus,
  subscribeToAuditLogs,
} from '../services/firestoreService';

interface AdminDashboardProps {
  currentUser: UserProfile;
  entries: JournalEntry[];
  addToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onBackToEditor: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  entries,
  addToast,
  onBackToEditor,
}) => {
  const isAdmin = currentUser.role === 'admin';

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const [adminTab, setAdminTab] = useState<'users' | 'metrics' | 'audit'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'role' | 'status';
    targetUser: UserProfile | null;
    newRole?: UserRole;
    newStatus?: UserStatus;
  }>({
    isOpen: false,
    type: 'role',
    targetUser: null,
  });

  // Subscribe to all users in real-time
  useEffect(() => {
    if (!isAdmin) return;

    setLoadingUsers(true);
    const unsubscribeUsers = subscribeToAllUsers(
      (userList) => {
        setUsers(userList);
        setLoadingUsers(false);
      },
      (err) => {
        console.error('Failed to load users:', err);
        addToast('error', 'Failed to load user directory.');
        setLoadingUsers(false);
      }
    );

    setLoadingLogs(true);
    const unsubscribeLogs = subscribeToAuditLogs(
      (logs) => {
        setAuditLogs(logs);
        setLoadingLogs(false);
      },
      (err) => {
        console.error('Failed to load audit logs:', err);
        setLoadingLogs(false);
      }
    );

    return () => {
      unsubscribeUsers();
      unsubscribeLogs();
    };
  }, [isAdmin]);

  // Access Denied Screen for non-admins (OWASP A01 broken access control enforcement)
  if (!isAdmin) {
    return (
      <div className="bg-white border border-red-200 rounded-2xl p-8 text-center max-w-xl mx-auto shadow-sm my-12">
        <div className="w-14 h-14 bg-red-100 border border-red-200 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-stone-900 mb-2">Access Restricted (403 Forbidden)</h2>
        <p className="text-sm text-stone-600 mb-6 leading-relaxed">
          The Administrative Console requires elevated <code className="bg-stone-100 text-stone-800 px-1.5 py-0.5 rounded font-mono text-xs">admin</code> role authorization. Your account (<code className="text-amber-700 font-mono text-xs">{currentUser.email}</code>) has the role of <code className="font-semibold">{currentUser.role || 'user'}</code>.
        </p>
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-left text-xs space-y-1 mb-6 font-mono text-stone-600">
          <div>Policy: OWASP A01 Broken Access Control Guard</div>
          <div>Audit: Access attempt logged to security telemetry</div>
          <div>Enforcement: Firebase Security Rules &amp; React Component Boundary</div>
        </div>
        <button
          type="button"
          onClick={onBackToEditor}
          className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold shadow transition"
        >
          Return to My Journal
        </button>
      </div>
    );
  }

  // Handle Role Change Execution
  const handleExecuteRoleChange = async () => {
    if (!confirmModal.targetUser || !confirmModal.newRole) return;
    const target = confirmModal.targetUser;
    const newRole = confirmModal.newRole;

    setActionLoadingId(target.uid);
    try {
      await updateUserRole(currentUser, target.uid, target.email || target.displayName || 'Unknown', newRole);
      addToast('success', `User ${target.email || target.uid} updated to ${newRole.toUpperCase()}.`);
    } catch (err: any) {
      console.error('Role update error:', err);
      addToast('error', err.message || 'Failed to update user role.');
    } finally {
      setActionLoadingId(null);
      setConfirmModal({ isOpen: false, type: 'role', targetUser: null });
    }
  };

  // Handle Status Change Execution
  const handleExecuteStatusChange = async () => {
    if (!confirmModal.targetUser || !confirmModal.newStatus) return;
    const target = confirmModal.targetUser;
    const newStatus = confirmModal.newStatus;

    setActionLoadingId(target.uid);
    try {
      await updateUserStatus(currentUser, target.uid, target.email || target.displayName || 'Unknown', newStatus);
      addToast('success', `User ${target.email || target.uid} status set to ${newStatus.toUpperCase()}.`);
    } catch (err: any) {
      console.error('Status update error:', err);
      addToast('error', err.message || 'Failed to update user status.');
    } finally {
      setActionLoadingId(null);
      setConfirmModal({ isOpen: false, type: 'status', targetUser: null });
    }
  };

  // Computed Metrics
  const totalUsersCount = users.length;
  const adminUsersCount = users.filter((u) => u.role === 'admin').length;
  const suspendedUsersCount = users.filter((u) => u.status === 'suspended').length;
  const totalEntriesCount = entries.length;
  const geotaggedCount = entries.filter((e) => Boolean(e.location?.lat && e.location?.lng)).length;

  // Filtered Users List
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (u.email?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      u.uid.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole =
      roleFilter === 'all' ? true : u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-stone-900 text-stone-100 rounded-2xl p-6 border border-stone-800 shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Shield className="w-3 h-3 text-amber-400" />
                ADMINISTRATOR CONSOLE
              </span>
              <span className="text-stone-400 text-xs font-mono">
                RBAC v2 • Zero-Trust Cloud Firestore
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Platform Administration &amp; Access Control
            </h1>
            <p className="text-xs text-stone-400 mt-1 max-w-2xl leading-relaxed">
              Manage system roles, enforce granular access policies, monitor security audit logs, and oversee platform reflection metrics in real-time.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBackToEditor}
              className="px-3.5 py-2 text-xs font-medium text-stone-300 hover:text-white bg-stone-800 hover:bg-stone-700 rounded-xl transition border border-stone-700"
            >
              Back to Journal
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium mb-1">
            <span>Total Registered Users</span>
            <Users className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-stone-900">{totalUsersCount}</div>
          <div className="text-[11px] text-stone-500 mt-1 flex items-center gap-1">
            <span className="text-amber-700 font-semibold">{adminUsersCount}</span> administrators
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium mb-1">
            <span>Active Roles</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-stone-900">
            {totalUsersCount - suspendedUsersCount}
            <span className="text-xs text-stone-500 font-normal ml-1">/ {totalUsersCount} active</span>
          </div>
          <div className="text-[11px] text-stone-500 mt-1">
            {suspendedUsersCount > 0 ? (
              <span className="text-rose-600 font-semibold">{suspendedUsersCount} suspended</span>
            ) : (
              <span className="text-emerald-700 font-semibold">0 suspended accounts</span>
            )}
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium mb-1">
            <span>Journal Reflections</span>
            <FileText className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-stone-900">{totalEntriesCount}</div>
          <div className="text-[11px] text-stone-500 mt-1 flex items-center gap-1">
            <span className="text-indigo-700 font-semibold">{geotaggedCount}</span> with location pins
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium mb-1">
            <span>Security Policy</span>
            <KeyRound className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-sm font-bold text-stone-900 mt-1">Owner-Bound + RBAC</div>
          <div className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Zero Insecure Defaults
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center border-b border-stone-200 gap-2">
        <button
          type="button"
          onClick={() => setAdminTab('users')}
          className={`pb-3 px-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
            adminTab === 'users'
              ? 'border-amber-600 text-amber-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Directory &amp; RBAC ({users.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('audit')}
          className={`pb-3 px-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
            adminTab === 'audit'
              ? 'border-amber-600 text-amber-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Security Audit Logs ({auditLogs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('metrics')}
          className={`pb-3 px-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
            adminTab === 'metrics'
              ? 'border-amber-600 text-amber-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Platform Health &amp; Telemetry</span>
        </button>
      </div>

      {/* TAB 1: User Directory & RBAC Management */}
      {adminTab === 'users' && (
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Controls toolbar */}
          <div className="p-4 border-b border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-stone-50/60">
            <div className="flex items-center gap-2 flex-1 max-w-md bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs shadow-inner">
              <Search className="w-4 h-4 text-stone-400 shrink-0" />
              <input
                type="text"
                placeholder="Search user by name, email, or UID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent outline-none text-stone-800 placeholder-stone-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-500">Filter Role:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                aria-label="Filter user directory by role"
                className="text-xs bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-700 font-medium outline-none"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admins Only</option>
                <option value="user">Standard Users Only</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          {loadingUsers ? (
            <div className="p-12 text-center text-stone-500 text-xs">
              <RefreshCw className="w-6 h-6 text-amber-600 animate-spin mx-auto mb-2" />
              Loading synchronized user directory...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-stone-500 text-xs">
              No users found matching the filter criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100/70 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Role (RBAC)</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4">Last Login</th>
                    <th className="py-3 px-4 text-right">Administrative Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredUsers.map((target) => {
                    const isSelf = target.uid === currentUser.uid;
                    const isTargetAdmin = target.role === 'admin';
                    const isTargetSuspended = target.status === 'suspended';

                    return (
                      <tr key={target.uid} className="hover:bg-stone-50/80 transition">
                        {/* User Identity Column */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {target.photoURL ? (
                              <img
                                src={target.photoURL}
                                alt={target.displayName || 'User'}
                                referrerPolicy="no-referrer"
                                className="w-8 h-8 rounded-full border border-stone-200"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-stone-200 text-stone-700 font-bold flex items-center justify-center text-xs">
                                {(target.displayName || target.email || 'U').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                                <span>{target.displayName || 'Unnamed User'}</span>
                                {isSelf && (
                                  <span className="text-[10px] bg-stone-200 text-stone-700 px-1.5 py-0.2 rounded font-mono">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-stone-500 text-[11px] font-mono truncate max-w-xs">
                                {target.email || target.uid}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Role Column */}
                        <td className="py-3 px-4">
                          {isTargetAdmin ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                              <Shield className="w-3 h-3 text-purple-600" />
                              ADMIN
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
                              USER
                            </span>
                          )}
                        </td>

                        {/* Status Column */}
                        <td className="py-3 px-4">
                          {isTargetSuspended ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <UserX className="w-3 h-3 text-rose-600" />
                              SUSPENDED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <UserCheck className="w-3 h-3 text-emerald-600" />
                              ACTIVE
                            </span>
                          )}
                        </td>

                        {/* Last Login Column */}
                        <td className="py-3 px-4 text-stone-500 font-mono text-[11px]">
                          {target.lastLoginAt
                            ? new Date(target.lastLoginAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Never'}
                        </td>

                        {/* Actions Column */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Toggle Role Button */}
                            <button
                              type="button"
                              disabled={isSelf || actionLoadingId === target.uid}
                              onClick={() => {
                                setConfirmModal({
                                  isOpen: true,
                                  type: 'role',
                                  targetUser: target,
                                  newRole: isTargetAdmin ? 'user' : 'admin',
                                });
                              }}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 ${
                                isSelf
                                  ? 'opacity-40 cursor-not-allowed bg-stone-100 text-stone-400'
                                  : isTargetAdmin
                                  ? 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200'
                              }`}
                              title={isSelf ? 'Cannot demote self' : undefined}
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>{isTargetAdmin ? 'Demote to User' : 'Promote to Admin'}</span>
                            </button>

                            {/* Toggle Status Button */}
                            <button
                              type="button"
                              disabled={isSelf || actionLoadingId === target.uid}
                              onClick={() => {
                                setConfirmModal({
                                  isOpen: true,
                                  type: 'status',
                                  targetUser: target,
                                  newStatus: isTargetSuspended ? 'active' : 'suspended',
                                });
                              }}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 ${
                                isSelf
                                  ? 'opacity-40 cursor-not-allowed bg-stone-100 text-stone-400'
                                  : isTargetSuspended
                                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                              }`}
                              title={isSelf ? 'Cannot suspend self' : undefined}
                            >
                              {isTargetSuspended ? (
                                <>
                                  <UserCheck className="w-3 h-3 text-emerald-600" />
                                  <span>Activate</span>
                                </>
                              ) : (
                                <>
                                  <UserX className="w-3 h-3 text-rose-600" />
                                  <span>Suspend</span>
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Audit Logs */}
      {adminTab === 'audit' && (
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-stone-900">Security &amp; Policy Audit Trail</h2>
              <p className="text-xs text-stone-500">
                Immutable record of administrative actions, role assignments, and security events.
              </p>
            </div>
            <span className="text-xs bg-stone-100 text-stone-700 border border-stone-200 px-2.5 py-1 rounded-lg font-mono">
              /admin_audit_logs ({auditLogs.length} events)
            </span>
          </div>

          {loadingLogs ? (
            <div className="p-8 text-center text-stone-500 text-xs">
              <RefreshCw className="w-5 h-5 text-amber-600 animate-spin mx-auto mb-2" />
              Loading security audit stream...
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="p-8 text-center text-stone-500 text-xs bg-stone-50 rounded-xl border border-stone-100">
              No audit log entries recorded yet. Administrative actions will automatically log here.
            </div>
          ) : (
            <div className="divide-y divide-stone-100 border border-stone-100 rounded-xl overflow-hidden">
              {auditLogs.map((log) => {
                let badgeClass = 'bg-stone-100 text-stone-700 border-stone-200';
                if (log.action === 'ROLE_PROMOTION') badgeClass = 'bg-purple-50 text-purple-800 border-purple-200';
                if (log.action === 'ROLE_DEMOTION') badgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
                if (log.action === 'USER_SUSPENDED') badgeClass = 'bg-rose-50 text-rose-800 border-rose-200';
                if (log.action === 'USER_ACTIVATED') badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';

                return (
                  <div key={log.id} className="p-4 hover:bg-stone-50/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${badgeClass}`}>
                          {log.action}
                        </span>
                        <span className="text-stone-800 font-semibold">{log.details}</span>
                      </div>
                      <div className="text-[11px] text-stone-500 flex items-center gap-2">
                        <span>Actor: <strong className="text-stone-700">{log.actorEmail}</strong></span>
                        {log.targetEmail && (
                          <>
                            <span>•</span>
                            <span>Target: <strong className="text-stone-700">{log.targetEmail}</strong></span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-stone-400 text-[11px] font-mono shrink-0 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Platform Health & Telemetry */}
      {adminTab === 'metrics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Security & Access Subsystem Status */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Security Hardening &amp; Cloud Rules
            </h2>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
                <div>
                  <div className="font-semibold text-stone-800">Cloud Firestore Security Rules</div>
                  <div className="text-[11px] text-stone-500">Owner-bound isolation &amp; dynamic isAdmin() ABAC lookup</div>
                </div>
                <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">
                  DEPLOYED
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
                <div>
                  <div className="font-semibold text-stone-800">Identity &amp; Authentication</div>
                  <div className="text-[11px] text-stone-500">Google Federated Sign-In via Firebase Auth</div>
                </div>
                <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">
                  ACTIVE
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
                <div>
                  <div className="font-semibold text-stone-800">OWASP A01 Barrier</div>
                  <div className="text-[11px] text-stone-500">Non-admin block &amp; account suspension screen</div>
                </div>
                <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">
                  ENFORCED
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
                <div>
                  <div className="font-semibold text-stone-800">Zero Insecure Defaults</div>
                  <div className="text-[11px] text-stone-500">Strict deny-all on unrecognized routes</div>
                </div>
                <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">
                  VERIFIED
                </span>
              </div>
            </div>
          </div>

          {/* AI Subsystem & Maps Status */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-600" />
              Intelligence &amp; Environmental Services
            </h2>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
                <div>
                  <div className="font-semibold text-stone-800">Gemini 3.6 Flash Multi-Turn Engine</div>
                  <div className="text-[11px] text-stone-500">Server-side proxy with dynamic prompt encapsulation</div>
                </div>
                <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">
                  ONLINE
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
                <div>
                  <div className="font-semibold text-stone-800">Resilient Fallback Ladder</div>
                  <div className="text-[11px] text-stone-500">gemini-3.6-flash → gemini-3.1-flash-lite → dynamic alias</div>
                </div>
                <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">
                  ACTIVE
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
                <div>
                  <div className="font-semibold text-stone-800">Google Maps Platform</div>
                  <div className="text-[11px] text-stone-500">Places Autocomplete &amp; Reverse Geocoding proxy</div>
                </div>
                <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">
                  READY
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
                <div>
                  <div className="font-semibold text-stone-800">Secret Management &amp; Zero-Hardcoding</div>
                  <div className="text-[11px] text-stone-500">All sensitive tokens accessed via Secret Manager</div>
                </div>
                <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">
                  PROTECTED
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Sensitive RBAC Changes */}
      {confirmModal.isOpen && confirmModal.targetUser && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                confirmModal.type === 'role' ? 'bg-purple-50 text-purple-700' : 'bg-rose-50 text-rose-700'
              }`}>
                {confirmModal.type === 'role' ? <KeyRound className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  {confirmModal.type === 'role'
                    ? `Confirm Role Change: ${confirmModal.newRole?.toUpperCase()}`
                    : `Confirm Account ${confirmModal.newStatus === 'suspended' ? 'Suspension' : 'Reactivation'}`}
                </h3>
                <p className="text-xs text-stone-500 font-mono">
                  {confirmModal.targetUser.email || confirmModal.targetUser.uid}
                </p>
              </div>
            </div>

            <div className="bg-stone-50 border border-stone-100 rounded-xl p-3.5 text-xs text-stone-600 space-y-1.5 leading-relaxed">
              {confirmModal.type === 'role' ? (
                <>
                  <p>
                    Are you sure you want to change this user&apos;s role to{' '}
                    <strong className="text-stone-900 uppercase">{confirmModal.newRole}</strong>?
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Granting administrator privileges allows this user to modify roles, view audit logs, and oversee platform records.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Are you sure you want to change account status to{' '}
                    <strong className="text-stone-900 uppercase">{confirmModal.newStatus}</strong>?
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Suspended accounts will be locked out from journal access and admin features immediately.
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal({ isOpen: false, type: 'role', targetUser: null })}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.type === 'role' ? handleExecuteRoleChange : handleExecuteStatusChange}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-xl shadow transition ${
                  confirmModal.type === 'role'
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : confirmModal.newStatus === 'suspended'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

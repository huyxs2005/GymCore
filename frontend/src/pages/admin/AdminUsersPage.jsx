import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Lock,
  MailCheck,
  MailX,
  PlusCircle,
  Search,
  ShieldCheck,
  Unlock,
  UserCog,
  UserRound,
  Users,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import PaginationControls from '../../components/common/PaginationControls'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { adminNav } from '../../config/navigation'
import { adminUserApi } from '../../features/users/api/adminUserApi'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { usePagination } from '../../hooks/usePagination'

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'COACH', label: 'Coach' },
  { value: 'RECEPTIONIST', label: 'Receptionist' },
]

const ROLE_FILTERS = [{ value: 'ALL', label: 'All staff roles' }, ...ROLE_OPTIONS]
const BOOLEAN_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
]
const INPUT_CLASS =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-gym-300'

function buildInitialForm() {
  return {
    fullName: '',
    email: '',
    phone: '',
    role: 'RECEPTIONIST',
    password: '',
    confirmPassword: '',
    active: true,
    dateOfBirth: '',
    gender: '',
    experienceYears: '',
    bio: '',
  }
}

function buildFormFromUser(user) {
  return {
    fullName: user?.fullName ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    role: user?.role ?? 'RECEPTIONIST',
    password: '',
    confirmPassword: '',
    active: Boolean(user?.active),
    dateOfBirth: user?.coachProfile?.dateOfBirth ?? '',
    gender: user?.coachProfile?.gender ?? '',
    experienceYears: user?.coachProfile?.experienceYears ?? '',
    bio: user?.coachProfile?.bio ?? '',
  }
}

function AdminUsersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [lockedFilter, setLockedFilter] = useState('all')
  const [activeFilter, setActiveFilter] = useState('all')
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [editorMode, setEditorMode] = useState(null)
  const [form, setForm] = useState(buildInitialForm())
  const [formError, setFormError] = useState('')
  const [lockDraft, setLockDraft] = useState(null)
  const [lockError, setLockError] = useState('')
  const [unlockDraft, setUnlockDraft] = useState(null)

  const filters = useMemo(() => ({
    q: search.trim() || undefined,
    role: roleFilter === 'ALL' ? undefined : roleFilter,
    locked: lockedFilter === 'all' ? undefined : lockedFilter,
    active: activeFilter === 'all' ? undefined : activeFilter,
  }), [activeFilter, lockedFilter, roleFilter, search])

  const usersQuery = useQuery({
    queryKey: ['admin-users', filters],
    queryFn: () => adminUserApi.getUsers(filters),
  })

  const items = usersQuery.data?.data?.items ?? []
  const {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems,
  } = usePagination(items, 10)
  const summary = usersQuery.data?.data?.summary ?? {}
  const selectedUser = items.find((user) => user.userId === selectedUserId) ?? null

  const upsertMutation = useMutation({
    mutationFn: (payload) => (
      payload.mode === 'create'
        ? adminUserApi.createStaff(payload.body)
        : adminUserApi.updateStaff(payload.userId, payload.body)
    ),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      const nextUser = response?.data?.user
      setSelectedUserId(nextUser?.userId ?? null)
      setEditorMode(null)
      setFormError('')
      toast.success(editorMode === 'create' ? 'Staff account created.' : 'Staff account updated.')
    },
    onError: (error) => {
      setFormError(error?.response?.data?.message || 'Staff account could not be saved.')
    },
  })

  const lockMutation = useMutation({
    mutationFn: ({ userId, reason }) => adminUserApi.lockUser(userId, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setLockDraft(null)
      setLockError('')
      toast.success('Staff account locked.')
    },
    onError: (error) => {
      setLockError(error?.response?.data?.message || 'Lock request failed.')
    },
  })

  const unlockMutation = useMutation({
    mutationFn: (userId) => adminUserApi.unlockUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setUnlockDraft(null)
      toast.success('Staff account unlocked.')
    },
    onError: (error) => {
      setFormError(error?.response?.data?.message || 'Unlock request failed.')
    },
  })

  const openCreate = () => {
    setEditorMode('create')
    setForm(buildInitialForm())
    setFormError('')
    setLockError('')
  }

  const openEdit = (user) => {
    setSelectedUserId(user.userId)
    setEditorMode('edit')
    setForm(buildFormFromUser(user))
    setFormError('')
    setLockError('')
  }

  const selectUser = (user) => {
    setSelectedUserId(user.userId)
    setEditorMode(null)
    setFormError('')
    setLockError('')
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const validationMessage = validateForm(form, editorMode)
    if (validationMessage) {
      setFormError(validationMessage)
      return
    }

    const payload = buildPayload(form, editorMode)
    upsertMutation.mutate({
      mode: editorMode,
      userId: selectedUserId,
      body: payload,
    })
  }

  const handleLockConfirm = () => {
    if (!lockDraft?.reason?.trim()) {
      setLockError('Lock reason is required.')
      return
    }
    lockMutation.mutate({ userId: lockDraft.user.userId, reason: lockDraft.reason })
  }

  return (
    <WorkspaceScaffold
      title="Admin User Management"
      subtitle="Create staff account and lock or unlock employee access."
      links={adminNav}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.95fr)]">
        <section className="gc-card-compact space-y-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Staff directory</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Employees only</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                This page manages employee accounts only. Customers are not created here and must remain customer-originated accounts.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <PlusCircle size={18} />
              New staff
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryCard label="Total staff" value={summary.totalStaff} icon={<Users size={18} />} tone="bg-gym-50 text-gym-700" />
            <SummaryCard label="Admins" value={summary.adminCount} icon={<ShieldCheck size={18} />} tone="bg-violet-50 text-violet-700" />
            <SummaryCard label="Coaches" value={summary.coachCount} icon={<UserCog size={18} />} tone="bg-blue-50 text-blue-700" />
            <SummaryCard label="Receptionists" value={summary.receptionistCount} icon={<UserRound size={18} />} tone="bg-emerald-50 text-emerald-700" />
            <SummaryCard label="Locked" value={summary.lockedCount} icon={<Lock size={18} />} tone="bg-rose-50 text-rose-700" />
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.7fr))]">
            <label className="relative">
              <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, email, or phone"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-gym-300"
              />
            </label>

            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-gym-300"
            >
              {ROLE_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <select
              value={lockedFilter}
              onChange={(event) => setLockedFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-gym-300"
            >
              <option value="all">All lock states</option>
              {BOOLEAN_FILTERS.slice(1).map((option) => (
                <option key={option.value} value={option.value}>{option.label === 'Yes' ? 'Locked' : 'Unlocked'}</option>
              ))}
            </select>

            <select
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-gym-300"
            >
              <option value="all">All active states</option>
              {BOOLEAN_FILTERS.slice(1).map((option) => (
                <option key={option.value} value={option.value}>{option.label === 'Yes' ? 'Active' : 'Inactive'}</option>
              ))}
            </select>
          </div>

          {usersQuery.error ? (
            <div className="rounded-3xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">
              {usersQuery.error?.response?.data?.message || 'Staff data could not be loaded.'}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-[28px] border border-slate-100 bg-white">
            <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_140px_110px_110px] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              <span>Staff</span>
              <span>Contact</span>
              <span>Role</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>

            <div className="divide-y divide-slate-100">
              {usersQuery.isLoading && !usersQuery.data ? (
                <div className="p-6 text-sm text-slate-500">Loading staff accounts...</div>
              ) : items.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">No staff accounts match the current filters.</div>
              ) : (
                paginatedItems.map((user) => (
                  <div
                    key={user.userId}
                    className={`grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_140px_110px_110px] gap-4 px-5 py-4 text-sm ${
                      selectedUserId === user.userId ? 'bg-gym-50/60' : 'bg-white'
                    }`}
                  >
                    <button type="button" className="text-left" onClick={() => selectUser(user)}>
                      <p className="font-bold text-slate-900">{user.fullName}</p>
                      <p className="mt-1 text-xs text-slate-500">ID #{user.userId}</p>
                    </button>
                    <div>
                      <p className="font-medium text-slate-700">{user.email}</p>
                      <p className="mt-1 text-xs text-slate-500">{user.phone || 'No phone'}</p>
                    </div>
                    <div className="flex items-start">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{formatRole(user.role)}</span>
                    </div>
                    <div className="space-y-1">
                      <StatusPill active={user.active} />
                      <LockPill locked={user.locked} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(user)}
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-gym-200 hover:text-gym-700"
                      >
                        Edit
                      </button>
                      {user.locked ? (
                        <button
                          type="button"
                          onClick={() => setUnlockDraft(user)}
                          className="rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                        >
                          Unlock
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setLockDraft({ user, reason: '' })}
                          className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                        >
                          Lock
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            className="pt-2"
          />
        </section>

        <aside className="gc-card-compact space-y-5">
          {editorMode ? (
            <>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Editor</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  {editorMode === 'create' ? 'Create staff account' : 'Update staff account'}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Customers are intentionally excluded. This form provisions only Admin, Coach, and Receptionist accounts.
                </p>
              </div>

              {formError ? (
                <div className="rounded-3xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">
                  {formError}
                </div>
              ) : null}

              <form className="space-y-4" onSubmit={handleSubmit}>
                <FormField label="Full name">
                  <input
                    value={form.fullName}
                    onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                    className={INPUT_CLASS}
                  />
                </FormField>

                <FormField label="Email">
                  <input
                    value={form.email}
                    readOnly={editorMode === 'edit'}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    className={`${INPUT_CLASS} disabled:bg-slate-50`}
                  />
                </FormField>

                <FormField label="Phone">
                  <input
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    className={INPUT_CLASS}
                  />
                </FormField>

                <FormField label="Role">
                  <select
                    value={form.role}
                    disabled={editorMode === 'edit'}
                    onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
                    className={`${INPUT_CLASS} disabled:bg-slate-50`}
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </FormField>

                {editorMode === 'create' ? (
                  <>
                    <FormField label="Temporary password">
                      <input
                        type="password"
                        value={form.password}
                        onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                        className={INPUT_CLASS}
                      />
                    </FormField>
                    <FormField label="Confirm password">
                      <input
                        type="password"
                        value={form.confirmPassword}
                        onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                        className={INPUT_CLASS}
                      />
                    </FormField>
                  </>
                ) : (
                  <label className="flex items-center justify-between rounded-3xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-sm font-medium text-slate-700">
                    <span>Active account</span>
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-gym-600 focus:ring-gym-500"
                    />
                  </label>
                )}

                {form.role === 'COACH' ? (
                  <div className="space-y-4 rounded-[28px] border border-blue-100 bg-blue-50/60 p-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Coach profile</p>
                      <p className="mt-1 text-sm text-blue-900">Coach accounts also create or update the linked coach profile.</p>
                    </div>

                    <FormField label="Date of birth">
                      <input
                        type="date"
                        value={form.dateOfBirth}
                        onChange={(event) => setForm((current) => ({ ...current, dateOfBirth: event.target.value }))}
                        className={INPUT_CLASS}
                      />
                    </FormField>

                    <FormField label="Gender">
                      <input
                        value={form.gender}
                        onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
                        className={INPUT_CLASS}
                      />
                    </FormField>

                    <FormField label="Experience years">
                      <input
                        type="number"
                        min="0"
                        value={form.experienceYears}
                        onChange={(event) => setForm((current) => ({ ...current, experienceYears: event.target.value }))}
                        className={INPUT_CLASS}
                      />
                    </FormField>

                    <FormField label="Bio">
                      <textarea
                        rows="4"
                        value={form.bio}
                        onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
                        className={`${INPUT_CLASS} resize-none`}
                      />
                    </FormField>
                  </div>
                ) : null}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditorMode(null)
                      setFormError('')
                    }}
                    className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={upsertMutation.isPending}
                    className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {upsertMutation.isPending ? 'Saving...' : editorMode === 'create' ? 'Create staff' : 'Save changes'}
                  </button>
                </div>
              </form>
            </>
          ) : selectedUser ? (
            <>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Staff detail</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">{selectedUser.fullName}</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Account detail, verification state, lock status, and coach metadata when applicable.
                </p>
              </div>

              {formError ? (
                <div className="rounded-3xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">
                  {formError}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <DetailCard label="Role" value={formatRole(selectedUser.role)} />
                <DetailCard label="Auth mode" value={selectedUser.authMode || 'UNKNOWN'} />
                <DetailCard label="Phone" value={selectedUser.phone || 'No phone'} />
                <DetailCard label="Created at" value={formatDateTime(selectedUser.createdAt)} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <InfoPill icon={selectedUser.emailVerified ? <MailCheck size={16} /> : <MailX size={16} />} label={selectedUser.emailVerified ? 'Email verified' : 'Email not verified'} />
                <InfoPill icon={selectedUser.locked ? <Lock size={16} /> : <Unlock size={16} />} label={selectedUser.locked ? 'Locked account' : 'Unlocked account'} />
              </div>

              {selectedUser.role === 'COACH' ? (
                <div className="rounded-[28px] border border-blue-100 bg-blue-50/60 p-4">
                  <h3 className="text-sm font-bold text-blue-900">Coach profile</h3>
                  <dl className="mt-3 space-y-2 text-sm text-blue-900">
                    <div className="flex justify-between gap-4"><dt>Date of birth</dt><dd>{selectedUser.coachProfile?.dateOfBirth || '--'}</dd></div>
                    <div className="flex justify-between gap-4"><dt>Gender</dt><dd>{selectedUser.coachProfile?.gender || '--'}</dd></div>
                    <div className="flex justify-between gap-4"><dt>Experience</dt><dd>{selectedUser.coachProfile?.experienceYears ?? '--'}</dd></div>
                    <div className="space-y-1"><dt>Bio</dt><dd className="text-blue-800/80">{selectedUser.coachProfile?.bio || 'No bio provided.'}</dd></div>
                  </dl>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => openEdit(selectedUser)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-gym-200 hover:text-gym-700"
                >
                  Edit account
                </button>
                {selectedUser.locked ? (
                  <button
                    type="button"
                    onClick={() => setUnlockDraft(selectedUser)}
                    className="rounded-2xl border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                  >
                    Unlock account
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setLockDraft({ user: selectedUser, reason: '' })}
                    className="rounded-2xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                  >
                    Lock account
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-white text-gym-600 shadow-sm">
                <Users size={24} />
              </span>
              <h2 className="mt-5 text-xl font-bold text-slate-900">Select a staff account</h2>
              <p className="mt-2 max-w-sm text-sm text-slate-500">
                Pick an employee from the list to manage the account, or create a new Admin, Coach, or Receptionist profile.
              </p>
            </div>
          )}
        </aside>
      </div>

      {lockDraft ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Lock account</p>
              <h2 className="text-xl font-bold text-slate-900">{lockDraft.user.fullName}</h2>
              <p className="text-sm text-slate-600">
                Locking blocks password access immediately. Provide a reason so the state is explicit in the admin record.
              </p>
            </div>

            <label className="mt-5 block space-y-2 text-sm font-medium text-slate-700">
              <span>Lock reason</span>
              <textarea
                rows="4"
                value={lockDraft.reason}
                onChange={(event) => {
                  setLockDraft((current) => ({ ...current, reason: event.target.value }))
                  setLockError('')
                }}
                className={`${INPUT_CLASS} resize-none`}
              />
            </label>

            {lockError ? (
              <div className="mt-4 rounded-3xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">
                {lockError}
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setLockDraft(null)
                  setLockError('')
                }}
                className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLockConfirm}
                disabled={lockMutation.isPending}
                className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {lockMutation.isPending ? 'Locking...' : 'Confirm lock'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(unlockDraft)}
        title="Unlock staff account"
        description={`Restore access for ${unlockDraft?.fullName || 'this staff account'}?`}
        confirmLabel="Unlock account"
        tone="neutral"
        pending={unlockMutation.isPending}
        onConfirm={() => unlockDraft && unlockMutation.mutate(unlockDraft.userId)}
        onCancel={() => setUnlockDraft(null)}
      />
    </WorkspaceScaffold>
  )
}

function SummaryCard({ label, value, icon, tone }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{value ?? 0}</p>
        </div>
        <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}>
          {icon}
        </span>
      </div>
    </div>
  )
}

function FormField({ label, children }) {
  return (
    <label className="block space-y-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  )
}

function DetailCard({ label, value }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function InfoPill({ icon, label }) {
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-slate-100 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
        {icon}
      </span>
      <span>{label}</span>
    </div>
  )
}

function StatusPill({ active }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${
      active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
    }`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function LockPill({ locked }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${
      locked ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
    }`}>
      {locked ? 'Locked' : 'Open'}
    </span>
  )
}

function validateForm(form, mode) {
  if (!form.fullName.trim()) return 'Full name is required.'
  if (!form.email.trim()) return 'Email is required.'
  if (!form.phone.trim()) return 'Phone number is required.'
  if (!['ADMIN', 'COACH', 'RECEPTIONIST'].includes(form.role)) {
    return 'Customers cannot be created from admin users.'
  }
  if (mode === 'create') {
    if (!form.password) return 'Temporary password is required.'
    if (form.password !== form.confirmPassword) return 'Password confirmation does not match.'
  }
  return ''
}

function buildPayload(form, mode) {
  const payload = {
    fullName: form.fullName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    role: form.role,
  }

  if (mode === 'create') {
    payload.password = form.password
    payload.confirmPassword = form.confirmPassword
  } else {
    payload.active = Boolean(form.active)
  }

  if (form.role === 'COACH') {
    payload.dateOfBirth = form.dateOfBirth || null
    payload.gender = form.gender.trim() || null
    payload.experienceYears = form.experienceYears === '' ? null : Number(form.experienceYears)
    payload.bio = form.bio.trim() || null
  }

  return payload
}

function formatRole(role) {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label || role
}

function formatDateTime(value) {
  if (!value) return '--'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return String(value)
  }
}

export default AdminUsersPage

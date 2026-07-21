import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  UserPlus, Trash2, KeyRound, Pencil, ShieldCheck, User,
  AlertCircle, Eye, EyeOff, Users
} from "lucide-react";

interface SafeUser {
  id: number;
  username: string;
  name: string | null;
  role: string | null;
  createdAt: string;
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SafeUser | null>(null);

  // Add user form state
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [addError, setAddError] = useState("");

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editRole, setEditRole] = useState("user");
  const [editError, setEditError] = useState("");

  // Password change form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [pwdError, setPwdError] = useState("");

  const { data: users = [], isLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; name: string; role: string }) => {
      const res = await apiRequest("POST", "/api/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setAddDialogOpen(false);
      setNewUsername(""); setNewPassword(""); setNewName(""); setNewRole("user"); setAddError("");
      toast({ title: "Account created", description: "New user has been added successfully." });
    },
    onError: (e: Error) => setAddError(e.message),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, string> }) => {
      const res = await apiRequest("PATCH", `/api/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditDialogOpen(false);
      setEditError("");
      toast({ title: "Account updated", description: "User details have been saved." });
    },
    onError: (e: Error) => setEditError(e.message),
  });

  const passwordMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, string> }) => {
      const res = await apiRequest("POST", `/api/users/${id}/change-password`, data);
      return res.json();
    },
    onSuccess: () => {
      setPasswordDialogOpen(false);
      setCurrentPassword(""); setNewPwd(""); setConfirmPwd(""); setPwdError("");
      toast({ title: "Password changed", description: "Password has been updated successfully." });
    },
    onError: (e: Error) => setPwdError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/users/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      toast({ title: "Account deleted", description: "User has been removed." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openEdit(u: SafeUser) {
    setSelectedUser(u);
    setEditName(u.name || "");
    setEditUsername(u.username);
    setEditRole(u.role || "user");
    setEditError("");
    setEditDialogOpen(true);
  }

  function openPassword(u: SafeUser) {
    setSelectedUser(u);
    setCurrentPassword(""); setNewPwd(""); setConfirmPwd(""); setPwdError("");
    setPasswordDialogOpen(true);
  }

  function openDelete(u: SafeUser) {
    setSelectedUser(u);
    setDeleteDialogOpen(true);
  }

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAddError("");
    if (!newUsername.trim()) { setAddError("Username is required"); return; }
    if (!newPassword) { setAddError("Password is required"); return; }
    if (newPassword.length < 6) { setAddError("Password must be at least 6 characters"); return; }
    createMutation.mutate({ username: newUsername.trim(), password: newPassword, name: newName.trim(), role: newRole });
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    setEditError("");
    if (!editUsername.trim()) { setEditError("Username is required"); return; }
    editMutation.mutate({ id: selectedUser.id, data: { username: editUsername.trim(), name: editName.trim(), role: editRole } });
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    setPwdError("");
    if (!newPwd) { setPwdError("New password is required"); return; }
    if (newPwd.length < 6) { setPwdError("Password must be at least 6 characters"); return; }
    if (newPwd !== confirmPwd) { setPwdError("Passwords do not match"); return; }
    const payload: Record<string, string> = { newPassword: newPwd };
    if (selectedUser.id === currentUser?.id) payload.currentPassword = currentPassword;
    passwordMutation.mutate({ id: selectedUser.id, data: payload });
  }

  const isOwnAccount = (u: SafeUser) => u.id === currentUser?.id;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Account Management</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Create and manage user accounts and passwords</p>
          </div>
        </div>
        <Button onClick={() => { setAddError(""); setAddDialogOpen(true); }} data-testid="button-add-user">
          <UserPlus className="h-4 w-4 mr-2" />
          Add Account
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Accounts</CardTitle>
          <CardDescription>{users.length} account{users.length !== 1 ? "s" : ""} registered</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 text-sm">No accounts yet</div>
          ) : (
            <div className="divide-y divide-border">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between px-6 py-4 flex-wrap gap-3" data-testid={`row-user-${u.id}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      {u.role === "admin"
                        ? <ShieldCheck className="h-4 w-4 text-primary" />
                        : <User className="h-4 w-4 text-primary" />
                      }
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground">{u.name || u.username}</span>
                        {isOwnAccount(u) && (
                          <Badge variant="secondary" className="text-xs">You</Badge>
                        )}
                        <Badge variant={u.role === "admin" ? "default" : "outline"} className="text-xs capitalize">
                          {u.role || "user"}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">@{u.username}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(u)}
                      data-testid={`button-edit-user-${u.id}`}
                    >
                      <Pencil className="h-3 w-3 mr-1.5" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPassword(u)}
                      data-testid={`button-password-user-${u.id}`}
                    >
                      <KeyRound className="h-3 w-3 mr-1.5" />
                      Password
                    </Button>
                    {!isOwnAccount(u) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDelete(u)}
                        className="text-destructive border-destructive/30 hover:bg-destructive/5"
                        data-testid={`button-delete-user-${u.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Account Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Account</DialogTitle>
            <DialogDescription>Create a new user account with login credentials.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSubmit}>
            <div className="space-y-4 py-2">
              {addError && (
                <Alert variant="destructive" className="text-sm py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{addError}</AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="add-name">Full Name</Label>
                  <Input id="add-name" placeholder="Jane Smith" value={newName} onChange={e => setNewName(e.target.value)} data-testid="input-add-name" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="add-username">Username <span className="text-destructive">*</span></Label>
                  <Input id="add-username" placeholder="jsmith" value={newUsername} onChange={e => setNewUsername(e.target.value)} autoComplete="off" data-testid="input-add-username" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-password">Password <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    id="add-password"
                    type={showNewPwd ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                    data-testid="input-add-password"
                  />
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowNewPwd(!showNewPwd)}>
                    {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger data-testid="select-add-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-add-user-submit">
                {createMutation.isPending ? "Creating..." : "Create Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>Update the details for {selectedUser?.username}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <div className="space-y-4 py-2">
              {editError && (
                <Alert variant="destructive" className="text-sm py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{editError}</AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-name">Full Name</Label>
                  <Input id="edit-name" value={editName} onChange={e => setEditName(e.target.value)} data-testid="input-edit-name" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-username">Username <span className="text-destructive">*</span></Label>
                  <Input id="edit-username" value={editUsername} onChange={e => setEditUsername(e.target.value)} autoComplete="off" data-testid="input-edit-username" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger data-testid="select-edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={editMutation.isPending} data-testid="button-edit-user-submit">
                {editMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              {isOwnAccount(selectedUser!)
                ? "Enter your current password then choose a new one."
                : `Set a new password for ${selectedUser?.username}.`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit}>
            <div className="space-y-4 py-2">
              {pwdError && (
                <Alert variant="destructive" className="text-sm py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{pwdError}</AlertDescription>
                </Alert>
              )}
              {selectedUser && isOwnAccount(selectedUser) && (
                <div className="space-y-1.5">
                  <Label htmlFor="current-pwd">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current-pwd"
                      type={showPwd ? "text" : "password"}
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                      className="pr-10"
                      data-testid="input-current-password"
                    />
                    <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPwd(!showPwd)}>
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="new-pwd">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-pwd"
                    type={showPwd ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    value={newPwd}
                    onChange={e => setNewPwd(e.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                    data-testid="input-new-password"
                  />
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPwd(!showPwd)}>
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-pwd">Confirm New Password</Label>
                <Input
                  id="confirm-pwd"
                  type={showPwd ? "text" : "password"}
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  autoComplete="new-password"
                  data-testid="input-confirm-new-password"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={passwordMutation.isPending} data-testid="button-change-password-submit">
                {passwordMutation.isPending ? "Updating..." : "Update Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the account for <strong>{selectedUser?.name || selectedUser?.username}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => selectedUser && deleteMutation.mutate(selectedUser.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-delete-user-confirm"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

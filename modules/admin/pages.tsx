import { Check, ArrowUp, ArrowDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isOwner, listUsers } from "@/lib/access";
import {
  setAccess,
  addUser,
  setRole,
  setUserDisabled,
  setModuleEnabled,
  renameModule,
  moveModule,
} from "./actions";
import { ConfirmDeleteUser } from "./confirm-delete-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// The management surface — users, modules, and the access grid. Owner-only.
export async function AdminModule() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isOwner(supabase, user.id))) {
    return <p className="text-sm text-muted-foreground">Owners only.</p>;
  }

  const users = await listUsers(supabase);
  const { data: modules } = await supabase
    .from("core_modules")
    .select("id, name, enabled, sort_order")
    .order("sort_order", { ascending: true });
  const mods = modules ?? [];
  const { data: grants } = await supabase
    .from("core_user_modules")
    .select("user_id, module_id");
  const grantedSet = new Set(
    (grants ?? []).map((g) => `${g.user_id}:${g.module_id}`),
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your people, your tools, and who can see what.
        </p>
      </div>

      {/* ===== Users ===== */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">Users</h2>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Add a user</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={addUser} className="flex flex-wrap items-end gap-3">
              <div className="min-w-48 flex-1 space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required placeholder="person@company.com" />
              </div>
              <div className="min-w-48 flex-1 space-y-1.5">
                <Label htmlFor="password">Temporary password</Label>
                <Input id="password" name="password" type="text" required minLength={6} placeholder="they change it later" />
              </div>
              <SubmitButton pendingText="Adding…">Add user</SubmitButton>
            </form>
            <p className="mt-2 text-xs text-muted-foreground">
              Creates the account immediately (no email) — share the temporary password with them.
            </p>
          </CardContent>
        </Card>

        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const isSelf = u.id === user.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.full_name ?? u.id.slice(0, 8)}
                      {isSelf ? <span className="text-muted-foreground"> (you)</span> : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "owner" ? "default" : "secondary"}>{u.role}</Badge>
                    </TableCell>
                    <TableCell>
                      {u.disabled ? (
                        <Badge variant="destructive">disabled</Badge>
                      ) : (
                        <Badge variant="outline">active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {isSelf ? (
                        <span className="block text-right text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap justify-end gap-2">
                          <form action={setRole}>
                            <input type="hidden" name="user_id" value={u.id} />
                            <input type="hidden" name="role" value={u.role === "owner" ? "member" : "owner"} />
                            <SubmitButton variant="outline" size="sm">
                              {u.role === "owner" ? "Make member" : "Make owner"}
                            </SubmitButton>
                          </form>
                          <form action={setUserDisabled}>
                            <input type="hidden" name="user_id" value={u.id} />
                            <input type="hidden" name="disabled" value={u.disabled ? "0" : "1"} />
                            <SubmitButton variant="outline" size="sm">
                              {u.disabled ? "Enable" : "Disable"}
                            </SubmitButton>
                          </form>
                          <ConfirmDeleteUser userId={u.id} label={u.full_name ?? u.email ?? "this user"} />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* ===== Modules ===== */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">Modules</h2>
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mods.map((m, idx) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <form action={renameModule} className="flex items-center gap-2">
                      <input type="hidden" name="module_id" value={m.id} />
                      <Input name="name" defaultValue={m.name} className="h-8 w-40" />
                      <SubmitButton variant="outline" size="sm">Rename</SubmitButton>
                    </form>
                    <span className="mt-1 block text-xs text-muted-foreground">{m.id}</span>
                  </TableCell>
                  <TableCell>
                    {m.enabled ? (
                      <Badge variant="secondary">on</Badge>
                    ) : (
                      <Badge variant="outline">off</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-2">
                      <form action={setModuleEnabled}>
                        <input type="hidden" name="module_id" value={m.id} />
                        <input type="hidden" name="enabled" value={m.enabled ? "0" : "1"} />
                        <SubmitButton variant="outline" size="sm">
                          {m.enabled ? "Disable" : "Enable"}
                        </SubmitButton>
                      </form>
                      <form action={moveModule}>
                        <input type="hidden" name="module_id" value={m.id} />
                        <input type="hidden" name="dir" value="up" />
                        <SubmitButton variant="outline" size="icon-sm" disabled={idx === 0} aria-label="Move up">
                          <ArrowUp />
                        </SubmitButton>
                      </form>
                      <form action={moveModule}>
                        <input type="hidden" name="module_id" value={m.id} />
                        <input type="hidden" name="dir" value="down" />
                        <SubmitButton variant="outline" size="icon-sm" disabled={idx === mods.length - 1} aria-label="Move down">
                          <ArrowDown />
                        </SubmitButton>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* ===== Access ===== */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">Access</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Who can see which module. Changes apply on their next page load.
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                {mods.map((m) => (
                  <TableHead key={m.id} className="text-center">{m.name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.full_name ?? u.email ?? u.id.slice(0, 8)}
                    <span className="text-muted-foreground"> ({u.role})</span>
                  </TableCell>
                  {mods.map((m) => {
                    const on = grantedSet.has(`${u.id}:${m.id}`);
                    return (
                      <TableCell key={m.id} className="text-center">
                        <form action={setAccess} className="inline-flex">
                          <input type="hidden" name="user_id" value={u.id} />
                          <input type="hidden" name="module_id" value={m.id} />
                          <input type="hidden" name="grant" value={on ? "0" : "1"} />
                          <SubmitButton
                            variant={on ? "default" : "outline"}
                            size="icon-sm"
                            aria-label={`${on ? "Revoke" : "Grant"} ${m.name}`}
                          >
                            {on ? <Check /> : null}
                          </SubmitButton>
                        </form>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

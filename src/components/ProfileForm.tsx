import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal } from "./ui";
import type { TunnelProfile, ProfileFormData } from "../types";
import { DEFAULT_FORM_DATA } from "../types";

const tunnelSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  notes: z.string().optional(),
  websiteUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  sshHost: z.string().min(1, "SSH Host is required"),
  sshPort: z.coerce.number().min(1, "Port must be > 0").max(65535, "Port must be ≤ 65535"),
  username: z.string().min(1, "Username is required"),
  authType: z.enum(["PASSWORD", "SSH_KEY"]),
  rememberPassword: z.boolean(),
  hasStoredPassword: z.boolean().optional(),
  password: z.string().optional(),
  privateKeyPath: z.string().optional(),
  passphrase: z.string().optional(),
  mode: z.enum(["LOCAL", "REMOTE", "DYNAMIC"]),
  localBindHost: z.string().optional(),
  localPort: z.coerce.number().min(1).max(65535).optional(),
  remoteHost: z.string().optional(),
  remotePort: z.coerce.number().min(1).max(65535).optional(),
  remoteBindHost: z.string().optional(),
  localTargetHost: z.string().optional(),
  localTargetPort: z.coerce.number().min(1).max(65535).optional(),
  autoReconnect: z.boolean().optional(),
  openUrlAfterStart: z.boolean().optional(),
}).superRefine((values, ctx) => {
  if (values.authType === "SSH_KEY" && !values.privateKeyPath?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["privateKeyPath"], message: "Required" });
  }
  if (values.mode === "LOCAL") {
    if (!values.localPort) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["localPort"], message: "Required" });
    if (!values.remoteHost?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["remoteHost"], message: "Required" });
    if (!values.remotePort) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["remotePort"], message: "Required" });
  }
  if (values.mode === "REMOTE") {
    if (!values.remotePort) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["remotePort"], message: "Required" });
    if (!values.localTargetHost?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["localTargetHost"], message: "Required" });
    if (!values.localTargetPort) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["localTargetPort"], message: "Required" });
  }
  if (values.mode === "DYNAMIC" && !values.localPort) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["localPort"], message: "Required" });
  }
});

type TunnelFormValues = z.infer<typeof tunnelSchema>;

interface ProfileFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (profile: ProfileFormData) => void;
  initialData?: TunnelProfile;
}

export function ProfileForm({ open, onClose, onSave, initialData }: ProfileFormProps) {
  const isEditing = !!initialData;
  const [showAdvanced, setShowAdvanced] = useState(false);

  const form = useForm<TunnelFormValues>({
    resolver: zodResolver(tunnelSchema),
    defaultValues: initialData
      ? {
          name: initialData.name,
          notes: initialData.notes || "",
          websiteUrl: initialData.websiteUrl || "",
          sshHost: initialData.sshHost,
          sshPort: initialData.sshPort,
          username: initialData.username,
          authType: initialData.authType,
          rememberPassword: initialData.rememberPassword ?? true,
          hasStoredPassword: initialData.hasStoredPassword ?? false,
          password: "",
          privateKeyPath: initialData.privateKeyPath || "",
          passphrase: "",
          mode: initialData.mode,
          localBindHost: initialData.localBindHost || "127.0.0.1",
          localPort: initialData.localPort,
          remoteHost: initialData.remoteHost || "",
          remotePort: initialData.remotePort,
          remoteBindHost: initialData.remoteBindHost || "",
          localTargetHost: initialData.localTargetHost || "",
          localTargetPort: initialData.localTargetPort,
          autoReconnect: initialData.autoReconnect ?? false,
          openUrlAfterStart: initialData.openUrlAfterStart ?? false,
        }
      : DEFAULT_FORM_DATA,
  });

  useEffect(() => {
    if (open && initialData) {
      form.reset({
        name: initialData.name,
        notes: initialData.notes || "",
        websiteUrl: initialData.websiteUrl || "",
        sshHost: initialData.sshHost,
        sshPort: initialData.sshPort,
        username: initialData.username,
        authType: initialData.authType,
        rememberPassword: initialData.rememberPassword ?? true,
        hasStoredPassword: initialData.hasStoredPassword ?? false,
        password: "",
        privateKeyPath: initialData.privateKeyPath || "",
        passphrase: "",
        mode: initialData.mode,
        localBindHost: initialData.localBindHost || "127.0.0.1",
        localPort: initialData.localPort,
        remoteHost: initialData.remoteHost || "",
        remotePort: initialData.remotePort,
        remoteBindHost: initialData.remoteBindHost || "",
        localTargetHost: initialData.localTargetHost || "",
        localTargetPort: initialData.localTargetPort,
        autoReconnect: initialData.autoReconnect ?? false,
        openUrlAfterStart: initialData.openUrlAfterStart ?? false,
      });
    } else if (open) {
      form.reset(DEFAULT_FORM_DATA);
    }
  }, [open, initialData, form]);

  const handleSubmit = (values: TunnelFormValues) => {
    onSave({
      ...values,
      sshHost: values.sshHost.trim(),
      username: values.username.trim(),
      privateKeyPath: values.privateKeyPath?.trim() || undefined,
      remoteHost: values.remoteHost?.trim() || undefined,
      remoteBindHost: values.remoteBindHost?.trim() || undefined,
      localTargetHost: values.localTargetHost?.trim() || undefined,
      localBindHost: values.localBindHost?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
      websiteUrl: values.websiteUrl?.trim() || undefined,
      password: values.password || undefined,
      passphrase: values.passphrase || undefined,
    } as ProfileFormData);
    onClose();
  };

  const watchMode = form.watch("mode");
  const watchAuthType = form.watch("authType");

  return (
    <Modal open={open} onClose={onClose} size="xl" showClose={false}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col h-full max-h-[90vh]">
        {/* Modal Header */}
        <header className="px-8 py-6 flex items-center justify-between border-b border-outline-variant/40 bg-surface-container-highest/30 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">add_link</span>
            </div>
            <div>
              <h2 className="font-headline text-xl font-bold text-on-surface">
                {isEditing ? "Edit SSH Profile" : "Create New SSH Profile"}
              </h2>
              <p className="text-[13px] text-on-surface-variant font-label">Configure a secure tunnel architecture</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-variant transition-colors text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </header>

        {/* Modal Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10 no-scrollbar">
          
          {/* Section: Basic Info */}
          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-6 bg-primary rounded-full"></span>
              <h3 className="font-headline text-lg font-semibold text-on-surface">Basic Info</h3>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-1 flex flex-col gap-2">
                <label className="text-on-surface-variant text-[13px] font-medium px-1">Profile Name</label>
                <input 
                  {...form.register("name")}
                  className={`bg-surface-container-highest border-none rounded-md px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/30 outline-none transition-all ${form.formState.errors.name ? 'ring-2 ring-error' : ''}`} 
                  placeholder="e.g. Production Cluster" 
                  type="text" 
                />
              </div>
              <div className="col-span-1 flex flex-col gap-2">
                <label className="text-on-surface-variant text-[13px] font-medium px-1">Website URL</label>
                <input 
                  {...form.register("websiteUrl")}
                  className="bg-surface-container-highest border-none rounded-md px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/30 outline-none transition-all" 
                  placeholder="https://app.tunnelarch.com" 
                  type="url" 
                />
              </div>
              <div className="col-span-2 flex flex-col gap-2">
                <label className="text-on-surface-variant text-[13px] font-medium px-1">Notes</label>
                <textarea 
                  {...form.register("notes")}
                  className="bg-surface-container-highest border-none rounded-md px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/30 outline-none transition-all resize-none" 
                  placeholder="Optional description for this connection..." 
                  rows={3}
                ></textarea>
              </div>
            </div>
          </section>

          {/* Section: SSH Connection */}
          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-6 bg-primary rounded-full"></span>
              <h3 className="font-headline text-lg font-semibold text-on-surface">SSH Connection</h3>
            </div>
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-9 flex flex-col gap-2">
                <label className="text-on-surface-variant text-[13px] font-medium px-1">Host</label>
                <input 
                  {...form.register("sshHost")}
                  className={`bg-surface-container-highest border-none rounded-md px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/30 outline-none transition-all ${form.formState.errors.sshHost ? 'ring-2 ring-error' : ''}`}
                  placeholder="ssh.production.server.com" 
                  type="text" 
                />
              </div>
              <div className="col-span-3 flex flex-col gap-2">
                <label className="text-on-surface-variant text-[13px] font-medium px-1">Port</label>
                <input 
                  {...form.register("sshPort")}
                  className="bg-surface-container-highest border-none rounded-md px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/30 outline-none transition-all" 
                  type="number" 
                />
              </div>
              <div className="col-span-6 flex flex-col gap-2">
                <label className="text-on-surface-variant text-[13px] font-medium px-1">Username</label>
                <input 
                  {...form.register("username")}
                  className={`bg-surface-container-highest border-none rounded-md px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/30 outline-none transition-all ${form.formState.errors.username ? 'ring-2 ring-error' : ''}`}
                  placeholder="ubuntu" 
                  type="text" 
                />
              </div>
              <div className="col-span-6 flex flex-col gap-2">
                <label className="text-on-surface-variant text-[13px] font-medium px-1">Authentication</label>
                <div className="relative">
                  <select 
                    {...form.register("authType")}
                    className="w-full bg-surface-container-highest border-none rounded-md px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/30 outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="SSH_KEY">SSH Key</option>
                    <option value="PASSWORD">Password</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">expand_more</span>
                </div>
              </div>
              
              {watchAuthType === "SSH_KEY" ? (
                <>
                  <div className="col-span-12 flex flex-col gap-2">
                    <label className="text-on-surface-variant text-[13px] font-medium px-1">Private Key Path</label>
                    <div className="relative group">
                      <input 
                        {...form.register("privateKeyPath")}
                        className={`w-full bg-surface-container-highest border-none rounded-md px-4 py-3 pr-12 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/30 outline-none transition-all ${form.formState.errors.privateKeyPath ? 'ring-2 ring-error' : ''}`}
                        placeholder="~/.ssh/id_rsa" 
                        type="text" 
                      />
                      {/* Optional: Hook up file picker to this button later */}
                      <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-surface-bright rounded-md transition-colors text-primary">
                        <span className="material-symbols-outlined">folder_open</span>
                      </button>
                    </div>
                  </div>
                  <div className="col-span-12 flex flex-col gap-2">
                    <label className="text-on-surface-variant text-[13px] font-medium px-1">Passphrase</label>
                    <input 
                      {...form.register("passphrase")}
                      className="bg-surface-container-highest border-none rounded-md px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/30 outline-none transition-all" 
                      placeholder="••••••••••••" 
                      type="password" 
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="col-span-12 flex flex-col gap-2">
                    <label className="text-on-surface-variant text-[13px] font-medium px-1">Password</label>
                    <input 
                      {...form.register("password")}
                      className="bg-surface-container-highest border-none rounded-md px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/30 outline-none transition-all" 
                      placeholder="••••••••••••" 
                      type="password" 
                    />
                  </div>
                  <div className="col-span-12 flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-[13px] text-on-surface-variant cursor-pointer select-none">
                      <input
                        type="checkbox"
                        {...form.register("rememberPassword")}
                        className="accent-primary w-4 h-4 rounded border-white/20 bg-surface-container-highest"
                      />
                      Remember password in secure keychain
                    </label>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Section: Tunnel Settings */}
          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-6 bg-primary rounded-full"></span>
              <h3 className="font-headline text-lg font-semibold text-on-surface">Tunnel Architecture</h3>
            </div>
            
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 flex flex-col gap-2">
                <label className="text-on-surface-variant text-[13px] font-medium px-1">Forwarding Mode</label>
                <div className="relative">
                  <select 
                    {...form.register("mode")}
                    className="w-full bg-surface-container-highest border-none rounded-md px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/30 outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="LOCAL">Local Forwarding (-L)</option>
                    <option value="REMOTE">Remote Forwarding (-R)</option>
                    <option value="DYNAMIC">Dynamic Forwarding (-D)</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">expand_more</span>
                </div>
              </div>

              {watchMode === "LOCAL" && (
                <>
                  <div className="col-span-6 flex flex-col gap-2">
                    <label className="text-on-surface-variant text-[13px] font-medium px-1">Local Port</label>
                    <input 
                      {...form.register("localPort")}
                      className={`bg-surface-container-highest border-none rounded-md px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/30 outline-none transition-all ${form.formState.errors.localPort ? 'ring-2 ring-error' : ''}`}
                      type="number" 
                      placeholder="8080"
                    />
                  </div>
                  <div className="col-span-6 flex flex-col gap-2">
                    <label className="text-on-surface-variant text-[13px] font-medium px-1">Local Bind Host</label>
                    <input 
                      {...form.register("localBindHost")}
                      className="bg-surface-container-highest border-none rounded-md px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                      type="text" 
                      placeholder="127.0.0.1"
                    />
                  </div>
                  <div className="col-span-9 flex flex-col gap-2">
                    <label className="text-on-surface-variant text-[13px] font-medium px-1">Remote Target Host</label>
                    <input 
                      {...form.register("remoteHost")}
                      className={`bg-surface-container-highest border-none rounded-md px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/30 outline-none transition-all ${form.formState.errors.remoteHost ? 'ring-2 ring-error' : ''}`}
                      type="text" 
                      placeholder="database.internal"
                    />
                  </div>
                  <div className="col-span-3 flex flex-col gap-2">
                    <label className="text-on-surface-variant text-[13px] font-medium px-1">Target Port</label>
                    <input 
                      {...form.register("remotePort")}
                      className={`bg-surface-container-highest border-none rounded-md px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/30 outline-none transition-all ${form.formState.errors.remotePort ? 'ring-2 ring-error' : ''}`}
                      type="number" 
                      placeholder="5432"
                    />
                  </div>
                </>
              )}

              {watchMode === "REMOTE" && (
                <>
                  <div className="col-span-9 flex flex-col gap-2">
                    <label className="text-on-surface-variant text-[13px] font-medium px-1">Remote Bind Host (Optional)</label>
                    <input 
                      {...form.register("remoteBindHost")}
                      className="bg-surface-container-highest border-none rounded-md px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                      type="text" 
                      placeholder="0.0.0.0"
                    />
                  </div>
                  <div className="col-span-3 flex flex-col gap-2">
                    <label className="text-on-surface-variant text-[13px] font-medium px-1">Remote Port</label>
                    <input 
                      {...form.register("remotePort")}
                      className={`bg-surface-container-highest border-none rounded-md px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/30 outline-none transition-all ${form.formState.errors.remotePort ? 'ring-2 ring-error' : ''}`}
                      type="number" 
                      placeholder="8080"
                    />
                  </div>
                  <div className="col-span-9 flex flex-col gap-2">
                    <label className="text-on-surface-variant text-[13px] font-medium px-1">Local Target Host</label>
                    <input 
                      {...form.register("localTargetHost")}
                      className={`bg-surface-container-highest border-none rounded-md px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/30 outline-none transition-all ${form.formState.errors.localTargetHost ? 'ring-2 ring-error' : ''}`}
                      type="text" 
                      placeholder="localhost"
                    />
                  </div>
                  <div className="col-span-3 flex flex-col gap-2">
                    <label className="text-on-surface-variant text-[13px] font-medium px-1">Local Port</label>
                    <input 
                      {...form.register("localTargetPort")}
                      className={`bg-surface-container-highest border-none rounded-md px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/30 outline-none transition-all ${form.formState.errors.localTargetPort ? 'ring-2 ring-error' : ''}`}
                      type="number" 
                      placeholder="3000"
                    />
                  </div>
                </>
              )}

              {watchMode === "DYNAMIC" && (
                <>
                  <div className="col-span-9 flex flex-col gap-2">
                    <label className="text-on-surface-variant text-[13px] font-medium px-1">Local Bind Host</label>
                    <input 
                      {...form.register("localBindHost")}
                      className="bg-surface-container-highest border-none rounded-md px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                      type="text" 
                      placeholder="127.0.0.1"
                    />
                  </div>
                  <div className="col-span-3 flex flex-col gap-2">
                    <label className="text-on-surface-variant text-[13px] font-medium px-1">Local Port</label>
                    <input 
                      {...form.register("localPort")}
                      className={`bg-surface-container-highest border-none rounded-md px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/30 outline-none transition-all ${form.formState.errors.localPort ? 'ring-2 ring-error' : ''}`}
                      type="number" 
                      placeholder="1080"
                    />
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Advanced Toggles */}
          <section className="space-y-6">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors font-medium"
            >
              <span className={`material-symbols-outlined text-lg transition-transform ${showAdvanced ? "rotate-180" : ""}`}>
                expand_more
              </span>
              Advanced Settings
            </button>
            
            {showAdvanced && (
              <div className="grid grid-cols-12 gap-6 pt-2">
                <div className="col-span-6 flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-[13px] text-on-surface-variant cursor-pointer select-none">
                    <input
                      type="checkbox"
                      {...form.register("autoReconnect")}
                      className="accent-primary w-4 h-4 rounded border-white/20 bg-surface-container-highest"
                    />
                    Auto Reconnect on disconnect
                  </label>
                </div>
                <div className="col-span-6 flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-[13px] text-on-surface-variant cursor-pointer select-none">
                    <input
                      type="checkbox"
                      {...form.register("openUrlAfterStart")}
                      className="accent-primary w-4 h-4 rounded border-white/20 bg-surface-container-highest"
                    />
                    Open URL in browser after start
                  </label>
                </div>
              </div>
            )}
          </section>

          {/* Information Note */}
          <div className="bg-primary/5 p-4 rounded-md border border-primary/10 flex gap-4 mt-6">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
            <p className="text-[13px] text-on-surface-variant leading-relaxed">
              Security Notice: All private keys and passphrases are encrypted locally using AES-256 before storage. TunnelArch never sends these credentials to its servers.
            </p>
          </div>

        </div>

        {/* Modal Footer */}
        <footer className="px-8 py-6 bg-surface-container-low/50 flex items-center justify-end gap-4 border-t border-outline-variant/40 shrink-0">
          <button 
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-md text-on-surface-variant font-medium hover:bg-surface-container-highest transition-all active:scale-95"
          >
            Cancel
          </button>
          <button 
            type="submit"
            className="px-8 py-2.5 rounded-md bg-gradient-to-br from-primary to-primary-container text-on-primary font-semibold shadow-lg shadow-primary/20 hover:brightness-110 transition-all active:scale-95"
          >
            {isEditing ? "Save Changes" : "Save Profile"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

import { z } from "zod";

export const tunnelSchema = z.object({
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
    if (!values.localPort) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["localPort"], message: "Required" });
    }
    if (!values.remoteHost?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["remoteHost"], message: "Required" });
    }
    if (!values.remotePort) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["remotePort"], message: "Required" });
    }
  }
  if (values.mode === "REMOTE") {
    if (!values.remotePort) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["remotePort"], message: "Required" });
    }
    if (!values.localTargetHost?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["localTargetHost"], message: "Required" });
    }
    if (!values.localTargetPort) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["localTargetPort"], message: "Required" });
    }
  }
  if (values.mode === "DYNAMIC" && !values.localPort) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["localPort"], message: "Required" });
  }
});

export type TunnelFormValues = z.infer<typeof tunnelSchema>;

export function profileToFormValues(initialData?: {
  name: string;
  notes?: string;
  websiteUrl?: string;
  sshHost: string;
  sshPort: number;
  username: string;
  authType: "PASSWORD" | "SSH_KEY";
  rememberPassword?: boolean;
  hasStoredPassword?: boolean;
  privateKeyPath?: string;
  mode: "LOCAL" | "REMOTE" | "DYNAMIC";
  localBindHost?: string;
  localPort?: number;
  remoteHost?: string;
  remotePort?: number;
  remoteBindHost?: string;
  localTargetHost?: string;
  localTargetPort?: number;
  autoReconnect?: boolean;
  openUrlAfterStart?: boolean;
}) {
  if (!initialData) {
    return null;
  }

  return {
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
  };
}

export function normalizeProfileFormData(values: TunnelFormValues) {
  return {
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
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Keep the preview readable without exposing raw HTML from pasted JSON.
export function highlightJson(value: string) {
  return escapeHtml(value).replace(
    /"(?:\\.|[^"\\])*"(?=\s*:)?|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\btrue\b|\bfalse\b|\bnull\b/g,
    (token: string) => {
      if (token === "true" || token === "false") {
        return `<span class="text-warning">${token}</span>`;
      }
      if (token === "null") {
        return `<span class="text-on-surface-variant">${token}</span>`;
      }
      if (token.startsWith("\"")) {
        return /:$/.test(token)
          ? `<span class="text-primary">${token}</span>`
          : `<span class="text-secondary">${token}</span>`;
      }
      return `<span class="text-primary-container">${token}</span>`;
    }
  );
}

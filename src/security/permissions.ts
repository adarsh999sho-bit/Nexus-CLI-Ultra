export type Role = "admin" | "developer" | "readonly";

export interface Permission {
  action: string;
  resource: string;
  allowed: boolean;
}

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    { action: "*", resource: "*", allowed: true },
  ],
  developer: [
    { action: "read", resource: "file", allowed: true },
    { action: "write", resource: "file", allowed: true },
    { action: "read", resource: "config", allowed: true },
    { action: "write", resource: "config", allowed: true },
    { action: "execute", resource: "command", allowed: true },
    { action: "read", resource: "secrets", allowed: false },
    { action: "write", resource: "secrets", allowed: false },
    { action: "read", resource: "audit", allowed: false },
    { action: "manage", resource: "plugins", allowed: false },
    { action: "manage", resource: "users", allowed: false },
  ],
  readonly: [
    { action: "read", resource: "file", allowed: true },
    { action: "read", resource: "config", allowed: true },
    { action: "execute", resource: "command", allowed: false },
    { action: "read", resource: "secrets", allowed: false },
    { action: "write", resource: "*", allowed: false },
    { action: "manage", resource: "*", allowed: false },
  ],
};

export class PermissionManager {
  private role: Role = "developer";

  constructor(role?: Role) {
    if (role) this.role = role;
  }

  /** Set the current role */
  setRole(role: Role): void {
    this.role = role;
  }

  /** Get the current role */
  getRole(): Role {
    return this.role;
  }

  /** Check if an action on a resource is allowed */
  can(action: string, resource: string): boolean {
    const permissions = ROLE_PERMISSIONS[this.role];
    if (!permissions) return false;

    // Check for wildcard admin permission
    const adminPerm = permissions.find((p) => p.action === "*" && p.resource === "*");
    if (adminPerm) return adminPerm.allowed;

    // Check exact match
    const exact = permissions.find((p) => p.action === action && p.resource === resource);
    if (exact) return exact.allowed;

    // Check wildcard resource
    const wildResource = permissions.find((p) => p.action === action && p.resource === "*");
    if (wildResource) return wildResource.allowed;

    // Check wildcard action on resource
    const wildAction = permissions.find((p) => p.action === "*" && p.resource === resource);
    if (wildAction) return wildAction.allowed;

    return false;
  }

  /** Require permission or throw */
  require(action: string, resource: string): void {
    if (!this.can(action, resource)) {
      throw new Error(`Permission denied: ${action} on ${resource} (role: ${this.role})`);
    }
  }

  /** Get all permissions for the current role */
  getPermissions(): Permission[] {
    return ROLE_PERMISSIONS[this.role] || [];
  }

  /** Get available roles */
  static getRoles(): Role[] {
    return Object.keys(ROLE_PERMISSIONS) as Role[];
  }
}

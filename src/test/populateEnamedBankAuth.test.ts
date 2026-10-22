import { describe, it, expect, vi } from "vitest";
import { requireAdmin } from "../../supabase/functions/populate-enamed-bank/auth";

function mockClient(opts: { userId?: string | null; userError?: unknown; isAdmin?: unknown; roleError?: unknown }) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: opts.userId ? { id: opts.userId } : null },
        error: opts.userError ?? null,
      })),
    },
    rpc: vi.fn(async () => ({ data: opts.isAdmin ?? false, error: opts.roleError ?? null })),
  };
}

describe("populate-enamed-bank requireAdmin", () => {
  it("rejeita sem header Authorization", async () => {
    const c = mockClient({ userId: "u1", isAdmin: true });
    expect(await requireAdmin(null, c)).toMatchObject({ ok: false, status: 401 });
    expect(c.auth.getUser).not.toHaveBeenCalled();
  });

  it("rejeita token inválido (ex.: chave anon, sem usuário)", async () => {
    const c = mockClient({ userId: null, userError: new Error("invalid") });
    expect(await requireAdmin("Bearer anon-key", c)).toMatchObject({ ok: false, status: 401 });
    expect(c.rpc).not.toHaveBeenCalled();
  });

  it("rejeita usuário autenticado que não é admin", async () => {
    const c = mockClient({ userId: "u1", isAdmin: false });
    expect(await requireAdmin("Bearer jwt", c)).toMatchObject({ ok: false, status: 403 });
    expect(c.rpc).toHaveBeenCalledWith("has_role", { _user_id: "u1", _role: "admin" });
  });

  it("rejeita quando a checagem de papel falha", async () => {
    const c = mockClient({ userId: "u1", isAdmin: true, roleError: new Error("db") });
    expect(await requireAdmin("Bearer jwt", c)).toMatchObject({ ok: false, status: 403 });
  });

  it("aceita admin", async () => {
    const c = mockClient({ userId: "u1", isAdmin: true });
    expect(await requireAdmin("Bearer jwt", c)).toEqual({ ok: true, userId: "u1" });
    expect(c.auth.getUser).toHaveBeenCalledWith("jwt");
  });
});

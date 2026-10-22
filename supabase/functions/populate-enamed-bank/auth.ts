// Guarda de admin: exige JWT de usuário válido com papel 'admin'.
// Recebe um cliente Supabase (service role) para permitir testes com mock.
type AdminCheckClient = {
  auth: {
    getUser: (jwt: string) => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  };
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
};

export type AdminCheckResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403; error: string };

export async function requireAdmin(
  authHeader: string | null,
  supabase: AdminCheckClient,
): Promise<AdminCheckResult> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Não autorizado" };
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return { ok: false, status: 401, error: "Não autorizado" };

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const userId = userData?.user?.id;
  if (userError || !userId) {
    return { ok: false, status: 401, error: "Token inválido" };
  }

  const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (roleError || isAdmin !== true) {
    return { ok: false, status: 403, error: "Acesso restrito a administradores" };
  }

  return { ok: true, userId };
}

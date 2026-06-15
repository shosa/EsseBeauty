import { createClient } from "@supabase/supabase-js";

export interface SupabaseAuthUser {
  email: string | undefined;
  id: string;
  last_sign_in_at?: string;
}

export interface SupabaseAdmin {
  deleteUser(userId: string): Promise<void>;
  getUsers(): Promise<SupabaseAuthUser[]>;
  inviteUser(email: string): Promise<SupabaseAuthUser>;
}

export function createSupabaseAdmin(
  supabaseUrl: string,
  serviceRoleKey: string,
): SupabaseAdmin {
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return {
    async deleteUser(userId) {
      const { error } = await client.auth.admin.deleteUser(userId);
      if (error) {
        throw error;
      }
    },
    async getUsers() {
      const { data, error } = await client.auth.admin.listUsers({
        page: 1,
        perPage: 1_000,
      });
      if (error) {
        throw error;
      }
      return data.users.map((user) => ({
        email: user.email,
        id: user.id,
        last_sign_in_at: user.last_sign_in_at,
      }));
    },
    async inviteUser(email) {
      const { data, error } =
        await client.auth.admin.inviteUserByEmail(email);
      if (error) {
        throw error;
      }
      return {
        email: data.user.email,
        id: data.user.id,
        last_sign_in_at: data.user.last_sign_in_at,
      };
    },
  };
}

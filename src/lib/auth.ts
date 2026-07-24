import { createSupabaseServerClient, createSupabaseAdminClient } from './supabase-server';
import { User, UserRole, OperationType } from '@/types';
import { redirect } from 'next/navigation';
import { logOperation } from './operations';

// 获取当前登录用户
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();

  // 使用 getUser() 而不是 getSession() 来确保安全性
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return null;
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (error || !user) {
    console.error('Error fetching user:', error);
    return null;
  }

  return user as User;
}

// 检查用户是否已认证，如果未认证则重定向到登录页面
export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  return user;
}

// 检查用户是否为管理员，如果不是则重定向到日历页面
export async function requireAdmin() {
  const user = await requireAuth();

  if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
    redirect('/calendar');
  }

  return user;
}

// 检查用户是否为超级管理员
export async function requireSuperAdmin() {
  const user = await requireAuth();

  if (user.role !== UserRole.SUPER_ADMIN) {
    redirect('/calendar');
  }

  return user;
}

// 服务器端权限检查工具函数
export function hasManagementAccess(userRole: UserRole): boolean {
  return userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN;
}

export function hasSuperAdminAccess(userRole: UserRole): boolean {
  return userRole === UserRole.SUPER_ADMIN;
}

// 创建新用户（仅超级管理员可用）
export async function createUser(
  adminUser: User,
  email: string,
  password: string,
  name: string,
  role: UserRole
): Promise<{ success: boolean; error?: string; user?: User }> {
  try {
    // 检查是否为超级管理员
    if (adminUser.role !== UserRole.SUPER_ADMIN) {
      return { success: false, error: '只有超级管理员可以创建用户' };
    }

    const adminSupabase = createSupabaseAdminClient();
    const supabase = await createSupabaseServerClient();

    // 创建认证用户
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      console.error('创建认证用户失败:', authError);
      return { success: false, error: authError?.message || '创建用户失败' };
    }

    // 创建用户记录
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert([
        {
          id: authData.user.id,
          email,
          name,
          role,
        },
      ])
      .select()
      .single();

    if (userError) {
      console.error('创建用户记录失败:', userError);
      return { success: false, error: userError.message };
    }

    // 记录操作
    await logOperation(
      adminUser.id,
      adminUser.username,
      OperationType.CREATE_USER,
      `管理员 ${adminUser.name} 创建了用户 ${name} (${email})`
    );

    return { success: true, user: userData as User };
  } catch (error) {
    console.error('创建用户时出错:', error);
    return { success: false, error: '创建用户时出错' };
  }
}

// 更新用户（仅管理员可用）
export async function updateUser(
  adminUser: User,
  userId: string,
  updates: { name?: string; role?: UserRole }
): Promise<{ success: boolean; error?: string; user?: User }> {
  try {
    // 检查是否为管理员（管理员或超级管理员）
    if (!hasManagementAccess(adminUser.role)) {
      return { success: false, error: '只有管理员可以更新用户' };
    }

    const supabase = await createSupabaseServerClient();

    // 更新用户记录
    const { data: userData, error: userError } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (userError) {
      console.error('更新用户记录失败:', userError);
      return { success: false, error: userError.message };
    }

    // 记录操作
    await logOperation(
      adminUser.id,
      adminUser.username,
      OperationType.UPDATE_USER,
      `管理员 ${adminUser.name} 更新了用户 ${userData.name} (${userData.username})`
    );

    return { success: true, user: userData as User };
  } catch (error) {
    console.error('更新用户时出错:', error);
    return { success: false, error: '更新用户时出错' };
  }
}

// 删除用户（仅管理员可用）
export async function deleteUser(
  adminUser: User,
  userId: string,
  userEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 检查是否为管理员（管理员或超级管理员）
    if (!hasManagementAccess(adminUser.role)) {
      return { success: false, error: '只有管理员可以删除用户' };
    }

    const adminSupabase = createSupabaseAdminClient();
    const supabase = await createSupabaseServerClient();

    // 删除用户记录
    const { error: userError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (userError) {
      console.error('删除用户记录失败:', userError);
      return { success: false, error: userError.message };
    }

    // 删除认证用户
    const { error: authError } = await adminSupabase.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('删除认证用户失败:', authError);
      return { success: false, error: authError.message };
    }

    // 记录操作
    await logOperation(
      adminUser.id,
      adminUser.username,
      OperationType.DELETE_USER,
      `管理员 ${adminUser.name} 删除了用户 (${userEmail})`
    );

    return { success: true };
  } catch (error) {
    console.error('删除用户时出错:', error);
    return { success: false, error: '删除用户时出错' };
  }
}

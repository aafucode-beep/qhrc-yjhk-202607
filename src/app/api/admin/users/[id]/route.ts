import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClientWithCookies, createSupabaseAdminClient } from '@/lib/supabase-server';
import { UserRole, OperationType } from '@/types';
import { logOperation } from '@/lib/operations';

// 更新用户信息（超级管理员专用）
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { message: '未授权' },
        { status: 401 }
      );
    }

    if (user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { message: '只有超级管理员可以编辑用户' },
        { status: 403 }
      );
    }

    const { username, name, role } = await request.json();
    const { id: userId } = await params;

    if (!username || !name || !role) {
      return NextResponse.json(
        { message: '请提供完整的用户信息' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClientWithCookies();

    // 检查用户名是否被其他用户使用
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .neq('id', userId)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { message: '用户名已被其他用户使用' },
        { status: 400 }
      );
    }

    // 更新用户信息
    const { error } = await supabase
      .from('users')
      .update({ username, name, role })
      .eq('id', userId);

    if (error) {
      console.error('更新用户失败:', error);
      return NextResponse.json(
        { message: '更新用户失败' },
        { status: 500 }
      );
    }

    // 记录操作
    await logOperation(
      user.id,
      user.username,
      OperationType.UPDATE_USER,
      `超级管理员 ${user.name} 更新了用户 ${name} (${username})`
    );

    return NextResponse.json(
      { message: '用户更新成功' },
      { status: 200 }
    );

  } catch (error) {
    console.error('更新用户时出错:', error);
    return NextResponse.json(
      { message: '服务器内部错误' },
      { status: 500 }
    );
  }
}

// 删除用户（超级管理员专用）
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { message: '未授权' },
        { status: 401 }
      );
    }

    if (user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { message: '只有超级管理员可以删除用户' },
        { status: 403 }
      );
    }

    const { id: userId } = await params;

    // 不能删除自己
    if (userId === user.id) {
      return NextResponse.json(
        { message: '不能删除自己的账户' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClientWithCookies();

    // 获取要删除的用户信息
    const { data: targetUser, error: getUserError } = await supabase
      .from('users')
      .select('username, name')
      .eq('id', userId)
      .single();

    if (getUserError || !targetUser) {
      return NextResponse.json(
        { message: '用户不存在' },
        { status: 404 }
      );
    }

    // 从users表删除用户
    const { error: deleteUserError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteUserError) {
      console.error('删除用户记录失败:', deleteUserError);
      return NextResponse.json(
        { message: '删除用户失败' },
        { status: 500 }
      );
    }

    // 从 Supabase Auth 删除用户（需要 service role 密钥）
    const adminSupabase = createSupabaseAdminClient();
    const { error: deleteAuthError } = await adminSupabase.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error('删除认证用户失败:', deleteAuthError);
      // 注意：这里用户记录已经删除，但认证用户删除失败
      // 在生产环境中可能需要更复杂的错误处理
    }

    // 记录操作
    await logOperation(
      user.id,
      user.username,
      OperationType.DELETE_USER,
      `超级管理员 ${user.name} 删除了用户 ${targetUser.name} (${targetUser.username})`
    );

    return NextResponse.json(
      { message: '用户删除成功' },
      { status: 200 }
    );

  } catch (error) {
    console.error('删除用户时出错:', error);
    return NextResponse.json(
      { message: '服务器内部错误' },
      { status: 500 }
    );
  }
}

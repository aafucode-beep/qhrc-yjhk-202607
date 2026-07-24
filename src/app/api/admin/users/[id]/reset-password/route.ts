import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClientWithCookies, createSupabaseAdminClient } from '@/lib/supabase-server';
import { UserRole, OperationType } from '@/types';
import { logOperation } from '@/lib/operations';

// 重置用户密码（超级管理员专用）
export async function POST(
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
        { message: '只有超级管理员可以重置用户密码' },
        { status: 403 }
      );
    }

    const { newPassword } = await request.json();
    const { id: userId } = await params;

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { message: '新密码长度至少为6位' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClientWithCookies();

    // 获取目标用户信息
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

    // 更新用户密码（需要 service role 密钥）
    const adminSupabase = createSupabaseAdminClient();
    const { error: updateError } = await adminSupabase.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (updateError) {
      console.error('重置密码失败:', updateError);
      return NextResponse.json(
        { message: '重置密码失败' },
        { status: 500 }
      );
    }

    // 记录操作
    await logOperation(
      user.id,
      user.username,
      OperationType.UPDATE_USER,
      `超级管理员 ${user.name} 重置了用户 ${targetUser.name} (${targetUser.username}) 的密码`
    );

    return NextResponse.json(
      { message: '密码重置成功' },
      { status: 200 }
    );

  } catch (error) {
    console.error('重置密码时出错:', error);
    return NextResponse.json(
      { message: '服务器内部错误' },
      { status: 500 }
    );
  }
}

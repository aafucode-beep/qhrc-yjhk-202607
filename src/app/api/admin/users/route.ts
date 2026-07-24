import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClientWithCookies, createSupabaseAdminClient } from '@/lib/supabase-server';
import { UserRole, OperationType } from '@/types';
import { logOperation } from '@/lib/operations';

// 获取所有用户（超级管理员专用）
export async function GET() {
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
        { message: '只有超级管理员可以查看所有用户' },
        { status: 403 }
      );
    }

    const supabase = await createSupabaseServerClientWithCookies();

    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, name, role, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('获取用户列表失败:', error);
      return NextResponse.json(
        { message: '获取用户列表失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({ users });

  } catch (error) {
    console.error('获取用户列表时出错:', error);
    return NextResponse.json(
      { message: '服务器内部错误' },
      { status: 500 }
    );
  }
}

// 创建新用户（超级管理员专用）
export async function POST(request: Request) {
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
        { message: '只有超级管理员可以创建用户' },
        { status: 403 }
      );
    }

    const { username, name, password, role } = await request.json();

    if (!username || !name || !password || !role) {
      return NextResponse.json(
        { message: '请提供完整的用户信息' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClientWithCookies();

    // 检查用户名是否已存在
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { message: '用户名已存在' },
        { status: 400 }
      );
    }

    // 生成虚拟邮箱
    const virtualEmail = `${username}@qhrc.internal`;

    // 在Supabase Auth中创建用户（需要 service role 密钥）
    const adminSupabase = createSupabaseAdminClient();
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: virtualEmail,
      password,
      email_confirm: true
    });

    if (authError) {
      console.error('创建认证用户失败:', authError);
      return NextResponse.json(
        { message: '创建用户失败' },
        { status: 500 }
      );
    }

    // 在users表中创建用户记录
    const { error: userError } = await supabase
      .from('users')
      .insert([
        {
          id: authData.user.id,
          username,
          name,
          role
        }
      ]);

    if (userError) {
      console.error('创建用户记录失败:', userError);
      // 如果用户记录创建失败，删除认证用户
      await adminSupabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { message: '创建用户失败' },
        { status: 500 }
      );
    }

    // 记录操作
    await logOperation(
      user.id,
      user.username,
      OperationType.CREATE_USER,
      `超级管理员 ${user.name} 创建了用户 ${name} (${username})`
    );

    return NextResponse.json(
      { message: '用户创建成功' },
      { status: 201 }
    );

  } catch (error) {
    console.error('创建用户时出错:', error);
    return NextResponse.json(
      { message: '服务器内部错误' },
      { status: 500 }
    );
  }
}

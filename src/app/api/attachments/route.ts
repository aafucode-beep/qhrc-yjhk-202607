import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClientWithCookies } from '@/lib/supabase-server';
import { uploadFile, validateFileType, validateFileSize } from '@/lib/cos';
import { UserRole } from '@/types';

// 上传附件
export async function POST(request: NextRequest) {
  try {
    // 获取当前用户
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { message: '未授权' },
        { status: 401 }
      );
    }

    // 检查上传权限：只有管理员和超级管理员可以上传附件
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { message: '权限不足，只有管理员可以上传附件' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const activityId = formData.get('activityId') as string;
    const userId = formData.get('userId') as string;

    if (!file || !activityId || !userId) {
      return NextResponse.json(
        { message: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 验证文件类型
    const fileType = file.type || '';
    if (!validateFileType(fileType)) {
      return NextResponse.json(
        { message: `不支持的文件类型: ${fileType || '未知类型'}` },
        { status: 400 }
      );
    }

    // 验证文件大小
    if (!validateFileSize(file.size)) {
      return NextResponse.json(
        { message: '文件大小超过限制（最大10MB）' },
        { status: 400 }
      );
    }

    // 转换文件为Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 上传到COS
    const uploadResult = await uploadFile(buffer, file.name, fileType);

    // 保存附件信息到数据库
    const supabase = await createSupabaseServerClientWithCookies();

    // 先检查表是否存在
    const { data: tableCheck } = await supabase
      .from('attachments')
      .select('id')
      .limit(1);

    if (!tableCheck) {
      return NextResponse.json(
        { message: '附件表不存在，请联系管理员' },
        { status: 500 }
      );
    }

    const attachmentData = {
      activity_id: activityId,
      user_id: userId,
      filename: uploadResult.filename,
      original_name: uploadResult.originalName,
      file_size: uploadResult.fileSize,
      mime_type: uploadResult.mimeType,
      cos_url: uploadResult.cosUrl,
      uploaded_by: user.id,
    };

    const { data, error } = await supabase
      .from('attachments')
      .insert(attachmentData)
      .select()
      .single();

    if (error) {
      console.error('保存附件信息失败:', error);
      return NextResponse.json(
        { message: '保存附件信息失败' },
        { status: 500 }
      );
    }

    // 转换数据库字段名为前端期望的驼峰格式，并确保所有字段都有值
    const attachment = {
      id: data.id || '',
      filename: data.filename || '',
      originalName: data.original_name || '',
      fileSize: data.file_size || 0,
      mimeType: data.mime_type || '',
      cosUrl: data.cos_url || '',
      uploadedAt: data.uploaded_at || new Date().toISOString(),
      uploadedBy: data.uploaded_by || ''
    };

    return NextResponse.json({
      message: '附件上传成功',
      attachment
    });

  } catch (error) {
    console.error('上传附件失败:', error);
    return NextResponse.json(
      { message: '上传附件失败' },
      { status: 500 }
    );
  }
}

// 获取附件列表
export async function GET(request: NextRequest) {
  try {
    // 获取当前用户
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { message: '未授权' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const activityId = searchParams.get('activityId');
    const userId = searchParams.get('userId');

    if (!activityId || !userId) {
      return NextResponse.json(
        { message: '缺少必要参数' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClientWithCookies();

    // 获取附件列表 - 在共享日历系统中，所有用户都能看到所有附件
    const { data, error } = await supabase
      .from('attachments')
      .select('*')
      .eq('activity_id', activityId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('获取附件列表失败:', error);
      return NextResponse.json(
        { message: '获取附件列表失败' },
        { status: 500 }
      );
    }

    // 转换数据库字段名为前端期望的驼峰格式，并确保所有字段都有值
    const attachments = (data || []).map((item: {
      id: string;
      filename: string;
      original_name: string;
      file_size: number;
      mime_type: string;
      cos_url: string;
      uploaded_at: string;
      uploaded_by: string;
    }) => ({
      id: item.id || '',
      filename: item.filename || '',
      originalName: item.original_name || '',
      fileSize: item.file_size || 0,
      mimeType: item.mime_type || '',
      cosUrl: item.cos_url || '',
      uploadedAt: item.uploaded_at || new Date().toISOString(),
      uploadedBy: item.uploaded_by || ''
    }));

    return NextResponse.json({
      attachments
    });

  } catch (error) {
    console.error('获取附件列表失败:', error);
    return NextResponse.json(
      { message: '获取附件列表失败' },
      { status: 500 }
    );
  }
}

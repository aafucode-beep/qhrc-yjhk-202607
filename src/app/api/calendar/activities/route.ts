import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { logOperation } from '@/lib/operations';
import { OperationType, ActivityType, UserRole } from '@/types';
import { createSupabaseServerClientWithCookies } from '@/lib/supabase-server';
import { SHARED_CALENDAR_ID } from '@/lib/constants';
import { format } from 'date-fns';
import { cache, CacheKeys } from '@/lib/cache';

// 添加活动
export async function POST(request: Request) {
  try {
    // 获取当前用户
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { message: '未授权' },
        { status: 401 }
      );
    }

    // 检查添加权限：只有管理员和超级管理员可以添加活动
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { message: '权限不足，只有管理员可以添加活动' },
        { status: 403 }
      );
    }

    const { date, activity } = await request.json();

    if (!date || !activity || !activity.description) {
      return NextResponse.json(
        { message: '缺少必要参数' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClientWithCookies();
    // 如果date已经是yyyy-MM-dd格式的字符串，直接使用；否则格式化
    const dateStr = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : format(new Date(date), 'yyyy-MM-dd');

    // 创建新活动
    const newActivity = {
      id: crypto.randomUUID(),
      description: activity.description,
      type: activity.type || ActivityType.QHRC_CENTER
    };

    // 尝试从缓存获取数据
    const cacheKey = CacheKeys.calendarEvents(SHARED_CALENDAR_ID);
    let events: Record<string, { date: Date; activities: Array<{ id: string; description: string; type: string }> }> =
      cache.get(cacheKey) || {};

    // 如果缓存为空，从数据库获取
    if (Object.keys(events).length === 0) {
      const { data: calendarData, error: fetchError } = await supabase
        .from('calendar_events')
        .select('events')
        .eq('user_id', SHARED_CALENDAR_ID)
        .single();

      if (calendarData && !fetchError) {
        events = calendarData.events || {};
        // 缓存数据，TTL 2分钟
        cache.set(cacheKey, events, 2 * 60 * 1000);
      }
    }

    // 更新事件数据
    const existingDayData = events[dateStr];
    const existingActivities = existingDayData?.activities || [];

    events[dateStr] = {
      date: new Date(dateStr + 'T00:00:00'), // 使用本地日期，避免时区偏移
      activities: [...existingActivities, newActivity]
    };

    // 保存到共享日历 - 只更新 events 字段
    const { error: saveError } = await supabase
      .from('calendar_events')
      .upsert(
        {
          user_id: SHARED_CALENDAR_ID,
          events
        },
        { onConflict: 'user_id' }
      );

    if (saveError) {
      console.error('保存活动失败:', saveError);
      return NextResponse.json(
        { message: '保存活动失败' },
        { status: 500 }
      );
    }

    // 更新缓存
    cache.set(cacheKey, events, 2 * 60 * 1000);

    // 异步记录操作日志，不阻塞响应
    logOperation(
      user.id,
      user.username,
      OperationType.CREATE_EVENT,
      `用户 ${user.name} 在 ${dateStr} 添加了活动: "${activity.description}" (类型: ${activity.type || 'QHRC'})`
    );

    return NextResponse.json(
      {
        message: '活动添加成功',
        activity: newActivity,
        date: dateStr
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('添加活动时出错:', error);
    return NextResponse.json(
      { message: '服务器内部错误' },
      { status: 500 }
    );
  }
}

// 删除活动
export async function DELETE(request: Request) {
  try {
    // 获取当前用户
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { message: '未授权' },
        { status: 401 }
      );
    }

    // 检查删除权限：只有超级管理员可以删除
    if (user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { message: '只有超级管理员可以删除活动' },
        { status: 403 }
      );
    }

    const { date, activityId } = await request.json();

    if (!date || !activityId) {
      return NextResponse.json(
        { message: '缺少必要参数' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClientWithCookies();
    // 如果date已经是yyyy-MM-dd格式的字符串，直接使用；否则格式化
    const dateStr = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : format(new Date(date), 'yyyy-MM-dd');

    // 尝试从缓存获取数据
    const cacheKey = CacheKeys.calendarEvents(SHARED_CALENDAR_ID);
    let events: Record<string, any> = cache.get(cacheKey) || {};

    // 如果缓存为空，从数据库获取
    if (Object.keys(events).length === 0) {
      const { data: calendarData, error: fetchError } = await supabase
        .from('calendar_events')
        .select('events')
        .eq('user_id', SHARED_CALENDAR_ID)
        .single();

      if (fetchError || !calendarData) {
        return NextResponse.json(
          { message: '未找到日历数据' },
          { status: 404 }
        );
      }

      events = calendarData.events || {};
      // 缓存数据
      cache.set(cacheKey, events, 2 * 60 * 1000);
    }
    const dayData = events[dateStr];

    if (!dayData || !dayData.activities) {
      return NextResponse.json(
        { message: '未找到指定日期的活动' },
        { status: 404 }
      );
    }

    // 查找要删除的活动
    const activityToDelete = dayData.activities.find((act: { id: string; description: string; type: string }) => act.id === activityId);
    if (!activityToDelete) {
      return NextResponse.json(
        { message: '未找到指定的活动' },
        { status: 404 }
      );
    }

    // 删除活动
    const updatedActivities = dayData.activities.filter((act: { id: string; description: string; type: string }) => act.id !== activityId);

    if (updatedActivities.length === 0) {
      // 如果没有活动了，删除整个日期
      delete events[dateStr];
    } else {
      events[dateStr] = {
        ...dayData,
        activities: updatedActivities
      };
    }

    // 保存到共享日历
    const { error: saveError } = await supabase
      .from('calendar_events')
      .upsert(
        {
          user_id: SHARED_CALENDAR_ID,
          events
        },
        { onConflict: 'user_id' }
      );

    if (saveError) {
      console.error('删除活动失败:', saveError);
      return NextResponse.json(
        { message: '删除活动失败' },
        { status: 500 }
      );
    }

    // 更新缓存
    cache.set(cacheKey, events, 2 * 60 * 1000);

    // 异步记录操作日志，不阻塞响应
    logOperation(
      user.id,
      user.username,
      OperationType.DELETE_EVENT,
      `管理员 ${user.name} 在 ${dateStr} 删除了活动: "${activityToDelete.description}" (类型: ${activityToDelete.type})`
    );

    return NextResponse.json(
      {
        message: '活动删除成功',
        deletedActivity: activityToDelete,
        date: dateStr
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('删除活动时出错:', error);
    return NextResponse.json(
      { message: '服务器内部错误' },
      { status: 500 }
    );
  }
}

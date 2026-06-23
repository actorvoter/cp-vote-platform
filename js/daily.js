// js/daily.js
// ============================================================
// 每日活动管理（道具、投票记录、转发奖励）
// ============================================================

async function getTodayActivity(userId) {
    var client = getClient();
    var today = new Date().toISOString().split('T')[0];
    try {
        var { data, error } = await client
            .from('daily_activities')
            .select('*')
            .eq('user_id', userId)
            .eq('activity_date', today)
            .maybeSingle();
        if (error) {
            console.warn('获取今日活动失败:', error);
            return null;
        }
        return data;
    } catch (e) {
        console.warn('获取今日活动异常:', e);
        return null;
    }
}

async function initTodayActivity(userId) {
    var existing = await getTodayActivity(userId);
    if (existing) return existing;

    var client = getClient();
    var today = new Date().toISOString().split('T')[0];

    var { data, error } = await client
        .from('daily_activities')
        .insert({
            user_id: userId,
            activity_date: today,
            used_votes: [],
            used_free_items: 0,
            items_light: 3,
            items_billboard: 0,
            items_rocket: 0,
            shared_today: false,
            shared_count: 0
        })
        .select()
        .single();

    if (error) {
        console.error('初始化今日活动失败:', error);
        return null;
    }
    return data;
}

function hasVotedToday(activity, cpId) {
    if (!activity || !activity.used_votes) return false;
    return activity.used_votes.includes(String(cpId));
}

async function getRemainingItems(userId) {
    var activity = await getTodayActivity(userId);
    if (!activity) {
        return { light: 3, billboard: 0, rocket: 0 };
    }
    return {
        light: Math.max(0, activity.items_light || 0),
        billboard: Math.max(0, activity.items_billboard || 0),
        rocket: Math.max(0, activity.items_rocket || 0)
    };
}

// js/daily.js - 确保道具扣减正确
async function useItem(userId, cpId, itemType) {
    var activity = await initTodayActivity(userId);
    if (!activity) return { success: false, msg: '系统错误' };

    var itemKey = 'items_' + itemType;
    var current = activity[itemKey] || 0;
    if (current <= 0) {
        return { success: false, msg: itemType + ' 已用完，转发可再得！' };
    }

    var client = getClient();
    var updates = {};
    updates[itemKey] = current - 1;

    var { error } = await client
        .from('daily_activities')
        .update(updates)
        .eq('id', activity.id);

    if (error) {
        console.error('使用道具失败:', error);
        return { success: false, msg: '使用失败，请重试' };
    }
    return { success: true, msg: '🎉 加油成功！' };
}

// ============================================================
// 发放分享奖励（10倍版）
// ============================================================
async function grantShareReward(userId) {
    var activity = await getTodayActivity(userId);
    if (!activity) return { success: false, msg: '请先登录' };
    if (activity.shared_today) {
        return { success: false, msg: '今天已领过，明天再来吧 🎁' };
    }

    var client = getClient();
    
    // ✅ 奖励翻10倍：原来 2+2+1 → 现在 20+20+10
    var newLight = (activity.items_light || 0) + 20;
    var newBillboard = (activity.items_billboard || 0) + 20;
    var newRocket = (activity.items_rocket || 0) + 10;

    var { error } = await client
        .from('daily_activities')
        .update({
            items_light: newLight,
            items_billboard: newBillboard,
            items_rocket: newRocket,
            shared_today: true,
            shared_count: (activity.shared_count || 0) + 1
        })
        .eq('id', activity.id);

    if (error) {
        console.error('发放奖励失败:', error);
        return { success: false, msg: '领取失败，请重试' };
    }
    return { success: true, msg: '🎁 获得 20个人气灯 + 20个广告牌 + 10个火箭！' };
}

// ============================================================
// 每日进度判断
// ============================================================

function getDaysSince(dateStr) {
    const created = new Date(dateStr);
    const now = new Date();
    const diff = now - created;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getCurrentPhase(createdAt, hasStyle, hasAvoid, hasComplaint) {
    const days = getDaysSince(createdAt);
    
    // 优先级：吐槽 > 雷区 > 风格 > 提名
    if (days >= 3) return 4;          // 吐槽解锁
    if (days >= 2) return 3;          // 雷区解锁
    if (days >= 1) return 2;          // 风格解锁
    return 1;                          // 仅提名
}

function shouldUnlock(phase, requiredPhase) {
    return phase >= requiredPhase;
}

function getLockMessage(phase, requiredPhase) {
    const labels = {
        2: '🎨 风格标签',
        3: '🚫 雷区投票',
        4: '💢 吐槽区'
    };
    if (phase >= requiredPhase) return null;
    const remaining = requiredPhase - phase;
    return `🔒 ${labels[requiredPhase]} 将在 ${remaining} 天后解锁`;
}
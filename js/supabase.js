// js/supabase.js
// ============================================================
// 1. Supabase 配置
// ============================================================
var SUPABASE_URL = 'https://grsxmjvjtqmvylyxmktt.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyc3htanZqdHFtdnlseXhta3R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTM5OTYsImV4cCI6MjA5NzI2OTk5Nn0.yZVerun2-o1gJmbR3OGlG64wCFZtJPTMvVxZ37pkBvA';

var _supabaseClient = null;

function getClient() {
    if (!_supabaseClient) {
        _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return _supabaseClient;
}

// ============================================================
// 2. 设备 ID
// ============================================================
function getDeviceId() {
    var id = localStorage.getItem('cp_device_id');
    if (!id) {
        id = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('cp_device_id', id);
    }
    return id;
}

// ============================================================
// 3. 当前用户
// ============================================================
function getCurrentUser() {
    var userStr = localStorage.getItem('cp_user');
    if (!userStr) return null;
    try { return JSON.parse(userStr); } catch (e) { return null; }
}

function setCurrentUser(user) {
    if (user) {
        localStorage.setItem('cp_user', JSON.stringify(user));
    } else {
        localStorage.removeItem('cp_user');
    }
}

// ============================================================
// 4. Toast
// ============================================================
function showToast(msg) {
    var t = document.getElementById('toast');
    if (!t) { alert(msg); return; }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._hideTimer);
    t._hideTimer = setTimeout(function() { t.classList.remove('show'); }, 2500);
}

// ============================================================
// 5. 工具函数
// ============================================================
function formatTime(iso) {
    var d = new Date(iso);
    return d.getMonth() + 1 + '/' + d.getDate() + ' ' +
        String(d.getHours()).padStart(2, '0') + ':' +
        String(d.getMinutes()).padStart(2, '0');
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function logout() {
    if (confirm('确定要退出登录吗？')) {
        setCurrentUser(null);
        window.location.href = 'index.html';
    }
}

// ============================================================
// 6. 获取用户 IP
// ============================================================
async function getUserIP() {
    var cachedIP = localStorage.getItem('cp_user_ip');
    if (cachedIP) return cachedIP;

    var apis = [
        'https://api.ipify.org?format=json',
        'https://ipapi.co/json/'
    ];

    for (var i = 0; i < apis.length; i++) {
        try {
            var response = await fetch(apis[i]);
            if (!response.ok) continue;
            var data = await response.json();
            var ip = data.ip || data.query;
            if (ip) {
                localStorage.setItem('cp_user_ip', ip);
                return ip;
            }
        } catch (e) {
            console.warn('IP 获取失败，尝试下一个:', e);
        }
    }
    return '';
}

// ============================================================
// 7. 会话 ID
// ============================================================
function getSessionId() {
    var sessionId = localStorage.getItem('cp_session_id');
    if (!sessionId) {
        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('cp_session_id', sessionId);
    }
    return sessionId;
}

// ============================================================
// 8. 记录用户行为
// ============================================================
async function trackActivity(activityType, targetId, targetType, metadata) {
    try {
        var client = getClient();
        var user = getCurrentUser();
        var deviceId = getDeviceId();
        var sessionId = getSessionId();
        var ip = await getUserIP();

        var record = {
            user_id: user ? user.id : null,
            device_id: deviceId,
            session_id: sessionId,
            ip_address: ip,
            user_agent: navigator.userAgent,
            activity_type: activityType,
            target_id: targetId || null,
            target_type: targetType || null,
            metadata: metadata || {}
        };

        await client.from('user_activities').insert(record);
    } catch (err) {
        console.warn('行为记录失败:', err);
    }
}

// ============================================================
// 9. 页面访问追踪
// ============================================================
function trackPageView(pageName) {
    trackActivity('page_view', null, null, { page: pageName || window.location.pathname });
}

// ============================================================
// 10. 用户进度管理
// ============================================================
async function getUserProgress(userId, cpId) {
    const client = getClient();
    const { data, error } = await client
        .from('user_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('cp_id', cpId)
        .maybeSingle();
    if (error && error.code !== 'PGRST116') {
        console.warn('获取进度失败:', error);
        return null;
    }
    return data;
}

async function upsertUserProgress(userId, cpId, phase) {
    const client = getClient();
    const { data, error } = await client
        .from('user_progress')
        .upsert({
            user_id: userId,
            cp_id: cpId,
            phase: phase,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, cp_id' })
        .select()
        .single();
    if (error) {
        console.error('更新进度失败:', error);
        return null;
    }
    return data;
}

async function getCPFollowerCount(cpId) {
    const client = getClient();
    const { count, error } = await client
        .from('user_progress')
        .select('*', { count: 'exact', head: true })
        .eq('cp_id', cpId);
    if (error) {
        console.warn('获取关注数失败:', error);
        return 0;
    }
    return count || 0;
}

// ============================================================
// 11. 用户共创管理
// ============================================================
async function getUserCreation(userId, cpId) {
    const client = getClient();
    const { data, error } = await client
        .from('user_creations')
        .select('*')
        .eq('user_id', userId)
        .eq('cp_id', cpId)
        .maybeSingle();
    if (error && error.code !== 'PGRST116') {
        console.warn('获取创作记录失败:', error);
        return null;
    }
    return data;
}

async function upsertUserCreation(userId, cpId, updates) {
    const client = getClient();
    const { data, error } = await client
        .from('user_creations')
        .upsert({
            user_id: userId,
            cp_id: cpId,
            ...updates,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, cp_id' })
        .select()
        .single();
    if (error) {
        console.error('保存创作记录失败:', error);
        return null;
    }
    return data;
}

async function getCreationProgress(userId, cpId) {
    const creation = await getUserCreation(userId, cpId);
    if (!creation) {
        return { total: 3, completed: 0, items: [
                { key: 'role', label: '🎭 角色设定', completed: false },
                { key: 'story', label: '📝 剧情创作', completed: false },
                { key: 'style', label: '🎨 视觉风格', completed: false }
            ]};
    }

    const items = [
        { key: 'role', label: '🎭 角色设定', completed: !!creation.user_role?.role_name },
        { key: 'story', label: '📝 剧情创作', completed: creation.story_scenes?.length > 0 },
        { key: 'style', label: '🎨 视觉风格', completed: !!creation.visual_style?.style_tags?.length }
    ];

    const completed = items.filter(i => i.completed).length;
    return { total: items.length, completed, items };
}

// ============================================================
// 12. 每日活动管理
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

async function grantShareReward(userId) {
    var activity = await getTodayActivity(userId);
    if (!activity) return { success: false, msg: '请先登录' };
    if (activity.shared_today) {
        return { success: false, msg: '今天已领过，明天再来吧 🎁' };
    }

    var client = getClient();

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

function getDaysSince(dateStr) {
    const created = new Date(dateStr);
    const now = new Date();
    const diff = now - created;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getCurrentPhase(createdAt, hasStyle, hasAvoid, hasComplaint) {
    const days = getDaysSince(createdAt);
    if (days >= 3) return 4;
    if (days >= 2) return 3;
    if (days >= 1) return 2;
    return 1;
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
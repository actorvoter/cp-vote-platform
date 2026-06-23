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
// 用户进度管理
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
// 1.5版本：用户共创管理
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
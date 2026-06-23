// js/creation.js
// ============================================================
// 1.5版本：用户共创模块
// ============================================================

async function loadCreationData(cpId) {
    const user = getCurrentUser();
    if (!user) {
        showToast('请先登录 🚀');
        window.location.href = 'login.html';
        return null;
    }
    
    const creation = await getUserCreation(user.id, cpId);
    const progress = await getCreationProgress(user.id, cpId);
    
    return { creation, progress, user };
}

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
// 保存各模块
// ============================================================
async function saveRoleSetting(cpId, roleData) {
    const user = getCurrentUser();
    if (!user) {
        showToast('请先登录 🚀');
        return false;
    }
    
    const creation = await getUserCreation(user.id, cpId);
    const updates = {
        user_role: {
            role_name: roleData.roleName || '',
            role_type: roleData.roleType || '',
            role_line: roleData.roleLine || '',
            appearance: roleData.appearance || '',
            avatar_url: roleData.avatarUrl || ''
        }
    };
    
    const result = await upsertUserCreation(user.id, cpId, updates);
    if (result) {
        showToast('🎭 角色设定已保存！');
        return true;
    }
    return false;
}

async function saveStoryScenes(cpId, scenes) {
    const user = getCurrentUser();
    if (!user) {
        showToast('请先登录 🚀');
        return false;
    }
    
    const validScenes = scenes.filter(s => s.trim().length > 0);
    if (validScenes.length === 0) {
        showToast('请至少写一个场景 📝');
        return false;
    }
    
    const updates = {
        story_scenes: validScenes
    };
    
    const result = await upsertUserCreation(user.id, cpId, updates);
    if (result) {
        showToast('📝 剧情已保存！共 ' + validScenes.length + ' 个场景');
        return true;
    }
    return false;
}

async function saveVisualStyle(cpId, styleData) {
    const user = getCurrentUser();
    if (!user) {
        showToast('请先登录 🚀');
        return false;
    }
    
    const updates = {
        visual_style: {
            style_tags: styleData.styleTags || [],
            color_tone: styleData.colorTone || '',
            scene_style: styleData.sceneStyle || ''
        }
    };
    
    const result = await upsertUserCreation(user.id, cpId, updates);
    if (result) {
        showToast('🎨 视觉风格已保存！');
        return true;
    }
    return false;
}

async function checkAndCompleteCreation(cpId) {
    const user = getCurrentUser();
    if (!user) return false;
    
    const progress = await getCreationProgress(user.id, cpId);
    if (progress.completed === progress.total) {
        const result = await upsertUserCreation(user.id, cpId, {
            is_completed: true,
            completed_at: new Date().toISOString()
        });
        if (result) {
            showToast('🎉 恭喜！你的剧本已就绪！');
            return true;
        }
    } else {
        const remaining = progress.total - progress.completed;
        showToast(`⏳ 还剩 ${remaining} 个模块未完成`);
        return false;
    }
}
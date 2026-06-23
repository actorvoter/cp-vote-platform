// js/creation.js
// ============================================================
// 1.5版本：用户共创模块
// ============================================================

// ============================================================
// 1. 加载创作数据
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

// ============================================================
// 2. 保存角色设定
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

// ============================================================
// 3. 保存剧情脉络
// ============================================================
async function saveStoryScenes(cpId, scenes) {
    const user = getCurrentUser();
    if (!user) {
        showToast('请先登录 🚀');
        return false;
    }
    
    // 过滤空行，只保留有内容的句子
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

// ============================================================
// 4. 保存视觉风格
// ============================================================
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

// ============================================================
// 5. 检查并完成创作
// ============================================================
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
// js/auth.js
// ============================================================
// 1. 发送验证码
// ============================================================
async function sendVerificationCode(email) {
    try {
        var client = getClient();
        var { error } = await client.auth.signInWithOtp({
            email: email,
            options: {
                shouldCreateUser: true
            }
        });

        if (error) { throw error; }
        showToast('验证码已发送到邮箱 📧');
        return true;
    } catch (err) {
        console.error('发送验证码失败:', err);
        showToast('发送失败，请检查邮箱地址');
        return false;
    }
}

// ============================================================
// 2. 验证码登录
// ============================================================
// auth.js - 修改 verifyAndLogin 函数
async function verifyAndLogin(email, code) {
    try {
        var client = getClient();
        var { data, error } = await client.auth.verifyOtp({
            email: email,
            token: code,
            type: 'email'
        });
        if (error) { throw error; }

        if (!data || !data.user) {
            throw new Error('登录失败，未获取到用户信息');
        }

        var user = {
            id: data.user.id,
            email: data.user.email,
            created_at: data.user.created_at
        };
        setCurrentUser(user);

        await trackActivity('login', user.id, 'user', { method: 'otp' });

        // 确保用户记录存在
        await ensureUserRecord(user.id, user.email);

        // ✅ 新增：检测用户是否已有密码（首次登录标记）
        var { data: userData, error: userError } = await client
            .from('users')
            .select('has_password, nickname')
            .eq('id', user.id)
            .maybeSingle();

        // 如果没有 has_password 字段，或者为 false，则认为是首次登录
        var isFirstLogin = !userData || !userData.has_password;

        if (isFirstLogin) {
            showToast('首次登录，请设置密码 🔑');
            // ✅ 跳转到密码设置页面，并标记为首次登录
            window.location.href = 'profile.html?first_login=true';
        } else {
            showToast('登录成功！🎉');
            window.location.href = 'index.html';
        }
        return true;

    } catch (err) {
        console.error('验证失败:', err);
        showToast('验证码错误或已过期');
        return false;
    }
}

// ============================================================
// 3. 密码登录
// ============================================================
async function signInWithEmail(email, password) {
    try {
        var client = getClient();
        var { data, error } = await client.auth.signInWithPassword({
            email: email,
            password: password
        });
        if (error) { throw error; }

        if (!data || !data.user) {
            throw new Error('登录失败，未获取到用户信息');
        }

        var user = {
            id: data.user.id,
            email: data.user.email,
            created_at: data.user.created_at
        };
        setCurrentUser(user);

        await trackActivity('login', user.id, 'user', { method: 'password' });

        // 尝试创建或更新用户记录
        await ensureUserRecord(user.id, user.email);

        showToast('登录成功！🎉');
        return true;
    } catch (err) {
        console.error('登录失败:', err);
        showToast('邮箱或密码错误');
        return false;
    }
}

// ============================================================
// 4. 密码注册
// ============================================================
async function signUpWithEmail(email, password) {
    try {
        var client = getClient();
        var { data, error } = await client.auth.signUp({
            email: email,
            password: password,
            options: {
                emailRedirectTo: window.location.origin + '/index.html'
            }
        });

        if (error) { throw error; }

        if (data && data.user) {
            var user = {
                id: data.user.id,
                email: data.user.email,
                created_at: data.user.created_at
            };
            setCurrentUser(user);

            await trackActivity('login', user.id, 'user', { method: 'signup_password' });

            // 尝试创建或更新用户记录
            await ensureUserRecord(user.id, user.email);

            showToast('注册成功！🎉 已自动登录');
            return true;
        }
        return false;
    } catch (err) {
        console.error('注册失败:', err);
        showToast('注册失败，请重试');
        return false;
    }
}

// 新增辅助函数：确保用户记录存在
async function ensureUserRecord(userId, email) {
    try {
        var client = getClient();
        // 检查用户是否存在
        var { data: existingUser, error: findError } = await client
            .from('users')
            .select('id')
            .eq('id', userId)
            .maybeSingle();

        if (findError) {
            console.warn('查找用户记录失败，尝试创建:', findError);
            // 如果查询失败，直接尝试插入
            var nickname = email ? email.split('@')[0] : '用户';
            await client.from('users').insert({
                id: userId,
                email: email || 'unknown@email.com',
                nickname: nickname
            });
            console.log('✅ 已创建用户记录');
            return;
        }

        // 如果用户不存在，创建新记录
        if (!existingUser) {
            var nickname = email ? email.split('@')[0] : '用户';
            await client.from('users').insert({
                id: userId,
                email: email || 'unknown@email.com',
                nickname: nickname
            });
            console.log('✅ 已创建用户记录');
        } else {
            // 如果用户存在但 email 字段为空，更新 email
            var { data: userData } = await client
                .from('users')
                .select('email')
                .eq('id', userId)
                .single();
            if (userData && !userData.email && email) {
                await client.from('users').update({ email: email }).eq('id', userId);
                console.log('✅ 已更新用户邮箱');
            }
        }
    } catch (err) {
        console.error('确保用户记录失败:', err);
        // 不抛出错误，避免影响主登录流程
    }
}
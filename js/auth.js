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
async function verifyAndLogin(email, code) {
    try {
        var client = getClient();
        var { data, error } = await client.auth.verifyOtp({
            email: email,
            token: code,
            type: 'email'
        });
        if (error) { throw error; }

        var user = {
            id: data.user.id,
            email: data.user.email,
            created_at: data.user.created_at
        };
        setCurrentUser(user);

        // 记录登录行为
        await trackActivity('login', user.id, 'user', { method: 'otp' });

        // 首次登录：创建用户记录
        var { data: existingUser } = await client
            .from('users')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();

        if (!existingUser) {
            var nickname = user.email.split('@')[0];
            await client.from('users').insert({
                id: user.id,
                email: user.email,
                nickname: nickname
            });
            showToast('首次登录，欢迎你！✨');
        }

        showToast('登录成功！🎉');
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

        var user = {
            id: data.user.id,
            email: data.user.email,
            created_at: data.user.created_at
        };
        setCurrentUser(user);

        await trackActivity('login', user.id, 'user', { method: 'password' });

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

        if (data.user) {
            var user = {
                id: data.user.id,
                email: data.user.email,
                created_at: data.user.created_at
            };
            setCurrentUser(user);

            await trackActivity('login', user.id, 'user', { method: 'signup_password' });

            var nickname = user.email.split('@')[0];
            await client.from('users').insert({
                id: user.id,
                email: user.email,
                nickname: nickname
            });

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
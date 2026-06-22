import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('🚀 Vercel 函数开始执行')

    const RESEND_API_KEY = process.env.RESEND_API_KEY
    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ 环境变量未设置')
      return res.status(500).json({ error: 'Environment variables not set' })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    console.log('📊 查询用户...')
    const { data: users, error } = await supabase
      .from('user_progress')
      .select(`
        id,
        user_id,
        cp_id,
        users!inner (email),
        cp_submissions!inner (male_actor, female_actor)
      `)
      .gte('phase', 4)
      .is('email_sent_at', null)

    if (error) {
      console.error('❌ 查询失败:', error)
      return res.status(500).json({ error: error.message })
    }

    console.log(`📊 找到 ${users?.length || 0} 个用户`)

    if (!users || users.length === 0) {
      return res.status(200).json({ message: '✅ 发送了 0 封邮件' })
    }

    let sentCount = 0

    for (const record of users) {
      try {
        const { count } = await supabase
          .from('user_progress')
          .select('*', { count: 'exact', head: true })
          .eq('cp_id', record.cp_id)

        if (!count || count < 10000) {
          console.log(`⏭️ 跳过 CP ${record.cp_id}（关注数 ${count || 0} < 10000）`)
          continue
        }

        const email = record.users?.email
        if (!email) continue

        const cp = record.cp_submissions
        const cpName = `${cp?.male_actor || ''} ✕ ${cp?.female_actor || ''}`

        console.log(`📧 发送邮件给 ${email}`)
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'noreply@cpmaker.com',
            to: email,
            subject: `🔥 你提名的 ${cpName} 已获 ${count} 人关注！`,
            html: `
              <h2>🔥 你提名的 CP 有新动静！</h2>
              <p>你提名的 <strong>${cpName}</strong> 已获得 <strong>${count}</strong> 位观众的关注！</p>
              <p><a href="https://cpmaker.com/mycp.html?id=${record.cp_id}" style="background:#6c5ce7;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">👉 去看看现在多热了</a></p>
            `
          })
        })

        if (response.ok) {
          await supabase
            .from('user_progress')
            .update({ email_sent_at: new Date().toISOString() })
            .eq('id', record.id)
          sentCount++
          console.log(`✅ 邮件发送成功: ${email}`)
        }
      } catch (innerErr) {
        console.error('❌ 处理记录失败:', innerErr)
      }
    }

    return res.status(200).json({ message: `✅ 发送了 ${sentCount} 封邮件` })

  } catch (err) {
    console.error('❌ 函数崩溃:', err)
    return res.status(500).json({ error: (err as Error).message })
  }
}
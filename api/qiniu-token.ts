// api/qiniu-token.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        // 允许跨域
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        const accessKey = process.env.QINIU_ACCESS_KEY;
        const secretKey = process.env.QINIU_SECRET_KEY;
        const bucket = process.env.QINIU_BUCKET || 'cp-video';

        if (!accessKey || !secretKey) {
            console.error('❌ 七牛云密钥未配置');
            return res.status(500).json({ 
                error: 'Storage service not configured',
                message: '请配置 QINIU_ACCESS_KEY 和 QINIU_SECRET_KEY'
            });
        }

        // 简单生成上传凭证（使用 HMAC-SHA1）
        // 注意：生产环境建议使用 qiniu SDK
        const crypto = require('crypto');

        const putPolicy = {
            scope: bucket,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            returnBody: '{"key":"$(key)","hash":"$(etag)","size":$(fsize)}'
        };

        const policy = Buffer.from(JSON.stringify(putPolicy)).toString('base64');
        const sign = crypto.createHmac('sha1', secretKey).update(policy).digest('base64');
        const token = accessKey + ':' + sign + ':' + policy;

        res.status(200).json({
            token: token,
            domain: process.env.QINIU_DOMAIN || 'https://video.cpmaker.com',
            bucket: bucket,
            uploadUrl: 'https://upload.qiniup.com'
        });

    } catch (err) {
        console.error('❌ 生成上传凭证失败:', err);
        res.status(500).json({ 
            error: 'Internal server error',
            message: (err as Error).message
        });
    }
}
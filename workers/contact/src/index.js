import { SmtpClient } from './smtp.js';

const ALLOWED_SERVICES = [
    'IT Support & AMC',
    'Infrastructure & Servers',
    'Network & Security',
    'Cloud & Backup',
    'IT Training / Internship',
    'Other',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+\d][\d\s().-]{6,19}$/;

const json = (data, status = 200, headers = {}) =>
    new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...headers,
        },
    });

function corsHeaders(request) {
    const origin = request.headers.get('Origin') || '*';
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
    };
}

function validate(payload) {
    const errors = {};
    const name = String(payload.name || '').trim();
    if (name.length < 2 || name.length > 100) {
        errors.name = 'Please enter your full name (2-100 characters).';
    }
    const company = String(payload.company || '').trim();
    if (company.length > 200) {
        errors.company = 'Company name is too long.';
    }
    const email = String(payload.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 254) {
        errors.email = 'Please enter a valid email address.';
    }
    const phone = String(payload.phone || '').trim();
    if (!PHONE_RE.test(phone)) {
        errors.phone = 'Please enter a valid phone number.';
    }
    const service = String(payload.service || '').trim();
    if (service && !ALLOWED_SERVICES.includes(service)) {
        errors.service = 'Please select a valid service.';
    }
    const message = String(payload.message || '').trim();
    if (message.length < 10 || message.length > 5000) {
        errors.message = 'Please describe your requirement (10-5000 characters).';
    }
    return { name, company, email, phone, service, message, errors };
}

export default {
    async fetch(request, env) {
        const cors = corsHeaders(request);
        const origin = request.headers.get('Origin');
        const allowedOrigin = env.ALLOWED_ORIGIN || 'https://ciyent.com';
        if (origin && origin !== allowedOrigin && !allowedOrigin.split(',').map((s) => s.trim()).includes(origin)) {
            return json({ ok: false, error: 'Origin not allowed.' }, 403, cors);
        }

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: cors });
        }
        if (request.method !== 'POST') {
            return json({ ok: false, error: 'Method not allowed.' }, 405, cors);
        }

        let payload;
        try {
            payload = await request.json();
        } catch (err) {
            return json({ ok: false, error: 'Invalid JSON body.' }, 400, cors);
        }

        const clientIp =
            request.headers.get('CF-Connecting-IP') ||
            request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
            'unknown';

        if (payload.website) {
            return json({ ok: true, honeypot: true }, 200, cors);
        }

        const { name, company, email, phone, service, message, errors } = validate(payload);
        if (Object.keys(errors).length) {
            return json({ ok: false, error: 'Please correct the highlighted fields.', errors }, 400, cors);
        }

        const rateKey = `rate:${clientIp}:${Math.floor(Date.now() / 60000)}`;
        const count = (await env.RATE_COUNTER?.get(rateKey)) || '0';
        const attempts = Number(count);
        if (attempts >= 3) {
            return json({ ok: false, error: 'Too many submissions. Please try again later.' }, 429, cors);
        }
        await env.RATE_COUNTER?.put(rateKey, String(attempts + 1), { expirationTtl: 120 });

        const subject = 'New Website Enquiry \u2013 CIYENT TECHNOLOGIES';
        const body = [
            'New website enquiry received.',
            '',
            `Name: ${name}`,
            `Company: ${company || '\u2014'}`,
            `Phone: ${phone}`,
            `Email: ${email}`,
            `Service: ${service || '\u2014'}`,
            '',
            'Message:',
            message,
            '',
            `Submitted: ${new Date().toISOString()}`,
            `Source IP: ${clientIp}`,
        ].join('\n');

        const from = env.FROM_EMAIL || env.SMTP_USER;
        const to = env.TO_EMAIL || env.SMTP_USER;
        const messageId = `<ciyent-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@${env.SMTP_HOST}>`;

        const client = new SmtpClient({ host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 465) });
        try {
            await client.connect();
            await client.expectGreeting();
            await client.helo();
            await client.auth(env.SMTP_USER, env.SMTP_PASSWORD);
            await client.send({ from, to, replyTo: email, subject, body, messageId });
        } catch (err) {
            console.error('SMTP send failed:', err.message);
            return json({ ok: false, error: 'Your enquiry could not be sent right now. Please try again or email us directly.' }, 502, cors);
        } finally {
            await client.close();
        }

        return json({ ok: true, error: null }, 200, cors);
    },
};

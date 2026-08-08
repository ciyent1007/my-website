import { connect } from 'cloudflare:sockets';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function b64Encode(str) {
    const bytes = textEncoder.encode(str);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
}

function formatDateHeader(date) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const pad = (n) => String(n).padStart(2, '0');
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const abs = Math.abs(offset);
    const tz = sign + pad(Math.floor(abs / 60)) + pad(abs % 60);
    return `${days[date.getDay()]}, ${pad(date.getDate())} ${months[date.getMonth()]} ${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${tz}`;
}

function encodeSubject(subject) {
    if (!/[\u0080-\uffff]/.test(subject)) return subject;
    const encoded = b64Encode(subject);
    return `=?UTF-8?B?${encoded}?=`;
}

export class SmtpClient {
    constructor({ host, port = 465 }) {
        this.host = host;
        this.port = port;
        this.buffer = '';
        this.lines = [];
        this.waiters = [];
    }

    async connect() {
        this.socket = connect({ hostname: this.host, port: this.port }, { secureTransport: 'on' });
        await this.socket.opened;
        this.writer = this.socket.writable.getWriter();
        this.reader = this.socket.readable.getReader();
        this.readLoop();
    }

    async readLoop() {
        try {
            for (;;) {
                const { value, done } = await this.reader.read();
                if (done) {
                    this.pushLine(null);
                    break;
                }
                this.buffer += textDecoder.decode(value, { stream: true });
                let idx;
                while ((idx = this.buffer.indexOf('\n')) !== -1) {
                    const line = this.buffer.slice(0, idx).replace(/\r$/, '');
                    this.buffer = this.buffer.slice(idx + 1);
                    this.pushLine(line);
                }
            }
        } catch (err) {
            this.pushLine(null);
        }
    }

    pushLine(line) {
        if (this.waiters.length) {
            const resolve = this.waiters.shift();
            resolve(line);
        } else {
            this.lines.push(line);
        }
    }

    nextLine(timeoutMs = 30000) {
        if (this.lines.length) return Promise.resolve(this.lines.shift());
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                const i = this.waiters.indexOf(resolve);
                if (i !== -1) this.waiters.splice(i, 1);
                resolve(null);
            }, timeoutMs);
            this.waiters.push((line) => {
                clearTimeout(timer);
                resolve(line);
            });
        });
    }

    async readReply() {
        let line = await this.nextLine();
        if (line === null) throw new Error('SMTP connection closed');
        const code = line.slice(0, 3);
        let text = line.slice(4);
        while (line[3] === '-') {
            line = await this.nextLine();
            if (line === null) throw new Error('SMTP connection closed');
            text += '\n' + line.slice(4);
        }
        return { code, text };
    }

    async sendCommand(command, expected) {
        await this.writer.write(textEncoder.encode(command + '\r\n'));
        const reply = await this.readReply();
        if (expected && reply.code !== String(expected)) {
            throw new Error(`SMTP ${command.split(' ')[0]} failed: ${reply.code} ${reply.text}`);
        }
        return reply;
    }

    async expectGreeting() {
        const reply = await this.readReply();
        if (reply.code !== '220') throw new Error(`SMTP greeting failed: ${reply.code} ${reply.text}`);
    }

    async helo() {
        try {
            await this.sendCommand(`EHLO ${this.host}`, 250);
        } catch (err) {
            await this.sendCommand(`HELO ${this.host}`, 250);
        }
    }

    async auth(user, pass) {
        const plain = b64Encode(`\u0000${user}\u0000${pass}`);
        try {
            await this.sendCommand(`AUTH PLAIN ${plain}`, 235);
            return;
        } catch (err) {
            // fall through to LOGIN
        }
        await this.sendCommand('AUTH LOGIN', 334);
        await this.sendCommand(b64Encode(user), 334);
        await this.sendCommand(b64Encode(pass), 235);
    }

    async send({ from, to, replyTo, subject, body, messageId }) {
        await this.sendCommand(`MAIL FROM:<${from}>`, 250);
        await this.sendCommand(`RCPT TO:<${to}>`, 250);
        await this.sendCommand('DATA', 354);

        const dateHeader = formatDateHeader(new Date());
        const headerLines = [
            `From: CIYENT TECHNOLOGIES <${from}>`,
            `To: <${to}>`,
            `Reply-To: <${replyTo}>`,
            `Subject: ${encodeSubject(subject)}`,
            `Date: ${dateHeader}`,
            `Message-ID: ${messageId}`,
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
            '',
            '',
        ];
        const message = headerLines.join('\r\n') + body.replace(/\r?\n/g, '\r\n') + '\r\n';
        const framed = message.replace(/^\./gm, '..');
        await this.writer.write(textEncoder.encode(framed + '.\r\n'));
        const dataReply = await this.readReply();
        if (dataReply.code !== '250') {
            throw new Error(`SMTP DATA failed: ${dataReply.code} ${dataReply.text}`);
        }

        await this.sendCommand('QUIT', 221).catch(() => {});
    }

    async close() {
        try {
            if (this.socket) await this.socket.close();
        } catch (err) {
            // ignore
        }
    }
}

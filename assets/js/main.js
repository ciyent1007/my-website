document.documentElement.classList.add('js');

(function () {
    'use strict';

    const toggle = document.getElementById('mobile-menu-toggle');
    const nav = document.getElementById('main-nav');

    function setMenu(open) {
        if (!toggle || !nav) return;
        nav.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', String(open));
    }

    if (toggle && nav) {
        toggle.addEventListener('click', () => {
            setMenu(!nav.classList.contains('is-open'));
        });
        nav.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => setMenu(false));
        });
        document.addEventListener('click', (e) => {
            if (nav.classList.contains('is-open') && !nav.contains(e.target) && !toggle.contains(e.target)) {
                setMenu(false);
            }
        });
    }

    const reveals = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window && reveals.length) {
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        io.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
        );
        reveals.forEach((el) => io.observe(el));
    } else {
        reveals.forEach((el) => el.classList.add('is-visible'));
    }

    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        const submitBtn = document.getElementById('contact-submit');
        const status = document.getElementById('form-status');
        const endpoint = contactForm.dataset.endpoint;
        const fieldErrors = {
            name: document.getElementById('name-error'),
            phone: document.getElementById('phone-error'),
            email: document.getElementById('email-error'),
            message: document.getElementById('message-error'),
        };

        const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        const PHONE_RE = /^[+\d][\d\s().-]{6,19}$/;

        function setStatus(text, type) {
            if (!status) return;
            status.textContent = text || '';
            status.className = 'form-status' + (type ? ' is-' + type : '');
        }

        function setFieldError(key, message) {
            const el = fieldErrors[key];
            if (el) {
                el.textContent = message || '';
                const group = el.closest('.form-group');
                if (group) group.classList.toggle('has-error', Boolean(message));
            }
        }

        function validate() {
            let ok = true;
            const name = contactForm.elements.name.value.trim();
            const phone = contactForm.elements.phone.value.trim();
            const email = contactForm.elements.email.value.trim();
            const message = contactForm.elements.message.value.trim();

            const checks = {
                name: name.length >= 2 && name.length <= 100 ? '' : 'Please enter your full name (2-100 characters).',
                phone: PHONE_RE.test(phone) ? '' : 'Please enter a valid phone number.',
                email: EMAIL_RE.test(email) && email.length <= 254 ? '' : 'Please enter a valid email address.',
                message: message.length >= 10 && message.length <= 5000 ? '' : 'Please describe your requirement (10-5000 characters).',
            };

            Object.entries(checks).forEach(([key, msg]) => {
                setFieldError(key, msg);
                if (msg) ok = false;
            });
            return ok;
        }

        async function submitForm(event) {
            event.preventDefault();
            if (submitBtn.disabled) return;
            if (!validate()) {
                setStatus('Please correct the highlighted fields.', 'error');
                return;
            }
            if (!endpoint) {
                setStatus('The contact form is not connected yet. Please email us directly.', 'error');
                return;
            }

            setStatus('', '');
            submitBtn.disabled = true;
            const original = submitBtn.textContent;
            submitBtn.textContent = 'Sending...';

            try {
                const formData = new FormData(contactForm);
                const payload = Object.fromEntries(formData.entries());
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data.ok) {
                    if (typeof gtag === 'function') {
                        gtag('event', 'generate_lead', {
                            event_category: 'contact_form',
                            event_label: 'Enquiry submitted',
                        });
                    }
                    setStatus('Thank you! Your enquiry has been sent. We will get back to you within one business day.', 'success');
                    contactForm.reset();
                    Object.keys(fieldErrors).forEach((key) => setFieldError(key, ''));
                } else {
                    const msg = data.error || 'Something went wrong. Please try again or email us directly.';
                    if (data.errors) {
                        Object.entries(data.errors).forEach(([key, message]) => setFieldError(key, message));
                        setStatus('Please correct the highlighted fields.', 'error');
                    } else {
                        setStatus(msg, 'error');
                    }
                }
            } catch (err) {
                setStatus('Network error. Please check your connection and try again.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = original;
            }
        }

        contactForm.addEventListener('submit', submitForm);
        ['name', 'phone', 'email', 'message'].forEach((key) => {
            const input = contactForm.elements[key];
            if (input) {
                input.addEventListener('input', () => {
                    setFieldError(key, '');
                    setStatus('', '');
                });
            }
        });
    }
})();

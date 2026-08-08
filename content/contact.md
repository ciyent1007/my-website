---
title: "Contact Us"
description: "Contact CIYENT TECHNOLOGIES for IT infrastructure services and support."
---
Reach out to our experts for a consultation. 

**Phone:** +91 87968 59107  
**Email:** support@ciyent.com  

### Send us a Message

*(Note: To make this form functional on a static site, replace the `action` attribute with an endpoint from a service like [Formspree](https://formspree.io/) or [Netlify Forms].)*

<form action="https://formspree.io/f/YOUR_FORM_ID" method="POST" class="contact-form">
    <div style="margin-bottom: 1rem;">
        <label>Name</label><br>
        <input type="text" name="name" required style="width:100%; padding: 0.5rem;">
    </div>
    <div style="margin-bottom: 1rem;">
        <label>Company/Organization</label><br>
        <input type="text" name="company" style="width:100%; padding: 0.5rem;">
    </div>
    <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
        <div style="flex: 1;">
            <label>Phone</label><br>
            <input type="tel" name="phone" required style="width:100%; padding: 0.5rem;">
        </div>
        <div style="flex: 1;">
            <label>Email</label><br>
            <input type="email" name="email" required style="width:100%; padding: 0.5rem;">
        </div>
    </div>
    <div style="margin-bottom: 1rem;">
        <label>Service Required</label><br>
        <select name="service" style="width:100%; padding: 0.5rem;">
            <option>IT Support & AMC</option>
            <option>Network & Security</option>
            <option>Cloud & Backup</option>
            <option>IT Training</option>
            <option>Other</option>
        </select>
    </div>
    <div style="margin-bottom: 1rem;">
        <label>Message</label><br>
        <textarea name="message" rows="5" required style="width:100%; padding: 0.5rem;"></textarea>
    </div>
    <button type="submit" class="btn btn-primary">Send Enquiry</button>
</form>

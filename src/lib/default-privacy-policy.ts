/**
 * Default content for the Privacy & Cookie Policy page.
 * This content is used as a fallback when no custom content has been saved in the database.
 * It is stored in the database under the key "privacy-policy" and is editable by root users
 * via the admin content management page (/admin/content).
 *
 * The site URL is read from the AUTH_URL environment variable so that the default policy
 * reflects the actual deployment URL rather than a hard-coded domain.
 */
export function getDefaultPrivacyPolicy(): string {
  const raw = (process.env.AUTH_URL ?? '').replace(/\/$/, '');
  if (!raw) {
    console.warn('AUTH_URL is not set — the default privacy policy will show a placeholder URL. Set AUTH_URL in .env to the public-facing URL of this deployment.');
  }
  const siteUrl = raw || '[site URL not configured — set AUTH_URL in .env]';
  return defaultPrivacyPolicyTemplate(siteUrl);
}

function defaultPrivacyPolicyTemplate(siteUrl: string): string {
  return `PRIVACY AND COOKIE POLICY
City of Norwich Aviation Museum — Volunteer Management System
Site: ${siteUrl}

Last updated: April 2026

───────────────────────────────────────────────────────────────

1. WHO WE ARE

City of Norwich Aviation Museum ("CNAM", "we", "us", or "our") operates the CNAM Volunteer Management System ("VMS") at ${siteUrl} ("the Site"). CNAM is the Data Controller for all personal data processed through this system.

This Privacy and Cookie Policy explains what personal data we collect, why we collect it, how we use it, and your rights under the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.

This policy applies to all users of the VMS, including volunteers, staff, and members.

───────────────────────────────────────────────────────────────

2. WHAT INFORMATION WE COLLECT

a) Personal information
  • Full name
  • Email address
  • Mobile telephone number(s)
  • Account type (Volunteer, Staff, or Member)
  • Availability preferences and scheduling information
  • Sign-up history for museum events and duty rotas

b) Technical information
  • IP address (recorded in audit logs for security purposes)
  • Browser and device information (User-Agent string, recorded in audit logs)
  • Session tokens (stored as secure, HttpOnly cookies)

c) Authentication data
  • Hashed passwords (using the scrypt algorithm — we never store plain-text passwords)
  • One-time passcodes (OTPs) sent by email during two-step sign-in (deleted immediately after use or expiry)

───────────────────────────────────────────────────────────────

3. HOW WE USE YOUR INFORMATION

We use the information we collect to:
  • Authenticate your identity and maintain your session securely
  • Manage your volunteering profile, availability, and event sign-ups
  • Send you important operational notifications (e.g. OTP codes) via email
  • Maintain an audit trail of actions performed within the system for security and accountability purposes
  • Administer the museum's scheduling and rostering processes

We do not sell, rent, or share your personal data with third parties for commercial or marketing purposes.

───────────────────────────────────────────────────────────────

4. LAWFUL BASIS FOR PROCESSING (Article 6, UK GDPR)

We process your personal data on the following lawful bases:

  • Contract (Article 6(1)(b)): processing is necessary to provide the VMS service you have registered to use and to fulfil obligations to registered volunteers and staff.
  • Legitimate interests (Article 6(1)(f)): operating, securing, and auditing the system in a manner consistent with running a museum and managing a volunteer workforce.
  • Consent (Article 6(1)(a)): where you have explicitly opted in to specific communications or data uses.

───────────────────────────────────────────────────────────────

5. WHERE YOUR DATA IS STORED

All data is stored in a SQLite database on the server hosting the CNAM VMS. No data is transmitted to third-party cloud services, advertising networks, or analytics platforms. The server is controlled by CNAM.

Outbound emails (such as OTP codes and password-reset links) are sent via a configured SMTP service. Please refer to that service provider's privacy policy if applicable.

───────────────────────────────────────────────────────────────

6. COOKIES

What are cookies?
Cookies are small text files placed on your device by your web browser when you visit a website. They help websites remember information about your visit and enable certain functionality.

Cookies we use:

┌─────────────────────────────────┬────────────┬─────────────────────────────────────────────────────────┬──────────────────────────┐
│ Cookie Name                     │ Type       │ Purpose                                                 │ Duration                 │
├─────────────────────────────────┼────────────┼─────────────────────────────────────────────────────────┼──────────────────────────┤
│ next-auth.session-token         │ Essential  │ Maintains your authenticated session                    │ Session / up to 30 days  │
│ __Secure-next-auth.session-token│ Essential  │ Secure version of session token (HTTPS connections)     │ Session / up to 30 days  │
│ _cnam_pending_uid               │ Essential  │ Holds your user ID during the two-step sign-in flow     │ ~2 minutes               │
│ _cnam_cb                        │ Essential  │ Remembers the page you were trying to reach at sign-in  │ ~2 minutes               │
│ cookie-consent                  │ Preferences│ Remembers your acknowledgement of this cookie notice    │ Until cleared            │
└─────────────────────────────────┴────────────┴─────────────────────────────────────────────────────────┴──────────────────────────┘

We use only ESSENTIAL cookies — cookies that are strictly necessary for the Site to function. We do not use tracking, advertising, analytics, or any third-party cookies.

Because we use only essential cookies, you cannot opt out of functional cookies without also losing the ability to sign in to the Site. You may dismiss the cookie notice banner without affecting your ability to use the Site.

Managing cookies:
You can delete or block cookies through your browser settings. Please be aware that blocking essential cookies will prevent you from signing in and using the VMS. The following browser help pages explain how to manage cookies:
  • Google Chrome: https://support.google.com/chrome/answer/95647
  • Mozilla Firefox: https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer
  • Apple Safari: https://support.apple.com/en-gb/guide/safari/sfri11471/mac
  • Microsoft Edge: https://support.microsoft.com/en-gb/topic/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09

───────────────────────────────────────────────────────────────

7. DATA RETENTION

┌──────────────────────┬──────────────────────────────────────────────────────────────────────────────────┐
│ Data Type            │ Retention Period                                                                 │
├──────────────────────┼──────────────────────────────────────────────────────────────────────────────────┤
│ Account data         │ Until you request deletion or your account is removed by an administrator        │
│ Audit logs           │ 12 months (or as required by CNAM policy)                                        │
│ Session tokens       │ Until sign-out or expiry (maximum 30 days)                                       │
│ Uploaded files       │ Until removed by an administrator                                                │
│ OTP tokens           │ 5 minutes maximum (deleted automatically after use or expiry)                    │
│ Cookie consent flag  │ Until you clear your browser's local storage                                     │
└──────────────────────┴──────────────────────────────────────────────────────────────────────────────────┘

───────────────────────────────────────────────────────────────

8. DATA SECURITY

We implement appropriate technical and organisational measures to protect your personal data, including:

  • TLS/HTTPS encryption for all data in transit
  • scrypt hashing for all passwords (plain-text passwords are never stored or transmitted)
  • Secure, HttpOnly cookies for session management to prevent client-side script access
  • Brute-force rate limiting for authentication attempts
  • Audit logging of all sensitive actions, including sign-in events and administrative changes

Despite these measures, no system is entirely secure. In the event of a data breach that is likely to result in a risk to your rights and freedoms, we will notify the Information Commissioner's Office (ICO) within 72 hours and affected individuals without undue delay.

───────────────────────────────────────────────────────────────

9. YOUR RIGHTS UNDER UK GDPR

You have the following rights regarding your personal data:

  • Right of access (Article 15): you may request a copy of all personal data we hold about you.
  • Right to rectification (Article 16): you may correct inaccurate or incomplete data via your profile settings or by contacting the administrator.
  • Right to erasure / "right to be forgotten" (Article 17): you may request that we delete your personal data. Subject to any legal obligation to retain it, we will action such requests promptly.
  • Right to restriction of processing (Article 18): you may ask us to restrict how we process your data in certain circumstances.
  • Right to data portability (Article 20): where processing is automated and based on consent or contract, you may request your data in a structured, commonly used, machine-readable format.
  • Right to object (Article 21): you may object to processing based on legitimate interests. Note that objecting may prevent us from providing the service.

To exercise any of these rights, please contact CNAM using the details in Section 11. We will respond within one calendar month as required by UK GDPR.

───────────────────────────────────────────────────────────────

10. CHANGES TO THIS POLICY

This policy may be updated when the application or our data processing activities change. The "Last updated" date at the top of this document will be revised accordingly. Significant changes will be communicated via an announcement on the Site.

───────────────────────────────────────────────────────────────

11. CONTACT AND COMPLAINTS

For any data protection queries or to exercise your rights, please contact:

  City of Norwich Aviation Museum
  Old Norwich Road
  Horsham St Faith
  Norwich
  NR10 3JF

  [Contact details to be confirmed by the museum]

If you are not satisfied with our response, you have the right to lodge a complaint with the Information Commissioner's Office (ICO):
  Website: https://ico.org.uk/make-a-complaint
  Telephone: 0303 123 1113`;
}

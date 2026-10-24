# Privacy policy v1.4, DRAFT for counsel

Status: **DRAFT. Not published.** `privacy.html` stays at v1.3 until counsel approves this text and
Aditi confirms (WAITLIST_INLINE_V1 stage B2). Written 2026-10-24 for counsel's condition 1
(`biowellth-backend-supa` `docs/evidence/counsel-reply-waitlist-2026-10.md`). v1.3 is quoted from
`privacy.html` as served on biowellth.ai.

Only the passages below change. Everything else in v1.3 stays word for word. The v1.3 paragraphs
carry "do not edit in place, a change is a new version" comments, which is why this is v1.4.

## Notes for counsel (not part of the policy)

1. **Typeform and the 12-month rule.** The Typeform paragraph says responses are kept "under the
   same 12-month retention rule". Today nothing deletes Typeform responses at 12 months or on
   invitation. The founder ruled that nothing is deleted from Typeform except a person's own
   response on a removal request. To make the sentence true, either a dated manual deletion step is
   added, or the sentence changes. The age of the oldest response has also not been checked.
2. **Two facts still bracketed**: which fields the Typeform form asked for besides email, and where
   Typeform stores responses. Both come from the Typeform admin.
3. **The IP hash** is not named in the policy. It is a salted hash, kept for at most 24 hours, for
   abuse prevention only, and documented internally as you asked. If you want it named, one clause
   can join "Basic technical information ... security records".
4. **The signup notice** under the button is your approved line: "We'll email you about early
   access. You can remove yourself at any time. Privacy Policy."

## v1.4 text of the changed passages

**Header**
> Version 1.4. Effective date [date of publication]

**Opening paragraph**: only the date changes.
> Effective date [date of publication]. BioWellth, Inc. ...

**1. What we collect.** One sentence is added after the first.
> Waitlist information if you join our waitlist, meaning your email address, the campaign tags in
> the link that brought you to our site, the website that referred you, and, only if you choose to
> tell us, the city you live in.

**2. Why we collect it.** Two sentences are added after "To keep your account secure and the service
working."
> If you join our waitlist, we use your email address to confirm your signup and to invite you to
> early access, the campaign tags and referring website to understand which links and sites bring
> people to the waitlist, and your city, if you give it, to plan where early access opens first. We
> do not use waitlist information for any other purpose.

**3. The service providers we use, named.** The Resend paragraph is replaced.
> We use Resend to send transactional account emails, such as account confirmation, password reset,
> and sign-in emails, and waitlist emails, such as the welcome email when you join our waitlist and
> your invitation when early access opens. Resend receives your email address, your display name if
> you have an account, and the contents of the email needed to deliver it, including for people on
> our waitlist who do not have an account. Resend may use Amazon Web Services/Amazon SES as its
> delivery infrastructure.

**3. The service providers we use, named.** A new paragraph follows Resend.
> Our waitlist form was previously hosted by Typeform. Typeform received the email address and
> [any other answers the form asked for] given in that form, together with the campaign tags in the
> link that brought you to it, and stored them [location, to be confirmed with Typeform]. Responses
> already given are retained in Typeform and used only to invite you to early access, under the
> same 12-month retention rule as other waitlist information. [If the Typeform form remains open to
> new responses, this must change to present tense.]

**4. Where your information lives.** The first sentence is replaced.
> Your account and wellness information, and the waitlist information of people who join our
> waitlist on our website, including people who do not have an account, is stored with Supabase in
> Mumbai, India.

**5. Your choices and controls.** One sentence is added after "You can delete your entire account."
> If you join our waitlist, you can remove yourself at any time with the link in any waitlist email
> or by writing to us, and that deletes your waitlist information and stops waitlist emails to you.

**6. How deletion works.** One sentence is added at the start.
> We delete waitlist information 12 months after you join the waitlist, or earlier when you are
> invited to early access or create an account, whichever comes first.

## Before and after, against v1.3

`-` is v1.3 as published, `+` is v1.4. Unchanged sentences in a changed paragraph are shown for
context. Paragraphs not listed do not change.

```diff
  Header (privacy.html:151)
- Version 1.3. Effective date September 24, 2026
+ Version 1.4. Effective date [date of publication]

  Opening (privacy.html:156)
- Effective date September 24, 2026. BioWellth, Inc. ("BioWellth", "we") operates biowellth.ai, ...
+ Effective date [date of publication]. BioWellth, Inc. ("BioWellth", "we") operates biowellth.ai, ...

  1. What we collect (privacy.html:158)
  Account information such as your name, email address, and date of birth.
+ Waitlist information if you join our waitlist, meaning your email address, the campaign tags in the link that brought you to our site, the website that referred you, and, only if you choose to tell us, the city you live in.
  Wellness information you choose to provide, ...

  2. Why we collect it (privacy.html:160)
  To keep your account secure and the service working.
+ If you join our waitlist, we use your email address to confirm your signup and to invite you to early access, the campaign tags and referring website to understand which links and sites bring people to the waitlist, and your city, if you give it, to plan where early access opens first. We do not use waitlist information for any other purpose.
  To meet our legal obligations.

  3. Resend (privacy.html:179)
- We use Resend to send transactional account emails, such as account confirmation, password reset, and sign-in emails. Resend receives your email address, display name, and the contents of the transactional email needed to deliver it.
+ We use Resend to send transactional account emails, such as account confirmation, password reset, and sign-in emails, and waitlist emails, such as the welcome email when you join our waitlist and your invitation when early access opens. Resend receives your email address, your display name if you have an account, and the contents of the email needed to deliver it, including for people on our waitlist who do not have an account.
  Resend may use Amazon Web Services/Amazon SES as its delivery infrastructure.

  3. Typeform (new paragraph after Resend)
+ Our waitlist form was previously hosted by Typeform. Typeform received the email address and [any other answers the form asked for] given in that form, together with the campaign tags in the link that brought you to it, and stored them [location, to be confirmed with Typeform]. Responses already given are retained in Typeform and used only to invite you to early access, under the same 12-month retention rule as other waitlist information. [If the Typeform form remains open to new responses, this must change to present tense.]

  4. Where your information lives (privacy.html:194)
- Your account and wellness information is stored with Supabase in Mumbai, India.
+ Your account and wellness information, and the waitlist information of people who join our waitlist on our website, including people who do not have an account, is stored with Supabase in Mumbai, India.
  AI processing occurs with the providers and in the locations described in section 3. ...

  5. Your choices and controls (privacy.html:196)
  You can delete your entire account.
+ If you join our waitlist, you can remove yourself at any time with the link in any waitlist email or by writing to us, and that deletes your waitlist information and stops waitlist emails to you.
  You can also reach us at support@mybiowellth.com for any of these requests.

  6. How deletion works (privacy.html:198)
+ We delete waitlist information 12 months after you join the waitlist, or earlier when you are invited to early access or create an account, whichever comes first.
  When you delete your account, we delete your information from our active systems promptly. ...
```

## How the draft maps to counsel's list (Part A, item 1)

| Counsel asked for | Where |
|---|---|
| Email, campaign and referrer information, and the purpose of each field | Sections 1 and 2 |
| Supabase as storage, including for people without accounts | Section 4 |
| Resend for waitlist emails, including for non-account holders | Section 3, Resend |
| The removal process and the retention period | Sections 5 and 6 |
| Typeform as a former provider, in the past tense | Section 3, Typeform (see note 1) |
| City as optional | Sections 1 and 2 ("only if you choose to tell us", "if you give it") |

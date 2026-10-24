# Website waitlist signup: request for review under condition 6

From Aditi Pillai, BioWellth. October 2026. Draft for counsel.

We would like to add a simple email signup to the biowellth.ai homepage, alongside our existing Typeform waitlist form, which stays exactly as it is. Privacy policy v1.3 does not cover the new signup, and on checking, it does not cover the Typeform either, so we would like your review before we build.

## 1. What would change

- **An email signup on the homepage.** One field and one button ("Join the waitlist"), in two places on the homepage. We collect the email address only. No name and no health information at signup.
- **Campaign tags and referrer.** With each signup we store the campaign tags already in the link (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, for example "ig, social") and the referring website, reduced to its domain only (for example linkedin.com, never the full page address).
- **Storage.** A new table in our existing Supabase database in Mumbai, India. The website cannot read it, and only our server-side function writes to it. Each row is marked as a website signup.
- **Welcome email.** Sent through Resend, our existing email provider, from no-reply@send.mybiowellth.com.
- **Two optional questions in the welcome email**, each answered with one tap on a link:
  - "What do you most want to understand about your body?" Hormones and cycle, Energy, Gut, Metabolism, or Skin and hair.
  - "Where do you live?" Bangalore, Mumbai, Delhi NCR, Chennai, Hyderabad, Pune, Kolkata, Elsewhere in India, US, UK, or Elsewhere outside India.
  We store one answer per question against the signup. Both are optional, a later tap replaces an earlier one, and the answers are used only to plan early access.
- **Removal.** Every email has a link to remove yourself. Removing yourself deletes the record and both answers. The same deletion is available by writing to support@mybiowellth.com.
- **Abuse protection.** To limit repeated submissions, we keep a one-way scrambled form (a salted hash) of the visitor's IP address for at most 24 hours. The IP address itself is never stored.
- **Retention.** Set by you (question 1). The deletion job is built but stays off until you confirm a period.

## 2. The existing gap

Our existing waitlist is a Typeform form (form `t0eULTZa`, embedded on biowellth.ai, `index.html` lines 801 and 804). It collects email addresses, and the campaign tags `utm_source`, `utm_medium` and `utm_content` are passed into it. It stays in use, unchanged. **Typeform is not named anywhere in privacy policy v1.3.** The three passages that come closest, quoted exactly from v1.3 (`privacy.html`), are below.

Line 158, section 1, What we collect:

> Account information such as your name, email address, and date of birth. Wellness information you choose to provide, including uploaded blood test reports, cycle and life stage information, dietary preferences, supplements, diagnosed conditions, symptoms you tell us about, medicines you take regularly, hormonal contraception or hormone therapy, and notes you add for context. Information generated for you, including transcribed results, wellness interpretations, scores, and trends. Sana conversations, meaning your questions to our AI companion and its responses. Basic technical information needed to run the service, such as login and security records.

Line 179, section 3, Resend:

> We use Resend to send transactional account emails, such as account confirmation, password reset, and sign-in emails. Resend receives your email address, display name, and the contents of the transactional email needed to deliver it. Resend may use Amazon Web Services/Amazon SES as its delivery infrastructure.

Line 194, section 4, Where your information lives:

> Your account and wellness information is stored with Supabase in Mumbai, India. AI processing occurs with the providers and in the locations described in section 3. This means some of your information is processed outside India and outside the United States, as described above.

All three are written for account holders. A waitlist signup is not an account, and the welcome email is not a transactional account email.

## 3. Proposed v1.4 wording

The smallest additions we could find, in the policy's existing voice. `-` is v1.3, `+` is the proposed v1.4. Bracketed items need a fact or a ruling before this is final.

**Section 1, What we collect** (line 158). One new sentence after the first.

```diff
  Account information such as your name, email address, and date of birth.
+ Waitlist information if you join our waitlist, meaning your email address, the campaign tags in the link that brought you to our site, the website that referred you, and, if you choose to answer the optional questions in our welcome email, what you most want to understand about your body and where you live.
  Wellness information you choose to provide, ...
```

**Section 2, Why we collect it** (line 160). One new sentence, so the new collection has a stated purpose.

```diff
  To keep your account secure and the service working.
+ To tell you when early access is available, and to plan it, if you join our waitlist.
  To meet our legal obligations.
```

**Section 3, Resend** (line 179).

```diff
- We use Resend to send transactional account emails, such as account confirmation, password reset, and sign-in emails. Resend receives your email address, display name, and the contents of the transactional email needed to deliver it.
+ We use Resend to send transactional account emails, such as account confirmation, password reset, and sign-in emails, and waitlist emails, such as the welcome email when you join our waitlist and your invitation when early access opens. Resend receives your email address, your display name if you have an account, and the contents of the email needed to deliver it.
  Resend may use Amazon Web Services/Amazon SES as its delivery infrastructure.
```

**Section 3, Typeform** (new paragraph after Resend).

```diff
+ You can also join our waitlist through a form hosted by Typeform. Typeform receives your email address, [any other answers the form asks for, to be confirmed from the form], and the campaign tags in the link that brought you to the form. Typeform stores this [location, to be confirmed with Typeform].
```

**Section 4, Where your information lives** (line 194).

```diff
- Your account and wellness information is stored with Supabase in Mumbai, India.
+ Your account and wellness information, and your waitlist information if you join our waitlist on our website, are stored with Supabase in Mumbai, India.
```

**Section 5, Your choices and controls** (line 196). One new sentence, which states the removal route.

```diff
  You can delete your entire account.
+ If you join our waitlist, you can remove yourself at any time with the link in any waitlist email or by writing to us, and that deletes your waitlist information, including your answers.
```

**Section 6, How deletion works.** One sentence once you set the period: "We delete waitlist information [period]."

## 4. Questions for you

1. **Retention.** How long may we keep a waitlist email and its answers? For example, a fixed period from signup, or until the person is invited or creates an account.
2. **Is the welcome email marketing?** If so, do we need consent wording at the email field? If you want a line under the button, our draft is "We'll email you about early access. You can remove yourself at any time."
3. **Is a self-selected interest health information?** If someone without an account taps "Hormones and cycle" (or Energy, Gut, Metabolism, Skin and hair), is that answer health information under the policy and the DPDP Act? If it is, does it need wording at the point of tagging, for example a line next to the question saying how the answer is used, and should the policy's health-information commitments name it? We could also drop "Hormones and cycle" or reword the options if you prefer.
4. **Existing Typeform signups.** These people gave their email under v1.3, which does not name Typeform, and the Typeform stays in use. Once v1.4 names Typeform, do earlier signups need a notice?
5. **Re-consent.** We do not expect re-consent to be needed. No account holder's data or processing changes, and the Resend change covers only waitlist emails. Please confirm.
6. **The 24-hour IP hash.** Is it covered by "Basic technical information needed to run the service, such as login and security records", or should it be named?

Nothing will be built until we hear from you.

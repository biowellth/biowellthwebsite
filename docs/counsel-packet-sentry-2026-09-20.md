# Counsel packet, Sentry error monitoring disclosure

**Date** 2026-09-20. **Prepared for** counsel review. **Status** draft, nothing published.

**What is being asked.** BioWellth has added Sentry, a client side error monitoring
service, to biowellth.ai. This packet proposes the privacy policy paragraph that
discloses it, and asks three questions. Nothing is live. The paragraph is committed but
not published, and the policy version has been moved to 1.2 with the effective date left
deliberately blank until you clear it.

---

## 1. The proposed paragraph, verbatim

This is the exact text proposed for section 3 of the privacy policy, placed after the
Resend paragraph.

> We use Sentry for client side error monitoring, so that we can detect and diagnose faults in the website. Sentry receives the type of error, the technical stack trace, your browser and operating system, the address of the page you were on with any query string removed, a random identifier for your browser that is not linked to your account, and a short trail of your recent activity in the page that is redacted before it is sent. Sentry does not receive your name, your email address, your biomarker values, your report identifiers, or the names of files you upload. Sentry does not store your IP address. If an error report would contain a report identifier, it is reduced to a record that an error happened before anything leaves your browser. We do not use session replay, performance tracing, or logging with Sentry. Sentry stores this information in the European Union.

---

## 2. What Sentry is, and what it handles

**What it is.** Sentry is an error monitoring service. When a fault occurs in the website
in someone's browser, Sentry records a technical description of that fault so we can find
and fix it. It is the only thing it does here. We use it for no other purpose.

**Why we want it.** Before this, the website had no client side error capture of any
kind. A fault in someone's browser was invisible to us unless they told us about it.

**What Sentry receives.**

- the type of error and its technical stack trace
- the browser and operating system
- the address of the page, with any query string removed
- a random identifier for the browser, described below
- a short trail of recent activity in the page, redacted before it is sent

**What Sentry does not receive.** No name. No email address. No biomarker or lab values.
No report identifiers. No names of uploaded files. These are not merely omitted by
configuration, they are removed or blocked by code that runs before anything is sent, and
each of these was tested by deliberately triggering an error containing the thing in
question and confirming it did not arrive.

**The random browser identifier.** Sixteen random characters, generated in the browser and
kept there. It is not the account identifier, not an email address, and is not linked to
the account. It lets us tell "one browser hit this fault forty times" apart from "forty
people hit it once", which is the difference between a minor bug and a widespread one.
Clearing site data replaces it.

**The safety catch.** If an error report would contain a report identifier despite the
above, the entire report is reduced before transmission to a bare record that an error of
a given type occurred, with no message, no technical detail and no activity trail. This
was tested end to end on the live site.

**Storage region.** The European Union. The Sentry project is on Sentry's EU
infrastructure.

**What we do not use.** No session replay, meaning no recording or reconstruction of what
a person did on screen. No performance tracing. No logging. The version of the Sentry
software loaded by the site does not contain the session recording code at all, so this is
a property of what is installed and not only of how it is configured.

---

## 3. Question one, the section heading

Section 3 of the policy is headed **"The AI services we use, named"**. It names Anthropic,
Microsoft and Resend.

Resend, a transactional email provider, is not an AI service. It was placed in section 3
in the version 1.1 round because that is the only named third party section the policy
has, and at that time the heading wording was recorded as an open question for counsel and
was not resolved.

**Sentry is the second non-AI processor placed under a heading that says AI.** One such
entry was arguably a tolerable exception. Two starts to look like the heading is simply
inaccurate.

Three questions, and we would like a direction rather than a preference:

1. Should the heading be reworded to cover named third parties generally rather than AI
   services specifically?
2. Or should a separate section hold non-AI processors?
3. If a separate section, does the Resend paragraph move into it, which would change text
   you approved verbatim on 2026-09-07?

We have not changed the heading. Changing approved wording without asking is what this
question exists to avoid.

---

## 4. Question two, the IP address wording

The proposed paragraph says Sentry **does not store** your IP address. An earlier draft
said does not receive, and we changed it because we believe does not receive overstates
the position.

**The technical position, stated precisely.** The Sentry software is configured so that no
IP address is attached to an event or stored with it. We verified this on a real event
sent from the live site and the stored record carries no IP address. However, Sentry's
servers terminate the network connection that carries the event, and any server that
answers a connection observes the source address of that connection in transit, whatever
the software chooses to send. So an IP address is observed in transit and is not attached
to or stored on the record.

**The question.** Which formulation do you want in the published text?

- "Sentry does not store your IP address", the current proposal
- "Sentry does not receive your IP address", which we think is too strong
- some other wording you prefer

The remaining items in that list, name, email address, biomarker values, report
identifiers and uploaded file names, are genuinely not received, and the sentence was
split so that this distinction is not lost.

---

## 5. Data processing agreement status

**DPA status, Sentry, Article 28 processing agreement: ACCEPTED.**

Accepted 2026-09-20. Sentry Data Processing Amendment version 5.1.0, signed via
Sentry's self-serve Legal & Compliance page, organization biowellth, by
general@mybiowellth.com. Data Storage Region is European Union. Terms of Service and
Privacy Policy were accepted at org creation the same day. The SOC2 Bridge Letter is
deliberately not accepted, being a confidentiality acknowledgment for reading their audit
report rather than a processing term. The Business Associate Agreement is not self-serve
and is not applicable at present, since BioWellth does not handle PHI under HIPAA.

---

## 6. What happens next

1. Counsel answers questions one and two.
2. The heading is changed, or not, per that answer.
3. The effective date placeholder is replaced with the cleared date, in the two places the
   policy carries it.
4. The policy is published as version 1.2.

Nothing above ships until step 1 is complete.

"use client";

import { FormEvent, useState } from "react";

export function ContactMailto({ supportEmail }: { supportEmail?: string | null }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!supportEmail) return;
    const href = `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    window.location.href = href;
  }
  return <form className="panel" onSubmit={submit}>
    <p className="eyebrow">Contact</p><h2>Open a message in your email app</h2>
    <label>Subject<input required maxLength={160} value={subject} onChange={event => setSubject(event.target.value)} /></label>
    <label>Message<textarea required maxLength={5_000} value={message} onChange={event => setMessage(event.target.value)} /></label>
    <div className="actions"><button className="primary" type="submit" disabled={!supportEmail}>Send message</button></div>
    <p className="privacy-note">This form does not POST your message to Provenance Cleaner or store it. It opens a draft in your email client.{!supportEmail ? " A production support address still needs to be configured." : ""}</p>
  </form>;
}

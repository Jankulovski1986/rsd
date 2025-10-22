"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const doLogin = async () => {
    setErr(null);
    const res = await signIn("credentials", { email, password, callbackUrl: "/" , redirect: false });
    if (res?.error) setErr("Login fehlgeschlagen");
    if (res?.ok) window.location.href = "/";
  };

  return (
    <div className="p-6 max-w-sm mx-auto">
      <h1 className="text-xl mb-4">Anmelden</h1>
      {err && <div className="mb-2 text-red-600">{err}</div>}
      <input className="border p-2 w-full mb-2" placeholder="E-Mail" value={email} onChange={e=>setEmail(e.target.value)} />
      <input className="border p-2 w-full mb-4" placeholder="Passwort" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
      <button className="border px-4 py-2" onClick={doLogin}>Login</button>
    </div>
  );
}


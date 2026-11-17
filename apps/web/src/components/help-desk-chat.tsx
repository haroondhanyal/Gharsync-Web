"use client";

import { useRef, useState } from "react";
import { Bot, FileText, Image as ImageIcon, LoaderCircle, Mic, Paperclip, Send, Volume2, X } from "lucide-react";

const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";
type ChatMessage = { role: "user" | "assistant"; content: string; fileName?: string; notice?: string };
type SpeechResult = { transcript: string };
type SpeechEvent = Event & { results: ArrayLike<ArrayLike<SpeechResult>> };
type SpeechRecognizer = { lang: string; interimResults: boolean; onresult: ((event: SpeechEvent) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechRecognizer; webkitSpeechRecognition?: new () => SpeechRecognizer };

export function HelpDeskChat({ configured, model = "lfm3-omni" }: { configured: boolean; model?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  async function send(event: React.FormEvent) {
    event.preventDefault(); if ((!text.trim() && !file) || busy) return;
    const prompt = text.trim(); const currentFile = file; const prior = messages;
    const next = [...prior, { role: "user" as const, content: prompt || `File bheji: ${currentFile?.name}`, ...(currentFile ? { fileName: currentFile.name } : {}) }];
    setMessages(next); setText(""); setFile(null); setError(""); setBusy(true);
    try {
      const form = new FormData(); form.append("text", prompt); form.append("history", JSON.stringify(prior.slice(-10).map(({ role, content }) => ({ role, content })))); if (currentFile) form.append("file", currentFile);
      const response = await fetch(`${api}/help-desk/chat`, { method: "POST", credentials: "include", body: form });
      const result = await response.json(); if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join(" ") : result.message ?? "Jawab nahi mil saka.");
      setMessages([...next, { role: "assistant", content: result.reply, ...(result.notice ? { notice: result.notice } : {}) }]);
    } catch (reason) { setMessages(prior); setText(prompt); setFile(currentFile); setError(reason instanceof Error ? reason.message : "Ollama se rabta nahi ho saka."); }
    finally { setBusy(false); requestAnimationFrame(() => scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: "smooth" })); }
  }
  function voice() {
    const Speech = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
    if (!Speech) { setError("Is browser mein voice typing available nahi. Chrome ya Safari ke latest version mein try karein."); return; }
    setError(""); const recognition = new Speech(); recognition.lang = "ur-PK"; recognition.interimResults = false;
    recognition.onresult = (event) => { const transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" "); setText((value) => `${value}${value ? " " : ""}${transcript}`); };
    recognition.onerror = () => { setError("Mic se awaaz nahi mil saki. Browser microphone permission check karein."); setListening(false); };
    recognition.onend = () => setListening(false); setListening(true); recognition.start();
  }
  function speak(content: string) { window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(content)); }
  return <section className="panel help-desk-panel"><header className="help-desk-header"><span className="help-desk-bot"><Bot size={21}/></span><div><b>GharSync Help Desk</b><small>Ollama · {model}</small></div><span className={`help-desk-status ${configured ? "ready" : "unavailable"}`}>{configured ? "Model ready" : "Model unavailable"}</span></header>
    <div className="help-chat-messages" ref={scroll} aria-live="polite">{messages.length === 0 && <div className="help-chat-welcome"><span><Bot size={25}/></span><h2>Assalam-o-alaikum! Kis cheez mein madad chahiye?</h2><p>App ka feature, home service sawal, ya kisi image, PDF ya video ke bare mein pooch sakte hain.</p><div className="help-chat-prompts"><button type="button" onClick={() => setText("GharSync mein booking kaise banata hoon?")}>Booking kaise banayein?</button><button type="button" onClick={() => setText("Is attachment ko samjha kar batao.")}>File samjha dein</button></div></div>}{messages.map((message, index) => <article key={index} className={`help-chat-message ${message.role}`}>{message.role === "assistant" && <span className="help-message-avatar"><Bot size={15}/></span>}<div className="help-message-body">{message.fileName && <span className="help-attachment-pill"><Paperclip size={12}/>{message.fileName}</span>}<p>{message.content}</p>{message.notice && <small className="help-model-notice">{message.notice}</small>}{message.role === "assistant" && <button type="button" aria-label="Jawab suno" className="help-speak-button" onClick={() => speak(message.content)}><Volume2 size={13}/> Jawab suno</button>}</div></article>)}{busy && <div className="help-chat-thinking"><LoaderCircle className="spin" size={15}/> Ollama jawab tayar kar raha hai…</div>}</div>
    <form className="help-chat-composer" onSubmit={send}>{file && <div className="help-selected-file">{file.type.startsWith("image/") ? <ImageIcon size={14}/> : <FileText size={14}/>}<span>{file.name}</span><button type="button" aria-label="Attachment hataein" onClick={() => setFile(null)}><X size={14}/></button></div>}<textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Apna sawal likhein ya voice se bol kar likhwaein…" rows={2} maxLength={6000}/><div className="help-composer-actions"><input ref={picker} type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/webm,video/quicktime" onChange={(event) => { const selected = event.target.files?.[0]; if (selected && selected.size > 20 * 1024 * 1024) { setError("File 20 MB ya us se chhoti honi chahiye."); return; } setFile(selected ?? null); setError(""); }}/><button type="button" className="help-tool-button" onClick={() => picker.current?.click()} aria-label="Image, PDF ya video attach karein"><Paperclip size={16}/><span>Attach</span></button><button type="button" className={`help-tool-button ${listening ? "recording" : ""}`} onClick={voice} aria-label="Voice typing shuru karein"><Mic size={16}/><span>{listening ? "Sun raha hoon…" : "Voice"}</span></button><small>Image · PDF · Video · 20 MB tak</small><button className="button button-primary help-send-button" disabled={!configured || busy || (!text.trim() && !file)} title={configured ? "Send message" : "Start Ollama and install the configured model first"}><Send size={15}/></button></div>{!configured && <small className="help-model-notice">Ollama abhi available nahi. API server par Ollama chala kar `{model}` install karein.</small>}{error && <div className="form-error" role="alert">{error}</div>}</form><p className="help-chat-footnote">File analysis local Ollama model par hoti hai. Jawab AI se hain; zaroori faislay se pehle verify karein.</p>
  </section>;
}

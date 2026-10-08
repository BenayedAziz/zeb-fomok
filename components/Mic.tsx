'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';

type Mode = 'hf' | 'browser' | null;

/* Ce que le serveur sait faire, demandé une seule fois. */
let statusP: Promise<{ voice?: boolean }> | null = null;
type St = { voice?: boolean };
const serverStatus = (): Promise<St> => (statusP ??= fetch('/api/connect/status').then((r) => (r.ok ? (r.json() as Promise<St>) : {})).catch(() => ({})));

interface SpeechRec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
const SpeechCtor = () =>
  typeof window === 'undefined' ? null : ((window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition || null);

/**
 * Bouton micro. Avec une clé Hugging Face côté serveur : on enregistre puis Whisper transcrit.
 * Sinon : la reconnaissance vocale du navigateur (Chrome, Safari, Edge), en français.
 */
export function Mic({ onText, onError, className }: { onText: (t: string, final: boolean) => void; onError?: (m: string) => void; className?: string }) {
  const [mode, setMode] = useState<Mode>(null);
  const [state, setState] = useState<'idle' | 'rec' | 'busy'>('idle');
  const rec = useRef<MediaRecorder | null>(null);
  const sr = useRef<SpeechRec | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => {
    let alive = true;
    serverStatus().then((s) => {
      if (!alive) return;
      const canRecord = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
      setMode(s.voice && canRecord ? 'hf' : SpeechCtor() ? 'browser' : null);
    });
    return () => {
      alive = false;
      rec.current?.stream.getTracks().forEach((t) => t.stop());
      sr.current?.stop();
    };
  }, []);

  if (!mode) return null;

  const fail = (m: string) => {
    setState('idle');
    onError?.(m);
  };

  const startHf = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
      const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: (mr.mimeType || 'audio/webm').split(';')[0] });
        if (blob.size < 1200) return fail('Rien entendu. Garde le bouton actif pendant que tu parles.');
        setState('busy');
        try {
          let r = await fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob });
          if (r.status === 503) {
            await new Promise((ok) => setTimeout(ok, 4000));
            r = await fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob });
          }
          const b = await r.json().catch(() => ({}));
          if (!r.ok || !b.text) return fail(b.error === 'daily_limit' ? 'Limite du jour atteinte.' : "La transcription n'a pas marché. Réessaie ou tape ton texte.");
          onText(b.text, true);
          setState('idle');
        } catch {
          fail('Pas de connexion. Réessaie.');
        }
      };
      rec.current = mr;
      mr.start();
      setState('rec');
    } catch {
      fail("Autorise le micro dans ton navigateur pour dicter.");
    }
  };

  const startBrowser = () => {
    const C = SpeechCtor();
    if (!C) return;
    const r = new C();
    r.lang = 'fr-FR';
    r.interimResults = true;
    r.continuous = true;
    let finalTxt = '';
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalTxt += res[0].transcript;
        else interim += res[0].transcript;
      }
      onText((finalTxt + interim).trim(), false);
    };
    r.onerror = (e) => fail(e.error === 'not-allowed' ? 'Autorise le micro dans ton navigateur pour dicter.' : 'Dictée interrompue.');
    r.onend = () => {
      setState('idle');
      if (finalTxt.trim()) onText(finalTxt.trim(), true);
    };
    sr.current = r;
    r.start();
    setState('rec');
  };

  const toggle = () => {
    if (state === 'busy') return;
    if (state === 'rec') {
      if (mode === 'hf') rec.current?.stop();
      else sr.current?.stop();
      return;
    }
    if (mode === 'hf') startHf();
    else startBrowser();
  };

  const label = state === 'rec' ? 'Arrêter la dictée' : state === 'busy' ? 'Transcription…' : 'Dicter';
  return (
    <button type="button" className={`icon-btn mic${state !== 'idle' ? ` ${state}` : ''}${className ? ` ${className}` : ''}`} onClick={toggle} aria-label={label} title={label} aria-pressed={state === 'rec'}>
      {state === 'busy' ? <i className="spin" /> : <Icon name={state === 'rec' ? 'stop' : 'mic'} />}
    </button>
  );
}

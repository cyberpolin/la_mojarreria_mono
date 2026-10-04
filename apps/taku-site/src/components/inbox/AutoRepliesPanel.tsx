"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  type FaqAutoReply,
  type FaqAutoReplyIntent,
  fetchFaqAutoReplies,
  readCachedFaqAutoReplies,
  saveFaqAutoReply,
  upsertCachedFaqAutoReply,
} from "./autoReplies";
import { Button, Field, Input, Switch, TextArea } from "./ui";

function parsePhrase(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function addPhrase(phrases: string[], value: string) {
  const phrase = parsePhrase(value);
  if (!phrase) return phrases;
  const key = phrase.toLowerCase();
  if (phrases.some((item) => item.toLowerCase() === key)) return phrases;
  return [...phrases, phrase];
}

function AutoReplyCard({
  item,
  draftPhrase,
  saving,
  onDraftPhraseChange,
  onChange,
  onSave,
}: {
  item: FaqAutoReply;
  draftPhrase: string;
  saving: boolean;
  onDraftPhraseChange: (value: string) => void;
  onChange: (next: FaqAutoReply) => void;
  onSave: () => void;
}) {
  const submitPhrase = (event?: FormEvent) => {
    event?.preventDefault();
    const nextPhrases = addPhrase(item.phrases, draftPhrase);
    if (nextPhrases === item.phrases) return;
    onChange({ ...item, phrases: nextPhrases });
    onDraftPhraseChange("");
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="font-semibold text-slate-950">{item.title}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Si el cliente escribe alguna de estas frases, TAKU puede responder
            automaticamente.
          </p>
        </div>
        <div className="md:w-56">
          <Switch
            checked={item.enabled}
            label={item.enabled ? "Activa" : "Inactiva"}
            onChange={(enabled) => onChange({ ...item, enabled })}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <div className="grid gap-2">
          <p className="text-sm font-medium text-slate-700">
            Palabras clave o frases
          </p>
          <div className="flex flex-wrap gap-2">
            {item.phrases.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() =>
                  onChange({
                    ...item,
                    phrases: item.phrases.filter((row) => row !== phrase),
                  })
                }
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-3 text-sm text-slate-800 hover:border-slate-950"
              >
                <span>{phrase}</span>
                <span className="text-slate-400">×</span>
              </button>
            ))}
            {item.phrases.length === 0 ? (
              <p className="text-sm text-slate-500">
                Agrega al menos una frase para disparar esta respuesta.
              </p>
            ) : null}
          </div>
          <form
            onSubmit={submitPhrase}
            className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
          >
            <Field label="Agregar frase">
              <Input
                placeholder="Ej. cuanto cuesta el envio"
                value={draftPhrase}
                onChange={onDraftPhraseChange}
              />
            </Field>
            <Button
              type="submit"
              variant="secondary"
              disabled={!parsePhrase(draftPhrase)}
            >
              Agregar
            </Button>
          </form>
        </div>

        <Field
          label="Respuesta automatica"
          hint="Este texto se envia cuando un mensaje coincide con alguna frase."
        >
          <TextArea
            rows={5}
            placeholder="Escribe la respuesta que debe mandar TAKU."
            value={item.responseText}
            onChange={(responseText) => onChange({ ...item, responseText })}
          />
        </Field>

        <div>
          <Button disabled={saving} onClick={onSave}>
            {saving ? "Guardando..." : "Guardar respuesta"}
          </Button>
        </div>
      </div>
    </section>
  );
}

export function AutoRepliesPanel() {
  const [items, setItems] = useState<FaqAutoReply[]>(() =>
    readCachedFaqAutoReplies(),
  );
  const [drafts, setDrafts] = useState<Record<FaqAutoReplyIntent, string>>({
    horarios: "",
    ubicacion: "",
    envio: "",
  });
  const [savingIntent, setSavingIntent] = useState<FaqAutoReplyIntent | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchFaqAutoReplies()
      .then((next) => {
        if (!cancelled) setItems(next);
      })
      .catch((error) => {
        if (cancelled) return;
        setMessage(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las respuestas automaticas.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateItem = (next: FaqAutoReply) => {
    setItems(upsertCachedFaqAutoReply(next));
  };

  const saveItem = async (item: FaqAutoReply) => {
    setSavingIntent(item.intent);
    setMessage(null);
    try {
      const saved = await saveFaqAutoReply(item.intent, {
        phrases: item.phrases,
        responseText: item.responseText,
        enabled: item.enabled,
      });
      setItems(upsertCachedFaqAutoReply(saved));
      setMessage(`Respuesta de ${saved.title.toLowerCase()} guardada.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la respuesta automatica.",
      );
    } finally {
      setSavingIntent(null);
    }
  };

  return (
    <div className="grid gap-6">
      <p className="text-sm leading-6 text-slate-600">
        Estas son las mismas banderas del inbox: horarios, ubicacion y costos de
        envio. Cada una tiene frases que detectan la pregunta y una respuesta
        automatica.
      </p>
      {message ? (
        <div className="rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}
      {items.map((item) => (
        <AutoReplyCard
          key={item.intent}
          item={item}
          draftPhrase={drafts[item.intent]}
          saving={savingIntent === item.intent}
          onDraftPhraseChange={(value) =>
            setDrafts((current) => ({ ...current, [item.intent]: value }))
          }
          onChange={updateItem}
          onSave={() => void saveItem(item)}
        />
      ))}
    </div>
  );
}
